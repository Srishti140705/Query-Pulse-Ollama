import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })
const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })

export const listConnections = () => api.get('/connections', config())
export const createConnection = (payload) => api.post('/connections', payload, config())
export const updateConnection = (id, payload) => api.patch(`/connections/${id}`, payload, config())
export const deleteConnection = (id) => api.delete(`/connections/${id}`, config())
export const testConnection = (payload) => api.post('/connections/test', payload, config())
export const testSavedConnection = (id) => api.post(`/connections/${id}/test`, {}, config())
export const connectConnection = (id) => api.post(`/connections/${id}/connect`, {}, config())
export const disconnectConnection = (id) => api.post(`/connections/${id}/disconnect`, {}, config())
export const getSchema = () => api.get('/connections/active/schema', config())
export const previewTable = (table) => api.get(`/connections/active/tables/${encodeURIComponent(table)}/rows`, config())
