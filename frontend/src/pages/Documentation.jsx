import React from 'react'

export default function Documentation() {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="ide-card ide-fade-in p-6 sm:p-8">
        <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">Documentation</p>
        <h1 className="font-heading mt-3 text-3xl font-semibold text-[var(--text)]">Using QueryPulse</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Create an account, open the editor, and run your first query. Each account has its own SQLite workspace.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['Start with SELECT * FROM employees LIMIT 20; or create your own tables. Run one statement at a time.', 'Use Run query or Ctrl + Enter. SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, and DROP are supported. Results show up to 1,000 rows.', 'Format SQL, search and sort results, and export the filtered table to CSV.', 'History records successful and failed runs in this browser. Copy, favorite, delete, or reopen a query in the editor.', 'Adjust editor font size and line numbers in Settings. Change your password in Profile.', 'Use Explain with Ollama in the editor for a local AI review of the current SQL. Only the query and dialect are sent; QueryPulse never auto-executes AI suggestions.'].map((item) => (
            <div key={item} className="ide-surface min-h-32 p-5 text-sm leading-6 text-[var(--text)]">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
