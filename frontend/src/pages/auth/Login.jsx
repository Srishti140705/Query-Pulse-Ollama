import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import PrimaryButton from '../../components/ui/PrimaryButton'
import { useAuth } from '../../auth/AuthProvider'
import { login as loginUser } from '../../services/authService'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(data) {
    setMessage(null)
    setSubmitting(true)

    try {
      const response = await loginUser(data)
      const { access_token: accessToken, user } = response.data
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('auth_user', JSON.stringify(user))
      login(user)
      navigate('/dashboard')
    } catch (error) {
      const detail = error.response?.data?.detail
      const errorText = Array.isArray(detail) ? detail[0]?.msg : detail
      setMessage({ type: 'error', text: typeof errorText === 'string' ? errorText : 'Unable to sign in. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
      <div className="ide-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="font-heading text-3xl font-semibold text-[var(--text)]">Welcome back</div>
          <p className="text-[var(--muted)] mt-2">Sign in to access QueryPulse and manage your SQL workflows.</p>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">Email</label>
            <input
              id="email"
              type="email"
              {...register('email', { required: 'Email is required' })}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition duration-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {errors.email && <p className="mt-2 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">Password</label>
            <input
              id="password"
              type="password"
              {...register('password', { required: 'Password is required' })}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition duration-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {errors.password && <p className="mt-2 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <Link to="/forgot-password" className="text-[var(--accent)] hover:text-[var(--accent-strong)]">Forgot password?</Link>
          </div>

          <PrimaryButton type="submit" disabled={submitting} className="w-full">{submitting ? 'Signing in...' : 'Sign In'}</PrimaryButton>
        </form>

        <div className="mt-8 text-center text-[var(--muted)] text-sm">
          Don’t have an account? <Link to="/register" className="text-[var(--accent)] hover:text-[var(--accent-strong)]">Register</Link>
        </div>
      </div>
    </div>
  )
}
