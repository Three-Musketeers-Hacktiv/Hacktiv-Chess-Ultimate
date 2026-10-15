import { memo } from 'react'
import { findPieceSet } from '../../lib/board-presets'
import { pieceUrl } from '../chess/pieceAssets'
import { Eyebrow } from '../ui/Card'

const SIZE = 4
const CELLS = Array.from({ length: SIZE * SIZE }, (_, index) => ({
  index,
  // Top-left is a light square, exactly like a1-h8 on a real board.
  light: (Math.floor(index / SIZE) + (index % SIZE)) % 2 === 0,
}))

/** A compact side-by-side simulation of the chosen board, pieces and colours. */
export const BoardPreview = memo(function BoardPreview({ theme }) {
  const pieces = findPieceSet(theme.piecesType)

  return (
    <div className="mt-4 flex w-full flex-row items-center gap-4 rounded-xl border border-slate-800/40 bg-slate-900/30 p-3">
      <div
        role="img"
        aria-label={`${theme.name} board preview`}
        className="grid h-24 w-24 shrink-0 grid-cols-4 overflow-hidden rounded-lg sm:h-32 sm:w-32"
      >
        {CELLS.map(({ index, light }) => (
          <span
            key={index}
            className="transition-colors duration-300 ease-out"
            style={{ backgroundColor: light ? theme.lightSquare : theme.darkSquare }}
          />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <Eyebrow>Preview</Eyebrow>
        <p className="truncate text-sm font-semibold text-slate-100">{theme.name}</p>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300">
          <img src={pieceUrl(pieces.white, 'N')} alt="" className="h-5 w-auto" draggable={false} />
          <img src={pieceUrl(pieces.black, 'N')} alt="" className="h-5 w-auto" draggable={false} />
          {pieces.name} pieces
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: theme.lightSquare }} />
            {theme.lightSquare}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: theme.darkSquare }} />
            {theme.darkSquare}
          </span>
        </div>
      </div>
    </div>
  )
})
