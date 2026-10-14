import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { HistoryPanel } from '../lobby/HistoryPanel'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { ChevronIcon, SettingsIcon } from '../ui/Icons'
import { Modal } from '../ui/Modal'
import { LogoMark, Wordmark } from '../ui/Logo'
import { ConnectionBadge } from './ConnectionBadge'

const navClass = ({ isActive }) =>
  cn(
    'whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium transition-all duration-300 ease-out sm:px-3',
    isActive ? 'bg-slate-800/70 text-slate-100' : 'text-slate-400 hover:text-slate-100',
  )

export function AppShell() {
  const { user, logout } = useAuth()
  const { socket } = useSocket()
  const { boardTheme } = useTheme()
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!isDropdownOpen) return undefined
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsDropdownOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isDropdownOpen])

  const openProfile = () => {
    setIsDropdownOpen(false)
    navigate('/settings?tab=profile')
  }

  const openHistory = () => {
    setIsDropdownOpen(false)
    setHistoryOpen(true)
  }

  const askLogout = () => {
    setIsDropdownOpen(false)
    setConfirmOpen(true)
  }

  const confirmLogout = () => {
    setConfirmOpen(false)
    socket?.disconnect()
    logout()
    localStorage.clear()
    navigate('/login', { replace: true })
  }

  return (
    // `isolate` keeps the -z-10 scrim above this wallpaper but below the content. No transform here: it would
    // re-anchor react-chessboard's `position: fixed` drag preview.
    <div
      className="relative isolate flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-x-hidden"
      style={{
        backgroundImage: boardTheme.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/60 backdrop-blur-sm" />
      <header className="sticky top-0 z-40 flex w-full min-w-0 flex-row items-center justify-between border-b border-slate-900 bg-slate-950/60 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link to="/lobby" aria-label="Hacktiv Chess Ultimate — Lobby" className="shrink-0">
            <LogoMark className="sm:hidden" />
            <Wordmark className="hidden sm:flex" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Primary">
            <NavLink to="/lobby" className={navClass}>
              Lobby
            </NavLink>
            <NavLink to="/analysis" className={navClass}>
              Analysis
            </NavLink>
          </nav>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <ConnectionBadge />
          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'grid size-9 shrink-0 place-items-center rounded-lg transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
                isActive ? 'bg-slate-800/70 text-violet-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
              )
            }
          >
            <SettingsIcon className="size-5" />
          </NavLink>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isDropdownOpen}
              onClick={() => setIsDropdownOpen((open) => !open)}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-1.5 py-1 transition-colors duration-200 hover:bg-slate-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-slate-700/60 bg-slate-800/70 font-mono text-xs font-semibold uppercase text-violet-200">
                {user?.username?.[0] ?? '?'}
              </span>
              <span className="max-w-24 truncate whitespace-nowrap font-mono text-sm text-slate-300 sm:max-w-40">{user?.username}</span>
              <ChevronIcon
                className={cn(
                  'size-3.5 shrink-0 text-slate-500 transition-transform duration-200',
                  isDropdownOpen ? 'rotate-[270deg]' : 'rotate-90',
                )}
              />
            </button>
            {isDropdownOpen && (
              <div
                role="menu"
                className="absolute top-full right-2 z-50 mt-2 w-48 animate-fade-in overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/90 p-1 shadow-2xl backdrop-blur-md"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={openProfile}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  Profil
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={openHistory}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  Riwayat Pertandingan
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={askLogout}
                  className="block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 transition-colors duration-200 hover:bg-red-500/10"
                >
                  Keluar Akun
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy="sign-out-title">
        <h2 id="sign-out-title" className="text-lg font-bold tracking-tight text-slate-100">
          Keluar akun
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Apakah Anda yakin ingin keluar dari Hacktiv Chess Ultimate?
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
            Batal
          </Button>
          <Button variant="danger" size="sm" onClick={confirmLogout}>
            Ya, Keluar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
