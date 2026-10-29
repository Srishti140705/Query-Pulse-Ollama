import React from 'react'

export default function About() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="ide-card ide-fade-in p-6 sm:p-8">
        <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">About</p>
        <h1 className="font-heading mt-3 text-3xl font-semibold text-[var(--text)]">About QueryPulse</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
          QueryPulse is a lightweight SQL developer dashboard focused on making it easier to write, analyze, and optimize SQL queries. It combines a React editor with a FastAPI backend and a private SQLite workspace for each account.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="ide-surface min-h-36 p-5">
            <h2 className="font-heading text-lg font-semibold text-[var(--text)]">Design</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">A dark purple IDE interface with compact density, code-first typography, and violet action states.</p>
          </div>
          <div className="ide-surface min-h-36 p-5">
            <h2 className="font-heading text-lg font-semibold text-[var(--text)]">Focus</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Query composition, execution feedback, reusable history, and professional data-table ergonomics.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
