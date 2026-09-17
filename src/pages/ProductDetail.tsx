import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { productAPI, orderAPI } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { conditionMap, categoryMap, statusMap } from '../lib/constants'
import {
  ArrowLeft,
  Star,
  User,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  RefreshCw,
  Tag,
  Package,
  Info,
  X,
} from 'lucide-react'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<any>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [exchangeOffer, setExchangeOffer] = useState('')
  const [error, setError] = useState('')
  const { isAuthenticated, user } = useAuthStore()

  const loadProduct = () => {
    setLoading(true)
    productAPI
      .getProduct(id!)
      .then((res) => setProduct(res.data.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProduct()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isOwner = user && product && user.id === product.seller_id
  const activeOrder = product?.active_order
  const myActiveOrder =
    activeOrder && user && (activeOrder.buyer_id === user.id || activeOrder.seller_id === user.id)

  const submitOrder = async (type: 'buy' | 'exchange') => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (type === 'exchange' && !exchangeOffer.trim()) {
      setError('请填写你想用什么来交换')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await orderAPI.createOrder({
        product_id: Number(id),
        type,
        exchange_offer: type === 'exchange' ? exchangeOffer.trim() : undefined,
      })
      navigate('/profile?tab=bought')
    } catch (e: any) {
      setError(e.response?.data?.error || '操作失败')
      // 状态可能已被其他请求改变，刷新以拿到最新交易状态
      loadProduct()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        加载中...
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">商品不存在</p>
        <Link to="/" className="text-purple-500 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  const tradeClosed = ['sold', 'removed'].includes(product.status)

  let bottomBar: React.ReactNode = null
  if (isOwner) {
    bottomBar = (
      <Link
        to="/profile?tab=published"
        className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-center"
      >
        这是我发布的商品 · 去管理
      </Link>
    )
  } else if (myActiveOrder) {
    bottomBar = (
      <Link
        to={activeOrder.buyer_id === user?.id ? '/profile?tab=bought' : '/profile?tab=sold'}
        className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-center"
      >
        该商品有进行中的交易 · 去订单查看
      </Link>
    )
  } else if (tradeClosed || activeOrder) {
    bottomBar = (
      <div className="flex-1 py-3.5 bg-gray-100 text-gray-400 rounded-xl font-medium text-center">
        {product.status === 'sold' ? '该商品已售出' : activeOrder ? '该商品交易中' : '该商品已下架'}
      </div>
    )
  } else {
    bottomBar = (
      <>
        <button
          onClick={() => setShowExchange(true)}
          disabled={submitting}
          className="flex-1 py-3.5 bg-pink-50 text-pink-600 rounded-xl font-medium hover:bg-pink-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          想要交换
        </button>
        <button
          onClick={() => submitOrder('buy')}
          disabled={submitting}
          className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          立即购买
        </button>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 truncate">{product.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-28">
        <div className="bg-white rounded-2xl overflow-hidden mb-6">
          <div className="relative aspect-square">
            <img
              src={product.photos[currentPhoto]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {product.photos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentPhoto(
                      (prev) => (prev - 1 + product.photos.length) % product.photos.length,
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <button
                  onClick={() => setCurrentPhoto((prev) => (prev + 1) % product.photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white"
                >
                  <ChevronRight className="w-6 h-6 text-gray-700" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {product.photos.map((_: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPhoto(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentPhoto ? 'bg-white w-6' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
              <p className="text-3xl font-bold text-pink-600">¥{product.price}</p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                {categoryMap[product.category] || product.category}
              </span>
              {(activeOrder || tradeClosed) && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    statusMap[activeOrder?.status]?.color || 'text-gray-500 bg-gray-100'
                  }`}
                >
                  {product.status === 'sold'
                    ? '已售出'
                    : statusMap[activeOrder?.status]?.label || '已下架'}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-600 flex-wrap">
              <Tag className="w-4 h-4" />
              <span className="font-medium">IP:</span>
              <span>{product.ip_name}</span>
              {product.character_name && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-medium">角色:</span>
                  <span>{product.character_name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Package className="w-4 h-4" />
              <span className="font-medium">新旧程度:</span>
              <span>{conditionMap[product.condition] || product.condition}</span>
            </div>
            {product.exchange_intent && (
              <div className="flex items-start gap-2 text-gray-600">
                <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="font-medium shrink-0">交换意向:</span>
                <span>{product.exchange_intent}</span>
              </div>
            )}
          </div>
        </div>

        {product.description && (
          <div className="bg-white rounded-2xl p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              商品描述
            </h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>
          </div>
        )}

        <Link
          to={`/user/${product.seller_id}`}
          className="bg-white rounded-2xl p-6 block hover:shadow-md transition-all"
        >
          <h3 className="font-bold text-gray-900 mb-3">卖家信息</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{product.seller_name}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span>{product.seller_rating || '暂无评分'}</span>
                <span className="text-gray-300">·</span>
                <span>{product.seller_review_count || 0}条评价</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </div>
        </Link>

        {error && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg whitespace-nowrap">
            {error}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40">
        <div className="max-w-4xl mx-auto flex gap-3">{bottomBar}</div>
      </div>

      {showExchange && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowExchange(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-pink-500" />
                发起交换
              </h3>
              <button
                onClick={() => setShowExchange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {product.exchange_intent && (
              <div className="bg-pink-50 text-pink-600 text-sm rounded-xl p-3 mb-4">
                卖家的交换意向：{product.exchange_intent}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">
              你想用来交换的物品 / 方案
            </label>
            <textarea
              value={exchangeOffer}
              onChange={(e) => {
                setExchangeOffer(e.target.value.slice(0, 300))
                setError('')
              }}
              rows={4}
              placeholder="例如：我有同系列另一角色的吧唧，九成新，可补差价..."
              className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none resize-none mb-4"
              autoFocus
            />

            <button
              onClick={() => submitOrder('exchange')}
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              {submitting ? '提交中...' : '发送交换请求'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              卖家接受后将进入发货流程；卖家拒绝或你取消后商品会重新上架
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
