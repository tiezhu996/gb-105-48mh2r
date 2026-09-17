import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import StarRating from './StarRating'
import { reviewAPI } from '../lib/api'

interface Props {
  order: any
  targetName: string
  onClose: () => void
  onDone: () => void
}

export default function ReviewModal({ order, targetName, onClose, onDone }: Props) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await reviewAPI.createReview({
        order_id: order.id,
        // 我买到的 → 评价卖家；我卖出的 → 评价买家
        reviewee_id: order.counterparty_id,
        rating,
        comment,
      })
      onDone()
    } catch (e: any) {
      setError(e.response?.data?.error || '评价失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            评价交易对方
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          对方：<span className="font-medium text-gray-900">{targetName}</span>
        </p>

        <div className="mb-4">
          <StarRating value={rating} onChange={setRating} size={32} />
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={300}
          placeholder="说说这次交易的感受吧（可选）"
          className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all resize-none"
        />

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            提交评价
          </button>
        </div>
      </div>
    </div>
  )
}
