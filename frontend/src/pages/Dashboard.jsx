import React from 'react'
import { readWorkspace } from '../services/workspaceStorage'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const runs = readWorkspace('runs')
  const favorites = readWorkspace('favoriteQueries')
  const successful = runs.filter((run) => run.status === 'Successful')
  const average = successful.length ? Math.round(successful.reduce((sum, run) => sum + run.executionTime, 0) / successful.length) : 0
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="ide-card ide-fade-in p-6 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">Dashboard</p>
                <h1 className="font-heading mt-3 text-4xl font-semibold tracking-normal text-[var(--text)]">Developer SQL command center</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Monitor query activity, saved workflows, and execution health from a dense workspace built for daily database work.</p>
              </div>
              <div className="ide-surface min-w-56 px-5 py-4">
                <p className="font-code text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Active workspace</p>
                <div className="font-code mt-3 truncate text-xl font-semibold text-[var(--text)]">Personal workspace</div>
              </div>
            </div>

            <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Queries" value={runs.length} />
              <MetricCard label="Saved" value={favorites.length} />
              <MetricCard label="Errors" value={runs.length - successful.length} />
              <MetricCard label="Successful" value={successful.length} />
            </div>

            <div className="grid items-stretch gap-4 lg:grid-cols-3">
              <InfoCard title="Recent query" value={runs[0]?.query || "No queries yet"} note={runs[0] ? new Date(runs[0].createdAt).toLocaleString() : "Open the editor to get started"} />
              <InfoCard title="Performance" value={runs.length ? `${Math.round(successful.length / runs.length * 100)}%` : "—"} note="Average query success rate" />
              <InfoCard title="Average duration" value={`${average} ms`} note="Successful query requests" />
            </div>
          </div>

          <aside className="ide-surface flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-code text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Quick actions</p>
                <h2 className="font-heading mt-3 text-xl font-semibold text-[var(--text)]">Launch workflow</h2>
              </div>
              <span className="rounded-lg bg-emerald-400/10 px-3 py-1 font-code text-xs text-emerald-200">Ready</span>
            </div>

            <div className="mt-8 grid flex-1 content-start gap-3">
              <ActionLink to="/editor" label="Open query editor" />
              <ActionLink to="/history" label="Review history" />
              <ActionLink to="/settings" label="Update workspace" />
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="ide-surface flex min-h-32 flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60">
      <div className="font-code text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="font-code mt-5 text-3xl font-semibold text-[var(--text)]">{value}</div>
    </div>
  )
}

function InfoCard({ title, value, note }) {
  return (
    <div className="ide-surface flex min-h-40 flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60">
      <div className="text-sm text-[var(--muted)]">{title}</div>
      <div className="font-code mt-3 line-clamp-2 text-xl font-semibold text-[var(--text)]">{value}</div>
      <p className="mt-auto pt-4 text-sm text-[var(--muted)]">{note}</p>
    </div>
  )
}

function ActionLink({ to, label }) {
  return (
    <Link to={to} className="ide-button justify-between">
      {label}
      <span className="font-code text-[var(--muted)]">enter</span>
    </Link>
  )
}
