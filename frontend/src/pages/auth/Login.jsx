import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PrimaryButton from '../../components/ui/PrimaryButton'
import { useAuth } from '../../auth/AuthProvider'
import { login as loginUser } from '../../services/authService'
import AuthShell from './AuthShell'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const navigate = useNavigate(); const location = useLocation(); const { login } = useAuth()
  const [message, setMessage] = useState(null); const [submitting, setSubmitting] = useState(false)
  useEffect(() => { const verification = new URLSearchParams(location.search).get('verification'); const text = location.state?.message || (verification === 'success' ? 'Email verified. You can now sign in.' : verification === 'error' ? 'Verification link is invalid or expired.' : null); if (text) setMessage({ type: verification === 'error' ? 'error' : 'success', text }) }, [location])
  async function onSubmit(data) { setMessage(null); setSubmitting(true); try { const { data: response } = await loginUser(data); localStorage.setItem('access_token', response.access_token); localStorage.setItem('auth_user', JSON.stringify(response.user)); login(response.user); navigate('/editor', { replace: true }) } catch (error) { const detail = error.response?.data?.detail; setMessage({ type: 'error', text: typeof detail === 'string' ? detail : error.response?.status === 404 ? 'The sign-in service is unavailable. Please refresh and try again.' : error.response?.status >= 500 ? 'The sign-in server is having trouble. Please try again shortly.' : 'Unable to reach the sign-in service. Please check your connection.' }) } finally { setSubmitting(false) } }
  return <AuthShell mode="login">{message && <div className={`auth-message ${message.type}`}>{message.text}</div>}<form onSubmit={handleSubmit(onSubmit)} className="auth-form"><label>Email<input type="email" className="auth-input" {...register('email', { required: 'Email is required' })}/>{errors.email && <small>{errors.email.message}</small>}</label><label>Password<input type="password" className="auth-input" {...register('password', { required: 'Password is required' })}/>{errors.password && <small>{errors.password.message}</small>}</label><div className="auth-options"><Link to="/forgot-password">Forgot password?</Link></div><PrimaryButton type="submit" disabled={submitting} className="auth-submit">{submitting ? 'Signing in...' : 'Sign In'}</PrimaryButton></form><div className="auth-switch">Don&apos;t have an account? <Link to="/register">Register</Link></div></AuthShell>
}
