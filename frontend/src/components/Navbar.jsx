import React, { Fragment } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Transition } from '@headlessui/react'
import { useAuth } from '../auth/AuthProvider'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Documentation', to: '/documentation' },
  { label: 'About', to: '/about' },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/85 text-[var(--text)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] font-heading font-bold text-[var(--accent-text)] shadow-lg shadow-violet-950/40">
            QP
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-[var(--text)]">QueryPulse</p>
            <p className="font-code text-xs text-[var(--muted)]">SQL developer IDE</p>
          </div>
        </Link>

        <nav className="order-3 flex w-full flex-wrap items-center gap-1 md:order-none md:w-auto md:gap-3">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} active={location.pathname === item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="ide-button">
                Login
              </Link>
              <Link to="/register" className="ide-button-primary">
                Register
              </Link>
            </div>
          ) : (
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button aria-label="Account menu" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)] ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {user?.name?.split(' ').map((part) => part[0]).join('')}
                </span>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-20 mt-3 w-56 origin-top-right rounded-2xl border border-[var(--border)] bg-[var(--panel)]/95 p-2 shadow-2xl backdrop-blur-xl focus:outline-none">
                  <div className="space-y-1">
                    <MenuItem to="/dashboard">Dashboard</MenuItem>
                    <MenuItem to="/profile">My Profile</MenuItem>
                    <MenuItem to="/history">Query History</MenuItem>
                    <MenuItem to="/settings">Settings</MenuItem>
                    <div className="my-2 border-t border-[var(--border)]" />
                    <MenuItem
                      onClick={() => {
                        logout()
                        navigate('/login')
                      }}
                      destructive
                    >
                      Logout
                    </MenuItem>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          )}
        </div>
      </div>
    </header>
  )
}

function NavLink({ to, children, active }) {
  return (
    <Link
      to={to}
      className={`rounded-xl px-4 py-2 text-sm transition-all duration-200 ${
        active
          ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-lg shadow-violet-950/30'
          : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </Link>
  )
}

function MenuItem({ to, onClick, children, destructive }) {
  const base = 'flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition'
  const activeClass = destructive
    ? 'text-rose-300 hover:bg-rose-500/10'
    : 'text-[var(--text)] hover:bg-[var(--surface)]'

  if (to) {
    return (
      <Menu.Item>
        {({ active }) => (
          <Link className={`${base} ${active ? 'bg-[var(--surface)]' : ''} ${activeClass}`} to={to}>
            {children}
          </Link>
        )}
      </Menu.Item>
    )
  }

  return (
    <Menu.Item>
      {({ active }) => (
        <button
          type="button"
          onClick={onClick}
          className={`${base} ${active ? 'bg-[var(--surface)]' : ''} ${activeClass} text-left`}
        >
          {children}
        </button>
      )}
    </Menu.Item>
  )
}
