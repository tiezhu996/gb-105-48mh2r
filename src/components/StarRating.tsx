import { useState } from 'react'
import { Star } from 'lucide-react'

interface Props {
  value: number
  onChange?: (v: number) => void
  size?: number
  readOnly?: boolean
}

export default function StarRating({ value, onChange, size = 24, readOnly }: Props) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => !readOnly && onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
        >
          <Star
            style={{ width: size, height: size }}
            className={
              n <= shown
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }
          />
        </button>
      ))}
    </div>
  )
}
