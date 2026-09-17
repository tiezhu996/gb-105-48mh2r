import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const CATEGORY_WHITELIST = [
  'figure',
  'badge',
  'card',
  'poster',
  'book',
  'clothing',
  'other',
]
const CONDITION_WHITELIST = ['new', 'like_new', 'good', 'fair']

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category } = req.query

    let query = `
      SELECT p.*, u.username as seller_name, u.avatar as seller_avatar, u.rating as seller_rating
      FROM products p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = 'active'
    `
    const params: any[] = []

    if (search) {
      // 首页搜索：按 IP 名 / 角色名 / 商品名模糊匹配
      query += ' AND (p.ip_name LIKE ? OR p.character_name LIKE ? OR p.name LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    if (category && category !== 'all') {
      query += ' AND p.category = ?'
      params.push(category)
    }

    query += ' ORDER BY p.created_at DESC'

    const products = db.prepare(query).all(...params)

    res.json({
      success: true,
      data: products.map((p: any) => ({
        ...p,
        photos: JSON.parse(p.photos),
      })),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: '获取商品列表失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const product: any = db
      .prepare(
        `SELECT p.*, u.username as seller_name, u.avatar as seller_avatar,
                u.rating as seller_rating, u.review_count as seller_review_count, u.bio as seller_bio
         FROM products p
         JOIN users u ON p.seller_id = u.id
         WHERE p.id = ?`,
      )
      .get(id)

    if (!product) {
      res.status(404).json({ success: false, error: '商品不存在' })
      return
    }

    product.photos = JSON.parse(product.photos)

    // 附带进行中的交易（用于详情页提示「交易中」并引导到订单）
    const activeOrder: any = db
      .prepare(
        `SELECT id, buyer_id, seller_id, type, status
         FROM orders WHERE product_id = ?
         AND status IN ('pending', 'shipped', 'exchanging')
         ORDER BY id DESC LIMIT 1`,
      )
      .get(id)
    product.active_order = activeOrder || null

    res.json({ success: true, data: product })
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
        !name ||
        !ip_name ||
        !category ||
        !condition ||
        price === undefined ||
        price === null ||
        !Array.isArray(photos) ||
        photos.length === 0
      ) {
        res.status(400).json({ success: false, error: '请填写完整信息（至少一张照片）' })
        return
      }

      if (!CATEGORY_WHITELIST.includes(category)) {
        res.status(400).json({ success: false, error: '商品分类不合法' })
        return
      }

      if (!CONDITION_WHITELIST.includes(condition)) {
        res.status(400).json({ success: false, error: '新旧程度不合法' })
        return
      }

      const priceNum = Number(price)
      if (Number.isNaN(priceNum) || priceNum < 0) {
        res.status(400).json({ success: false, error: '价格不合法' })
        return
      }

      if (photos.length > 6) {
        res.status(400).json({ success: false, error: '最多上传6张照片' })
        return
      }

      const result = db
        .prepare(
          `INSERT INTO products
            (seller_id, name, description, ip_name, character_name, category, condition, price, exchange_intent, photos)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          req.user!.id,
          String(name).slice(0, 100),
          String(description || '').slice(0, 2000),
          String(ip_name).slice(0, 100),
          String(character_name || '').slice(0, 100),
          category,
          condition,
          priceNum,
          String(exchange_intent || '').slice(0, 500),
          JSON.stringify(photos),
        )

      const product = db
        .prepare('SELECT * FROM products WHERE id = ?')
        .get(result.lastInsertRowid)

      res.status(201).json({
        success: true,
        data: { ...(product as any), photos: JSON.parse((product as any).photos) },
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '发布商品失败' })
    }
  },
)

router.get(
  '/user/my',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const products = db
        .prepare(
          `SELECT p.*,
                  o.id as order_id, o.status as order_status, o.type as order_type,
                  bu.username as order_buyer_name
           FROM products p
           LEFT JOIN orders o
             ON o.product_id = p.id
            AND o.status IN ('pending', 'shipped', 'exchanging')
           LEFT JOIN users bu ON bu.id = o.buyer_id
           WHERE p.seller_id = ?
           ORDER BY p.created_at DESC`,
        )
        .all(req.user!.id)

      res.json({
        success: true,
        data: products.map((p: any) => ({
          ...p,
          photos: JSON.parse(p.photos),
        })),
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: '获取我的发布失败' })
    }
  },
)

/** 下架自己的在售商品（无进行中交易时） */
router.put(
  '/:id/status',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const { status } = req.body

      if (!['active', 'removed'].includes(status)) {
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

      if (product.seller_id !== req.user!.id) {
        res.status(403).json({ success: false, error: '无权限操作' })
        return
      }

      const active = db
        .prepare(
          `SELECT id FROM orders WHERE product_id = ?
           AND status IN ('pending', 'shipped', 'exchanging')`,
        )
        .get(id)
      if (active && status === 'removed') {
        res.status(409).json({ success: false, error: '该商品有进行中的交易，无法下架' })
        return
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
