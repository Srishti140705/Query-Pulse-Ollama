import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { readWorkspace, writeWorkspace } from '../services/workspaceStorage'

export default function Settings() {
  const { user } = useAuth()
  const [fontSize, setFontSize] = useState(() => readWorkspace('editorFontSize', 14))
  const [lineNumbers, setLineNumbers] = useState(() => readWorkspace('lineNumbers', true))
  const [message, setMessage] = useState('')
  function save(event) {
    event.preventDefault()
    writeWorkspace('editorFontSize', Number(fontSize))
    writeWorkspace('lineNumbers', lineNumbers)
    setMessage('Preferences saved. They will apply when you open the editor.')
  }
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="ide-card p-8"><p className="font-code text-sm text-[var(--accent-soft)]">Settings</p><h1 className="mt-3 text-3xl font-semibold">Workspace preferences</h1><p className="mt-3 text-[var(--muted)]">Preferences and query history are saved in this browser for your account.</p></header>
    <form onSubmit={save} className="ide-card space-y-6 p-8">
      <h2 className="text-xl font-semibold">SQL editor</h2>
      <label className="flex items-center justify-between gap-4">Font size<select value={fontSize} onChange={(event) => setFontSize(event.target.value)} className="ide-surface p-3">{[12,14,16,18,20].map((size) => <option key={size} value={size}>{size} px</option>)}</select></label>
      <label className="flex items-center justify-between gap-4">Show line numbers<input type="checkbox" checked={lineNumbers} onChange={(event) => setLineNumbers(event.target.checked)} /></label>
      <p className="text-sm text-[var(--muted)]">Your private SQLite workspace includes an employees table to get started. Query results are capped at 1,000 rows, with a 30-second execution limit.</p>
      <button className="ide-button-primary" type="submit">Save preferences</button>
      {message && <p role="status">{message}</p>}
    </form>
    <section className="ide-card space-y-4 p-8"><h2 className="text-xl font-semibold">Account</h2><p>{user?.name}</p><p>{user?.email}</p><Link to="/profile" className="ide-button">Change password</Link></section>
    <section className="ide-card space-y-4 p-8"><h2 className="text-xl font-semibold">Editor shortcuts</h2><p>Run query: Ctrl + Enter (⌘ + Enter on Mac)</p><p>Format SQL: use the Format button above the editor.</p></section>
  </div>
}
