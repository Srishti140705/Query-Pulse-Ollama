import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import PrimaryButton from '../../components/ui/PrimaryButton'
import { register as registerUser } from '../../services/authService'
import AuthShell from './AuthShell'

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm(); const navigate = useNavigate(); const [message, setMessage] = useState(null); const [submitting, setSubmitting] = useState(false)
  async function onSubmit(data) { setMessage(null); setSubmitting(true); try { const response = await registerUser({ username:data.username, email:data.email, password:data.password }); navigate('/login', { state:{ message:response.data.message || 'Account created. You can now sign in.' } }) } catch (error) { setMessage({ type:'error', text: typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Unable to create your account. Please try again.' }) } finally { setSubmitting(false) } }
  return <AuthShell mode="register">{message && <div className="auth-message error">{message.text}</div>}<form onSubmit={handleSubmit(onSubmit)} className="auth-form"><label>Username<input className="auth-input" {...register('username',{required:'Username is required'})}/>{errors.username&&<small>{errors.username.message}</small>}</label><label>Email<input type="email" className="auth-input" {...register('email',{required:'Email is required'})}/>{errors.email&&<small>{errors.email.message}</small>}</label><label>Password<input type="password" className="auth-input" {...register('password',{required:'Password is required',minLength:{value:8,message:'Minimum 8 characters'}})}/>{errors.password&&<small>{errors.password.message}</small>}</label><label>Confirm password<input type="password" className="auth-input" {...register('confirmPassword',{required:'Confirm password is required',validate:value=>value===watch('password')||'Passwords must match'})}/>{errors.confirmPassword&&<small>{errors.confirmPassword.message}</small>}</label><PrimaryButton type="submit" disabled={submitting} className="auth-submit">{submitting?'Creating account...':'Create account'}</PrimaryButton></form><div className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></div></AuthShell>
}
