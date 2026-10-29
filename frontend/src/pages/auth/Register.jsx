import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import PrimaryButton from '../../components/ui/PrimaryButton'
import { register as registerUser } from '../../services/authService'

export default function Register() {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm()
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(data) {
    setMessage(null)
    setSubmitting(true)

    try {
      await registerUser({ username: data.username, email: data.email, password: data.password })
      reset()
      setMessage({ type: 'success', text: 'Account created successfully. You can now sign in.' })
    } catch (error) {
      const detail = error.response?.data?.detail
      setMessage({
        type: 'error',
        text: Array.isArray(detail) ? detail.map((item) => item.msg).join('. ') : typeof detail === 'string' ? detail : 'Unable to create your account. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }



  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="ide-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="font-heading text-3xl font-semibold text-[var(--text)]">Create account</div>
          <p className="text-[var(--muted)] mt-2">Start optimizing SQL with QueryPulse in seconds.</p>
        </div>

        {message && (
          <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-200'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[var(--text)]">Username</label>
            <input
              id="username"
              type="text"
              {...register('username', { required: 'Username is required' })}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition duration-200 placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {errors.username && <p className="mt-2 text-xs text-red-400">{errors.username.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">Email</label>
            <input
              id="email"
              type="email"
              {...register('email', { required: 'Email is required', pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: 'Enter a valid email address' } })}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition duration-200 placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {errors.email && <p className="mt-2 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">Password</label>
            <input
              id="password"
              type="password"
              {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition duration-200 placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {errors.password && <p className="mt-2 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--text)]">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              {...register('confirmPassword', {
                required: 'Confirm password is required',
                validate: (value) => value === watch('password') || 'Passwords must match',
              })}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition duration-200 placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {errors.confirmPassword && <p className="mt-2 text-xs text-red-400">{errors.confirmPassword.message}</p>}
          </div>

          <PrimaryButton type="submit" disabled={submitting} className="w-full">{submitting ? 'Creating account...' : 'Create account'}</PrimaryButton>
        </form>

        <div className="mt-8 text-center text-[var(--muted)] text-sm">
          Already have an account? <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-strong)]">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
