import { useState } from 'react'
import { useAbortable } from '../../hooks/useAbortable'
import { useAuth } from '../../hooks/useAuth'
import { useHome } from '../../hooks/useHome'
import { userApi } from '../../lib/api'
import { USERNAME_RE } from '../../lib/validation'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Card, Eyebrow } from '../ui/Card'
import { Field } from '../ui/Field'

const show = (value) => (value ?? '—')

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

const pickUsername = (candidate) => (typeof candidate?.username === 'string' ? candidate.username : null)

/** "Profile" tab: player record on top, then username + current-password confirmation. */
export function ProfilePanel() {
  const { user, updateUser } = useAuth()
  const { elo, stats } = useHome()
  const nextSignal = useAbortable()

  const [form, setForm] = useState(() => ({ username: user?.username ?? '', password: '' }))
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)

  const username = form.username.trim()
  const password = form.password

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFeedback(null)
  }

  const reset = () => {
    setForm({ username: user?.username ?? '', password: '' })
    setErrors({})
    setFeedback(null)
  }

  const validate = () => {
    const next = {}
    if (!username) next.username = 'Enter a new username.'
    else if (!USERNAME_RE.test(username)) next.username = '3–24 characters: letters, numbers, _ or -.'
    if (!password) next.password = 'Enter your current password to confirm.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)
    if (!validate()) return

    setSaving(true)
    try {
      const data = await userApi.updateUsername({ username, password }, nextSignal())
      const saved = pickUsername(data?.user) ?? username
      updateUser({ username: saved })
      setForm({ username: saved, password: '' })
      setFeedback({ tone: 'success', text: data?.message ?? 'Username berhasil diperbarui' })
    } catch (error) {
      if (error.name === 'AbortError') return
      setForm((prev) => ({ ...prev, password: '' }))
      if (error.status === 401) {
        setErrors({ password: error.message || 'Password salah. Konfirmasi gagal.' })
      } else if (error.status === 409) {
        setErrors({ username: error.message || 'Username sudah digunakan.' })
      } else {
        setFeedback({ tone: 'error', text: error.message })
      }
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-5 p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full border border-slate-700/60 bg-slate-800/70 font-mono text-xl font-semibold uppercase text-violet-200">
            {user?.username?.[0] ?? '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold tracking-tight text-slate-50">{user?.username}</p>
            <p className="truncate font-mono text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Elo" value={show(elo)} tone="text-violet-300" />
          <Stat label="Wins" value={show(stats?.wins)} tone="text-emerald-300" />
          <Stat label="Draws" value={show(stats?.draws)} tone="text-slate-200" />
          <Stat label="Losses" value={show(stats?.losses)} tone="text-red-300" />
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="space-y-1">
            <Eyebrow>Edit profile</Eyebrow>
            <p className="text-sm text-slate-400">Username changes need your current password.</p>
          </div>

          {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

          <Field
            label="Username"
            autoComplete="username"
            value={form.username}
            onChange={update('username')}
            error={errors.username}
          />
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="Ketik password Anda untuk mengonfirmasi"
            value={form.password}
            onChange={update('password')}
            error={errors.password}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving}>
              Save
            </Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
