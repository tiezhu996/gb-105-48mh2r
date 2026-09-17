import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = Router()

function isConstraintError(error: any) {
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === 2067
}

// 重新计算用户评分（事务内调用）
function refreshUserRating(revieweeId: number) {
  const reviews: any[] = db
    .prepare('SELECT rating FROM reviews WHERE reviewee_id = ?')
    .all(revieweeId) as any[]

  const total = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0)
  const avg = reviews.length > 0 ? total / reviews.length : 0

  db.prepare('UPDATE users SET rating = ?, review_count = ? WHERE id = ?').run(
    Math.round(avg * 10) / 10,
    reviews.length,
    revieweeId,
  )
}

router.post(
  '/',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { order_id, reviewee_id, rating, comment } = req.body
      const reviewerId = req.user!.id

      if (!order_id || !reviewee_id || !Number.isInteger(rating)) {
        res.status(400).json({ success: false, error: '参数不完整' })
        return
      }

      if (rating < 1 || rating > 5) {
        res.status(400).json({ success: false, error: '评分范围1-5' })
        return
      }

      const tx = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id)
        if (!order) return { code: 404, error: '订单不存在' }
        if (order.status !== 'completed') return { code: 400, error: '交易完成后才能评价' }

        const isBuyer = order.buyer_id === reviewerId
        const isSeller = order.seller_id === reviewerId
        if (!isBuyer && !isSeller) return { code: 403, error: '无权限评价此交易' }

        // 被评价人必须是交易的另一方
        const counterpartyId = isBuyer ? order.seller_id : order.buyer_id
        if (Number(reviewee_id) !== counterpartyId) {
          return { code: 400, error: '只能评价交易对方' }
        }

        const existing = db
          .prepare('SELECT id FROM reviews WHERE order_id = ? AND reviewer_id = ?')
          .get(order_id, reviewerId)
        if (existing) return { code: 400, error: '你已评价过此交易' }

        db.prepare(
          'INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
        ).run(order_id, reviewerId, reviewee_id, rating, (comment || '').trim())

        refreshUserRating(Number(reviewee_id))
        return { code: 201 }
      })

      const outcome: any = tx()
      if (outcome.error) {
        res.status(outcome.code).json({ success: false, error: outcome.error })
        return
      }
      res.status(201).json({ success: true, message: '评价成功' })
    } catch (error: any) {
      if (isConstraintError(error)) {
        res.status(400).json({ success: false, error: '你已评价过此交易' })
        return
      }
      console.error(error)
      res.status(500).json({ success: false, error: '评价失败' })
    }
  },
)

// 用户收到的评价（个人主页展示）
router.get('/user/:userId', (req: Request, res: Response): void => {
  try {
    const { userId } = req.params

    const reviews = db
      .prepare(
        `
        SELECT r.*, u.username as reviewer_name, u.avatar as reviewer_avatar,
               o.type as order_type, p.id as product_id, p.name as product_name,
               p.category, p.photos
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        JOIN orders o ON r.order_id = o.id
        JOIN products p ON o.product_id = p.id
        WHERE r.reviewee_id = ?
        ORDER BY r.created_at DESC
      `,
      )
      .all(userId)

    res.json({
      success: true,
      data: (reviews as any[]).map((r) => ({
        ...r,
        photos: JSON.parse(r.photos || '[]'),
      })),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取评价失败' })
  }
})

// 批量查询当前用户对若干订单的评价（个人中心一次性判断"评价/已评价"）
router.get(
  '/by-orders',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const raw = String(req.query.ids || '')
      const ids = raw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 100)

      if (ids.length === 0) {
        res.json({ success: true, data: {} })
        return
      }

      const placeholders = ids.map(() => '?').join(',')
      const rows = db
        .prepare(
          `SELECT * FROM reviews WHERE reviewer_id = ? AND order_id IN (${placeholders})`,
        )
        .all(req.user!.id, ...ids)

      const map: Record<number, any> = {}
      for (const r of rows as any[]) {
        map[r.order_id] = r
      }
      res.json({ success: true, data: map })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取评价失败' })
    }
  },
)

// 当前用户在某订单中的评价
router.get(
  '/order/:orderId',
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { orderId } = req.params

      const review = db
        .prepare('SELECT * FROM reviews WHERE order_id = ? AND reviewer_id = ?')
        .get(orderId, req.user!.id)

      res.json({ success: true, data: review || null })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取评价失败' })
    }
  },
)

export default router
