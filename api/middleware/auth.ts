import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'anime-market-secret-key'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    email: string
  }
}

function decodeToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    id: number
    username: string
    email: string
  }
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }

  try {
    req.user = decodeToken(token)
    next()
  } catch {
    res.status(403).json({ success: false, error: 'Token无效' })
  }
}

// 有 token 就解析，没有也放行（用于公开接口区分访客/本人）
export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    try {
      req.user = decodeToken(token)
    } catch {
      // 忽略无效 token，按访客处理
    }
  }
  next()
}
