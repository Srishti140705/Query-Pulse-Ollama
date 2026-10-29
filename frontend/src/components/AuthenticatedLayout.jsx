import React, { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Query Editor', to: '/editor' },
  { label: 'History', to: '/history' },
  { label: 'Profile', to: '/profile' },
  { label: 'Settings', to: '/settings' },
]

export default function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()

  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    return [
      { label: 'Home', to: '/dashboard' },
      ...segments.map((segment, index) => ({
        label: segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        to: '/' + segments.slice(0, index + 1).join('/'),
      })),
    ]
  }, [location.pathname])

  const initials = user?.name?.split(' ').map((part) => part[0]).join('') || 'QP'

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="lg:flex lg:min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-[var(--border)] bg-[var(--panel)]/95 p-5 shadow-glow backdrop-blur-xl transition duration-300 ease-out lg:fixed lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] font-heading font-bold text-white shadow-lg shadow-violet-950/40">
                QP
              </div>
              <div>
                <p className="font-heading text-sm font-semibold tracking-wide text-[var(--text)]">QueryPulse</p>
                <p className="font-code text-xs text-[var(--muted)]">SQL IDE</p>
              </div>
            </Link>
            <button type="button" onClick={() => setSidebarOpen(false)} className="ide-button h-10 w-10 px-0 lg:hidden" aria-label="Close sidebar">
              x
            </button>
          </div>

          <div className="mt-8 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex h-11 items-center justify-between rounded-xl px-4 text-sm font-medium transition-all duration-200 ${
                    isActive ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-lg shadow-violet-950/30' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-10 ide-surface p-5">
            <p className="font-code text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Account</p>
            <p className="mt-3 text-base font-semibold text-[var(--text)]">{user?.name}</p>
            <p className="truncate text-sm text-[var(--muted)]">{user?.email}</p>
          </div>
        </aside>

        <div className="flex-1 lg:pl-72">
          <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/85 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSidebarOpen(true)} className="ide-button h-11 w-11 px-0 lg:hidden" aria-label="Open sidebar">
                  =
                </button>
                <div>
                  <p className="text-sm text-[var(--muted)]">Welcome back,</p>
                  <p className="font-heading text-lg font-semibold text-[var(--text)]">{user?.name}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <Link to="/documentation" className="ide-button">Documentation</Link><button className="ide-button" onClick={logout}>Sign out</button>
                <div className="inline-flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] font-heading text-sm font-semibold text-white">
                    {initials}
                  </div>
                  <div className="hidden flex-col text-right sm:flex">
                    <span className="text-sm font-medium text-[var(--text)]">{user?.name}</span>
                    <span className="text-xs text-[var(--muted)]">{user?.role}</span>
                  </div>
                </div>
              </div>
            </div>

            <nav className="mt-4 flex min-w-0 flex-wrap items-center gap-2 font-code text-xs text-[var(--muted)]">
              {breadcrumbs.map((item, index) => (
                <span key={item.to} className="inline-flex items-center gap-2">
                  {index > 0 && <span className="text-[var(--border)]">/</span>}
                  <Link to={item.to} className="transition hover:text-[var(--accent-strong)]">
                    {item.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>

          <main className="px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
