import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api from '../services/api'
const AuthContext = createContext(null)
const normalize = (user) => ({ ...user, name: user.username, joined: user.created_at ? new Date(user.created_at).toLocaleDateString() : '—' })
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    setUser(null)
  }, [])
  const login = useCallback((value) => {
    localStorage.setItem('auth_user', JSON.stringify(value))
    setUser(normalize(value))
  }, [])
  useEffect(() => {
    if (!localStorage.getItem('access_token')) { setLoading(false); return }
    api.get('/auth/me').then(({ data }) => login(data)).catch(logout).finally(() => setLoading(false))
  }, [login, logout])
  useEffect(() => {
    window.addEventListener('auth-expired', logout)
    return () => window.removeEventListener('auth-expired', logout)
  }, [logout])
  return <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: Boolean(user) }}>{children}</AuthContext.Provider>
}
export function useAuth() { return useContext(AuthContext) }
