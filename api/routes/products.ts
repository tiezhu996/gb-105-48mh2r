import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'
import { authenticateToken, optionalAuth, type AuthRequest } from '../middleware/auth.js'
import { ACTIVE_ORDER_STATUSES } from '../db/index.js'

const router = Router()

const CATEGORIES = ['figure', 'badge', 'card', 'poster', 'book', 'clothing', 'other']
const CONDITIONS = ['new', 'like_new', 'good', 'fair']

function parseProduct(p: any) {
  return { ...p, photos: JSON.parse(p.photos || '[]') }
}

// 首页瀑布流：只展示在售（无进行中交易）的商品
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, ip, character } = req.query

    let query = `
      SELECT p.*, u.username as seller_name, u.avatar as seller_avatar,
             u.rating as seller_rating, u.review_count as seller_review_count
      FROM products p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = 'active'
    `
    const params: any[] = []

    if (search) {
      query +=
        ' AND (p.ip_name LIKE ? OR p.character_name LIKE ? OR p.name LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    if (category && category !== 'all') {
      query += ' AND p.category = ?'
      params.push(category)
    }

    if (ip) {
      query += ' AND p.ip_name LIKE ?'
      params.push(`%${ip}%`)
    }

    if (character) {
      query += ' AND p.character_name LIKE ?'
      params.push(`%${character}%`)
    }

    query += ' ORDER BY p.created_at DESC'

    const products = db.prepare(query).all(...params)

    res.json({
      success: true,
      data: (products as any[]).map(parseProduct),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取商品列表失败' })
  }
})

// 热门 IP 搜索建议
router.get('/meta/ips', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = db
      .prepare(
        `SELECT ip_name as name, COUNT(*) as count
         FROM products WHERE status = 'active' AND ip_name != ''
         GROUP BY ip_name ORDER BY count DESC, name ASC LIMIT 20`,
      )
      .all()
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取IP列表失败' })
  }
})

// 我的发布
router.get(
  '/user/my',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const products = db
        .prepare(
          `SELECT p.*,
                  (SELECT id FROM orders o WHERE o.product_id = p.id
                    AND o.status IN (${ACTIVE_ORDER_STATUSES.map(() => '?').join(',')})
                    LIMIT 1) as active_order_id
           FROM products p
           WHERE p.seller_id = ? AND p.status != 'offline'
           ORDER BY p.created_at DESC`,
        )
        .all(...ACTIVE_ORDER_STATUSES, req.user?.id)

      res.json({
        success: true,
        data: (products as any[]).map(parseProduct),
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取我的发布失败' })
    }
  },
)

// 某卖家的公开主页商品（在售 + 交易中 + 已售出，不含下架）
router.get(
  '/seller/:userId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params
      const products = db
        .prepare(
          `SELECT p.* FROM products p
           WHERE p.seller_id = ? AND p.status != 'offline'
           ORDER BY p.created_at DESC`,
        )
        .all(userId)

      res.json({
        success: true,
        data: (products as any[]).map(parseProduct),
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取卖家商品失败' })
    }
  },
)

// 商品详情：附带进行中的订单摘要，供前端按身份渲染
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const product: any = db
      .prepare(
        `
        SELECT p.*, u.username as seller_name, u.avatar as seller_avatar,
               u.rating as seller_rating, u.review_count as seller_review_count
        FROM products p
        JOIN users u ON p.seller_id = u.id
        WHERE p.id = ?
      `,
      )
      .get(id)

    if (!product) {
      res.status(404).json({ success: false, error: '商品不存在' })
      return
    }

    const activeOrder: any = db
      .prepare(
        `SELECT id, buyer_id, seller_id, type, status, created_at
         FROM orders WHERE product_id = ?
         AND status IN (${ACTIVE_ORDER_STATUSES.map(() => '?').join(',')})
         LIMIT 1`,
      )
      .get(id, ...ACTIVE_ORDER_STATUSES)

    res.json({
      success: true,
      data: {
        ...parseProduct(product),
        active_order: activeOrder || null,
        is_owner: product.seller_id === req.user?.id,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取商品详情失败' })
  }
})

router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        name,
        description,
        ip_name,
        character_name,
        category,
        condition,
        price,
        exchange_intent,
        photos,
      } = req.body

      if (
        !name || typeof name !== 'string' || name.trim().length > 100 ||
        !ip_name ||
        !CATEGORIES.includes(category) ||
        !CONDITIONS.includes(condition)
      ) {
        res.status(400).json({ success: false, error: '请填写完整且合法的商品信息' })
        return
      }

      const priceNum = Number(price)
      if (!Number.isFinite(priceNum) || priceNum < 0 || priceNum > 1_000_000) {
        res.status(400).json({ success: false, error: '价格不合法' })
        return
      }

      if (!Array.isArray(photos) || photos.length === 0 || photos.length > 6) {
        res.status(400).json({ success: false, error: '请上传1-6张商品照片' })
        return
      }

      const result = db
        .prepare(
          `
          INSERT INTO products (seller_id, name, description, ip_name, character_name, category, condition, price, exchange_intent, photos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          req.user?.id,
          name.trim(),
          (description || '').trim(),
          ip_name.trim(),
          (character_name || '').trim(),
          category,
          condition,
          priceNum,
          (exchange_intent || '').trim(),
          JSON.stringify(photos),
        )

      const product = db
        .prepare('SELECT * FROM products WHERE id = ?')
        .get(result.lastInsertRowid)

      res.status(201).json({ success: true, data: parseProduct(product) })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '发布商品失败' })
    }
  },
)

// 上架 / 下架（进行中的交易存在时不允许下架）
router.put(
  '/:id/status',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const { status } = req.body

      if (!['active', 'offline'].includes(status)) {
        res.status(400).json({ success: false, error: '状态不合法' })
        return
      }

      const product: any = db
        .prepare('SELECT * FROM products WHERE id = ?')
        .get(id)

      if (!product) {
        res.status(404).json({ success: false, error: '商品不存在' })
        return
      }

      if (product.seller_id !== req.user?.id) {
        res.status(403).json({ success: false, error: '无权限操作' })
        return
      }

      if (status === 'offline') {
        if (product.status === 'sold') {
          res.status(400).json({ success: false, error: '已售出商品不能下架' })
          return
        }
        const active: any = db
          .prepare(
            `SELECT id FROM orders WHERE product_id = ?
             AND status IN (${ACTIVE_ORDER_STATUSES.map(() => '?').join(',')}) LIMIT 1`,
          )
          .get(id, ...ACTIVE_ORDER_STATUSES)
        if (active) {
          res.status(400).json({ success: false, error: '该商品有进行中的交易，无法下架' })
          return
        }
      }

      db.prepare('UPDATE products SET status = ? WHERE id = ?').run(status, id)

      res.json({ success: true, message: '状态更新成功' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '更新状态失败' })
    }
  },
)

export default router
