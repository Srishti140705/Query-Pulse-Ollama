import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', headers: { 'Content-Type': 'application/json' } })
const authConfig = () => {
  const token = localStorage.getItem('access_token')
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}
export const login = ({ email, password }) => api.post('/login', { email, password })
export const register = ({ username, email, password }) => api.post('/register', { username, email, password })
export const forgotPassword = ({ email }) => api.post('/forgot-password', { email })
export const resetPassword = ({ token, password }) => api.post('/reset-password', { token, password })
export const getCurrentUser = () => api.get('/auth/me', authConfig())
export const updateCurrentUser = (payload) => api.patch('/auth/me', payload, authConfig())
