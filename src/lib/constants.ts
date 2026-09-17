export const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'figure', name: '手办' },
  { id: 'badge', name: '吧唧' },
  { id: 'card', name: '卡牌' },
  { id: 'poster', name: '海报' },
  { id: 'book', name: '漫画' },
  { id: 'clothing', name: '服饰' },
  { id: 'other', name: '其他' },
] as const

export const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== 'all').map((c) => [c.id, c.name]),
)

export const CONDITIONS = [
  { id: 'new', name: '全新' },
  { id: 'like_new', name: '几乎全新' },
  { id: 'good', name: '品相良好' },
  { id: 'fair', name: '有使用痕迹' },
]

export const CONDITION_MAP: Record<string, string> = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c.name]),
)

export const TYPE_LABEL: Record<string, string> = {
  buy: '购买',
  exchange: '交换',
}

// 订单状态元信息
export const STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  exchange_pending: {
    label: '交换待确认',
    tone: 'text-amber-600 bg-amber-50 border border-amber-100',
  },
  pending: {
    label: '待发货',
    tone: 'text-orange-500 bg-orange-50 border border-orange-100',
  },
  shipped: {
    label: '待收货',
    tone: 'text-blue-500 bg-blue-50 border border-blue-100',
  },
  completed: {
    label: '已完成',
    tone: 'text-green-600 bg-green-50 border border-green-100',
  },
  rejected: {
    label: '交换被拒绝',
    tone: 'text-gray-500 bg-gray-100 border border-gray-200',
  },
  cancelled: {
    label: '已取消',
    tone: 'text-gray-500 bg-gray-100 border border-gray-200',
  },
}

export function statusMeta(status: string) {
  return STATUS_META[status] || { label: status, tone: 'text-gray-500 bg-gray-100' }
}

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  active: '在售',
  reserved: '交易中',
  sold: '已售出',
  offline: '已下架',
}

export function formatTime(t: string) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 16)
}
