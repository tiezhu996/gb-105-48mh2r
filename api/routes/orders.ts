import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = Router()

/** 进行中的订单状态（同一商品同时只允许一个） */
const ACTIVE_STATUSES = ['pending', 'shipped', 'exchanging']

interface OrderRow {
  id: number
  product_id: number
  buyer_id: number
  seller_id: number
  price: number
  type: string
  exchange_offer: string
  status: string
  created_at: string
}

function getActiveOrder(productId: number): OrderRow | undefined {
  return db
    .prepare(
      `SELECT * FROM orders
       WHERE product_id = ? AND status IN ('pending', 'shipped', 'exchanging')
       ORDER BY id DESC LIMIT 1`,
    )
    .get(productId) as OrderRow | undefined
}

/**
 * 创建订单（立即购买 / 发起交换）
 * 关键并发约束：同一商品只能存在一个进行中的交易。
 * 通过事务 + 商品行条件更新（active -> reserved）+ 数据库唯一索引三重保证，
 * 重复点击或并发请求不会产生冲突订单，只有一个请求成功。
 */
router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id
      const { product_id, type, price, exchange_offer } = req.body

      if (!product_id || !type || !['buy', 'exchange'].includes(type)) {
        res.status(400).json({ success: false, error: '参数不完整' })
        return
      }

      if (type === 'exchange' && !(exchange_offer || '').trim()) {
        res.status(400).json({ success: false, error: '请填写交换意向（想换什么）' })
        return
      }

      const result = db.transaction(() => {
        const product: any = db
          .prepare('SELECT * FROM products WHERE id = ?')
          .get(product_id)

        if (!product) {
          return { code: 404, error: '商品不存在' }
        }

        if (product.seller_id === userId) {
          return { code: 400, error: '不能对自己的商品发起交易' }
        }

        if (product.status !== 'active') {
          const active = getActiveOrder(product.id)
          if (active) {
            return {
              code: 409,
              error:
                active.type === 'exchange'
                  ? '该商品已有进行中的交换请求'
                  : '该商品已有进行中的订单',
              orderId: active.id,
            }
          }
          return { code: 400, error: '商品当前不可购买' }
        }

        // 条件更新：只有仍是 active 才能抢占成功。
        // SQLite 写事务串行执行，并发请求中只有一个 changes === 1。
        const lock = db
          .prepare("UPDATE products SET status = 'reserved' WHERE id = ? AND status = 'active'")
          .run(product_id)

        if (lock.changes === 0) {
          return { code: 409, error: '手慢了，该商品已被他人抢先下单' }
        }

        const initialStatus = type === 'buy' ? 'pending' : 'exchanging'
        const insert = db
          .prepare(
            `INSERT INTO orders (product_id, buyer_id, seller_id, price, type, exchange_offer, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            product_id,
            userId,
            product.seller_id,
            type === 'buy' ? product.price : price || product.price,
            type,
            type === 'exchange' ? exchange_offer.trim() : '',
            initialStatus,
          )

        const order = db
          .prepare('SELECT * FROM orders WHERE id = ?')
          .get(insert.lastInsertRowid)
        return { code: 201, order }
      })()

      if (result.code !== 201) {
        res.status(result.code).json({
          success: false,
          error: result.error,
          data: result.orderId ? { order_id: result.orderId } : undefined,
        })
        return
      }

      res.status(201).json({ success: true, data: result.order })
    } catch (error: any) {
      // 唯一索引兜底：并发下重复落库会在这里被拒绝
      if (String(error?.message || '').includes('UNIQUE constraint failed')) {
        res.status(409).json({ success: false, error: '该商品已有进行中的交易，请勿重复下单' })
        return
      }
      console.error(error)
      res.status(500).json({ success: false, error: '创建订单失败' })
    }
  },
)

/** 组装订单列表的公共查询 */
function queryOrders(role: 'buyer' | 'seller', userId: number) {
  const counterparty = role === 'buyer' ? 'seller' : 'buyer'
  const rows = db
    .prepare(
      `SELECT o.*, p.name as product_name, p.ip_name, p.character_name, p.photos,
              u.username as ${counterparty}_name,
              cr.reviewer_id IS NOT NULL as my_reviewed,
              cr2.reviewer_id IS NOT NULL as peer_reviewed
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users u ON o.${counterparty}_id = u.id
       LEFT JOIN reviews cr ON cr.order_id = o.id AND cr.reviewer_id = ?
       LEFT JOIN reviews cr2 ON cr2.order_id = o.id AND cr2.reviewer_id = o.${counterparty}_id
       WHERE o.${role}_id = ?
       ORDER BY o.created_at DESC`,
    )
    .all(userId, userId) as any[]

  return rows.map((o) => ({
    ...o,
    photos: JSON.parse(o.photos),
    my_reviewed: !!o.my_reviewed,
    peer_reviewed: !!o.peer_reviewed,
  }))
}

router.get(
  '/buyer',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json({ success: true, data: queryOrders('buyer', req.user!.id) })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取订单失败' })
    }
  },
)

router.get(
  '/seller',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json({ success: true, data: queryOrders('seller', req.user!.id) })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取订单失败' })
    }
  },
)

/** 通用的「按身份 + 当前状态推进订单」方法，重复/越权请求一律幂等拒绝 */
function advanceOrder(params: {
  orderId: number
  userId: number
  asRole: 'buyer' | 'seller'
  fromStatuses: string[]
  toStatus: string
}) {
  const { orderId, userId, asRole, fromStatuses, toStatus } = params
  return db.transaction(() => {
    const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return { code: 404, error: '订单不存在' }
    if (order[`${asRole}_id`] !== userId) return { code: 403, error: '无权限操作' }
    if (!fromStatuses.includes(order.status)) {
      return { code: 409, error: '订单状态已变化，请刷新后重试', current: order.status }
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(toStatus, orderId)
    return { code: 200, order: { ...order, status: toStatus } }
  })()
}

/** 卖家：接受交换请求（exchanging -> pending），随后进入正常发货流程 */
router.put(
  '/:id/accept-exchange',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const r = advanceOrder({
        orderId: Number(req.params.id),
        userId: req.user!.id,
        asRole: 'seller',
        fromStatuses: ['exchanging'],
        toStatus: 'pending',
      })
      if (r.code !== 200) {
        res.status(r.code).json({ success: false, error: r.error })
        return
      }
      res.json({ success: true, message: '已接受交换请求，等待您发货' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '操作失败' })
    }
  },
)

/** 任一方：取消进行中的交易（仅未发货前），释放商品回首页 */
function cancelOrder(orderId: number, userId: number) {
  return db.transaction(() => {
    const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return { code: 404, error: '订单不存在' }
    if (order.buyer_id !== userId && order.seller_id !== userId) {
      return { code: 403, error: '无权限操作' }
    }
    if (!['exchanging', 'pending'].includes(order.status)) {
      return { code: 409, error: '订单已发货，无法取消' }
    }
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId)
    // 释放商品：仅当还指向本订单的保留状态时才恢复，避免误伤
    db.prepare(
      "UPDATE products SET status = 'active' WHERE id = ? AND status = 'reserved'",
    ).run(order.product_id)
    return { code: 200 }
  })()
}

router.put(
  '/:id/cancel',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const r = cancelOrder(Number(req.params.id), req.user!.id)
      if (r.code !== 200) {
        res.status(r.code).json({ success: false, error: r.error })
        return
      }
      res.json({ success: true, message: '交易已取消，商品重新上架' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '操作失败' })
    }
  },
)

/** 卖家发货（pending -> shipped） */
router.put(
  '/:id/ship',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const r = advanceOrder({
        orderId: Number(req.params.id),
        userId: req.user!.id,
        asRole: 'seller',
        fromStatuses: ['pending'],
        toStatus: 'shipped',
      })
      if (r.code !== 200) {
        res.status(r.code).json({ success: false, error: r.error })
        return
      }
      res.json({ success: true, message: '发货成功' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '发货失败' })
    }
  },
)

/** 买家确认收货（shipped -> completed），商品标记已售出 */
router.put(
  '/:id/receive',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const orderId = Number(req.params.id)
      const r = db.transaction(() => {
        const out = advanceOrder({
          orderId,
          userId: req.user!.id,
          asRole: 'buyer',
          fromStatuses: ['shipped'],
          toStatus: 'completed',
        })
        if (out.code !== 200) return out
        db.prepare("UPDATE products SET status = 'sold' WHERE id = ?").run(
          (out.order as any).product_id,
        )
        return out
      })()
      if (r.code !== 200) {
        res.status(r.code).json({ success: false, error: r.error })
        return
      }
      res.json({ success: true, message: '确认收货成功，交易完成' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '确认收货失败' })
    }
  },
)

router.get(
  '/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params

      const order: any = db
        .prepare(
          `SELECT o.*, p.name as product_name, p.description as product_description,
                  p.photos, p.ip_name, p.character_name, p.category, p.condition,
                  buyer.username as buyer_name, buyer.avatar as buyer_avatar,
                  seller.username as seller_name, seller.avatar as seller_avatar,
                  rb.rating as buyer_review_rating, rb.comment as buyer_review_comment,
                  rs.rating as seller_review_rating, rs.comment as seller_review_comment
           FROM orders o
           JOIN products p ON o.product_id = p.id
           JOIN users buyer ON o.buyer_id = buyer.id
           JOIN users seller ON o.seller_id = seller.id
           LEFT JOIN reviews rb ON rb.order_id = o.id AND rb.reviewer_id = o.buyer_id
           LEFT JOIN reviews rs ON rs.order_id = o.id AND rs.reviewer_id = o.seller_id
           WHERE o.id = ?`,
        )
        .get(id)

      if (!order) {
        res.status(404).json({ success: false, error: '订单不存在' })
        return
      }

      if (order.buyer_id !== req.user!.id && order.seller_id !== req.user!.id) {
        res.status(403).json({ success: false, error: '无权限查看' })
        return
      }

      order.photos = JSON.parse(order.photos)

      res.json({ success: true, data: order })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取订单详情失败' })
    }
  },
)

export default router
