import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = Router()

/**
 * 评价订单：交易完成后，买卖双方各可评价对方一次。
 * 唯一性由数据库索引 (order_id, reviewer_id) + 事务共同保证，重复提交不会产生第二条。
 */
router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id
      const { order_id, reviewee_id, rating, comment } = req.body

      if (!order_id || !reviewee_id || !rating) {
        res.status(400).json({ success: false, error: '参数不完整' })
        return
      }

      const ratingNum = Number(rating)
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({ success: false, error: '评分范围1-5星' })
        return
      }

      const result = db.transaction(() => {
        const order: any = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id)
        if (!order) return { code: 404, error: '订单不存在' }

        if (order.status !== 'completed') {
          return { code: 400, error: '交易完成后才能评价' }
        }

        if (order.buyer_id !== userId && order.seller_id !== userId) {
          return { code: 403, error: '无权限评价该订单' }
        }

        // 被评价人必须是本订单的交易对手，且不能评价自己
        const counterparties = [order.buyer_id, order.seller_id]
        if (reviewee_id === userId || !counterparties.includes(Number(reviewee_id))) {
          return { code: 400, error: '只能评价本订单的交易对方' }
        }

        const existing = db
          .prepare('SELECT id FROM reviews WHERE order_id = ? AND reviewer_id = ?')
          .get(order_id, userId)
        if (existing) {
          return { code: 409, error: '您已评价过此订单，不能重复评价' }
        }

        db.prepare(
          'INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
        ).run(order_id, userId, Number(reviewee_id), ratingNum, (comment || '').trim())

        const agg: any = db
          .prepare(
            'SELECT COUNT(*) AS cnt, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE reviewee_id = ?',
          )
          .get(Number(reviewee_id))

        db.prepare('UPDATE users SET rating = ?, review_count = ? WHERE id = ?').run(
          Number(agg.avg).toFixed(1),
          agg.cnt,
          Number(reviewee_id),
        )

        return { code: 201 }
      })()

      if (result.code !== 201) {
        res.status(result.code).json({ success: false, error: result.error })
        return
      }

      res.status(201).json({ success: true, message: '评价成功' })
    } catch (error: any) {
      if (String(error?.message || '').includes('UNIQUE constraint failed')) {
        res.status(409).json({ success: false, error: '您已评价过此订单，不能重复评价' })
        return
      }
      console.error(error)
      res.status(500).json({ success: false, error: '评价失败' })
    }
  },
)

/** 用户主页收到的评价列表 */
router.get(
  '/user/:userId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params

      const reviews = db
        .prepare(
          `SELECT r.*, u.username as reviewer_name, u.avatar as reviewer_avatar
           FROM reviews r
           JOIN users u ON r.reviewer_id = u.id
           WHERE r.reviewee_id = ?
           ORDER BY r.created_at DESC`,
        )
        .all(userId)

      res.json({ success: true, data: reviews })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取评价失败' })
    }
  },
)

/** 我在某笔订单中是否已评价（前端决定显示「评价」还是「已评价」） */
router.get(
  '/order/:orderId',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
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
