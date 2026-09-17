import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { productAPI } from '../lib/api'
import {
  Search,
  Plus,
  User,
  Star,
  Filter,
  Package,
  Gamepad2,
  Ticket,
  BookOpen,
  Shirt,
  MoreHorizontal,
} from 'lucide-react'
import ProductWaterfall from '@/components/ProductWaterfall'

const categories = [
  { id: 'all', name: '全部', icon: Filter },
  { id: 'figure', name: '手办', icon: Package },
  { id: 'badge', name: '吧唧', icon: Star },
  { id: 'card', name: '卡牌', icon: Gamepad2 },
  { id: 'poster', name: '海报', icon: Ticket },
  { id: 'book', name: '漫画', icon: BookOpen },
  { id: 'clothing', name: '服饰', icon: Shirt },
  { id: 'other', name: '其他', icon: MoreHorizontal },
]

interface Product {
  id: number
  name: string
  price: number
  photos: string[]
  ip_name: string
  category: string
  status: string
  exchange_intent?: string
  seller_name: string
  seller_rating: number
}

export default function Home() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productAPI.getProducts({
        search: search || undefined,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
      })
      setProducts(res.data.data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hidden sm:inline">
                二次元集市
              </span>
            </Link>

            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索IP、角色或商品名称..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate('/publish')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">发布闲置</span>
                  </button>
                  <Link
                    to="/profile"
                    className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all"
                  >
                    <User className="w-5 h-5 text-gray-600" />
                  </Link>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all"
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-5 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {search || selectedCategory !== 'all'
                ? '没有找到相关周边'
                : '暂无商品'}
            </p>
            <p className="text-gray-400 mt-1">快来发布第一个商品吧~</p>
          </div>
        ) : (
          <ProductWaterfall products={products} />
        )}
      </main>
    </div>
  )
}
