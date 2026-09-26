import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })
const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } })
export const listWorkspaceQueries = () => api.get('/workspace/queries', config())
export const saveWorkspaceQuery = (payload) => api.post('/workspace/queries', payload, config())
export const updateWorkspaceQuery = (id, payload) => api.patch(`/workspace/queries/${id}`, payload, config())
export const deleteWorkspaceQuery = (id) => api.delete(`/workspace/queries/${id}`, config())
