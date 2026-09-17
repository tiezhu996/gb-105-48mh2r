import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { productAPI, orderAPI, reviewAPI } from '../lib/api'
import {
  statusMap,
  typeMap,
  productStatusMap,
} from '../lib/constants'
import ReviewModal from '../components/ReviewModal'
import {
  ArrowLeft,
  User,
  Star,
  ShoppingCart,
  Package,
  Tag,
  LogOut,
  Send,
  CheckCircle,
  MessageSquare,
  CheckCheck,
  XCircle,
  ChevronDown,
} from 'lucide-react'

type Tab = 'bought' | 'sold' | 'published'

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>(
    (['bought', 'sold', 'published'] as Tab[]).includes(searchParams.get('tab') as Tab)
      ? (searchParams.get('tab') as Tab)
      : 'bought',
  )
  const [boughtOrders, setBoughtOrders] = useState<any[]>([])
  const [soldOrders, setSoldOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<any | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [showReviews, setShowReviews] = useState(false)
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const next = searchParams.get('tab')
    if (next && next !== activeTab) setActiveTab(next as Tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      if (activeTab === 'bought') {
        setBoughtOrders((await orderAPI.getBuyerOrders()).data.data)
      } else if (activeTab === 'sold') {
        setSoldOrders((await orderAPI.getSellerOrders()).data.data)
      } else {
        setProducts((await productAPI.getMyProducts()).data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeTab, isAuthenticated])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 个人主页收到的评价
  useEffect(() => {
    if (!user) return
    reviewAPI.getUserReviews(user.id).then((res) => setReviews(res.data.data)).catch(() => {})
  }, [user])

  if (!user) return null

  const callOrder = async (fn: () => Promise<any>) => {
    try {
      await fn()
      await loadData()
    } catch (e: any) {
      alert(e.response?.data?.error || '操作失败')
    }
  }

  const handleReview = async (rating: number, comment: string) => {
    try {
      // 评价交易对手：我是买家就评卖家，反之亦然
      const revieweeId =
        reviewTarget.buyer_id === user.id ? reviewTarget.seller_id : reviewTarget.buyer_id
      await reviewAPI.createReview({
        order_id: reviewTarget.id,
        reviewee_id: revieweeId,
        rating,
        comment,
      })
      setReviewTarget(null)
      await loadData()
    } catch (e: any) {
      alert(e.response?.data?.error || '评价失败')
    }
  }

  const renderOrderCard = (order: any, isSeller: boolean) => {
    const status = statusMap[order.status] || { label: order.status, color: '' }
    const canReview = order.status === 'completed' && !order.my_reviewed
    return (
      <div key={order.id} className="bg-white rounded-2xl p-4 mb-4">
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
              <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-pink-600 font-semibold mt-1">
              {order.type === 'exchange' ? '交换' : `¥${order.price}`}
            </p>
            <p className="text-sm text-gray-500 mt-1 truncate">
              {typeMap[order.type] || order.type} ·{' '}
              {isSeller ? `买家: ${order.buyer_name}` : `卖家: ${order.seller_name}`}
            </p>
            {order.type === 'exchange' && order.exchange_offer && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                交换方案：{order.exchange_offer}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          {/* 卖家：接受交换请求 */}
          {isSeller && order.status === 'exchanging' && (
            <>
              <button
                onClick={() =>
                  callOrder(() => orderAPI.acceptExchange(order.id))
                }
                className="flex-1 min-w-[120px] py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                接受交换
              </button>
              <button
                onClick={() => {
                  if (confirm('确定拒绝该交换请求吗？商品将重新上架。')) {
                    callOrder(() => orderAPI.cancelOrder(order.id))
                  }
                }}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
              >
                <XCircle className="w-4 h-4" />
                拒绝
              </button>
            </>
          )}

          {/* 买家：交换请求等待卖家确认时可撤回 */}
          {!isSeller && order.status === 'exchanging' && (
            <button
              onClick={() => {
                if (confirm('确定撤回该交换请求吗？')) {
                  callOrder(() => orderAPI.cancelOrder(order.id))
                }
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
            >
              <XCircle className="w-4 h-4" />
              撤回请求
            </button>
          )}

          {/* 卖家发货（购买订单待发货 / 交换已接受后） */}
          {isSeller && order.status === 'pending' && (
            <>
              <button
                onClick={() => callOrder(() => orderAPI.shipOrder(order.id))}
                className="flex-1 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 flex items-center justify-center gap-1"
              >
                <Send className="w-4 h-4" />
                确认发货
              </button>
              <button
                onClick={() => {
                  if (confirm('确定取消交易吗？商品将重新上架。')) {
                    callOrder(() => orderAPI.cancelOrder(order.id))
                  }
                }}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200"
              >
                取消交易
              </button>
            </>
          )}

          {/* 买家取消待发货订单 */}
          {!isSeller && order.status === 'pending' && (
            <button
              onClick={() => {
                if (confirm('确定取消订单吗？')) {
                  callOrder(() => orderAPI.cancelOrder(order.id))
                }
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              取消订单
            </button>
          )}

          {/* 买家确认收货 */}
          {!isSeller && order.status === 'shipped' && (
            <button
              onClick={() => callOrder(() => orderAPI.receiveOrder(order.id))}
              className="flex-1 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              确认收货
            </button>
          )}

          {/* 完成后互评，每人仅一次 */}
          {order.status === 'completed' &&
            (canReview ? (
              <button
                onClick={() => setReviewTarget(order)}
                className="flex-1 py-2 bg-pink-50 text-pink-600 rounded-xl font-medium hover:bg-pink-100 flex items-center justify-center gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                {order.peer_reviewed ? '去评价对方' : '评价对方'}
              </button>
            ) : (
              <span className="flex-1 py-2 text-center text-gray-400 text-sm flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4" />
                已评价
              </span>
            ))}
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'bought', label: '我买到的', icon: ShoppingCart },
    { id: 'sold', label: '我卖出的', icon: Package },
    { id: 'published', label: '我的发布', icon: Tag },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">个人中心</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{user.username}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span>{user.rating || '暂无评分'}</span>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => setShowReviews((v) => !v)}
                  className="text-purple-500 hover:underline flex items-center gap-0.5"
                >
                  {user.review_count || 0}条评价
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showReviews ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* 我的个人主页：收到的评价 */}
          {showReviews && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">还没有收到评价</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-300 to-pink-300 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {r.reviewer_name}
                        </span>
                        <span className="flex">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`w-3 h-3 ${
                                n <= r.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-200 fill-gray-200'
                              }`}
                            />
                          ))}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 mt-0.5 break-words">{r.comment}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
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
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse flex gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
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
            boughtOrders.map((o) => renderOrderCard(o, false))
          )
        ) : activeTab === 'sold' ? (
          soldOrders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">还没有卖出任何商品</p>
            </div>
          ) : (
            soldOrders.map((o) => renderOrderCard(o, true))
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
          <div className="space-y-4">
            {products.map((product) => {
              const ps = productStatusMap[product.status] || productStatusMap.active
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
                      <p className="text-pink-600 font-semibold mt-1">¥{product.price}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${ps.cls}`}
                      >
                        {ps.label}
                      </span>
                      {product.order_id && (
                        <span className="ml-2 text-xs text-gray-400">
                          {statusMap[product.order_status]?.label} · 买家 {product.order_buyer_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {product.status === 'active' && (
                    <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          if (confirm('确定下架该商品吗？下架后不再出现在首页。')) {
                            productAPI
                              .updateProductStatus(product.id, 'removed')
                              .then(loadData)
                              .catch((e) => alert(e.response?.data?.error || '下架失败'))
                          }
                        }}
                        className="text-sm text-gray-400 hover:text-red-500 px-3 py-1"
                      >
                        下架
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {reviewTarget && (
        <ReviewModal
          title={`评价 · ${
            reviewTarget.buyer_id === user.id
              ? reviewTarget.seller_name
              : reviewTarget.buyer_name
          }`}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReview}
        />
      )}
    </div>
  )
}
