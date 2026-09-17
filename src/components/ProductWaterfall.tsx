import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { CATEGORY_MAP } from '@/lib/constants'

interface Product {
  id: number
  name: string
  price: number
  photos: string[]
  ip_name: string
  character_name?: string
  category: string
  status?: string
  exchange_intent?: string
  seller_name?: string
  seller_rating?: number
}

// 商品卡片瀑布流（CSS columns 实现，图片保持原始比例）
export default function ProductWaterfall({ products }: { products: Product[] }) {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:_balance]">
      {products.map((product) => (
        <Link
          key={product.id}
          to={`/product/${product.id}`}
          className="break-inside-avoid mb-4 block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group"
        >
          <div className="relative overflow-hidden bg-gray-100">
            <img
              src={product.photos?.[0]}
              alt={product.name}
              loading="lazy"
              className="w-full h-auto group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-purple-600">
              {CATEGORY_MAP[product.category] || product.category}
            </div>
            {product.status === 'reserved' && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="px-3 py-1 bg-amber-500 text-white text-sm font-medium rounded-full">
                  交易中
                </span>
              </div>
            )}
            {product.status === 'sold' && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="px-3 py-1 bg-gray-700 text-white text-sm font-medium rounded-full">
                  已售出
                </span>
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
              {product.name}
            </h3>
            <p className="text-xs text-gray-400 truncate mb-1.5">
              {product.ip_name}
              {product.character_name ? ` · ${product.character_name}` : ''}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-purple-600 font-bold">¥{product.price}</span>
              {product.exchange_intent && (
                <span className="inline-flex items-center gap-1 text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full shrink-0">
                  可交换
                </span>
              )}
            </div>
            {product.seller_name && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-500 truncate max-w-[110px]">
                  {product.seller_name}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-gray-500">
                    {product.seller_rating || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
