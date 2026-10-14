import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProfilePanel } from '../components/settings/ProfilePanel'
import { ThemePanel } from '../components/settings/ThemePanel'
import { Eyebrow } from '../components/ui/Card'
import { BoardIcon, UserIcon } from '../components/ui/Icons'
import { cn } from '../lib/cn'

const TABS = [
  { id: 'profile', label: 'Profile', Icon: UserIcon, Panel: ProfilePanel },
  { id: 'board', label: 'Board & Pieces', Icon: BoardIcon, Panel: ThemePanel },
]

const tabId = (id) => `settings-tab-${id}`
const panelId = (id) => `settings-panel-${id}`

export default function SettingsPage() {
  const [params] = useSearchParams()
  const requested = params.get('tab')
  const [active, setActive] = useState(() => (TABS.some((tab) => tab.id === requested) ? requested : TABS[0].id))
  const current = TABS.find((tab) => tab.id === active) ?? TABS[0]

  useEffect(() => {
    if (TABS.some((tab) => tab.id === requested)) setActive(requested)
  }, [requested])

  // Roving focus: ↑/↓ (or ←/→ when the tabs sit in a row on small screens) move between tabs.
  const onKeyDown = (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const index = TABS.findIndex((tab) => tab.id === active)
    const next = TABS[(index + step + TABS.length) % TABS.length]
    setActive(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  return (
    <div className="space-y-8 animate-rise">
      <header className="space-y-2">
        <Eyebrow>Account</Eyebrow>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl">Settings</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label="Settings sections"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="flex gap-2 md:flex-col md:self-start"
        >
          {TABS.map(({ id, label, Icon }) => {
            const selected = id === current.id
            return (
              <button
                key={id}
                id={tabId(id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(id)}
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-300 ease-out md:flex-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
                  selected
                    ? 'border-violet-500/40 bg-violet-500/10 text-slate-50 shadow-glow'
                    : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
                )}
              >
                <Icon className={cn('size-5', selected ? 'text-violet-300' : 'text-slate-500')} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Only the active panel is mounted: leaving a tab aborts its pending request and drops its state. */}
        <section
          key={current.id}
          id={panelId(current.id)}
          role="tabpanel"
          aria-labelledby={tabId(current.id)}
          className="min-w-0 animate-fade"
        >
          <current.Panel />
        </section>
      </div>
    </div>
  )
}
