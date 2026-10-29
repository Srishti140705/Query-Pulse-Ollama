import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <p className="p-8" role="status">Loading your workspace…</p>

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
