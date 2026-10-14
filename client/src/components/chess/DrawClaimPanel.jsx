import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card, Eyebrow } from '../ui/Card'

/**
 * Draw *claims* (threefold repetition / fifty-move rule). Only rendered when it is our turn and chess.js
 * sees such a position — an invalid claim would hand the opponent two extra minutes.
 */
export function DrawClaimPanel({ claimable, isMyTurn, onClaim }) {
  const [busy, setBusy] = useState(null)
  if (!isMyTurn || !(claimable.threefold || claimable.fifty)) return null

  const run = async (key, reason) => {
    setBusy(key)
    await onClaim(reason)
    setBusy(null)
  }

  return (
    <Card className="animate-pop space-y-2 p-5">
      <Eyebrow>Claim a draw</Eyebrow>
      {claimable.threefold && (
        <Button
          size="sm"
          variant="violet"
          className="w-full"
          loading={busy === 'threefold'}
          disabled={busy !== null}
          onClick={() => run('threefold', 'threefold_repetition')}
        >
          Threefold repetition
        </Button>
      )}
      {claimable.fifty && (
        <Button
          size="sm"
          variant="violet"
          className="w-full"
          loading={busy === 'fifty'}
          disabled={busy !== null}
          onClick={() => run('fifty', 'fifty_move_rule')}
        >
          Fifty-move rule
        </Button>
      )}
    </Card>
  )
}
