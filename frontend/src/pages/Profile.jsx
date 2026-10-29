import React, { useMemo, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { readWorkspace } from '../services/workspaceStorage'
import { useAuth } from '../auth/AuthProvider'

const Eye = ({ visible }) => <span aria-hidden="true" className="text-lg leading-none">{visible ? '◉' : '◌'}</span>

export default function Profile() {
  const { user } = useAuth()
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const displayName = user?.name || 'Explorer'
  const email = user?.email || 'explorer@querypulse.dev'
  const initials = useMemo(() => displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), [displayName])
  const joined = user?.joined || 'July 24, 2026'

  const updatePassword = (key, value) => {
    setPasswords((state) => ({ ...state, [key]: value }))
    setMessage('')
  }

  const saveChanges = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!passwords.current || !passwords.next || !passwords.confirm) return setMessage('Please fill in all password fields.')
    if (passwords.next.length < 8) return setMessage('Your new password needs at least 8 characters.')
    if (passwords.next !== passwords.confirm) return setMessage('New passwords do not match.')
    setSaving(true)
    try {
      const { data } = await api.post('/auth/change-password', { current_password: passwords.current, password: passwords.next })
      localStorage.setItem('access_token', data.access_token)
      setMessage('Password updated successfully.')
      setPasswords({ current: '', next: '', confirm: '' })
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setSaving(false) }
  }

  return (
    <main className="profile-page text-[var(--text)]">
      <section className="profile-hero">
        <div className="profile-avatar">{initials}</div>
        <div className="min-w-0">
          <p className="profile-kicker">✦ Explorer profile ✦</p>
          <h1>{displayName}</h1>
          <p className="profile-tagline">Build better queries. Earn better insights.</p>
          <div className="mt-4 flex gap-4 text-xl"><span>⭐</span><span>💗</span><span>✦</span></div>
        </div>
        <div className="level-card">
          <div className="level-label">✦ SQL level ✦</div>
          <div className="mt-1 text-4xl font-black text-pink-400">{Math.floor(readWorkspace("runs").length / 10) + 1}</div>
          <div className="mt-1 text-sm font-bold text-orange-400">Query Explorer</div>
          <div className="xp-track"><span /></div>
          <div className="mt-2 text-xs font-semibold text-indigo-300">{readWorkspace("runs").length} queries executed</div>
        </div>
      </section>

      <div className="profile-grid">
        <aside className="account-panel">
          <p className="section-kicker text-cyan-400">▣ Account intel</p>
          <InfoCard icon="✉" label="Email" value={email} />
          <InfoCard icon="✓" label="Account" value="Signed in" green />
          <InfoCard icon="◷" label="Joined" value={joined} />
          <div className="achievement-card"><span>✦</span><div><b>Achievements</b><p>Keep exploring to unlock more.</p></div></div>
        </aside>

        <section className="controls-panel">
          <p className="section-kicker text-fuchsia-400">Profile controls</p>
          <h2>Keep your account current</h2>
          <p className="controls-copy">Update your password whenever you need to. Your profile details stay protected.</p>
          {message && <div className={`profile-message ${message.startsWith('Password') ? 'success' : ''}`} role="status">{message}</div>}
          <form onSubmit={saveChanges} className="mt-8 grid gap-5 md:grid-cols-2">
            <PasswordField label="Current password" name="current" value={passwords.current} visible={visible.current} onChange={updatePassword} onToggle={() => setVisible((state) => ({ ...state, current: !state.current }))} />
            <PasswordField label="New password" name="next" value={passwords.next} visible={visible.next} onChange={updatePassword} onToggle={() => setVisible((state) => ({ ...state, next: !state.next }))} />
            <PasswordField label="Confirm password" name="confirm" value={passwords.confirm} visible={visible.confirm} onChange={updatePassword} onToggle={() => setVisible((state) => ({ ...state, confirm: !state.confirm }))} />
            <div className="flex items-end"><button className="save-button" type="submit" disabled={saving}>{saving ? "Saving…" : "▣ Save changes"}</button></div>
          </form>
        </section>
      </div>
    </main>
  )
}

function InfoCard({ icon, label, value, green }) {
  return <div className="account-info"><span className={green ? 'info-icon green' : 'info-icon'}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></div>
}

function PasswordField({ label, name, value, visible, onChange, onToggle }) {
  return <label className="password-field"><span>{label}</span><div><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={`Enter ${label.toLowerCase()}`} autoComplete={name === 'current' ? 'current-password' : 'new-password'} /><button type="button" onClick={onToggle} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}><Eye visible={visible} /></button></div></label>
}
