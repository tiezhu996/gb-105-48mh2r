import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { productAPI, orderAPI, reviewAPI } from '../lib/api'
import {
  ArrowLeft,
  User,
  Star,
  ShoppingCart,
  Package,
  Tag,
  LogOut,
  ChevronRight,
  Send,
  CheckCircle,
  MessageSquare,
  XCircle,
  Ban,
  Eye,
  Loader2,
} from 'lucide-react'
import {
  statusMeta,
  TYPE_LABEL,
  PRODUCT_STATUS_LABEL,
} from '@/lib/constants'
import ReviewModal from '@/components/ReviewModal'

type Tab = 'bought' | 'sold' | 'published'

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab) || 'bought',
  )
  const [boughtOrders, setBoughtOrders] = useState<any[]>([])
  const [soldOrders, setSoldOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [myReviews, setMyReviews] = useState<Record<number, any>>({})
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<any | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const { user, logout, isAuthenticated, checkAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) navigate('/login')
  }, [isAuthenticated, navigate])

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    setSearchParams(tab === 'bought' ? {} : { tab })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'bought') {
        const res = await orderAPI.getBuyerOrders()
        setBoughtOrders(res.data.data)
        const ids = res.data.data.map((o: any) => o.id)
        if (ids.length) {
          const r = await reviewAPI.getMyReviewsByOrders(ids)
          setMyReviews(r.data.data)
        } else {
          setMyReviews({})
        }
      } else if (activeTab === 'sold') {
        const res = await orderAPI.getSellerOrders()
        setSoldOrders(res.data.data)
        const ids = res.data.data.map((o: any) => o.id)
        if (ids.length) {
          const r = await reviewAPI.getMyReviewsByOrders(ids)
          setMyReviews(r.data.data)
        } else {
          setMyReviews({})
        }
      } else {
        const res = await productAPI.getMyProducts()
        setProducts(res.data.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (isAuthenticated) loadData()
  }, [isAuthenticated, loadData])

  const runOrderAction = async (
    orderId: number,
    action: (id: number) => Promise<any>,
    confirmText: string,
  ) => {
    if (!window.confirm(confirmText)) return
    setBusyId(orderId)
    try {
      await action(orderId)
      await Promise.all([loadData(), checkAuth()])
    } catch (error: any) {
      alert(error.response?.data?.error || '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const toggleOffline = async (product: any) => {
    const goingOffline = product.status === 'active'
    if (
      goingOffline &&
      !window.confirm('确定下架该商品吗？下架后其他人将看不到它。')
    ) {
      return
    }
    setBusyId(product.id)
    try {
      await productAPI.updateProductStatus(
        product.id,
        goingOffline ? 'offline' : 'active',
      )
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.error || '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const openReview = (order: any, isSeller: boolean) => {
    setReviewTarget({
      ...order,
      counterparty_id: isSeller ? order.buyer_id : order.seller_id,
      counterparty_name: isSeller ? order.buyer_name : order.seller_name,
    })
  }

  const renderOrderCard = (order: any, isSeller: boolean) => {
    const st = statusMeta(order.status)
    const myReview = myReviews[order.id]
    const busy = busyId === order.id

    let actionButtons: React.ReactNode = null

    if (isSeller) {
      if (order.status === 'exchange_pending') {
        actionButtons = (
          <>
            <button
              disabled={busy}
              onClick={() =>
                runOrderAction(order.id, orderAPI.rejectOrder, '确定拒绝交换请求吗？商品将重新上架。')
              }
              className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
            >
              <XCircle className="w-4 h-4" /> 拒绝
            </button>
            <button
              disabled={busy}
              onClick={() =>
                runOrderAction(order.id, orderAPI.acceptOrder, '确定接受交换吗？接受后进入待发货状态。')
              }
              className="flex-1 py-2 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 flex items-center justify-center gap-1"
            >
              <CheckCircle className="w-4 h-4" /> 接受交换
            </button>
          </>
        )
      } else if (order.status === 'pending') {
        actionButtons = (
          <button
            disabled={busy}
            onClick={() =>
              runOrderAction(order.id, orderAPI.shipOrder, '确认已发货？')
            }
            className="flex-1 py-2 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 flex items-center justify-center gap-1"
          >
            <Send className="w-4 h-4" /> 确认发货
          </button>
        )
      }
    } else {
      if (order.status === 'shipped') {
        actionButtons = (
          <button
            disabled={busy}
            onClick={() =>
              runOrderAction(
                order.id,
                orderAPI.receiveOrder,
                '确认已收到商品？确认后交易完成，双方可以互评。',
              )
            }
            className="flex-1 py-2 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-4 h-4" /> 确认收货
          </button>
        )
      }
    }

    // 发货前买家可取消；交换待确认阶段卖家也可取消
    const buyerCanCancel =
      !isSeller && ['exchange_pending', 'pending'].includes(order.status)
    const sellerCanCancel = isSeller && order.status === 'exchange_pending'

    return (
      <div key={order.id} className="bg-white rounded-2xl p-4">
        <div className="flex items-start gap-4">
          <Link to={`/product/${order.product_id}`} className="shrink-0">
            <img
              src={order.photos?.[0]}
              alt={order.product_name}
              className="w-20 h-20 rounded-xl object-cover"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link
                to={`/product/${order.product_id}`}
                className="font-medium text-gray-900 truncate hover:text-purple-600"
              >
                {order.product_name}
              </Link>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${st.tone}`}
              >
                {st.label}
              </span>
            </div>
            <p className="text-purple-600 font-semibold mt-1">¥{order.price}</p>
            <p className="text-sm text-gray-500 mt-1">
              {TYPE_LABEL[order.type] || order.type} ·{' '}
              {isSeller ? (
                <>
                  买家：
                  <Link
                    to={`/user/${order.buyer_id}`}
                    className="text-purple-500 hover:underline"
                  >
                    {order.buyer_name}
                  </Link>
                </>
              ) : (
                <>
                  卖家：
                  <Link
                    to={`/user/${order.seller_id}`}
                    className="text-purple-500 hover:underline"
                  >
                    {order.seller_name}
                  </Link>
                </>
              )}
            </p>
            {order.type === 'exchange' && order.exchange_offer && (
              <p className="text-xs text-pink-600 bg-pink-50 rounded-lg px-2 py-1.5 mt-2">
                交换说明：{order.exchange_offer}
              </p>
            )}
          </div>
        </div>

        {(actionButtons ||
          buyerCanCancel ||
          sellerCanCancel ||
          order.status === 'completed' ||
          ['rejected', 'cancelled'].includes(order.status)) && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            {actionButtons}
            {(buyerCanCancel || sellerCanCancel) && (
              <button
                disabled={busy}
                onClick={() =>
                  runOrderAction(
                    order.id,
                    orderAPI.cancelOrder,
                    '确定取消这笔交易吗？商品将重新上架。',
                  )
                }
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
              >
                <Ban className="w-4 h-4" /> 取消交易
              </button>
            )}
            {order.status === 'completed' &&
              (myReview ? (
                <span className="flex-1 py-2 text-center text-sm text-green-600 bg-green-50 rounded-xl flex items-center justify-center gap-1">
                  <CheckCircle className="w-4 h-4" /> 已评价对方
                </span>
              ) : (
                <button
                  onClick={() => openReview(order, isSeller)}
                  className="flex-1 py-2 rounded-xl bg-pink-50 text-pink-600 font-medium hover:bg-pink-100 flex items-center justify-center gap-1"
                >
                  <MessageSquare className="w-4 h-4" /> 评价对方
                </button>
              ))}
          </div>
        )}
      </div>
    )
  }

  const renderProductCard = (product: any) => {
    const busy = busyId === product.id
    const statusTone =
      product.status === 'active'
        ? 'text-green-600 bg-green-50'
        : product.status === 'reserved'
          ? 'text-amber-600 bg-amber-50'
          : product.status === 'sold'
            ? 'text-gray-500 bg-gray-100'
            : 'text-gray-500 bg-gray-100'

    return (
      <div key={product.id} className="bg-white rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <Link to={`/product/${product.id}`} className="shrink-0">
            <img
              src={product.photos?.[0]}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              to={`/product/${product.id}`}
              className="font-medium text-gray-900 truncate block hover:text-purple-600"
            >
              {product.name}
            </Link>
            <p className="text-purple-600 font-semibold mt-1">¥{product.price}</p>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusTone}`}
            >
              {PRODUCT_STATUS_LABEL[product.status] || product.status}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          {product.status === 'active' && (
            <button
              disabled={busy}
              onClick={() => toggleOffline(product)}
              className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
            >
              下架
            </button>
          )}
          {product.status === 'offline' && (
            <button
              disabled={busy}
              onClick={() => toggleOffline(product)}
              className="flex-1 py-2 rounded-xl bg-purple-50 text-purple-600 text-sm font-medium hover:bg-purple-100"
            >
              重新上架
            </button>
          )}
          {product.status === 'reserved' && (
            <Link
              to={`/product/${product.id}`}
              className="flex-1 py-2 rounded-xl bg-amber-50 text-amber-600 text-sm font-medium flex items-center justify-center gap-1"
            >
              <Eye className="w-4 h-4" /> 查看进行中的交易
            </Link>
          )}
          {product.status === 'sold' && (
            <span className="flex-1 py-2 text-center text-sm text-gray-400">
              交易已完成
            </span>
          )}
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">个人中心</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {user?.username}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-medium text-gray-700">
                  {user?.rating || 0}
                </span>
                <span className="text-gray-300">·</span>
                <span>{user?.review_count || 0}条评价</span>
              </div>
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl">
          {[
            { id: 'bought', label: '我买到的', icon: ShoppingCart },
            { id: 'sold', label: '我卖出的', icon: Package },
            { id: 'published', label: '我的发布', icon: Tag },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id as Tab)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : activeTab === 'bought' ? (
          boughtOrders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">还没有买到任何商品</p>
              <Link to="/" className="text-purple-500 hover:underline mt-2 inline-block">
                去逛逛
              </Link>
            </div>
          ) : (
            <div>{boughtOrders.map((o) => renderOrderCard(o, false))}</div>
          )
        ) : activeTab === 'sold' ? (
          soldOrders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">还没有卖出任何商品</p>
              <Link to="/publish" className="text-purple-500 hover:underline mt-2 inline-block">
                去发布
              </Link>
            </div>
          ) : (
            <div>{soldOrders.map((o) => renderOrderCard(o, true))}</div>
          )
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">还没有发布任何商品</p>
            <Link to="/publish" className="text-purple-500 hover:underline mt-2 inline-block">
              去发布
            </Link>
          </div>
        ) : (
          <div>{products.map(renderProductCard)}</div>
        )}
      </main>

      {reviewTarget && (
        <ReviewModal
          order={reviewTarget}
          targetName={reviewTarget.counterparty_name}
          onClose={() => setReviewTarget(null)}
          onDone={async () => {
            setReviewTarget(null)
            await loadData()
            await checkAuth()
          }}
        />
      )}
    </div>
  )
}
