import { defaultPieces } from 'react-chessboard'
import { Modal } from '../ui/Modal'

const CHOICES = [
  { id: 'q', name: 'Queen', code: 'Q' },
  { id: 'r', name: 'Rook', code: 'R' },
  { id: 'b', name: 'Bishop', code: 'B' },
  { id: 'n', name: 'Knight', code: 'N' },
]

export function PromotionPicker({ open, color, onSelect, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="promotion-title" className="max-w-sm">
      <h2 id="promotion-title" className="text-lg font-bold text-slate-50">
        Promote your pawn
      </h2>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {CHOICES.map(({ id, name, code }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-label={`Promote to ${name}`}
            className="group aspect-square rounded-xl border border-slate-700/60 bg-slate-800/50 p-2 transition-all duration-300 ease-out hover:scale-[1.04] hover:border-emerald-500/50 hover:bg-slate-800 hover:shadow-glow-emerald active:scale-[0.97]"
          >
            {defaultPieces[`${color}${code}`]?.({ svgStyle: { width: '100%', height: '100%' } })}
          </button>
        ))}
      </div>
    </Modal>
  )
}
