import { Router, type Response } from 'express'
import db from '../db/index.js'
import { ACTIVE_ORDER_STATUSES } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const ORDER_SELECT = `
  SELECT o.*, p.name as product_name, p.description as product_description,
         p.photos, p.ip_name, p.character_name, p.category, p.condition,
         p.status as product_status,
         buyer.username as buyer_name, buyer.avatar as buyer_avatar,
         seller.username as seller_name, seller.avatar as seller_avatar
  FROM orders o
  JOIN products p ON o.product_id = p.id
  JOIN users buyer ON o.buyer_id = buyer.id
  JOIN users seller ON o.seller_id = seller.id
`

function parseOrder(o: any) {
  return { ...o, photos: JSON.parse(o.photos || '[]') }
}

function isConstraintError(error: any) {
  // better-sqlite3 UNIQUE 约束冲突
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === 2067
}

/**
 * 创建交易
 * - buy: 直接进入 pending（待发货）
 * - exchange: 进入 exchange_pending（待卖家确认），可携带交换说明
 * 同一商品只允许一个进行中的交易：先在事务内 SELECT 检查，
 * 再由部分唯一索引 idx_orders_product_active 兜底，杜绝并发重复下单。
 */
router.post(
  '/',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { product_id, type, exchange_offer } = req.body
      const buyerId = req.user!.id

      if (!product_id || !['buy', 'exchange'].includes(type)) {
        res.status(400).json({ success: false, error: '参数不完整' })
        return
      }

      const createTx = db.transaction(() => {
        const product: any = db
          .prepare('SELECT * FROM products WHERE id = ?')
          .get(product_id)

        if (!product) {
          return { code: 404, error: '商品不存在' }
        }
        if (product.status !== 'active') {
          return { code: 400, error: '该商品已有进行中的交易或已下架' }
        }
        if (product.seller_id === buyerId) {
          return { code: 400, error: '不能和自己交易' }
        }

        const active: any = db
          .prepare(
            `SELECT id FROM orders WHERE product_id = ?
             AND status IN (${ACTIVE_ORDER_STATUSES.map(() => '?').join(',')})
             LIMIT 1`,
          )
          .get(product_id, ...ACTIVE_ORDER_STATUSES)
        if (active) {
          return { code: 409, error: '该商品已有进行中的交易，请勿重复操作' }
        }

        const newStatus = type === 'exchange' ? 'exchange_pending' : 'pending'
        const offer = type === 'exchange' ? (exchange_offer || '').trim() : ''

        const result = db
          .prepare(
            `INSERT INTO orders (product_id, buyer_id, seller_id, price, type, status, exchange_offer)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(product_id, buyerId, product.seller_id, product.price, type, newStatus, offer)

        // 锁定商品：首页不再展示，其他人无法下单
        db.prepare("UPDATE products SET status = 'reserved' WHERE id = ? AND status = 'active'").run(
          product_id,
        )

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid)
        return { code: 201, order }
      })

      const outcome: any = createTx()

      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }

      res.status(201).json({ success: true, data: outcome.order })
    } catch (error: any) {
      if (isConstraintError(error)) {
        res.status(409).json({ success: false, error: '该商品已有进行中的交易，请勿重复操作' })
        return
      }
      console.error(error)
      res.status(500).json({ success: false, error: '创建交易失败' })
    }
  },
)

// 卖家接受交换：exchange_pending -> pending
router.put(
  '/:id/accept',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { id } = req.params
      const userId = req.user!.id

      const tx = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
        if (!order) return { code: 404, error: '订单不存在' }
        if (order.seller_id !== userId) return { code: 403, error: '只有卖家可以操作' }
        if (order.status !== 'exchange_pending') {
          return { code: 400, error: '当前状态下不能接受交换' }
        }
        const result = db
          .prepare("UPDATE orders SET status = 'pending' WHERE id = ? AND status = 'exchange_pending'")
          .run(id)
        if (result.changes === 0) return { code: 409, error: '操作冲突，请刷新后重试' }
        return { code: 200 }
      })

      const outcome: any = tx()
      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }
      res.json({ success: true, message: '已接受交换，等待卖家发货' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '操作失败' })
    }
  },
)

// 卖家拒绝交换：exchange_pending -> rejected，商品恢复在售
router.put(
  '/:id/reject',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { id } = req.params
      const userId = req.user!.id

      const tx = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
        if (!order) return { code: 404, error: '订单不存在' }
        if (order.seller_id !== userId) return { code: 403, error: '只有卖家可以操作' }
        if (order.status !== 'exchange_pending') {
          return { code: 400, error: '当前状态下不能拒绝交换' }
        }
        const result = db
          .prepare("UPDATE orders SET status = 'rejected' WHERE id = ? AND status = 'exchange_pending'")
          .run(id)
        if (result.changes === 0) return { code: 409, error: '操作冲突，请刷新后重试' }
        db.prepare("UPDATE products SET status = 'active' WHERE id = ? AND status = 'reserved'").run(
          order.product_id,
        )
        return { code: 200 }
      })

      const outcome: any = tx()
      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }
      res.json({ success: true, message: '已拒绝交换请求' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '操作失败' })
    }
  },
)

// 取消交易：买家在发货前可取消；exchange_pending 阶段卖家也可取消
router.put(
  '/:id/cancel',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { id } = req.params
      const userId = req.user!.id

      const tx = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
        if (!order) return { code: 404, error: '订单不存在' }

        const isBuyer = order.buyer_id === userId
        const isSeller = order.seller_id === userId
        if (!isBuyer && !isSeller) return { code: 403, error: '无权限操作' }

        const buyerCancelable = isBuyer && ['exchange_pending', 'pending'].includes(order.status)
        const sellerCancelable = isSeller && order.status === 'exchange_pending'
        if (!buyerCancelable && !sellerCancelable) {
          return { code: 400, error: '当前状态下不能取消' }
        }

        const result = db
          .prepare(
            `UPDATE orders SET status = 'cancelled'
             WHERE id = ? AND status IN ('exchange_pending', 'pending')`,
          )
          .run(id)
        if (result.changes === 0) return { code: 409, error: '操作冲突，请刷新后重试' }

        db.prepare("UPDATE products SET status = 'active' WHERE id = ? AND status = 'reserved'").run(
          order.product_id,
        )
        return { code: 200 }
      })

      const outcome: any = tx()
      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }
      res.json({ success: true, message: '交易已取消' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '取消失败' })
    }
  },
)

// 卖家发货：pending -> shipped
router.put(
  '/:id/ship',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { id } = req.params
      const userId = req.user!.id

      const tx = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
        if (!order) return { code: 404, error: '订单不存在' }
        if (order.seller_id !== userId) return { code: 403, error: '只有卖家可以发货' }
        if (order.status !== 'pending') return { code: 400, error: '当前状态下不能发货' }

        const result = db
          .prepare("UPDATE orders SET status = 'shipped' WHERE id = ? AND status = 'pending'")
          .run(id)
        if (result.changes === 0) return { code: 409, error: '操作冲突，请刷新后重试' }
        return { code: 200 }
      })

      const outcome: any = tx()
      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }
      res.json({ success: true, message: '发货成功' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '发货失败' })
    }
  },
)

// 买家确认收货：shipped -> completed，商品标记已售出
router.put(
  '/:id/receive',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { id } = req.params
      const userId = req.user!.id

      const tx = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
        if (!order) return { code: 404, error: '订单不存在' }
        if (order.buyer_id !== userId) return { code: 403, error: '只有买家可以确认收货' }
        if (order.status !== 'shipped') return { code: 400, error: '当前状态下不能确认收货' }

        const result = db
          .prepare("UPDATE orders SET status = 'completed' WHERE id = ? AND status = 'shipped'")
          .run(id)
        if (result.changes === 0) return { code: 409, error: '操作冲突，请刷新后重试' }

        db.prepare("UPDATE products SET status = 'sold' WHERE id = ?").run(order.product_id)
        return { code: 200 }
      })

      const outcome: any = tx()
      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }
      res.json({ success: true, message: '确认收货成功，交易完成' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '确认收货失败' })
    }
  },
)

router.get('/buyer', authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const orders = db
      .prepare(`${ORDER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC`)
      .all(req.user!.id)
    res.json({ success: true, data: (orders as any[]).map(parseOrder) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取订单失败' })
  }
})

router.get('/seller', authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const orders = db
      .prepare(`${ORDER_SELECT} WHERE o.seller_id = ? ORDER BY o.created_at DESC`)
      .all(req.user!.id)
    res.json({ success: true, data: (orders as any[]).map(parseOrder) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取订单失败' })
  }
})

// 当前用户在某商品上的进行中交易（详情页按钮区用）
router.get(
  '/product/:productId/mine',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const order: any = db
        .prepare(
          `${ORDER_SELECT} WHERE o.product_id = ? AND (o.buyer_id = ? OR o.seller_id = ?)
           ORDER BY o.created_at DESC LIMIT 1`,
        )
        .get(req.params.productId, req.user!.id, req.user!.id)

      res.json({ success: true, data: order ? parseOrder(order) : null })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取交易信息失败' })
    }
  },
)

router.get('/:id', authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params

    const order: any = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id)

    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' })
      return
    }

    if (order.buyer_id !== req.user!.id && order.seller_id !== req.user!.id) {
      res.status(403).json({ success: false, error: '无权限查看' })
      return
    }

    res.json({ success: true, data: parseOrder(order) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取订单详情失败' })
  }
})

export default router
