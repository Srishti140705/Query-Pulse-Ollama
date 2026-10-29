import React, { lazy, Suspense } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import Navbar from './components/Navbar'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import Landing from './pages/Landing'
const QueryEditor = lazy(() => import('./pages/QueryEditor'))
import History from './pages/History'
import Documentation from './pages/Documentation'
import About from './pages/About'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import ProtectedRoute from './auth/ProtectedRoute'
import GuestRoute from './auth/GuestRoute'

export default function App() {
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const workspaceRoute = ['/dashboard', '/editor', '/history', '/profile', '/settings'].includes(pathname)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      {(!isAuthenticated || !workspaceRoute) && <Navbar />}

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/documentation" element={<Documentation />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPassword />
            </GuestRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor" element={<Suspense fallback={<p className="p-8">Loading editor…</p>}><QueryEditor /></Suspense>} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<div className="p-10 text-center"><h1 className="text-2xl">Page not found</h1><Link to={isAuthenticated ? "/dashboard" : "/"} className="ide-button mt-6">Return home</Link></div>} />
      </Routes>
    </div>
  )
}
