import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWorkspaceQueries, updateWorkspaceQuery, deleteWorkspaceQuery } from '../services/workspaceService'
import { useAuth } from '../auth/AuthProvider'


const filters = [['all', '▦', 'All runs'], ['success', '●', 'Successful'], ['error', '✕', 'Errors'], ['favorite', '★', 'Favorites']]

export default function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [runs, setRuns] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    listWorkspaceQueries().then(({ data }) => {
      const records = data.map((item) => ({ ...item, type: item.query_type, rows: (item.row_count || 0) + ' rows', time: (item.execution_time_ms ?? '—') + ' ms', date: new Date(item.created_at).toLocaleDateString(), clock: new Date(item.created_at).toLocaleTimeString(), favorite: item.is_favorite }))
      setRuns(records)
      setFavorites(new Set(records.filter((item) => item.favorite).map((item) => item.id)))
    }).catch(() => setMessage('Unable to load history. Please try refreshing.')).finally(() => setLoading(false))
  }, [])
  async function remove(id) {
    try { await deleteWorkspaceQuery(id); setRuns((current) => current.filter((item) => item.id !== id)); setFavorites((current) => { const next = new Set(current); next.delete(id); return next }) }
    catch { setMessage('Unable to delete this record. Please try again.') }
  }
  async function copy(sql) {
    try { await navigator.clipboard.writeText(sql); setMessage('Query copied.') }
    catch { setMessage('Unable to access clipboard. Select the query text to copy it.') }
  }
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [range, setRange] = useState('all')
  const [favorites, setFavorites] = useState(() => new Set())
  const displayName = user?.name || 'Shreya'
  const displayed = useMemo(() => runs.filter((run) => {
    const matchText = `${run.sql} ${run.type}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || run.status === filter || (filter === 'favorite' && favorites.has(run.id))
    const date = new Date(run.created_at)
    const matchTime = range === 'all' || (range === 'today' ? date.toDateString() === new Date().toDateString() : Date.now() - date.getTime() <= 7 * 86400000)
    return matchText && matchFilter && matchTime
  }), [favorites, filter, range, search, runs])
  const toggleFavorite = async (id) => {
    try {
      const { data } = await updateWorkspaceQuery(id, { is_favorite: !favorites.has(id) })
      setFavorites((items) => { const next = new Set(items); data.is_favorite ? next.add(id) : next.delete(id); return next })
    } catch { setMessage('Unable to update favorite. Please try again.') }
  }

  return <div className="qp-history min-h-screen overflow-hidden bg-[#07133c] text-white">
    <style>{`
      .qp-history{font-family:Inter,ui-sans-serif,system-ui;background:linear-gradient(180deg,#47c9ff 0 100px,#101a60 100px 100%)}
      .qp-pixel{font-family:'JetBrains Mono',monospace;letter-spacing:.045em;text-shadow:2px 2px #241452}
      .qp-sky{display:none}
      .qp-cloud{position:absolute;background:#f5feff;border-radius:20px;height:12px;width:52px;box-shadow:20px 8px 0 4px #f5feff,40px 0 0 -2px #f5feff}.qp-cloud:after{content:'';position:absolute;width:28px;height:10px;background:#d8f1ff;border-radius:10px;left:72px;top:8px}
      .qp-mountain{position:absolute;bottom:12px;width:0;height:0;border-left:68px solid transparent;border-right:68px solid transparent;border-bottom:42px solid #77a9de;opacity:.72}.qp-grass{height:10px;background:repeating-linear-gradient(90deg,#2eac66 0 3px,#39ca75 3px 7px);position:absolute;bottom:0;left:0;right:0}
      .qp-panel{background-image:radial-gradient(rgba(148,132,255,.33) 1px,transparent 1px),linear-gradient(110deg,#141c66,#0a123c);background-size:16px 16px,auto}
      .qp-row{background:linear-gradient(90deg,rgba(14,32,86,.96),rgba(21,35,95,.94));}.qp-row:hover{background:#1b307d}
      .qp-title{display:grid;grid-template-columns:minmax(0,1fr) 390px;align-items:center;min-height:62px}.qp-title h1{font-size:20px!important;line-height:1.1}.qp-title p{margin-top:3px!important;font-size:10px!important}.qp-stats{display:grid;grid-template-columns:repeat(4,1fr);height:58px;align-items:center}.qp-stats>div{min-width:0!important;padding:6px 10px!important}.qp-toolbar{display:grid;grid-template-columns:minmax(320px,1fr) repeat(4,max-content) 105px 30px;align-items:center;padding:5px!important}.qp-toolbar>*{min-height:30px!important;padding-top:5px!important;padding-bottom:5px!important}.qp-row{display:grid;grid-template-columns:90px 33% 15% 20% 1fr;align-items:center;min-height:46px!important;padding-top:5px!important;padding-bottom:5px!important}.qp-row pre{font-size:9px!important;line-height:13px!important}.qp-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;width:100%}.qp-actions button{padding:5px 8px!important;font-size:9px!important}.qp-actions .qp-error{display:block;flex-basis:220px;max-width:220px;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qp-sky .qp-left{position:absolute;top:10%;left:7%;display:block;transform:none}.qp-sky .qp-left>div{box-sizing:border-box!important}.qp-sky .qp-left>div:first-child{width:180px;height:90px;padding:16px!important}.qp-sky .qp-left>div:nth-child(2){position:absolute;left:190px;top:8px;width:152px;height:76px;padding:12px!important;font-size:9px!important;line-height:13px!important}.qp-sky .qp-archive{position:absolute;bottom:9%;left:79%;transform:translateX(-50%) scale(.62);transform-origin:center bottom;text-align:center}.qp-sky .qp-controls{position:absolute;top:7%;right:3%;display:flex;gap:5px;transform:scale(.78);transform-origin:right top}.qp-sky .qp-cloud,.qp-sky .qp-mountain,.qp-sky .qp-grass{display:none}.qp-sky .qp-archive span{display:none}
      .qp-title{grid-template-columns:minmax(0,1fr) 440px;min-height:76px}.qp-title h1{font-size:28px!important}.qp-title p{font-size:13px!important}.qp-stats{height:68px}.qp-stats>div{padding:8px 12px!important}.qp-stats .text-base{font-size:19px!important}.qp-stats p:last-child{font-size:11px!important}.qp-toolbar{grid-template-columns:minmax(320px,1fr) repeat(4,max-content) 112px 36px;padding:7px!important}.qp-toolbar>*{min-height:36px!important;padding-top:7px!important;padding-bottom:7px!important}.qp-toolbar input,.qp-toolbar button,.qp-toolbar select{font-size:13px!important}.qp-row{grid-template-columns:100px 33% 15% 20% 1fr;min-height:58px!important;padding-top:7px!important;padding-bottom:7px!important}.qp-row pre{font-size:12px!important;line-height:16px!important}.qp-row>div:first-child{font-size:11px!important}.qp-row>div:nth-child(3),.qp-row>div:nth-child(4){font-size:12px!important;line-height:18px!important}.qp-row>div:nth-child(3) b{font-size:11px!important}.qp-actions button{padding:7px 10px!important;font-size:11px!important}.qp-actions .qp-error{font-size:10px!important}
      @media(max-width:1100px){.qp-title{grid-template-columns:1fr}.qp-stats{max-width:500px}.qp-toolbar{grid-template-columns:1fr repeat(4,max-content)}.qp-toolbar select{margin-left:0}.qp-row{grid-template-columns:58px minmax(200px,1fr) 105px 125px}.qp-actions{grid-column:2/-1;justify-content:flex-start}}@media(max-width:760px){.qp-row{grid-template-columns:50px 1fr}.qp-row>div:nth-of-type(3),.qp-row>div:nth-of-type(4){grid-column:2}.qp-toolbar{display:flex}.qp-sky .qp-controls{display:none}}
      @media(max-width:1100px){.qp-title,.qp-toolbar,.qp-row{display:flex;flex-wrap:wrap;gap:12px}.qp-row>pre{flex:1 1 100%;max-height:none}.qp-stats{width:100%}.qp-actions{justify-content:flex-start}}
    `}</style>
    <section className="qp-sky">
      <img className="qp-scenery" src="/history-scenery-banner.png" alt="Pixel-art Query Archive scenery" />
      <div className="qp-cloud qp-cloud-one" /><div className="qp-cloud qp-cloud-two" />
      <div className="qp-mountain qp-mountain-one" /><div className="qp-mountain qp-mountain-two" />
      <div className="qp-left"><div className="rounded-md border-2 border-[#7c4ee8] bg-[#f7f4ff] px-3 py-2 text-[#10184f] shadow-[3px_3px_0_#e76dd8]"><p className="text-[10px] font-bold">Welcome back,</p><p className="text-base font-black">{displayName}! 👋</p></div><div className="hidden rounded-md border border-emerald-200 bg-[#ebfff1]/95 px-2 py-1.5 text-[8px] font-semibold leading-3 text-[#223c58] sm:block">Every query you run<br />brings you closer to<br /><span className="text-emerald-600">SQL mastery! ✨</span></div></div>
      <div className="qp-archive"><span className="text-3xl">🤖</span><div className="rounded-t-lg border-4 border-[#342a9b] bg-[#5740c8] px-5 py-2 qp-pixel text-xs font-black text-[#ffe44d]">QUERY ARCHIVE</div></div>
      <div className="qp-controls"><button className="rounded-md bg-white/90 px-3 py-2 text-xs text-[#11194a] shadow">🔔<sup className="rounded bg-rose-500 px-1 text-white">3</sup></button><button className="rounded-md bg-white/90 px-3 py-2 text-[10px] font-bold text-[#11194a]">● MySQL Local　⌄<br /><span className="text-emerald-500">Connected</span></button><button className="rounded-md bg-white px-3 py-2 text-xs font-bold text-violet-700">S　⌄</button></div>
      <div className="qp-grass" />
    </section>
    <div className="qp-panel border-y border-[#5751c7] px-2 py-3 sm:px-3">
      <section className="mx-auto max-w-[1480px] rounded-lg border border-[#514ac2] bg-[#11195a]/90 px-4 py-3 shadow-[0_0_28px_rgba(75,64,210,.35)] sm:px-5">
        <div className="qp-title">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-md border-2 border-[#ffcd55] bg-[#7441be] text-2xl shadow-[2px_2px_0_#33228a]">📜</div><div><h1 className="qp-pixel text-xl font-black uppercase sm:text-2xl">Query history</h1><p className="mt-1 text-xs text-[#e1e4ff]">Your past queries, results, and victories.</p></div></div>
          <div className="qp-stats overflow-hidden rounded-md border border-[#5753c6] bg-[#5753c6] text-xs"><Stat icon="🧩" value={runs.length} label="Total runs" /><Stat icon="✓" value={runs.filter((run) => run.status === "success").length} label="Successful" color="text-emerald-400" /><Stat icon="✕" value={runs.filter((run) => run.status === "error").length} label="Errors" color="text-rose-400" /><Stat icon="⭐" value={favorites.size} label="Favorites" /></div>
        </div>
      </section>
      <section className="mx-auto mt-2 max-w-[1480px] overflow-hidden rounded-md border border-[#4649a9] bg-[#111a57]/95">
        <div className="qp-toolbar gap-2 border-b border-[#4448a4] p-2">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded border border-[#3d469e] bg-[#0a1241] px-3 py-2 text-xs text-[#b8c1ff]"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent outline-none placeholder:text-[#aeb8f0]" placeholder="Search queries, tables, columns..." /></label>
          {filters.map(([value, icon, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded border px-3 py-2 text-xs font-semibold ${filter === value ? 'border-[#ae85ff] bg-[#6e43db] shadow-[0_0_12px_#7245e9]' : 'border-[#444ba6] bg-[#16215e] hover:bg-[#263184]'}`}><span className="mr-1">{icon}</span>{label}</button>)}
          <select value={range} onChange={(event) => setRange(event.target.value)} className="ml-auto rounded border border-[#444ba6] bg-[#16215e] px-3 py-2 text-xs outline-none"><option value="all">▣ All time　⌄</option><option value="today">Today</option><option value="week">Last 7 days</option></select>
        </div>
        <div className="space-y-1 p-1.5">{message && <p role="status" className="p-3">{message}</p>}{loading && <p className="p-3">Loading history…</p>}
          {displayed.map((run) => <Run key={run.id} run={run} favorite={favorites.has(run.id)} onFavorite={toggleFavorite} onOpen={() => navigate("/editor", { state: { sql: run.sql } })} onCopy={() => copy(run.sql)} onDelete={() => remove(run.id)} />)}
          {!displayed.length && <p className="py-12 text-center text-sm text-[#c4ccff]">No query records found.</p>}
        </div>
        <footer className="relative overflow-hidden border-t border-[#4649a9] py-2 text-center text-[10px] text-[#c8d1ff]"><span className="absolute bottom-0 left-2 text-base">🌻🌿</span>That&apos;s {runs.length} queries on your journey! Keep exploring! ✨<span className="absolute bottom-0 right-2 text-base">🌿🌼</span></footer>
      </section>
    </div>
  </div>
}

function Stat({ icon, value, label, color = 'text-amber-300' }) { return <div className="min-w-[92px] bg-[#131c58] px-3 py-2"><p className={`font-bold ${color}`}><span className="mr-2">{icon}</span><span className="text-base text-white">{value}</span></p><p className="mt-0.5 text-[9px] text-[#d4d9ff]">{label}</p></div> }

function Run({ run, favorite, onFavorite, onOpen, onCopy, onDelete }) {
  const successful = run.status === 'success'
  return <article className={`qp-row grid min-h-[66px] gap-2 rounded border border-[#383f94] border-l-4 px-2 py-2 sm:grid-cols-[68px_minmax(250px,1.9fr)_116px_154px_auto] sm:items-center ${successful ? 'border-l-emerald-400' : 'border-l-rose-500'}`}>
    <div className={`text-center text-[9px] font-bold ${successful ? 'text-emerald-300' : 'text-rose-300'}`}><span className={`mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full text-base text-white ${successful ? 'bg-emerald-400' : 'bg-rose-500'}`}>{successful ? '✓' : '✕'}</span>{successful ? 'Successful' : 'Error'}</div>
    <pre className="max-h-[48px] overflow-hidden whitespace-pre-wrap font-code text-[10px] leading-4 text-fuchsia-300">{run.sql}</pre>
    <div className="border-l border-[#373e91] pl-3 text-[10px] leading-4 text-[#d4dbff]"><b className="rounded bg-[#2455c6] px-2 py-1 text-[9px] text-white">{run.type}</b><br />▦ {run.rows}<br />◷ {run.time}</div>
    <div className="border-l border-[#373e91] pl-3 text-[10px] leading-4 text-[#d4dbff]">▣ &nbsp;{run.date}<br />　 {run.clock}<br />▱ &nbsp;{run.connection_name || "Database"}</div>
    <div className="qp-actions gap-1"><button onClick={onOpen} className="rounded bg-emerald-500 px-2.5 py-1.5 text-[10px] font-bold text-emerald-950">▷ Open in editor</button><button onClick={onCopy} className="rounded bg-[#4434af] px-2.5 py-1.5 text-[10px] font-bold">▣ Copy</button><button onClick={() => onFavorite(run.id)} className={`rounded border px-2 py-1 text-sm ${favorite ? 'border-amber-400 text-amber-300' : 'border-[#6773c6] text-[#b8c3ff]'}`}>{favorite ? '★' : '☆'}</button><button onClick={onDelete} className="rounded border border-rose-500/70 px-2 py-1 text-sm text-rose-300" aria-label="Delete query">⌫</button>{run.error && <span className="qp-error rounded bg-rose-950/60 px-1 text-right text-[9px] text-rose-300">ⓘ {run.error}</span>}</div>
  </article>
}
