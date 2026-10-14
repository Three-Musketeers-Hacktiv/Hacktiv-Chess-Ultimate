import { useState } from 'react'
import { Button } from '../ui/Button'
import { Eyebrow } from '../ui/Card'
import { Modal } from '../ui/Modal'

/**
 * Shown to the side that received a draw offer. Deliberately not dismissable by backdrop/Escape:
 * the offer stays pending on the server until it is answered or a move is played.
 */
export function DrawOfferModal({ open, from, onRespond }) {
  const [busy, setBusy] = useState(null)

  const respond = async (decision) => {
    setBusy(decision)
    await onRespond(decision)
    setBusy(null)
  }

  return (
    <Modal open={open} labelledBy="draw-offer-title" className="text-center shadow-glow">
      <Eyebrow className="font-mono">Tawaran remis</Eyebrow>
      <h2 id="draw-offer-title" className="mt-3 text-2xl font-extrabold tracking-tight text-slate-50">
        Remis?
      </h2>
      <p className="mx-auto mt-3 max-w-xs text-sm text-slate-400">
        <span className="font-semibold text-violet-300">{from ?? 'Lawan'}</span> menawarkan remis (draw). Apakah Anda
        setuju?
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" loading={busy === 'decline'} disabled={busy !== null} onClick={() => respond('decline')}>
          Tolak (Decline)
        </Button>
        <Button loading={busy === 'accept'} disabled={busy !== null} onClick={() => respond('accept')}>
          Terima (Accept)
        </Button>
      </div>
    </Modal>
  )
}
