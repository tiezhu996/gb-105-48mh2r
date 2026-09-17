import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { productAPI } from '../lib/api'
import { categories } from '../lib/constants'
import { Search, Plus, User, Star, Package, RefreshCw } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
  photos: string[]
  ip_name: string
  character_name: string
  category: string
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

  // 搜索防抖：停止输入 300ms 后再请求
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setLoading(true)
    productAPI
      .getProducts({
        search: search || undefined,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
      })
      .then((res) => setProducts(res.data.data))
      .catch((e) => console.error('Failed to load products:', e))
      .finally(() => setLoading(false))
  }, [search, selectedCategory])

  const catName = useMemo(() => {
    const m: Record<string, string> = {}
    categories.forEach((c) => (m[c.id] = c.name))
    return m
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hidden sm:block">
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
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden animate-pulse mb-4 break-inside-avoid"
              >
                <div className="bg-gray-200" style={{ aspectRatio: 1 + (i % 3) * 0.25 }} />
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
              {search ? '没有找到相关周边' : '暂无商品'}
            </p>
            <p className="text-gray-400 mt-1">
              {search ? '换个关键词试试吧~' : '快来发布第一个商品吧~'}
            </p>
          </div>
        ) : (
          // 瀑布流：CSS columns 按图片原始比例自然错落
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all mb-4 break-inside-avoid group"
              >
                <div className="relative overflow-hidden bg-gray-100">
                  <img
                    src={product.photos[0]}
                    alt={product.name}
                    loading="lazy"
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-purple-600">
                    {catName[product.category] || product.category}
                  </div>
                </div>
                <div className="p-3.5">
                  <h3 className="font-medium text-gray-900 line-clamp-2 mb-1.5 leading-snug">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-400 truncate mb-2">
                    {product.ip_name}
                    {product.character_name ? ` · ${product.character_name}` : ''}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-pink-600 font-bold text-lg">
                      ¥{product.price}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <RefreshCw className="w-3 h-3" />
                      可聊
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-gray-500">
                      {product.seller_rating || '新'} · {product.seller_name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
