import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { useAbortable } from '../hooks/useAbortable'
import { useAuth } from '../hooks/useAuth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const nextSignal = useAbortable()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!USERNAME_RE.test(form.username.trim())) {
      next.username = '3–24 characters: letters, numbers, _ or -.'
    }
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (form.password.length < 8) next.password = 'Use at least 8 characters.'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setServerError('')
    if (!validate()) return

    setSubmitting(true)
    const email = form.email.trim().toLowerCase()
    try {
      const data = await register(
        { username: form.username.trim(), email, password: form.password },
        nextSignal(),
      )
      navigate('/login', {
        replace: true,
        state: { email, notice: data?.message ?? 'Account created. Please sign in.' },
      })
    } catch (error) {
      if (error.name === 'AbortError') return
      setServerError(error.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Claim your seat"
      subtitle="Create an account and challenge players or a Grandmaster bot."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-violet-300 transition-colors duration-300 hover:text-violet-200">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <Field
          label="Username"
          autoComplete="username"
          placeholder="player1"
          value={form.username}
          onChange={update('username')}
          error={errors.username}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="player1@email.com"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="min. 8 chars"
            value={form.password}
            onChange={update('password')}
            error={errors.password}
          />
          <Field
            label="Confirm"
            type="password"
            autoComplete="new-password"
            placeholder="repeat"
            value={form.confirm}
            onChange={update('confirm')}
            error={errors.confirm}
          />
        </div>

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
