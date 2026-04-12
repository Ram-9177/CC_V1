type PerfMeta = Record<string, unknown>

const isDev = import.meta.env.DEV

function canMeasure() {
  return typeof window !== 'undefined' && typeof performance !== 'undefined' && isDev
}

export function perfMark(name: string, meta?: PerfMeta) {
  if (!canMeasure()) return
  performance.mark(name)
  if (meta) {
    // Dev-only diagnostics to identify low-end device hotspots quickly.
    console.debug(`[perf:mark] ${name}`, meta)
  }
}

export function perfMeasure(name: string, startMark: string, endMark?: string, meta?: PerfMeta) {
  if (!canMeasure()) return
  // Defer until after the browser finishes layout/paint from this commit (reduces sync layout reads in the same turn).
  requestAnimationFrame(() => {
    const end = endMark ?? `${name}:end`
    if (!endMark) performance.mark(end)
    try {
      performance.measure(name, startMark, end)
    } catch {
      return
    }
    const entries = performance.getEntriesByName(name)
    const latest = entries[entries.length - 1]
    if (latest) {
      console.debug(`[perf] ${name}: ${latest.duration.toFixed(2)}ms`, meta || {})
    }
  })
}
