import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <p className="p-8" role="status">Loading your workspace…</p>

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
