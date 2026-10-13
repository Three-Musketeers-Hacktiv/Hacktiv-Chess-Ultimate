import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Wordmark } from '../ui/Logo'

/** Decorative board lattice that fades out toward the edges. */
function Lattice() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          'conic-gradient(#94a3b8 25%, transparent 0 50%, #94a3b8 0 75%, transparent 0)',
        backgroundSize: '96px 96px',
        maskImage: 'radial-gradient(ellipse 60% 55% at 50% 45%, black, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 45%, black, transparent 75%)',
      }}
    />
  )
}

export function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <Lattice />
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-130 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="relative w-full max-w-105 animate-rise">
        <Link to="/login" className="mb-8 flex justify-center" aria-label="Hacktiv Chess Ultimate">
          <Wordmark />
        </Link>

        <Card glass className="p-7 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </div>
  )
}
