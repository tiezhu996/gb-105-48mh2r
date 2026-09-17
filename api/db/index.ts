import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../../data/anime-market.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 订单状态：
// exchange_pending 交换请求待卖家确认
// pending          待发货（购买下单成功 / 交换请求被接受）
// shipped          已发货，待收货
// completed        已完成
// rejected         卖家拒绝了交换请求
// cancelled        买家/卖家取消
export const ACTIVE_ORDER_STATUSES = ['exchange_pending', 'pending', 'shipped']

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[]
  return rows.some((r) => r.name === column)
}

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      ip_name TEXT NOT NULL,
      character_name TEXT,
      category TEXT NOT NULL,
      condition TEXT NOT NULL,
      price REAL NOT NULL,
      exchange_intent TEXT,
      photos TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      price REAL NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      exchange_offer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      reviewee_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (reviewee_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_ip ON products(ip_name);
    CREATE INDEX IF NOT EXISTS idx_products_character ON products(character_name);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
  `)

  // 兼容旧库：补充交换请求说明字段
  if (!hasColumn('orders', 'exchange_offer')) {
    db.exec('ALTER TABLE orders ADD COLUMN exchange_offer TEXT')
  }

  // 同一商品只允许存在一个进行中的订单：
  // 利用部分唯一索引在数据库层兜底，彻底杜绝并发/重复提交产生冲突订单。
  // 历史脏数据先收敛：同商品若有多笔进行中订单，只保留最早的一笔。
  db.exec(`
    UPDATE orders SET status = 'cancelled'
    WHERE status IN ('exchange_pending', 'pending', 'shipped')
      AND id NOT IN (
        SELECT MIN(id) FROM orders
        WHERE status IN ('exchange_pending', 'pending', 'shipped')
        GROUP BY product_id
      );

    DELETE FROM reviews
    WHERE id NOT IN (
      SELECT MIN(id) FROM reviews GROUP BY order_id, reviewer_id
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_product_active
      ON orders(product_id)
      WHERE status IN ('exchange_pending', 'pending', 'shipped');

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_reviewer
      ON reviews(order_id, reviewer_id);
  `)
}

export default db
