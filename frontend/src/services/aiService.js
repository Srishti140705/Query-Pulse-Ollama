import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })
const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } })
export const explainSql = (sql, dialect) => api.post('/ai/explain', { sql, dialect }, config())
export const optimizeSql = (sql, dialect) => api.post('/ai/optimize', { sql, dialect }, config())
export const generateSql = (prompt, dialect) => api.post('/ai/generate', { prompt, dialect }, config())
export const debugSql = (sql, error_message, dialect) => api.post('/ai/debug', { sql, error_message, dialect }, config())
export const convertSql = (sql, dialect, target_dialect) => api.post('/ai/convert', { sql, dialect, target_dialect }, config())
