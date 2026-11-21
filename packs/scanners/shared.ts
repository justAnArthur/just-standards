// Shared by the scanners pack: running a local tool with a deadline, and spacing requests to a public service.

export interface Ran {
  code: number
  stdout: string
  stderr: string
  /** It was stopped at the deadline: its output is partial and proves nothing. */
  timedOut: boolean
  ms: number
}

/**
 * Runs `cmd` in `cwd` until it exits or `timeoutMs` passes. It runs in its own process group, so a deadline also stops
 * what it started (a package manager's eslint, tsc), not only the command itself.
 */
export async function exec(cmd: string[], { cwd, timeoutMs, env }: { cwd?: string; timeoutMs: number; env?: Record<string, string> }): Promise<Ran> {
  const started = performance.now()
  let timedOut = false
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', detached: true })
  } catch (error) {
    return { code: 127, stdout: '', stderr: (error as Error).message, timedOut: false, ms: 0 }
  }
  const stop = (signal: NodeJS.Signals) => {
    try {
      process.kill(-proc.pid, signal)
    } catch {}
  }
  const timer = setTimeout(() => {
    timedOut = true
    stop('SIGTERM')
    setTimeout(() => stop('SIGKILL'), 5_000).unref()
  }, timeoutMs)
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout as ReadableStream).text(),
      new Response(proc.stderr as ReadableStream).text(),
      proc.exited,
    ])
    return { code, stdout, stderr, timedOut, ms: Math.round(performance.now() - started) }
  } finally {
    clearTimeout(timer)
    // Whatever it left running in the background goes with it.
    stop('SIGTERM')
  }
}

/** Text without terminal colors, for evidence. */
export const plain = (text: string) => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')

const last = new Map<string, number>()
const turns = new Map<string, Promise<void>>()

/**
 * Waits until `gapMs` have passed since the last request to `key` started, one caller at a time: a public service's
 * fair use (the Nu checker) in one process, however many items and assets ask at once.
 */
export function spaced(key: string, gapMs: number): Promise<void> {
  const previous = turns.get(key) ?? Promise.resolve()
  const turn = previous.then(async () => {
    const wait = (last.get(key) ?? 0) + gapMs - Date.now()
    if (wait > 0) await Bun.sleep(wait)
    last.set(key, Date.now())
  })
  turns.set(key, turn)
  return turn
}

/** A short list for evidence: the first `max`, and how many more. */
export function listed(items: string[], max = 5, separator = '; ') {
  return items.slice(0, max).join(separator) + (items.length > max ? `${separator}and ${items.length - max} more` : '')
}
