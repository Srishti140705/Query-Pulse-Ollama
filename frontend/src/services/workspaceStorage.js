function key(name) {
  try { return `querypulse:${JSON.parse(localStorage.getItem('auth_user'))?.id || 'guest'}:${name}` } catch { return `querypulse:guest:${name}` }
}
export function readWorkspace(name, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback } catch { return fallback }
}
export function writeWorkspace(name, value) { localStorage.setItem(key(name), JSON.stringify(value)) }
export function recordRun(run) {
  const runs = readWorkspace('runs')
  writeWorkspace('runs', [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...run }, ...runs].slice(0, 500))
}
