import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { Wordmark } from '../ui/Logo'
import { ConnectionBadge } from './ConnectionBadge'

const navClass = ({ isActive }) =>
  cn(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out',
    isActive ? 'bg-slate-800/70 text-slate-100' : 'text-slate-400 hover:text-slate-100',
  )

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-obsidian/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/lobby" aria-label="Hacktiv Chess Ultimate — Lobby">
            <Wordmark />
          </Link>

          <nav className="flex items-center gap-1" aria-label="Primary">
            <NavLink to="/lobby" className={navClass}>
              Lobby
            </NavLink>
            <NavLink to="/analysis" className={navClass}>
              Analysis
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <ConnectionBadge />
            <span className="hidden items-center gap-2 md:flex">
              <span className="grid size-8 place-items-center rounded-full border border-slate-700/60 bg-slate-800/70 font-mono text-xs font-semibold uppercase text-violet-200">
                {user?.username?.[0] ?? '?'}
              </span>
              <span className="font-mono text-sm text-slate-300">{user?.username}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
