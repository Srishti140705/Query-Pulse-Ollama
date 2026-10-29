import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 35000 })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.includes('login')) window.dispatchEvent(new Event('auth-expired'))
  return Promise.reject(error)
})
export function errorMessage(error) {
  const detail = error.response?.data?.detail || error.response?.data?.error
  return Array.isArray(detail) ? detail.map((item) => item.msg).join('. ') : detail || error.message || 'Request failed. Please try again.'
}
export default api
