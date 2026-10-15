import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Card'

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="animate-rise text-center">
        <Eyebrow>Error 404</Eyebrow>
        <p className="mt-4 font-mono text-8xl font-semibold tracking-tighter text-slate-200">
          4<span className="text-violet-400">0</span>4
        </p>
        <p className="mt-4 text-slate-400">That square is off the board.</p>
        <Link to="/lobby" className="mt-8 inline-block">
          <Button>Back to the lobby</Button>
        </Link>
      </div>
    </div>
  )
}
