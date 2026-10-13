import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { useAbortable } from '../hooks/useAbortable'
import { useAuth } from '../hooks/useAuth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const nextSignal = useAbortable()

  const [form, setForm] = useState({ email: location.state?.email ?? '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const notice = location.state?.notice
  const redirectTo = location.state?.from?.pathname ?? '/lobby'

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Enter your password.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setServerError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      await login({ email: form.email.trim().toLowerCase(), password: form.password }, nextSignal())
      navigate(redirectTo, { replace: true })
    } catch (error) {
      if (error.name === 'AbortError') return
      setServerError(error.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to enter the arena."
      footer={
        <>
          New to the board?{' '}
          <Link to="/register" className="font-semibold text-violet-300 transition-colors duration-300 hover:text-violet-200">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {notice && <Alert tone="success">{notice}</Alert>}
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="player1@email.com"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
        />

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
