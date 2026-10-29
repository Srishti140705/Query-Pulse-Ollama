import Editor from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useLocation } from "react-router-dom";
import api, { errorMessage } from "../services/api";
import { readWorkspace, writeWorkspace, recordRun } from "../services/workspaceStorage";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
import React, { useEffect, useRef, useState } from 'react'
import { format } from "sql-formatter";
import { analyzeQuery, executeQuery } from "../services/queryService";
import { analyzeSQL } from "../utils/sqlAnalyzer";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"


export default function QueryEditor() {
  const location = useLocation()
  const [sql, setSql] = useState(() => location.state?.query || readWorkspace('draft', 'SELECT id, name, department, salary FROM employees LIMIT 20;'))
  const [databases, setDatabases] = useState([{ value: 'sqlite', label: 'SQLite workspace' }])
  const [analysis, setAnalysis] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAdvice, setAiAdvice] = useState(null)
  async function explainWithOllama() {
    if (aiBusy || !sql.trim()) return
    setAiBusy(true)
    setAiAdvice(null)
    try {
      const { data } = await api.post('/ai/explain', { query: sql, database }, { timeout: 130000 })
      setAiAdvice({ text: data.explanation, model: data.model })
    } catch (error) {
      setAiAdvice({ text: errorMessage(error), error: true })
    } finally {
      setAiBusy(false)
    }
  }
  useEffect(() => { api.get('/databases').then(({ data }) => setDatabases(data)).catch(() => {}) }, [])
  useEffect(() => { writeWorkspace('draft', sql) }, [sql])
  const [database, setDatabase] = useState(() => location.state?.database || readWorkspace('selectedDatabase', 'sqlite'))
  const [message, setMessage] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [favorites, setFavorites] = useState([])
  const [executionTime, setExecutionTime] = useState('—')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  })
  const [analytics, setAnalytics] = useState([])
  const [staticWarnings, setStaticWarnings] = useState(() => analyzeSQL(sql))
  const [warningsDismissed, setWarningsDismissed] = useState(false)
  const [executionPlan, setExecutionPlan] = useState({
    queryType: '--',
    estimatedCost: '--',
    tables: [],
    suggestions: [],
  })
  const editorRef = useRef(null);
  const runButtonRef = useRef(null);
  useEffect(() => {
    writeWorkspace('selectedDatabase', database)
  }, [database])


  useEffect(() => {
    setHistory([...new Set(readWorkspace('runs').map((run) => run.query))])
    setFavorites(readWorkspace('favoriteQueries'))
    setAnalytics(readWorkspace('runs').filter((run) => run.status === 'Successful').reverse().map((run) => ({ ...run, timestamp: new Date(run.createdAt).toLocaleTimeString(), queryType: run.type })))
  }, [])



  useEffect(() => {
    setStaticWarnings(analyzeSQL(sql))
    setWarningsDismissed(false)
  }, [sql])

  useEffect(() => {
    let isCurrent = true

    const timeout = window.setTimeout(async () => {
      if (!sql.trim()) {
        setAnalysis(null)
        setExecutionPlan({ queryType: '--', estimatedCost: '--', tables: [], suggestions: [] })
        return
      }

      try {
        const response = await analyzeQuery(sql, database)
        if (!isCurrent) return
        if (response.error) throw new Error(response.error)
        setAnalysis(response.analysis)

        const suggestions = [...(response.analysis?.recommendations || [])]
        if (/\bSELECT\s+\*/i.test(sql)) suggestions.push('Avoid SELECT *; select only the columns you need.')
        if (/^(SELECT|UPDATE|DELETE)\b/i.test(sql.trim()) && !/\bWHERE\b/i.test(sql)) suggestions.push('Add a WHERE clause to reduce scanned or affected rows.')
        if (/\bWHERE\b/i.test(sql)) suggestions.push('Consider indexing filtered columns.')
        if (/^SELECT\b/i.test(sql.trim()) && !/\bLIMIT\b/i.test(sql)) suggestions.push('LIMIT large result sets when appropriate.')

        setExecutionPlan({
          queryType: response.parsed?.query_type || '--',
          estimatedCost: response.analysis?.estimated_cost || '--',
          tables: response.parsed?.tables || [],
          suggestions: [...new Set(suggestions)],
        })
      } catch (error) {
        if (isCurrent) setAnalysis(null)
        if (isCurrent) setExecutionPlan({ queryType: '--', estimatedCost: '--', tables: [], suggestions: [] })
      }
    }, 300)

    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
    }
  }, [sql, database])
  async function handleRun() {
    if (loading || !sql.trim()) return
    setResults([])
    setExecutionTime('—')
    setSearchTerm('')
    setSortConfig({ key: null, direction: 'asc' })
    setStaticWarnings(analyzeSQL(sql))
    setLoading(true)
    const startTime = performance.now()
    try {
      const response = await executeQuery(sql, database)
      if (response.error || response.result?.error) {
        throw new Error(response.error || response.result.error)
      }

      setResults(response.result.rows || [])

      const endTime = performance.now()
      const elapsed = endTime - startTime

      let displayTime

      if (elapsed < 1) {
        displayTime = '< 1 ms'
      } else if (elapsed < 1000) {
        displayTime = `${Math.round(elapsed)} ms`
      } else {
        displayTime = `${(elapsed / 1000).toFixed(2)} s`
      }

      setExecutionTime(displayTime)

      recordRun({ query: sql, database, status: 'Successful', executionTime: elapsed, rowsReturned: response.result.row_count || 0, type: sql.trim().split(/\s+/)[0].toUpperCase() })
      const executionValue = elapsed

      setAnalytics((prev) => {
  const updated = [
    ...prev,
    {
      query: sql,
      executionTime: executionValue,
      rowsReturned: response.result.rows?.length || 0,
      queryType: sql.trim().split(" ")[0].toUpperCase(),
      timestamp: new Date().toLocaleTimeString(),
    },
  ]

  writeWorkspace("queryAnalytics", updated.slice(-500))

  return updated
})
      setHistory((prev) => [
        sql,
        ...prev.filter((item) => item !== sql),
      ])


      setLoading(false)



      setMessage({
        type: 'success',
        text: `Query executed successfully. ${response.result.row_count || 0} rows ${response.result.rows ? 'returned' : 'affected'}.${response.result.truncated ? ' Showing the first 1,000 rows.' : ''}`,
      })

      window.setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setLoading(false)

      recordRun({ query: sql, database, status: 'Error', executionTime: performance.now() - startTime, rowsReturned: 0, type: sql.trim().split(/\s+/)[0].toUpperCase(), error: errorMessage(error) })
      setHistory((prev) => [sql, ...prev.filter((item) => item !== sql)])
      setMessage({
        type: 'error',
        text:
          errorMessage(error),
      })

      window.setTimeout(() => setMessage(null), 3000)
    }
  }

  function handleFormat() {
    try {
      const formattedSql = format(sql, { language: database === "mariadb" ? "mysql" : database })
      setSql(formattedSql)
      setMessage({ type: 'success', text: 'Formatted query successfully.' })
    } catch (error) {
      console.error(error)
      setMessage({ type: 'error', text: 'Failed to format query.' })
    }

    window.setTimeout(() => setMessage(null), 3000)
  }

  function exportToCSV() {
    if (filteredResults.length === 0) return

    const escape = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"'
    const columns = Object.keys(results[0])
    const headers = columns.map(escape).join(',')
    const rows = filteredResults.map((row) => columns.map((column) => escape(row[column])).join(','))

    const csvContent = [headers, ...rows].join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')

    link.href = url

    link.download = 'query_results.csv'

    link.click()

    URL.revokeObjectURL(url)
  }

  const filteredResults = [...results]
    .filter((row) =>
      Object.values(row)
        .join(' ')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (!sortConfig.key) return 0

      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }

      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }

      return 0
    })

  const totalQueries = analytics.length

  const averageTime =
    analytics.length > 0
      ? Math.round(
        analytics.reduce((sum, item) => sum + item.executionTime, 0) /
        analytics.length,
      )
      : 0

  const fastestQuery =
    analytics.length > 0
      ? Math.round(
        Math.min(...analytics.map((item) => item.executionTime)),
      )
      : 0

  const slowestQuery =
    analytics.length > 0
      ? Math.round(
        Math.max(...analytics.map((item) => item.executionTime)),
      )
      : 0

  const totalRowsReturned = analytics.reduce(
    (sum, item) => sum + item.rowsReturned,
    0,
  )

  const queryTypeData = Object.values(
  analytics.reduce((acc, item) => {
    if (!acc[item.queryType]) {
      acc[item.queryType] = {
        name: item.queryType,
        value: 0,
      }
    }

    acc[item.queryType].value += 1

    return acc
  }, {})
)

