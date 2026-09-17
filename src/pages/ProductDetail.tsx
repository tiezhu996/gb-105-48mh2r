import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { productAPI, orderAPI } from '../lib/api'
import { useAuthStore } from '../store/auth'
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
  Send,
  CheckCircle,
  XCircle,
  Ban,
  Loader2,
} from 'lucide-react'
import {
  CATEGORY_MAP,
  CONDITION_MAP,
  statusMeta,
  TYPE_LABEL,
} from '@/lib/constants'
import ExchangeModal from '@/components/ExchangeModal'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<any>(null)
  const [myOrder, setMyOrder] = useState<any>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const { isAuthenticated } = useAuthStore()

  const load = async () => {
    setLoading(true)
    try {
      const res = await productAPI.getProduct(id!)
      setProduct(res.data.data)
      setCurrentPhoto(0)
      if (isAuthenticated) {
        const o = await orderAPI.getMyOrderForProduct(Number(id))
        setMyOrder(o.data.data)
      } else {
        setMyOrder(null)
      }
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated])

  const requireLogin = () => {
    navigate('/login')
  }

  const handleBuy = async () => {
    if (!isAuthenticated) return requireLogin()
    setBusy(true)
    try {
      await orderAPI.createOrder({ product_id: Number(id), type: 'buy' })
      await load()
    } catch (error: any) {
      alert(error.response?.data?.error || '下单失败')
    } finally {
      setBusy(false)
    }
  }

  const handleExchange = async (offer: string) => {
    await orderAPI.createOrder({
      product_id: Number(id),
      type: 'exchange',
      exchange_offer: offer,
    })
    setShowExchange(false)
    await load()
  }

  const handleAction = async (action: 'accept' | 'reject' | 'cancel' | 'ship' | 'receive') => {
    const labels: Record<string, string> = {
      accept: '确定接受这个交换请求吗？接受后请尽快发货。',
      reject: '确定拒绝这个交换请求吗？拒绝后商品将重新上架。',
      cancel: '确定取消这笔交易吗？取消后商品将重新上架。',
      ship: '确认已发货？',
      receive: '确认已收到商品？确认后交易完成，双方可以互评。',
    }
    if (!window.confirm(labels[action])) return

    setBusy(true)
    try {
      const api = {
        accept: orderAPI.acceptOrder,
        reject: orderAPI.rejectOrder,
        cancel: orderAPI.cancelOrder,
        ship: orderAPI.shipOrder,
        receive: orderAPI.receiveOrder,
      }[action]
      await api(myOrder.id)
      await load()
    } catch (error: any) {
      alert(error.response?.data?.error || '操作失败')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">商品不存在或已下架</p>
        <Link to="/" className="text-purple-500 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  const active = product.active_order
  const isOwner = product.is_owner
  const iAmBuyer = myOrder && active && myOrder.id === active.id
  const iAmSeller = isOwner && active
  const st = active ? statusMeta(active.status) : null

  const renderActionBar = () => {
    // 1. 自己的商品
    if (isOwner) {
      if (!active) {
        return (
          <div className="flex gap-3">
            <button
              disabled
              className="flex-1 py-3.5 bg-gray-100 text-gray-400 rounded-xl font-medium cursor-not-allowed"
            >
              这是你发布的商品
            </button>
            <button
              onClick={() => navigate('/profile?tab=published')}
              className="px-5 py-3.5 bg-purple-50 text-purple-600 rounded-xl font-medium hover:bg-purple-100"
            >
              管理
            </button>
          </div>
        )
      }
      if (iAmSeller) {
        return (
          <div className="flex gap-3">
            <span className={`px-4 py-3 rounded-xl text-sm font-medium ${st!.tone}`}>
              {TYPE_LABEL[active.type]} · {st!.label}
            </span>
            {active.status === 'exchange_pending' && (
              <>
                <button
                  disabled={busy}
                  onClick={() => handleAction('reject')}
                  className="px-5 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5" /> 拒绝
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleAction('accept')}
                  className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> 接受交换
                </button>
              </>
            )}
            {active.status === 'pending' && (
              <>
                <button
                  disabled={busy}
                  onClick={() => handleAction('cancel')}
                  className="px-5 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 flex items-center gap-2"
                >
                  <Ban className="w-5 h-5" /> 取消
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleAction('ship')}
                  className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" /> 确认发货
                </button>
              </>
            )}
            {active.status === 'shipped' && (
              <button
                disabled
                className="flex-1 py-3.5 bg-blue-50 text-blue-500 rounded-xl font-medium cursor-not-allowed"
              >
                已发货，等待买家收货
              </button>
            )}
            {active.status === 'completed' && (
              <button
                onClick={() => navigate('/profile?tab=sold')}
                className="flex-1 py-3.5 bg-green-50 text-green-600 rounded-xl font-medium"
              >
                交易已完成 · 去评价对方
              </button>
            )}
          </div>
        )
      }
    }

    // 2. 我是买家且参与了进行中的交易
    if (iAmBuyer) {
      return (
        <div className="flex gap-3">
          <span className={`px-4 py-3 rounded-xl text-sm font-medium ${st!.tone}`}>
            {TYPE_LABEL[active.type]} · {st!.label}
          </span>
          {['exchange_pending', 'pending'].includes(active.status) && (
            <>
              <button
                disabled={busy}
                onClick={() => handleAction('cancel')}
                className="px-5 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 flex items-center gap-2"
              >
                <Ban className="w-5 h-5" /> 取消交易
              </button>
              {active.status === 'pending' && (
                <button
                  disabled
                  className="flex-1 py-3.5 bg-orange-50 text-orange-500 rounded-xl font-medium cursor-not-allowed"
                >
                  等待卖家发货
                </button>
              )}
              {active.status === 'exchange_pending' && (
                <button
                  disabled
                  className="flex-1 py-3.5 bg-amber-50 text-amber-600 rounded-xl font-medium cursor-not-allowed"
                >
                  等待卖家确认交换
                </button>
              )}
            </>
          )}
          {active.status === 'shipped' && (
            <button
              disabled={busy}
              onClick={() => handleAction('receive')}
              className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" /> 确认收货
            </button>
          )}
          {active.status === 'completed' && (
            <button
              onClick={() => navigate('/profile?tab=bought')}
              className="flex-1 py-3.5 bg-green-50 text-green-600 rounded-xl font-medium"
            >
              交易已完成 · 去评价
            </button>
          )}
        </div>
      )
    }

    // 3. 商品可下单
    if (product.status === 'active' && !active) {
      if (!isAuthenticated) {
        return (
          <div className="flex gap-3">
            <button
              onClick={requireLogin}
              className="flex-1 py-3.5 bg-pink-50 text-pink-600 rounded-xl font-medium hover:bg-pink-100 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              想要交换
            </button>
            <button
              onClick={requireLogin}
              className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              立即购买
            </button>
          </div>
        )
      }
      return (
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => setShowExchange(true)}
            className="flex-1 py-3.5 bg-pink-50 text-pink-600 rounded-xl font-medium hover:bg-pink-100 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            想要交换
          </button>
          <button
            disabled={busy}
            onClick={handleBuy}
            className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
            立即购买
          </button>
        </div>
      )
    }

    // 4. 访客/无关用户面对进行中或已售出商品
    return (
      <button
        disabled
        className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl font-medium cursor-not-allowed"
      >
        {product.status === 'sold' ? '该商品已售出' : '该商品正在交易中'}
      </button>
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
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {product.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-28">
        <div className="bg-white rounded-2xl overflow-hidden mb-6">
          <div className="relative aspect-square bg-gray-100">
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
                      (prev) =>
                        (prev - 1 + product.photos.length) % product.photos.length,
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <button
                  onClick={() =>
                    setCurrentPhoto((prev) => (prev + 1) % product.photos.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white"
                >
                  <ChevronRight className="w-6 h-6 text-gray-700" />
                </button>
              </>
            )}
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
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {product.name}
              </h2>
              <p className="text-3xl font-bold text-purple-600">
                ¥{product.price}
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium shrink-0">
              {CATEGORY_MAP[product.category] || product.category}
            </span>
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
              <span className="font-medium">新旧:</span>
              <span>{CONDITION_MAP[product.condition] || product.condition}</span>
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
          className="bg-white rounded-2xl p-6 block hover:shadow-md transition-shadow"
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
                <span>{product.seller_rating || 0}</span>
                <span className="text-gray-300">·</span>
                <span>{product.seller_review_count || 0}条评价</span>
              </div>
            </div>
          </div>
        </Link>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40">
        <div className="max-w-4xl mx-auto">{renderActionBar()}</div>
      </div>

      {showExchange && (
        <ExchangeModal
          productName={product.name}
          onClose={() => setShowExchange(false)}
          onSubmit={handleExchange}
        />
      )}
    </div>
  )
}
