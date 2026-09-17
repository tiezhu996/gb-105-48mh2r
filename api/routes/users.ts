import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'

const router = Router()

/** 公开用户主页：资料 + 在售商品 + 收到的评价 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const user: any = db
      .prepare(
        `SELECT id, username, avatar, bio, rating, review_count, created_at
         FROM users WHERE id = ?`,
      )
      .get(id)

    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' })
      return
    }

    const products = (db
      .prepare(
        `SELECT id, name, price, photos, ip_name, character_name, category, status, created_at
         FROM products WHERE seller_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 12`,
      )
      .all(id) as any[]).map((p) => ({ ...p, photos: JSON.parse(p.photos) }))

    const reviews = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at,
                u.username as reviewer_name, u.avatar as reviewer_avatar
         FROM reviews r JOIN users u ON r.reviewer_id = u.id
         WHERE r.reviewee_id = ?
         ORDER BY r.created_at DESC`,
      )
      .all(id)

    res.json({ success: true, data: { ...user, products, reviews } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取用户主页失败' })
  }
})

export default router
