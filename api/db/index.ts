import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../../data/anime-market.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      bio TEXT DEFAULT '',
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
      exchange_offer TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
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
    CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
  `)

  // ---- lightweight migrations for databases created by earlier versions ----
  const userCols = db.prepare('PRAGMA table_info(users)').all() as any[]
  if (!userCols.some((c) => c.name === 'bio')) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
  }

  const orderCols = db.prepare('PRAGMA table_info(orders)').all() as any[]
  if (!orderCols.some((c) => c.name === 'exchange_offer')) {
    db.exec("ALTER TABLE orders ADD COLUMN exchange_offer TEXT DEFAULT ''")
  }

  // 同一商品同时只能存在一个进行中的交易：
  // 用部分唯一索引兜底，即使两个请求并发也只会有一条进行中订单落库。
  // （reserved 状态的商品行上最多挂一个进行中订单）
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_active_per_product
    ON orders(product_id)
    WHERE status IN ('pending', 'shipped', 'exchanging')
  `)

  // 每笔订单每个用户只能评价一次
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_once_per_order_user
    ON reviews(order_id, reviewer_id)
  `)
}

export default db
