import { memo } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'

/** A 4×4 miniature board (light square top-left, like a real one) painted with the preset's colours. */
const miniBoard = ({ darkSquare, lightSquare }) => ({
  background: `repeating-conic-gradient(${darkSquare} 0% 25%, ${lightSquare} 0% 50%) 0 0 / 50% 50%`,
})

const Swatch = memo(function Swatch({ theme, active, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(theme.id)}
      className={cn(
        'group relative rounded-xl border p-2 text-center transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
        active
          ? 'border-emerald-400/60 bg-emerald-500/10 shadow-glow-emerald'
          : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-600/80 hover:bg-slate-800/50',
      )}
    >
      <span
        aria-hidden="true"
        className="block aspect-square w-full overflow-hidden rounded-lg transition-transform duration-200 ease-out group-hover:scale-[1.04]"
        style={miniBoard(theme)}
      />
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white shadow"
        >
          ✓
        </span>
      )}
      <span
        className={cn(
          'block py-1 text-center text-[10px] font-bold uppercase tracking-wider tracking-widest sm:text-xs',
          active ? 'text-emerald-300' : 'text-slate-400',
        )}
      >
        {theme.name}
      </span>
    </button>
  )
})

/** Grid of mini boards; clicking one switches every board in the app at once. */
export function BoardThemePicker({ className }) {
  const { boardTheme, themes, setBoardTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Board theme"
      className={cn('my-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}
    >
      {themes.map((theme) => (
        <Swatch key={theme.id} theme={theme} active={theme.id === boardTheme.id} onSelect={setBoardTheme} />
      ))}
    </div>
  )
}
