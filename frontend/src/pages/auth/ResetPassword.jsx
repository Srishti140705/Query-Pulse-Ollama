import React, { useState } from 'react'
import api, { errorMessage } from '../../services/api'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import PrimaryButton from '../../components/ui/PrimaryButton'

export default function ResetPassword() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm()

  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function onSubmit(data) {
    setSubmitting(true)
    setMessage('')
    try {
      const response = await api.post('/auth/reset-password', { password: data.password, token: new URLSearchParams(window.location.search).get('token') || '' })
      setMessage(response.data.message)
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="ide-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="font-heading text-3xl font-semibold text-[var(--text)]">Create a new password</div>
          <p className="text-[var(--muted)] mt-2">Choose a strong password to keep your account secure.</p>
        </div>

        {message && <p className="mb-5 text-sm" role="status">{message}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-[var(--text)]">New password</label>
            <input
              id="new-password"
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

          <PrimaryButton disabled={submitting} type="submit" className="w-full">Reset password</PrimaryButton>
        </form>

        <div className="mt-8 text-center text-[var(--muted)] text-sm">
          Back to <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-strong)]">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
