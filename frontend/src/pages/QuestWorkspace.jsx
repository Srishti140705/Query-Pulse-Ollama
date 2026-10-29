import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/editor.all'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { format } from 'sql-formatter'
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analyzeQuery, executeQuery, getExecutionPlan } from '../services/queryService'
import { listConnections } from '../services/connectionService'
import { listWorkspaceQueries } from '../services/workspaceService'
import { debugSql, explainSql, optimizeSql } from '../services/aiService'

const starterSql = `SELECT
  department,
  AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > 50000
ORDER BY avg_salary DESC;`

const formatDuration = (milliseconds) => milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(2)} s` : `${milliseconds} ms`
const speedTone = (milliseconds) => milliseconds > 1000 ? 'slow' : milliseconds >= 200 ? 'moderate' : 'fast'

function SlowQueryTooltip({ active, payload }) {
  const query = active && payload?.[0]?.payload
  if (!query) return null
  return (
    <div className="slow-query-tooltip">
      <strong>{formatDuration(query.execution_time_ms)}</strong>
      <code>{query.sql}</code>
      <span>{query.row_count ?? 0} rows • {query.status}</span>
      <span>{query.performance_reason || 'No performance signal recorded'}</span>
      <time>{new Date(query.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
    </div>
  )
}

export default function QuestWorkspace() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const location = useLocation()
  const draftKey = `querypulse:${user.id}:draft`
  const [running, setRunning] = useState(false)
  const [connectionName, setConnectionName] = useState('No active connection')
  const [cursor, setCursor] = useState({ lineNumber: 1, column: 1 })
  const runRef = useRef(null)
  const [tabs, setTabs] = useState(() => [{ id: 0, name: 'query.sql', sql: location.state?.sql || location.state?.query || localStorage.getItem(draftKey) || starterSql }])
  const [activeTabId, setActiveTabId] = useState(0)
  const [notice, setNotice] = useState('Query ready')
  const [resultRows, setResultRows] = useState([])
  const [resultSearch, setResultSearch] = useState('')
  const [history, setHistory] = useState([])
  const [queryInsights, setQueryInsights] = useState([])
  const [lastExecutionError, setLastExecutionError] = useState('')
  const [dialect, setDialect] = useState('mysql')
  const [executionPlan, setExecutionPlan] = useState({ loading: false, data: null, error: '' })
  const [staticAnalysis, setStaticAnalysis] = useState({ loading: false, data: null, error: '' })
  const [aiReview, setAiReview] = useState({ loading: false, action: '', data: null, error: '' })
  const [historyTop, setHistoryTop] = useState(394)
  const [historyMinHeight, setHistoryMinHeight] = useState(385)
  const editorPanelRef = useRef(null)
  const companionPanelRef = useRef(null)
  const resultPanelRef = useRef(null)
  const resultTableRef = useRef(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const sql = activeTab?.sql || ''
  useEffect(() => { localStorage.setItem(draftKey, sql) }, [draftKey, sql])
  useEffect(() => { listConnections().then(({ data }) => setConnectionName(data.find((item) => item.is_active)?.name || 'No active connection')).catch(() => {}) }, [])

  function handleRequestError(error, fallbackMessage) {
    const detail = error?.response?.data?.detail
    const message = Array.isArray(detail) ? detail.map((item) => item.msg).join('. ') : detail || error?.message || fallbackMessage
    const sessionExpired = error?.response?.status === 401 || /invalid or expired token|authentication required/i.test(message)
    if (sessionExpired) {
      setNotice('Session expired. Redirecting to sign in...')
      logout()
      navigate('/login', { replace: true, state: { message: 'Your session expired. Please sign in again.' } })
      return { sessionExpired: true, message: 'Your session expired. Please sign in again.' }
    }
    return { sessionExpired: false, message }
  }

  function setSql(value) {
    if (!activeTab) { setTabs([{ id: 0, name: 'query.sql', sql: value }]); setActiveTabId(0); return }
    setTabs((current) => current.map((tab) => tab.id === activeTabId ? { ...tab, sql: value } : tab))
    setExecutionPlan({ loading: false, data: null, error: '' })
    setStaticAnalysis({ loading: false, data: null, error: '' })
    setLastExecutionError('')
    setAiReview({ loading: false, action: '', data: null, error: '' })
  }

  async function runAiReview(action) {
    if (!sql.trim()) {
      setAiReview({ loading: false, action, data: null, error: 'Enter SQL before asking the AI Companion.' })
      return
    }
    setAiReview({ loading: true, action, data: null, error: '' })
    try {
      let response
      if (action === 'explain') response = await explainSql(sql, dialect)
      if (action === 'optimize') response = await optimizeSql(sql, dialect)
      if (action === 'debug') response = await debugSql(sql, lastExecutionError, dialect)
      setAiReview({ loading: false, action, data: response.data, error: '' })
      setNotice(`AI ${action} review completed`)
    } catch (error) {
      const failure = handleRequestError(error, 'AI Companion request failed')
      if (failure.sessionExpired) return
      setAiReview({ loading: false, action, data: null, error: failure.message })
      setNotice(failure.message)
    }
  }

  function insertAiSuggestion() {
    const data = aiReview.data || {}
    const suggestion = data.optimized_sql || data.corrected_sql || data.generated_sql || data.converted_sql
    if (!suggestion) return
    setSql(suggestion)
    setNotice('AI suggestion inserted. Review it before running.')
  }

  function addTab() {
    let suffix = 1
    while (tabs.some((tab) => tab.name === `query.sql${suffix}`)) suffix += 1
    const nextTab = { id: Date.now(), name: `query.sql${suffix}`, sql: '' }
    setTabs((current) => [...current, nextTab])
    setActiveTabId(nextTab.id)
    setNotice(`${nextTab.name} opened`)
  }

  function closeTab(id) {
    const closingIndex = tabs.findIndex((tab) => tab.id === id)
    const remaining = tabs.filter((tab) => tab.id !== id)
    setTabs(remaining)
    if (id === activeTabId) setActiveTabId(remaining[Math.max(0, closingIndex - 1)]?.id ?? null)
  }

  const slowestQueries = useMemo(() => {
    const today = new Date().toDateString()
    return queryInsights
      .filter((item) => item.execution_time_ms != null && new Date(item.created_at).toDateString() === today)
      .sort((left, right) => right.execution_time_ms - left.execution_time_ms)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        label: `${String(item.sql || '').replace(/\s+/g, ' ').slice(0, 42)}${String(item.sql || '').replace(/\s+/g, ' ').length > 42 ? '…' : ''}`,
        tone: speedTone(item.execution_time_ms),
      }))
  }, [queryInsights])
  const resultColumns = Object.keys(resultRows[0] || {})
  const filteredResultRows = useMemo(() => {
    const search = resultSearch.trim().toLowerCase()
    if (!search) return resultRows
    return resultRows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(search)))
  }, [resultRows, resultSearch])

  useEffect(() => {
    let cancelled = false
    listWorkspaceQueries()
      .then((response) => {
        if (!cancelled) {
          const records = Array.isArray(response.data) ? response.data : []
          setQueryInsights(records)
          setHistory(records.map((item) => [item.sql.replace(/\s+/g, ' ').slice(0, 35), item.status === 'error' ? 'Error' : (item.row_count || 0) + ' rows', new Date(item.created_at).toLocaleDateString(), item.status === 'success', item.sql]))
        }
      })
      .catch((error) => {
        if (cancelled) return
        const failure = handleRequestError(error, 'Could not load query insights')
        if (!failure.sessionExpired) setQueryInsights([])
      })
    return () => { cancelled = true }
  }, [])

  function showSearchResult() {
    setNotice(resultSearch.trim() ? `${filteredResultRows.length} matching rows found` : `${resultRows.length} rows available`)
  }

  function viewLastResult() {
    if (!filteredResultRows.length || !resultTableRef.current) return
    resultTableRef.current.scrollTo({ top: resultTableRef.current.scrollHeight, behavior: 'smooth' })
    setNotice('Showing the last matching result')
  }

  async function generateExecutionPlan() {
    if (!sql.trim()) {
      setExecutionPlan({ loading: false, data: null, error: 'Enter a query before generating a plan.' })
      return
    }
    setExecutionPlan({ loading: true, data: null, error: '' })
    try {
      const response = await getExecutionPlan(sql, dialect)
      setExecutionPlan({ loading: false, data: response, error: '' })
      setNotice('Execution plan generated')
    } catch (error) {
      const failure = handleRequestError(error, 'Execution plan failed')
      if (failure.sessionExpired) return
      setExecutionPlan({ loading: false, data: null, error: failure.message })
      setNotice(failure.message)
    }
  }

  async function runStaticAnalysis() {
    if (!sql.trim()) {
      setStaticAnalysis({ loading: false, data: null, error: 'Enter a query before running static analysis.' })
      return
    }
    setStaticAnalysis({ loading: true, data: null, error: '' })
    try {
      const response = await analyzeQuery(sql, dialect)
      if (response.error) throw new Error(response.error)
      setStaticAnalysis({ loading: false, data: response, error: '' })
      setNotice('Static analysis complete')
    } catch (error) {
      const failure = handleRequestError(error, 'Static analysis failed')
      if (failure.sessionExpired) return
      setStaticAnalysis({ loading: false, data: null, error: failure.message })
      setNotice(failure.message)
    }
  }

  useEffect(() => {
    function alignHistory() {
      if (!resultPanelRef.current || !editorPanelRef.current || !companionPanelRef.current) return
      const nextHistoryTop = resultPanelRef.current.offsetTop + resultPanelRef.current.offsetHeight + 14
      const leftColumnBottom = companionPanelRef.current.offsetTop + companionPanelRef.current.offsetHeight
      setHistoryTop(nextHistoryTop)
      setHistoryMinHeight(Math.max(320, leftColumnBottom - nextHistoryTop))
    }
    alignHistory()
    window.addEventListener('resize', alignHistory)
    return () => window.removeEventListener('resize', alignHistory)
  }, [resultRows.length])


  async function runQuery() {
    if (running) return
    if (!sql.trim()) {
      setNotice('Enter a query before running it')
      return
    }
    setRunning(true)
    setResultRows([])
    setResultSearch('')
    setNotice('Running query...')
    let historyInfo = 'Error'
    let historyOk = false
    let insightRecord = null
    try {
      const response = await executeQuery(sql, dialect)
      const result = response?.result || response
      insightRecord = result?.history_record || null
      if (result?.error) throw new Error(result.error)
      const liveRows = Array.isArray(result?.rows) ? result.rows : []
      setResultRows(liveRows)
      setLastExecutionError('')
      setNotice((result?.message || `Executed successfully - ${liveRows.length} rows returned`) + (result?.truncated ? ' Showing first 1,000 rows.' : '') + (result?.history_warning ? ` ${result.history_warning}` : ''))
      historyInfo = liveRows.length
        ? `${liveRows.length} rows`
        : result?.affected_rows
          ? `${result.affected_rows} affected`
          : 'Success'
      historyOk = true
    } catch (error) {
      const failure = handleRequestError(error, 'Query execution failed')
      if (failure.sessionExpired) return
      const errorMessage = failure.message
      setResultRows([])
      setLastExecutionError(errorMessage)
      setNotice(errorMessage)
    } finally { setRunning(false) }
    if (insightRecord) {
      setQueryInsights((current) => [
        insightRecord,
        ...current.filter((item) => item.id !== insightRecord.id),
      ].slice(0, 100))
    }
    const normalizedSql = sql.trim().replace(/\s+/g, ' ').toLowerCase()
    setHistory((current) => [
      [sql.replace(/\s+/g, ' ').slice(0, 35) + '...', historyInfo, 'now', historyOk, sql],
      ...current.filter((item) => item[4].trim().replace(/\s+/g, ' ').toLowerCase() !== normalizedSql),
    ])
  }

  function loadHistoryQuery(query) {
    setSql(query)
    setNotice('Loaded query from history')
  }

  function formatQuery() {
    try { setSql(format(sql, { language: dialect })); setNotice('SQL formatted') }
    catch { setNotice('Could not format this SQL statement.') }
  }
  function exportCsv() {
    if (!filteredResultRows.length) return
    const escape = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"'
    const csv = [resultColumns.map(escape).join(','), ...filteredResultRows.map((row) => resultColumns.map((column) => escape(row[column])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'query-results.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="quest-workspace">
      <section className="workspace-grid" style={{ '--history-top': `${historyTop}px`, '--history-min-height': `${historyMinHeight}px` }}>
        <div ref={editorPanelRef} className="quest-panel editor-panel">
          <div className="editor-tabbar">
            {tabs.map((tab) => <div key={tab.id} className={`query-tab ${activeTabId === tab.id ? 'selected' : ''}`}><button type="button" className="tab-select" onClick={() => setActiveTabId(tab.id)}><i /> {tab.name}</button><button type="button" className="tab-close" onClick={() => closeTab(tab.id)} aria-label={`Close ${tab.name}`}>×</button></div>)}
            <button type="button" className="tab-add" onClick={addTab} aria-label="Open a new query tab">+</button>
          </div>
          <div className="quest-toolbar" aria-label="SQL actions">
            <button ref={runRef} className="run" disabled={running || !sql.trim()} onClick={runQuery}>{running ? "Running…" : "▶ Run"}</button>
            <button className="explain" onClick={formatQuery}>Format SQL</button>
            <button className="convert" onClick={exportCsv} disabled={!filteredResultRows.length}>Export CSV</button>
            <button className="clear" onClick={() => setSql('')}>▱ Clear</button>
          </div>
          <div className="editor-shell">
            <div className="editor-filebar"><span><b /> {activeTab?.name || 'No query open'}</span><select aria-label="Database dialect" value={dialect} onChange={(event) => { setDialect(event.target.value); setExecutionPlan({ loading: false, data: null, error: '' }); setStaticAnalysis({ loading: false, data: null, error: '' }) }}><option value="mysql">MySQL</option></select></div>
            <Editor onMount={(editor) => { editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.click()); editor.onDidChangeCursorPosition((event) => setCursor(event.position)) }} height="294px" defaultLanguage="sql" value={sql} onChange={(value) => setSql(value || '')} theme="vs-dark" options={{ readOnly: !activeTab, minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 14, bottom: 14 }, automaticLayout: true }} />
            <div className="editor-status"><span>Ln {cursor.lineNumber}, Col {cursor.column}</span><span>Spaces: 4</span><span>{dialect === 'postgresql' ? 'PostgreSQL' : dialect === 'sqlite' ? 'SQLite' : 'MySQL'}</span><b>✓ {notice}</b></div>
          </div>
        </div>

        <aside className="quest-side">
          <section ref={resultPanelRef} className="quest-panel result-panel">
            <header><h2>✦ Result Set</h2><span>{resultSearch.trim() ? `${filteredResultRows.length} / ${resultRows.length}` : resultRows.length} rows</span></header>
            <form className="result-search" onSubmit={(event) => { event.preventDefault(); showSearchResult() }}>
              <input aria-label="Search query results" placeholder="Search results..." value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} />
              <button type="submit" aria-label="Search results" title="Search results">⌕</button>
              <button type="button" aria-label="View last matching result" title="View last matching result" onClick={viewLastResult} disabled={!filteredResultRows.length}>⇩</button>
            </form>
            <div ref={resultTableRef} className="result-table quest-scroll">{resultColumns.length > 0 && <div className="result-head" style={{ gridTemplateColumns: `repeat(${resultColumns.length}, minmax(110px, 1fr))` }}>{resultColumns.map((column) => <span key={column}>{column}</span>)}</div>}{filteredResultRows.length > 0 ? filteredResultRows.map((row, index) => <div className="result-row" style={{ gridTemplateColumns: `repeat(${resultColumns.length}, minmax(110px, 1fr))` }} key={index}>{resultColumns.map((column, columnIndex) => columnIndex === resultColumns.length - 1 ? <b key={column}>{String(row[column])}</b> : <span key={column}>{String(row[column])}</span>)}</div>) : <p className="result-empty">{resultRows.length ? 'No rows match your search.' : 'This statement returned no result rows.'}</p>}</div>
            <footer><small>{filteredResultRows.length} matching rows</small></footer>
          </section>
          <section className="quest-panel history-panel">
            <header><h2>♟ Query History</h2><button type="button" onClick={() => navigate('/history')}>View all</button></header>
            <div className="history-list quest-scroll">{history.map(([query, info, time, ok, fullQuery], index) => <article key={`${fullQuery}-${index}`} onClick={() => loadHistoryQuery(fullQuery)} title="Load this query in the editor"><b className={ok ? 'ok' : 'bad'}>{ok ? '✓' : '×'}</b><div><strong>{query}</strong><small>MySQL &nbsp; <em className={ok ? '' : 'error'}>{info}</em></small></div><time>{time}</time></article>)}</div>
            <button type="button" className="history-clear" onClick={() => navigate("/history")}>Manage history and favorites</button>
          </section>
        </aside>

        <section ref={companionPanelRef} className="quest-panel companion-panel">
          <header><h2>♟ AI Companion</h2><div className="ai-actions"><button type="button" onClick={() => runAiReview('explain')} disabled={aiReview.loading}>Explain</button><button type="button" onClick={() => runAiReview('optimize')} disabled={aiReview.loading}>Optimize</button><button type="button" onClick={() => runAiReview('debug')} disabled={aiReview.loading}>Debug</button></div></header>
          <div className="companion-body">
            <div className={`robot-mini ${aiReview.loading ? 'thinking' : ''}`} aria-hidden="true" />
            <div className="ai-conversation">
              {!aiReview.loading && !aiReview.data && !aiReview.error && <div className="ai-answer"><h3>Ollama SQL assistant</h3><p>Choose Explain, Optimize, or Debug to review the SQL currently in the editor.</p></div>}
              {aiReview.loading && <div className="ai-thinking"><div className="thinking-dots"><i /><i /><i /></div><h3>Reviewing your SQL</h3><p>QueryPulse is combining deterministic checks with the configured AI provider.</p></div>}
              {aiReview.error && <div className="ai-answer warning"><h3>AI Companion unavailable</h3><p>{aiReview.error}</p></div>}
              {aiReview.data && <div className={`ai-answer ${aiReview.data.provider_available ? 'success' : 'warning'}`}>
                <h3>{aiReview.action.charAt(0).toUpperCase() + aiReview.action.slice(1)} review</h3>
                <p>{aiReview.data.explanation || aiReview.data.summary || aiReview.data.problem || aiReview.data.deterministic_review?.operation_summary || 'The review completed successfully.'}</p>
                {aiReview.data.provider_warning && <section><h4>Provider status</h4><p>{aiReview.data.provider_warning} Deterministic SQL checks are still shown below.</p></section>}
                {(aiReview.data.issues?.length > 0 || aiReview.data.deterministic_review?.issues?.length > 0) && <section><h4>Issues</h4><ul>{(aiReview.data.issues || aiReview.data.deterministic_review?.issues || []).map((item, index) => <li key={`${item.message || item}-${index}`}>{item.message || item}</li>)}</ul></section>}
                {(aiReview.data.changes?.length > 0 || aiReview.data.suggestions?.length > 0 || aiReview.data.deterministic_review?.optimizations?.length > 0) && <section><h4>Recommendations</h4><ul>{(aiReview.data.changes || aiReview.data.suggestions || aiReview.data.deterministic_review?.optimizations || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
                {(aiReview.data.optimized_sql || aiReview.data.corrected_sql || aiReview.data.generated_sql || aiReview.data.converted_sql) && <section><h4>Suggested SQL</h4><pre>{aiReview.data.optimized_sql || aiReview.data.corrected_sql || aiReview.data.generated_sql || aiReview.data.converted_sql}</pre><button type="button" className="ai-insert" onClick={insertAiSuggestion}>Insert into editor</button></section>}
              </div>}
            </div>
          </div>
        </section>
      </section>

      <section className="quest-continuation">
        <article className="quest-panel compact-card analysis-card">
          <div className="analysis-card-title"><h3>Execution Plan</h3><button type="button" onClick={generateExecutionPlan} disabled={executionPlan.loading}>{executionPlan.loading ? 'Planning...' : 'Generate plan'}</button></div>
          {executionPlan.error && <p className="analysis-error">{executionPlan.error}</p>}
          {!executionPlan.loading && !executionPlan.error && !executionPlan.data && <p className="analysis-empty">Generate a real database EXPLAIN plan for the query currently in the editor.</p>}
          {executionPlan.loading && <div className="analysis-loading"><i /> Asking the database for its execution strategy...</div>}
          {executionPlan.data && <div className="plan-results">
            <div className="analysis-summary"><b>{executionPlan.data.parsed?.query_type}</b><span>{executionPlan.data.plan?.step_count || 0} plan step(s)</span></div>
            {executionPlan.data.plan?.strategy && <p className="analysis-plan-note">{executionPlan.data.plan.strategy}</p>}
            {executionPlan.data.plan?.steps?.map((step, index) => executionPlan.data.plan?.plan_kind === 'operation'
              ? <section key={`${step.operation}-${index}`} className="plan-step operation-step">
                <strong>{step.operation}</strong>
                <span>Object: {step.object || 'current database'}</span>
                <span>Risk: {step.risk || 'unknown'}</span>
                <small>{step.detail}</small>
              </section>
              : <section key={`${step.id}-${step.table}-${index}`} className="plan-step">
                <strong>{step.table || 'Derived result'}</strong>
                <span>Access: {step.access_type || 'n/a'}</span>
                <span>Index: {step.key || 'none'}</span>
                <span>Estimated rows: {step.estimated_rows ?? 'n/a'}</span>
                <span>Filtered: {step.filtered_percent ?? 'n/a'}%</span>
                {step.extra && <small>{step.extra}</small>}
              </section>)}
          </div>}
        </article>
        <article className="quest-panel compact-card analysis-card">
          <div className="analysis-card-title"><h3>Static Analysis</h3><button type="button" onClick={runStaticAnalysis} disabled={staticAnalysis.loading}>{staticAnalysis.loading ? 'Checking...' : 'Analyze query'}</button></div>
          {staticAnalysis.error && <p className="analysis-error">{staticAnalysis.error}</p>}
          {!staticAnalysis.loading && !staticAnalysis.error && !staticAnalysis.data && <p className="analysis-empty">Check syntax, schema objects, safety, style, and optimization signals without executing the query.</p>}
          {staticAnalysis.loading && <div className="analysis-loading"><i /> Parsing and validating the current SQL...</div>}
          {staticAnalysis.data && <div className="static-results">
            <div className="analysis-summary">
              <b className={staticAnalysis.data.static_analysis?.issues?.length ? 'has-issues' : ''}>{staticAnalysis.data.static_analysis?.issues?.length ? 'Issues found' : '✓ No blocking issues'}</b>
              <span>{staticAnalysis.data.parsed?.query_type || 'SQL'}</span>
              <span>Score: {staticAnalysis.data.analysis?.performance_score ?? 'n/a'} / 100</span>
              <span>Complexity: {staticAnalysis.data.analysis?.complexity || 'n/a'}</span>
            </div>
            {staticAnalysis.data.static_analysis?.issues?.map((issue, index) => <p key={`${issue.category}-${index}`} className={`analysis-finding ${issue.severity}`}><strong>{issue.category}</strong>{issue.message}</p>)}
            {staticAnalysis.data.static_analysis?.style_warnings?.map((warning) => <p key={warning} className="analysis-finding style"><strong>Style</strong>{warning}</p>)}
            {staticAnalysis.data.static_analysis?.optimizations?.map((suggestion) => <p key={suggestion} className="analysis-finding optimization"><strong>Optimization</strong>{suggestion}</p>)}
            {!staticAnalysis.data.static_analysis?.issues?.length && !staticAnalysis.data.static_analysis?.style_warnings?.length && !staticAnalysis.data.static_analysis?.optimizations?.length && <p className="analysis-clean">No syntax, schema, safety, style, or obvious optimization issue was detected.</p>}
          </div>}
        </article>
        <article className="quest-panel chart-card slow-insights-card">
          <div className="slow-insights-header">
            <div><h3>Slow Query Insights</h3><p>The five slowest real executions recorded today.</p></div>
            <span>Today</span>
          </div>
          {!slowestQueries.length ? (
            <div className="slow-insights-empty"><strong>No measured queries yet</strong><span>Run a query to start collecting real execution timings.</span></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={slowestQueries} layout="vertical" margin={{ top: 8, right: 35, bottom: 8, left: 10 }}>
                  <CartesianGrid stroke="rgba(154,139,255,.2)" horizontal={false} />
                  <XAxis type="number" stroke="#aea5d8" fontSize={11} tickFormatter={formatDuration} />
                  <YAxis type="category" dataKey="label" width={245} stroke="#aea5d8" fontSize={11} />
                  <Tooltip content={<SlowQueryTooltip />} cursor={{ fill: 'rgba(154,139,255,.08)' }} />
                  <Bar dataKey="execution_time_ms" radius={[0, 6, 6, 0]}>
                    {slowestQueries.map((item) => <Cell key={item.id} fill={item.tone === 'slow' ? '#ff557c' : item.tone === 'moderate' ? '#ffc83d' : '#32e69a'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="slow-query-list">
                {slowestQueries.map((item, index) => (
                  <section key={item.id} className="slow-query-item">
                    <div>
                      <strong>{index + 1}. {item.label}</strong>
                      <small>{item.row_count ?? 0} rows • {item.status} • {item.performance_reason || 'No performance signal recorded'} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <span className={`speed-label ${item.tone}`}>{formatDuration(item.execution_time_ms)} {item.tone === 'slow' ? 'SLOW' : ''}</span>
                    <button type="button" onClick={() => loadHistoryQuery(item.sql)}>Load query</button>

                  </section>
                ))}
              </div>
            </>
          )}
        </article>
      </section>
      <div className="quest-bottom-status"><span>● {connectionName}</span><button onClick={() => navigate("/connections")}>Manage connections</button><span>◉ Draft saved in this browser</span></div>
    </div>
  )
}
