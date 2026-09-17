import {
  Filter,
  Package,
  Star,
  Gamepad2,
  Ticket,
  BookOpen,
  Shirt,
  MoreHorizontal,
} from 'lucide-react'

export const categories = [
  { id: 'all', name: '全部', icon: Filter },
  { id: 'figure', name: '手办', icon: Package },
  { id: 'badge', name: '吧唧', icon: Star },
  { id: 'card', name: '卡牌', icon: Gamepad2 },
  { id: 'poster', name: '海报', icon: Ticket },
  { id: 'book', name: '漫画', icon: BookOpen },
  { id: 'clothing', name: '服饰', icon: Shirt },
  { id: 'other', name: '其他', icon: MoreHorizontal },
]

export const categoryOptions = categories.filter((c) => c.id !== 'all')

export const categoryMap: Record<string, string> = Object.fromEntries(
  categoryOptions.map((c) => [c.id, c.name]),
)

export const conditions = [
  { id: 'new', name: '全新' },
  { id: 'like_new', name: '几乎全新' },
  { id: 'good', name: '品相良好' },
  { id: 'fair', name: '有使用痕迹' },
]

export const conditionMap: Record<string, string> = Object.fromEntries(
  conditions.map((c) => [c.id, c.name]),
)

export const typeMap: Record<string, string> = {
  buy: '购买',
  exchange: '交换',
}

/** 订单状态机展示 */
export const statusMap: Record<string, { label: string; color: string }> = {
  exchanging: { label: '交换待确认', color: 'text-pink-600 bg-pink-50' },
  pending: { label: '待发货', color: 'text-orange-500 bg-orange-50' },
  shipped: { label: '待收货', color: 'text-blue-500 bg-blue-50' },
  completed: { label: '已完成', color: 'text-green-500 bg-green-50' },
  cancelled: { label: '已取消', color: 'text-gray-500 bg-gray-100' },
}

/** 商品状态展示（我的发布） */
export const productStatusMap: Record<string, { label: string; cls: string }> = {
  active: { label: '在售中', cls: 'text-green-600 bg-green-50' },
  reserved: { label: '交易中', cls: 'text-orange-500 bg-orange-50' },
  sold: { label: '已售出', cls: 'text-gray-500 bg-gray-100' },
  removed: { label: '已下架', cls: 'text-gray-500 bg-gray-100' },
}