const COLORS = [
  "#8B5CF6",
  "#A855F7",
  "#6366F1",
  "#7C3AED",
  "#C084FC",
]

  const displayAnalytics = analytics
  const displayQueryTypes = queryTypeData

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(380px,0.85fr)]">
      <div className="space-y-6">
        <section className="ide-card ide-fade-in overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">Query editor</p>
              <h1 className="font-heading mt-3 text-3xl font-semibold tracking-normal text-[var(--text)]">SQL workbench</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Compose, execute, inspect, and reuse SQL in a focused developer workspace.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={handleFormat} className="ide-button border-amber-300/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20">Format</button>
              <button onClick={explainWithOllama} disabled={aiBusy || !sql.trim()} className="ide-button">{aiBusy ? 'Thinking…' : 'Explain with Ollama'}</button>
              <button ref={runButtonRef} onClick={handleRun} disabled={loading || !sql.trim()} className="ide-button-primary min-w-28 bg-emerald-500 hover:bg-emerald-400">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Running
                  </span>
                ) : 'Run query'}
              </button>
              <button onClick={exportToCSV} disabled={results.length === 0} className="ide-button border-sky-300/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20">Export CSV</button>
              <button onClick={() => setSql('')} className="ide-button">Clear</button>
            </div>
          </div>

          {aiAdvice && <div role={aiAdvice.error ? 'alert' : 'status'} className="mt-5 rounded-xl border border-[var(--border)] p-4">
            <p className="mb-2 font-semibold">{aiAdvice.error ? 'Ollama unavailable' : `Ollama · ${aiAdvice.model}`}</p>
            <p className="whitespace-pre-wrap text-sm">{aiAdvice.text}</p>
            {!aiAdvice.error && <p className="mt-3 text-xs text-[var(--muted)]">AI advice may be inaccurate. Review suggestions before running SQL.</p>}
          </div>}
          <div className="relative mt-6">
            <div className="overflow-hidden rounded-2xl border border-violet-400/30 bg-[#0A0716] shadow-[0_0_38px_rgba(124,58,237,0.18)]">
              <div className="flex h-11 items-center justify-between border-b border-[var(--border)] bg-[#171032] px-4 font-code text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-2 text-violet-100"><span className="h-2 w-2 rounded-full bg-emerald-400" />console.sql</span>
                <select value={database} onChange={(event) => setDatabase(event.target.value)} className="bg-transparent font-code text-xs text-[var(--muted)] outline-none">
                  {databases.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <Editor
                height="360px"
                defaultLanguage="sql"
                value={sql}
                onMount={(editor) => {
                  editorRef.current = editor
                  monaco.editor.setTheme('vs-dark')
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runButtonRef.current?.click())
                }}
                onChange={(value) => setSql(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontFamily: 'JetBrains Mono, IBM Plex Mono, Consolas, monospace',
                  fontSize: readWorkspace('editorFontSize', 14),
                  lineNumbers: readWorkspace('lineNumbers', true) ? 'on' : 'off',
                  lineHeight: 22,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>
            {staticWarnings.length > 0 && !warningsDismissed && (
              <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                <div>
                  <p className="font-heading font-semibold">Static analysis warnings</p>
                  <ul className="mt-2 space-y-1 text-amber-100/80">
                    {staticWarnings.map((warning) => (
                      <li key={warning.title}><span className="font-medium text-amber-100">{warning.title}:</span> {warning.message}</li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => setWarningsDismissed(true)} className="-mr-1 -mt-1 rounded-lg p-1 text-amber-100/70 transition hover:bg-amber-400/10 hover:text-amber-100" aria-label="Dismiss static analysis warnings">&times;</button>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="ide-surface font-code px-4 py-3 text-xs text-[var(--muted)]">Dialect: {database === "postgresql" ? "PostgreSQL" : database === "sqlite" ? "SQLite" : database === "mariadb" ? "MariaDB" : "MySQL"} / Single statement / Maximum 1,000 result rows</div>
            {message && (
              <div className={`rounded-xl px-4 py-3 text-sm transition-all duration-200 ${message.type === 'success' ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border border-rose-400/20 bg-rose-400/10 text-rose-200'}`}>
                {message.text}
              </div>
            )}
          </div>
        </section>

        <section className="grid items-stretch gap-6 lg:grid-cols-2">
          <PanelCard title="Query analysis" description="SQL structure and heuristic suggestions. These are not database execution-plan measurements.">
            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <PlanMetric label="Query type" value={executionPlan.queryType} />
                <PlanMetric label="Estimated cost" value={executionPlan.estimatedCost} />
                <PlanMetric label="Rows returned" value={results.length} />
                <PlanMetric label="Tables used" value={executionPlan.tables.length} />
              </div>
              <div>
                <p className="font-code text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">Tables</p>
                <p className="mt-2 font-code text-xs text-[var(--text)]">{executionPlan.tables.length ? executionPlan.tables.join(', ') : '--'}</p>
              </div>
              <div>
                <p className="font-code text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">Optimization suggestions</p>
                {executionPlan.suggestions.length ? (
                  <ul className="mt-2 space-y-2 text-sm leading-5 text-[var(--muted)]">
                    {executionPlan.suggestions.map((suggestion) => <li key={suggestion}>&bull; {suggestion}</li>)}
                  </ul>
                ) : <p className="mt-2 text-sm text-[var(--muted)]">No suggestions available.</p>}
              </div>
            </div>
          </PanelCard>
          <PanelCard title="Static analysis" description="Heuristic quality score and SQL warnings.">
            <StaticAnalysisDashboard analysis={analysis} tableCount={executionPlan.tables.length} />
          </PanelCard>
          <PanelCard title="AI integration" description="Local explanations powered by Ollama.">
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <p>Use <span className="font-semibold text-[var(--text)]">Explain with Ollama</span> above to review the current SQL.</p>
              <p>Only the query and selected dialect are sent to your local model. Query results are not shared or executed by the AI.</p>
            </div>
          </PanelCard>
        </section>

        <section className="ide-card p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">Analytics</p>
              <h2 className="font-heading mt-2 text-xl font-semibold text-[var(--text)]">Query performance charts</h2>
            </div>
            <span className="font-code text-xs text-[var(--muted)]">{analytics.length ? `${analytics.length} live samples` : 'Run a query to see your performance data'}</span>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <ChartCard title="Execution Time Trend">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={displayAnalytics} margin={{ top: 12, right: 24, bottom: 28, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(169, 155, 200, 0.16)" />
                  <XAxis dataKey="timestamp" tick={{ fill: '#A99BC8', fontSize: 12 }} tickMargin={12} minTickGap={28} stroke="rgba(169, 155, 200, 0.45)" />
                  <YAxis tick={{ fill: '#A99BC8', fontSize: 12 }} tickMargin={10} stroke="rgba(169, 155, 200, 0.45)" width={44} />
                  <Tooltip contentStyle={{ background: '#15102A', border: '1px solid rgba(184, 152, 255, 0.22)', borderRadius: '12px', color: '#F7F2FF' }} />
                  <Line type="monotone" dataKey="executionTime" stroke="#A78BFA" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#8B5CF6' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Query Type Distribution">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie data={displayQueryTypes} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={58} outerRadius={108} paddingAngle={3}>
                    {displayQueryTypes.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#15102A', border: '1px solid rgba(184, 152, 255, 0.22)', borderRadius: '12px', color: '#F7F2FF' }} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ color: '#A99BC8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="ide-card ide-fade-in p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">Query results</p>
              <h2 className="font-heading mt-2 text-xl font-semibold">Result set</h2>
            </div>
            <span className="ide-surface font-code px-3 py-2 text-xs text-[var(--muted)]">
              {results.length} {results.length === 1 ? 'row' : 'rows'} / {executionTime || '--'}
            </span>
          </div>

          <input
            type="text"
            placeholder="Search results..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-code text-sm text-[var(--text)] outline-none transition duration-200 placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />

      


  

          <div
            className="ide-scrollbar mt-6 overflow-x-auto overflow-y-scroll rounded-2xl border border-[var(--border)]"
            style={{ height: '292px' }}
          >
            {results.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--muted)]">
                No records found. Execute a SELECT query to display results.
              </div>
            ) : (
              <table className="ide-table min-w-max">
                <thead>
                  <tr>
                    {Object.keys(results[0]).map((column) => (
                      <th
                        key={column}
                        onClick={() => {
                          setSortConfig((prev) => ({
                            key: column,
                            direction:
                              prev.key === column && prev.direction === 'asc'
                                ? 'desc'
                                : 'asc',
                          }))
                        }}
                        className="cursor-pointer select-none whitespace-nowrap hover:text-[var(--accent-strong)]"
                      >
                        {column}
                        {sortConfig.key === column &&
                          (sortConfig.direction === 'asc' ? ' ASC' : ' DESC')}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredResults.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, i) => (
                        <td key={i} className="whitespace-nowrap">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <QueryList
          title="Query history"
          empty="No queries executed yet."
          listClassName="ide-scrollbar h-[228px] overflow-y-scroll pr-2"
        >
          {history.map((item, index) => (
            <div key={index} className="group flex min-h-[68px] items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60">
              <code onClick={() => setSql(item)} className="font-code block min-w-0 flex-1 cursor-pointer truncate text-sm text-[var(--text)]">
                {item}
              </code>

              <button
                onClick={() => {
                  const updatedFavorites = favorites.includes(item)
                    ? favorites.filter((query) => query !== item)
                    : [...favorites, item]

                  setFavorites(updatedFavorites)

                  writeWorkspace('favoriteQueries', updatedFavorites)
                }}
                className="ide-button h-9 w-9 px-0"
                aria-label={favorites.includes(item) ? 'Remove favorite' : 'Add favorite'}
              >
                {favorites.includes(item) ? '*' : '+'}
              </button>
            </div>
          ))}
        </QueryList>

        <QueryList title="Favorite queries" empty="No favorite queries yet.">
          {favorites.map((item, index) => (
            <div
              key={index}
              onClick={() => setSql(item)}
              className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/10"
            >
              <code className="font-code block truncate text-sm text-[var(--text)]">
                {item}
              </code>
            </div>
          ))}
        </QueryList>
      </aside>
    </div>
  )
}

function PanelCard({ title, description, children }) {
  return (
    <div className="ide-card flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60">
      <h3 className="font-heading text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      {children || <div className="ide-surface mt-5 p-4 text-sm text-[var(--muted)]">No connected database. Connect your data source to see live results.</div>}
    </div>
  )
}

function PlanMetric({ label, value }) {
  return <div className="ide-surface p-3"><p className="font-code text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p><p className="mt-2 font-code text-sm text-[var(--text)]">{value}</p></div>
}

function StaticAnalysisDashboard({ analysis, tableCount }) {
  const hasAnalysis = Boolean(analysis)
  const score = analysis?.performance_score ?? 0
  const warnings = analysis?.warnings || []
  const recommendations = analysis?.recommendations || []
  const complexity = analysis?.complexity || '—'
  const estimatedCost = analysis?.estimated_cost || '—'
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const progress = hasAnalysis ? (score / 100) * circumference : 0
  const scoreColor = score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#FB7185'
  const complexityColor = complexity === 'Low' ? '#34D399' : complexity === 'Medium' ? '#FBBF24' : complexity === 'High' ? '#FB7185' : '#A99BC8'
  const complexityIndex = complexity === 'Low' ? 0 : complexity === 'Medium' ? 1 : complexity === 'High' ? 2 : -1

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
        <div className="ide-surface flex min-h-[190px] items-center justify-center p-4">
          <div className="relative h-36 w-36" aria-label={hasAnalysis ? `Quality score ${score} out of 100` : 'Quality score unavailable'}>
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img">
              <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(169, 155, 200, 0.14)" strokeWidth="10" />
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-code text-3xl font-semibold text-[var(--text)]">{hasAnalysis ? score : '—'}</span>
              <span className="font-code text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">quality score</span>
            </div>
          </div>
        </div>

        <div className="ide-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-code text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Complexity</p>
            <span className="rounded-full border px-2.5 py-1 font-code text-xs font-semibold" style={{ borderColor: `${complexityColor}55`, color: complexityColor, backgroundColor: `${complexityColor}12` }}>{complexity}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`Complexity level ${complexity}`}>
            {['Low', 'Medium', 'High'].map((level, index) => (
              <div key={level}>
                <div className="h-2 rounded-full transition-all duration-500" style={{ backgroundColor: index <= complexityIndex ? complexityColor : 'rgba(169, 155, 200, 0.14)' }} />
                <p className="mt-2 text-center font-code text-[9px] uppercase text-[var(--muted)]">{level}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <AnalysisMetric label="Warnings" value={warnings.length} tone={warnings.length ? '#FBBF24' : '#34D399'} />
            <AnalysisMetric label="Suggestions" value={recommendations.length} tone="#A78BFA" />
            <AnalysisMetric label="Est. cost" value={estimatedCost} tone={complexityColor} />
            <AnalysisMetric label="Tables" value={tableCount} tone="#60A5FA" />
          </div>
        </div>
      </div>

      <div className="ide-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-code text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Findings</p>
          <span className="font-code text-[10px] text-[var(--muted)]">Live as you type</span>
        </div>
        {!hasAnalysis ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Enter a valid SQL statement to generate the analysis graph.</p>
        ) : warnings.length ? (
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />No heuristic warnings detected.</p>
        )}
      </div>
    </div>
  )
}

function AnalysisMetric({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)]/40 p-2.5">
      <p className="font-code text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-code text-lg font-semibold" style={{ color: tone }}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="ide-surface p-5">
      <h3 className="mb-4 font-heading text-lg font-semibold text-[var(--text)]">
        {title}
      </h3>

      {children}
    </div>
  )
}

function AnalyticsTile({ label, value, wide = false }) {
  const parts = String(value).split(' ')

  return (
    <div className={`ide-surface flex min-h-[104px] flex-col justify-between p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/60 ${wide ? 'col-span-2' : ''}`}>
      <p className="font-code truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <h3 className="font-code mt-4 flex items-baseline gap-2 text-2xl font-semibold leading-none text-[var(--text)]">
        <span>{parts[0]}</span>
        {parts[1] && <span className="text-sm font-semibold text-[var(--muted)]">{parts.slice(1).join(' ')}</span>}
      </h3>
    </div>
  )
}

function QueryList({ title, empty, children, listClassName = '' }) {
  const hasItems = React.Children.count(children) > 0

  return (
    <section className="ide-card p-5 sm:p-6">
      <p className="font-code text-xs uppercase tracking-[0.28em] text-[var(--accent-soft)]">{title}</p>
      <div className={`mt-5 space-y-3 ${listClassName}`}>
        {hasItems ? children : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">{empty}</p>
        )}
      </div>
    </section>
  )
}
