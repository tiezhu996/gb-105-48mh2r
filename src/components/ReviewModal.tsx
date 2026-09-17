import { useState } from 'react'
import { X, Star } from 'lucide-react'

interface ReviewModalProps {
  title?: string
  onClose: () => void
  onSubmit: (rating: number, comment: string) => Promise<void>
}

/** 星级 + 评语评价弹窗，交易完成后双方各用一次 */
export default function ReviewModal({ title = '评价交易', onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating < 1) return
    setSubmitting(true)
    try {
      await onSubmit(rating, comment.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
            >
              <Star
                className={`w-9 h-9 transition-colors ${
                  n <= (hover || rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-200 fill-gray-200'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 300))}
          rows={4}
          placeholder="说说这次交易的感受吧~（可选）"
          className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none resize-none mb-2"
        />
        <p className="text-right text-xs text-gray-400 mb-4">{comment.length}/300</p>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          {submitting ? '提交中...' : '提交评价'}
        </button>
      </div>
    </div>
  )
}
