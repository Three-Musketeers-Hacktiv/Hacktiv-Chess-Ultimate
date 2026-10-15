import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { findPieceSet } from '../../lib/board-presets'
import { cn } from '../../lib/cn'
import { BoardThemePicker } from '../chess/BoardThemePicker'
import { pieceUrl } from '../chess/pieceAssets'
import { BoardIcon, KnightIcon, WallpaperIcon } from '../ui/Icons'
import { Card } from '../ui/Card'
import { BoardPreview } from './BoardPreview'
import { ChoiceCard } from './ChoiceCard'

const THEME_GRID = 'my-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'

const SUBTABS = [
  { id: 'board', label: 'Board', Icon: BoardIcon },
  { id: 'pieces', label: 'Pieces', Icon: KnightIcon },
  { id: 'background', label: 'Background', Icon: WallpaperIcon },
]

const miniBoard = ({ darkSquare, lightSquare }) => ({
  background: `repeating-conic-gradient(${darkSquare} 0% 25%, ${lightSquare} 0% 50%) 0 0 / 50% 50%`,
})

function PieceThumb({ set }) {
  return (
    <span
      aria-hidden="true"
      className="flex aspect-square w-full items-center justify-center gap-1 overflow-hidden rounded-lg bg-slate-950/50"
    >
      <img src={pieceUrl(set.white, 'N')} alt="" className="h-2/3 w-auto max-h-10" draggable={false} />
      <img src={pieceUrl(set.black, 'N')} alt="" className="h-2/3 w-auto max-h-10" draggable={false} />
    </span>
  )
}

function BackgroundThumb({ background }) {
  return (
    <span
      aria-hidden="true"
      className="block aspect-square w-full overflow-hidden rounded-lg"
      style={{ backgroundImage: background.css, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  )
}

function SubTabBar({ active, onChange }) {
  return (
    <div role="tablist" aria-label="Visual settings" className="flex gap-1 rounded-xl border border-slate-800/70 bg-slate-950/40 p-1">
      {SUBTABS.map(({ id, label, Icon }) => {
        const selected = id === active
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ease-out',
              selected
                ? 'bg-slate-800/90 text-slate-50 shadow-glow'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100',
            )}
          >
            <Icon className={cn('size-4', selected ? 'text-violet-300' : 'text-slate-500')} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function PresetStrip() {
  const { presets, activePresetId, applyPreset, themes } = useTheme()

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Looks</p>
      <div role="radiogroup" aria-label="Theme presets" className={THEME_GRID}>
        {presets.map((preset) => {
          const board = themes.find((theme) => theme.id === preset.boardId)
          const active = preset.id === activePresetId
          return (
            <ChoiceCard
              key={preset.id}
              value={preset.id}
              label={preset.name}
              active={active}
              onSelect={applyPreset}
            >
              <span
                aria-hidden="true"
                className="block aspect-square w-full overflow-hidden rounded-lg"
                style={board ? miniBoard(board) : undefined}
              />
            </ChoiceCard>
          )
        })}
      </div>
    </div>
  )
}

function PiecesGrid() {
  const { boardTheme, pieceSets, setPiecesType } = useTheme()

  return (
    <div role="radiogroup" aria-label="Piece set" className={THEME_GRID}>
      {pieceSets.filter((set) => !set.aliasOf).map((set) => (
        <ChoiceCard
          key={set.id}
          value={set.id}
          label={set.name}
          active={
            set.id === boardTheme.piecesType ||
            findPieceSet(boardTheme.piecesType).aliasOf === set.id
          }
          onSelect={setPiecesType}
        >
          <PieceThumb set={set} />
        </ChoiceCard>
      ))}
    </div>
  )
}

function BackgroundGrid() {
  const { boardTheme, backgrounds, setBackground } = useTheme()

  return (
    <div role="radiogroup" aria-label="Background" className={THEME_GRID}>
      {backgrounds.map((background) => (
        <ChoiceCard
          key={background.id}
          value={background.id}
          label={background.name}
          active={background.id === boardTheme.backgroundId}
          onSelect={setBackground}
        >
          <BackgroundThumb background={background} />
        </ChoiceCard>
      ))}
    </div>
  )
}

const COPY = {
  board: {
    title: 'Board colours',
    blurb: 'Saved on this device and applied to every game and review.',
  },
  pieces: {
    title: 'Piece set',
    blurb: 'The same drawing in different fills. Applied to every board at once.',
  },
  background: {
    title: 'Background',
    blurb: 'Wallpaper behind the whole app. Text stays readable over a dark overlay.',
  },
}

/** "Board & Pieces" tab: board colours, piece set and wallpaper, all through ThemeContext. */
export function ThemePanel() {
  const { boardTheme } = useTheme()
  const [subtab, setSubtab] = useState('board')
  const copy = COPY[subtab]

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-5">
        <PresetStrip />
        <Card className="space-y-4 p-6">
          <SubTabBar active={subtab} onChange={setSubtab} />
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-50">{copy.title}</h2>
            <p className="text-sm text-slate-400">{copy.blurb}</p>
          </div>
          {subtab === 'board' && <BoardThemePicker />}
          {subtab === 'pieces' && <PiecesGrid />}
          {subtab === 'background' && <BackgroundGrid />}
        </Card>
      </div>
      <BoardPreview theme={boardTheme} />
    </div>
  )
}
