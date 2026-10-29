import React, { useState } from 'react'
import api, { errorMessage } from '../../services/api'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import PrimaryButton from '../../components/ui/PrimaryButton'

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors } } = useForm()

  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function onSubmit(data) {
    setSubmitting(true)
    setMessage('')
    try {
      const response = await api.post('/auth/forgot-password', { email: data.email })
      setMessage(response.data.message)
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
      <div className="ide-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="font-heading text-3xl font-semibold text-[var(--text)]">Reset your password</div>
          <p className="text-[var(--muted)] mt-2">Enter your email and we’ll send you instructions to reset your password.</p>
        </div>

        {message && <p className="mb-5 text-sm" role="status">{message}</p>}
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

          <PrimaryButton disabled={submitting} type="submit" className="w-full">Send reset link</PrimaryButton>
        </form>

        <div className="mt-8 text-center text-[var(--muted)] text-sm">
          Remembered your password? <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-strong)]">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
