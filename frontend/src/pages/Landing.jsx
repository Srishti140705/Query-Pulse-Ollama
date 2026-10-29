import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function Landing() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-10">
        <section className="grid min-h-[calc(100vh-9rem)] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8 ide-fade-in">
            <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-code text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent-soft)]">
              Your personal SQL workspace
            </div>
            <div className="space-y-5">
              <h1 className="font-heading max-w-3xl text-5xl font-semibold tracking-normal text-[var(--text)] sm:text-6xl">
                QueryPulse SQL IDE
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
                A premium developer workspace for composing, running, analyzing, and reusing SQL with the density of DataGrip and the polish of modern product tools.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to={isAuthenticated ? '/dashboard' : '/register'} className="ide-button-primary h-12 px-6">
                {isAuthenticated ? 'Continue to workspace' : 'Create an account'}
              </Link>
              <a href="#features" className="ide-button h-12 px-6">
                View features
              </a>
            </div>

            <div className="grid items-stretch gap-4 sm:grid-cols-3">
              <FeatureStat label="Auto-save" value="Real-time" />
              <FeatureStat label="History" value="Instant" />
              <FeatureStat label="Workspace" value="Private" />
            </div>
          </div>

          <div className="ide-card overflow-hidden p-5 ide-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <p className="font-code text-xs uppercase tracking-[0.24em] text-[var(--accent-soft)]">Workspace preview</p>
                <p className="font-heading mt-2 text-xl font-semibold">Editor + results</p>
              </div>
              <span className="rounded-lg bg-emerald-400/10 px-3 py-1 font-code text-xs text-emerald-200">Preview</span>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#0A0716]">
              <div className="flex h-10 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 font-code text-xs text-[var(--muted)]">
                <span>analytics.sql</span>
                <span>SQLite</span>
              </div>
              <pre className="font-code overflow-hidden p-5 text-sm leading-7 text-[var(--text)]">
{`SELECT id,
       name,
       email
FROM users
WHERE active = 1
ORDER BY last_login DESC
LIMIT 50;`}
              </pre>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PreviewCard label="Score" value="91%" />
              <PreviewCard label="Rows" value="50" />
              <PreviewCard label="Time" value="42 ms" />
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-6 py-10 xl:grid-cols-3">
          <FeatureHighlight title="Smart analysis" description="Warnings, recommendations, and scorecards while you write SQL." />
          <FeatureHighlight title="Rich editor" description="Readable monospaced editing, clear actions, and focused execution feedback." />
          <FeatureHighlight title="Safe execution" description="Run queries with workload protection and inspect results in sticky-header tables." />
        </section>
      </main>
    </div>
  )
}

function FeatureStat({ label, value }) {
  return (
    <div className="ide-surface min-h-28 px-5 py-4 text-sm text-[var(--text)]">
      <p className="font-code text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="font-code mt-4 text-xl font-semibold">{value}</p>
    </div>
  )
}

function FeatureHighlight({ title, description }) {
  return (
    <div className="ide-card min-h-44 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60">
      <h3 className="font-heading text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
  )
}

function PreviewCard({ label, value }) {
  return (
    <div className="ide-surface min-h-24 p-4">
      <p className="font-code text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="font-code mt-3 text-xl font-semibold text-[var(--text)]">{value}</p>
    </div>
  )
}
