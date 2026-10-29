import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readWorkspace, writeWorkspace } from '../services/workspaceStorage'


const filterOptions = ['All runs', 'Successful', 'Errors', 'Favorites']

export default function History() {
  const navigate = useNavigate()
  const [history, setHistory] = useState(() => readWorkspace('runs').map((run) => ({ ...run, rows: `${run.rowsReturned} rows`, time: `${Math.round(run.executionTime)} ms`, date: new Date(run.createdAt).toLocaleDateString(), clock: new Date(run.createdAt).toLocaleTimeString() })))
  const [message, setMessage] = useState('')
  const [timeRange, setTimeRange] = useState('all')
  const [activeFilter, setActiveFilter] = useState('All runs')
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState(() => new Set(readWorkspace('favoriteQueries')))

  const visibleHistory = useMemo(() => history.filter((item) => {
    const searchable = `${item.query} ${item.type} ${item.status}`.toLowerCase()
    const matchesQuery = searchable.includes(query.toLowerCase())
    const matchesFilter = activeFilter === 'All runs'
      || (activeFilter === 'Successful' && item.status === 'Successful')
      || (activeFilter === 'Errors' && item.status === 'Error')
      || (activeFilter === 'Favorites' && favorites.has(item.query))
    const age = Date.now() - new Date(item.createdAt).getTime()
    const matchesTime = timeRange === 'all' || (timeRange === 'today' ? new Date(item.createdAt).toDateString() === new Date().toDateString() : age <= (timeRange === 'week' ? 7 : 30) * 86400000)
    return matchesQuery && matchesFilter && matchesTime
  }), [activeFilter, favorites, query, timeRange, history])

  const toggleFavorite = (id) => setFavorites((current) => {
    const next = new Set(current)
    next.has(id) ? next.delete(id) : next.add(id)
    writeWorkspace('favoriteQueries', [...next])
    return next
  })

  return (
    <div className="history-page mx-auto max-w-7xl overflow-hidden rounded-[22px] border border-[#4a42b4] bg-[#07133c] font-sans text-[#f3f5ff] shadow-[0_22px_70px_rgba(1,3,32,.55)]">
      <style>{`
        .history-page { background-image: radial-gradient(rgba(123,125,255,.32) 1px, transparent 1px), linear-gradient(180deg,#10175b 0%,#0b164c 100%); background-size: 18px 18px, auto; }
        .history-hero { background: linear-gradient(180deg,rgba(29,31,104,.96),rgba(22,25,89,.97)); box-shadow: inset 0 -1px 0 rgba(122,103,255,.55); }
        .history-row { background: linear-gradient(90deg,rgba(15,29,79,.95),rgba(23,32,91,.88)); }
        .history-row:hover { background: linear-gradient(90deg,rgba(26,42,105,.98),rgba(31,43,111,.94)); }
        .pixel-title { text-shadow: 3px 3px 0 rgba(2,8,49,.85); letter-spacing: .04em; }
      `}</style>

      <section className="relative min-h-[188px] overflow-hidden border-b border-[#4d46bf] px-5 py-5 sm:px-8 history-hero">
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0d1c56] to-transparent" />
        <div className="absolute left-8 top-4 text-4xl">📜</div>
        <div className="absolute right-8 top-1 text-4xl opacity-80">✨</div>
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 pt-2">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border-2 border-[#ffd45c] bg-[#6d3ab6] text-3xl shadow-[3px_3px_0_#352177]">📜</div>
            <div>
              <h1 className="pixel-title font-code text-2xl font-extrabold uppercase text-white sm:text-3xl">Query history</h1>
              <p className="mt-1 text-sm text-[#d7d9ff]">Your past queries, results, and victories.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#4e49b6] bg-[#4e49b6] sm:grid-cols-4">
            {[['🧩', history.length, 'Total runs'], ['✓', history.filter((run) => run.status === 'Successful').length, 'Successful'], ['✕', history.filter((run) => run.status === 'Error').length, 'Errors'], ['⭐', favorites.size, 'Favorites']].map(([icon, value, label], index) => (
              <div className="min-w-[105px] bg-[#151c5a] px-4 py-3" key={label}>
                <div className={`flex items-center gap-2 ${index === 1 ? 'text-[#54e59b]' : index === 2 ? 'text-[#ff668c]' : 'text-[#ffd34f]'}`}><span>{icon}</span><strong className="text-lg text-white">{value}</strong></div>
                <p className="mt-0.5 text-[10px] text-[#c0c5f2]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#4543a9] bg-[#101a54]/90 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[230px] flex-1 items-center gap-2 rounded-md border border-[#41449d] bg-[#0b1546] px-3 py-2 text-sm text-[#aeb7ec]">
            <span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-[#8b94d3]" placeholder="Search queries, tables, columns..." />
          </label>
          {filterOptions.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-md border px-3 py-2 text-xs font-medium transition ${activeFilter === filter ? 'border-[#7e5cff] bg-[#6243db] text-white shadow-[0_0_14px_rgba(136,87,255,.6)]' : 'border-[#41449d] bg-[#121d59] text-[#e4e6ff] hover:bg-[#252977]'}`}><span className="mr-1.5">{filter === 'All runs' ? '▦' : filter === 'Successful' ? '●' : filter === 'Errors' ? '✕' : '★'}</span>{filter}</button>)}
          <select aria-label="History time range" value={timeRange} onChange={(event) => setTimeRange(event.target.value)} className="ml-auto rounded-md border border-[#41449d] bg-[#121d59] px-3 py-2 text-xs text-white outline-none">
            <option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option>
          </select>
        </div>
      </section>

      <div className="space-y-1.5 p-2 sm:p-3">
        {message && <p role="status" className="p-3">{message}</p>}
        {visibleHistory.map((item) => {
          const isSuccess = item.status === 'Successful'
          const favorite = favorites.has(item.query)
          return <article className={`history-row grid gap-3 rounded-md border border-[#353c91] border-l-4 p-3 transition xl:grid-cols-[66px_minmax(180px,1.7fr)_100px_130px_auto] xl:items-center ${isSuccess ? 'border-l-[#42e598]' : 'border-l-[#ff4f81]'}`} key={item.id}>
            <div className={`text-center text-[10px] font-semibold ${isSuccess ? 'text-[#53e49c]' : 'text-[#ff6089]'}`}><div className={`mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full text-base text-white ${isSuccess ? 'bg-[#3acb83]' : 'bg-[#f25379]'}`}>{isSuccess ? '✓' : '✕'}</div>{item.status}</div>
            <pre className="whitespace-pre-wrap break-words font-code text-[11px] leading-[1.45] text-[#f2f3ff]"><span className="text-[#ff70c5]">{item.query}</span></pre>
            <div className="border-l border-[#363d94] pl-3 text-[11px] leading-5 text-[#c3c9ff]"><span className="rounded bg-[#2455c4] px-2 py-1 text-[9px] font-bold text-white">{item.type}</span><br />▦ {item.rows}<br />◷ {item.time}</div>
            <div className="border-l border-[#363d94] pl-3 text-[11px] leading-5 text-[#b8c0f3]">▣ &nbsp;{item.date}<br />　 {item.clock}<br />▱ &nbsp;{item.database}</div>
            <div className="flex flex-wrap justify-end gap-1.5"><button type="button" onClick={() => navigate("/editor", { state: { query: item.query, database: item.database } })} className="rounded-md bg-[#20b77d] px-3 py-2 text-xs font-semibold text-white">▷ Open in editor</button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(item.query); setMessage("Query copied.") } catch { setMessage("Unable to copy. Select the query text and copy it manually.") } }} className="rounded-md bg-[#3c32a6] px-3 py-2 text-xs font-semibold text-white">▣ Copy</button><button type="button" onClick={() => toggleFavorite(item.query)} className={`rounded-md border px-2.5 py-2 text-sm ${favorite ? 'border-[#e7b63f] bg-[#3f3651] text-[#ffd34c]' : 'border-[#5762b3] text-[#b9c4ff]'}`}>{favorite ? '★' : '☆'}</button><button type="button" aria-label="Delete query from history" onClick={() => { const next = history.filter((run) => run.id !== item.id); setHistory(next); writeWorkspace("runs", next) }} className="rounded-md border border-[#a3416d] px-2.5 py-2 text-sm text-[#ff6b95]">♙</button>{item.error && <span className="basis-full text-right text-[9px] text-[#ff7797]">ⓘ {item.error}</span>}</div>
          </article>
        })}
        {!visibleHistory.length && <p className="py-10 text-center text-sm text-[#b7c0f4]">No matching queries found.</p>}
      </div>
      <footer className="border-t border-[#4248a5] bg-[#111956] py-2 text-center text-[11px] text-[#bfc8ff]">That&apos;s {history.length} queries on your journey! Keep exploring! ✨</footer>
    </div>
  )
}
