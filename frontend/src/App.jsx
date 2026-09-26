import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import Navbar from './components/Navbar'
import AuthenticatedLayout from './components/AuthenticatedLayout'
const QuestWorkspace = lazy(() => import('./pages/QuestWorkspace'))
import History from './pages/History'
import About from './pages/About'
import Profile from './pages/Profile'
import DatabaseConnections from './pages/DatabaseConnections'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import ProtectedRoute from './auth/ProtectedRoute'
import GuestRoute from './auth/GuestRoute'

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      {!isAuthenticated && !['/', '/login', '/register', '/about'].includes(window.location.pathname) && <Navbar />}

      <Routes>
        <Route
          path="/"
          element={<GuestRoute><Login /></GuestRoute>}
        />
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
          <Route path="/dashboard" element={<Navigate to="/editor" replace />} />
          <Route path="/editor" element={<Suspense fallback={<p className="p-8">Loading workspace…</p>}><QuestWorkspace /></Suspense>} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/connections" element={<DatabaseConnections />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? "/editor" : "/login"} replace />} />
      </Routes>
    </div>
  )
}

