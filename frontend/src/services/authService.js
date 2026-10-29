import api from './api'

export async function login({ email, password }) {
  return api.post('/login', { email, password })
}

export async function register({ username, email, password }) {
  return api.post('/register', { username, email, password })
}

export async function logout() {
  return api.post('/auth/logout')
}

export async function forgotPassword({ email }) {
  return api.post('/auth/forgot-password', { email })
}

export async function resetPassword({ token, password }) {
  return api.post('/auth/reset-password', { token, password })
}

export async function googleLogin({ accessToken }) {
  return api.post('/auth/google', { access_token: accessToken })
}

export async function githubLogin({ accessToken }) {
  return api.post('/auth/github', { access_token: accessToken })
}
