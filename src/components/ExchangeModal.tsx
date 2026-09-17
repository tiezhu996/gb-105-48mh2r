import { useState } from 'react'
import { X, Loader2, RefreshCw } from 'lucide-react'

interface Props {
  productName: string
  onClose: () => void
  onSubmit: (offer: string) => Promise<void>
}

export default function ExchangeModal({ productName, onClose, onSubmit }: Props) {
  const [offer, setOffer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(offer)
    } catch (e: any) {
      setError(e.response?.data?.error || '交换请求失败')
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-pink-500" />
            发起交换
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          目标商品：<span className="font-medium text-gray-900">{productName}</span>
          <br />
          发送后卖家可以接受或拒绝；接受前双方都可取消。
        </p>

        <textarea
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          rows={4}
          maxLength={200}
          placeholder="描述你想用什么交换，例如：我有刻晴吧唧一枚，想换这个～"
          className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-pink-500 focus:bg-white outline-none transition-all resize-none"
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
            className="flex-1 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            发送交换请求
          </button>
        </div>
      </div>
    </div>
  )
}
