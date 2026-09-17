import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { userAPI } from '../lib/api'
import { categoryMap } from '../lib/constants'
import { ArrowLeft, User, Star, Package } from 'lucide-react'

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setData(null)
    setNotFound(false)
    userAPI
      .getUserProfile(id!)
      .then((res) => setData(res.data.data))
      .catch(() => setNotFound(true))
  }, [id])

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">用户不存在</p>
        <Link to="/" className="text-purple-500 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        加载中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">个人主页</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 用户信息 */}
        <div className="bg-white rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{data.username}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span>{data.rating || '暂无评分'}</span>
                <span className="text-gray-300">·</span>
                <span>{data.review_count || 0}条评价</span>
              </div>
            </div>
          </div>
          {data.bio && <p className="text-gray-600 text-sm mt-4">{data.bio}</p>}
        </div>

        {/* 收到的评价 */}
        <div className="bg-white rounded-2xl p-6 mb-4">
          <h3 className="font-bold text-gray-900 mb-4">买家/卖家评价</h3>
          {data.reviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">还没有收到评价</p>
          ) : (
            <div className="space-y-4">
              {data.reviews.map((r: any) => (
                <div key={r.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-300 to-pink-300 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{r.reviewer_name}</span>
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
              ))}
            </div>
          )}
        </div>

        {/* 在售商品 */}
        <div className="bg-white rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">在售闲置</h3>
          {data.products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">暂无在售商品</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {data.products.map((p: any) => (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  className="rounded-xl overflow-hidden bg-gray-50 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-gray-100">
                    <img src={p.photos[0]} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-800 line-clamp-1">{p.name}</p>
                    <p className="text-xs text-pink-600 font-semibold mt-0.5">¥{p.price}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {categoryMap[p.category] || p.category}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
