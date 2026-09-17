import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, User, Star, MessageSquare, Package, Loader2 } from 'lucide-react'
import { authAPI, productAPI, reviewAPI } from '@/lib/api'
import { CATEGORY_MAP, TYPE_LABEL, formatTime } from '@/lib/constants'
import StarRating from '@/components/StarRating'

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [tab, setTab] = useState<'reviews' | 'products'>('reviews')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const [u, r, p] = await Promise.all([
          authAPI.getUser(Number(id)),
          reviewAPI.getUserReviews(Number(id)),
          productAPI.getSellerProducts(Number(id)),
        ])
        if (cancelled) return
        setProfile(u.data.data)
        setReviews(r.data.data)
        setProducts(p.data.data)
      } catch (e: any) {
        if (e.response?.status === 404) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">用户不存在</p>
        <Link to="/" className="text-purple-500 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">个人主页</h1>
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
              <h2 className="text-xl font-bold text-gray-900">
                {profile.username}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-medium text-gray-700">
                  {profile.rating || 0}
                </span>
                <span className="text-gray-300">·</span>
                <span>{profile.review_count || 0} 条评价</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl">
          <button
            onClick={() => setTab('reviews')}
            className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 ${
              tab === 'reviews'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            收到的评价
          </button>
          <button
            onClick={() => setTab('products')}
            className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 ${
              tab === 'products'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Package className="w-4 h-4" />
            TA的发布
          </button>
        </div>

        {tab === 'reviews' ? (
          reviews.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">还没有收到评价</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-300 to-pink-300 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900">
                          {r.reviewer_name}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatTime(r.created_at)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <StarRating value={r.rating} readOnly size={16} />
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 mt-2">{r.comment}</p>
                      )}
                      <Link
                        to={`/product/${r.product_id}`}
                        className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg"
                      >
                        <img
                          src={r.photos?.[0]}
                          alt={r.product_name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-700 truncate">
                            {r.product_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {TYPE_LABEL[r.order_type] || r.order_type}交易 ·{' '}
                            {CATEGORY_MAP[r.category] || ''}
                          </p>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">TA还没有发布商品</p>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="bg-white rounded-2xl p-4 flex items-center gap-4 block"
              >
                <img
                  src={p.photos?.[0]}
                  alt={p.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{p.name}</h3>
                  <p className="text-purple-600 font-semibold mt-1">¥{p.price}</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'active'
                        ? 'text-green-600 bg-green-50'
                        : p.status === 'reserved'
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-gray-500 bg-gray-100'
                    }`}
                  >
                    {p.status === 'active'
                      ? '在售'
                      : p.status === 'reserved'
                        ? '交易中'
                        : '已售出'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
