// The exact package versions a lockfile pins, read without installing anything.

export interface Locked {
  name: string
  version: string
  /** Only installed for development, where the lockfile says so (package-lock.json). */
  dev?: boolean
}

/** The lockfiles read, in the order a package manager would pick one (core/deps.ts). */
export const LOCKFILES = ['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'] as const

const SEMVER = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/

/** `@scope/name@1.2.3` → name and version, splitting at the last `@` that isn't the scope's. */
export function splitSpec(spec: string): { name: string; version: string } | undefined {
  const at = spec.lastIndexOf('@')
  if (at <= 0) return undefined
  return { name: spec.slice(0, at), version: spec.slice(at + 1) }
}

/** package-lock.json v1 (nested `dependencies`) and v2/v3 (flat `packages` keyed by `node_modules/` path). */
export function packageLock(text: string): Locked[] {
  const lock = JSON.parse(text) as {
    packages?: Record<string, { name?: string; version?: string; link?: boolean; dev?: boolean }>
    dependencies?: Record<string, V1>
  }
  type V1 = { version?: string; dev?: boolean; dependencies?: Record<string, V1> }
  const found: Locked[] = []
  if (lock.packages) {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (!path.includes('node_modules/') || entry.link || !entry.version) continue
      const name = entry.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
      found.push({ name, version: entry.version, dev: entry.dev })
    }
    return found
  }
  const walk = (deps: Record<string, V1> = {}) => {
    for (const [name, entry] of Object.entries(deps)) {
      if (!entry.version) continue
      // an alias: "version": "npm:real-name@1.2.3"
      const alias = entry.version.startsWith('npm:') ? splitSpec(entry.version.slice(4)) : undefined
      found.push({ ...(alias ?? { name, version: entry.version }), dev: entry.dev })
      walk(entry.dependencies)
    }
  }
  walk(lock.dependencies)
  return found
}

/** pnpm-lock.yaml: `packages` keyed `name@version` (v9), `/name@version(peers)` (v6–8) or `/name/version_peers` (v5). */
export function pnpmLock(text: string): Locked[] {
  const lock = Bun.YAML.parse(text) as { lockfileVersion?: string | number; packages?: Record<string, { name?: string; version?: string }> }
  const slashed = Number.parseFloat(String(lock.lockfileVersion ?? '9')) < 6
  const found: Locked[] = []
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const bare = key.replace(/^\//, '').replace(/\(.*$/, '')
    // v5: /name/1.2.3_peer@4.5.6
    const unpeered = bare.replace(/_.*$/, '')
    const slash = unpeered.lastIndexOf('/')
    const spec = slashed ? (slash > 0 ? { name: unpeered.slice(0, slash), version: unpeered.slice(slash + 1) } : undefined) : splitSpec(bare)
    const name = entry?.name ?? spec?.name
    const version = entry?.version ?? spec?.version
    if (name && version) found.push({ name, version })
  }
  return found
}

/** bun.lock: JSON with trailing commas; `packages` maps a path to `["name@version", registry, meta, integrity]`. */
export function bunLock(text: string): Locked[] {
  const lock = JSON.parse(text.replace(/,(\s*[}\]])/g, '$1')) as { packages?: Record<string, unknown[]> }
  const found: Locked[] = []
  for (const entry of Object.values(lock.packages ?? {})) {
    const spec = typeof entry?.[0] === 'string' ? splitSpec(entry[0]) : undefined
    if (spec) found.push(spec)
  }
  return found
}

/** yarn.lock, classic (v1, `version "1.2.3"`) and Berry (`version: 1.2.3`, `resolution: "name@npm:1.2.3"`). */
export function yarnLock(text: string): Locked[] {
  const found: Locked[] = []
  let header: string | undefined
  let version: string | undefined
  let resolution: string | undefined
  const flush = () => {
    // Berry resolves workspaces, patches and git deps through other protocols: not from the registry
    if (header && header !== '__metadata' && (!resolution || resolution.includes('@npm:'))) {
      const fromResolution = resolution?.includes('@npm:') ? splitSpec(resolution.replace('@npm:', '@')) : undefined
      // the first spec of the entry: `"@babel/core@^7.0.0", "@babel/core@^7.1.0"` → @babel/core; an alias `x@npm:y@^1` → y
      const first = header.split(',')[0]!.trim().replace(/^"|"$/g, '')
      const target = first.includes('@npm:') ? first.slice(first.indexOf('@npm:') + 5) : first
      const name = fromResolution?.name ?? splitSpec(target)?.name
      const pinned = fromResolution?.version ?? version
      if (name && pinned) found.push({ name, version: pinned })
    }
    header = version = resolution = undefined
  }
  for (const line of text.split('\n')) {
    if (/^\S.*:\s*$/.test(line) && !line.startsWith('#')) {
      flush()
      header = line.replace(/:\s*$/, '')
      continue
    }
    const field = line.match(/^\s+(version|resolution):?\s+"?([^"\s]+)"?\s*$/)
    if (field?.[1] === 'version') version = field[2]
    if (field?.[1] === 'resolution') resolution = field[2]
  }
  flush()
  return found
}

/** The packages a lockfile pins, without duplicates, workspace links, git or file dependencies. */
export function parseLockfile(file: string, text: string): Locked[] {
  const base = file.split('/').at(-1)
  const all =
    base === 'package-lock.json' || base === 'npm-shrinkwrap.json'
      ? packageLock(text)
      : base === 'pnpm-lock.yaml'
        ? pnpmLock(text)
        : base === 'bun.lock'
          ? bunLock(text)
          : yarnLock(text)
  const seen = new Map<string, Locked>()
  for (const entry of all) {
    if (!SEMVER.test(entry.version)) continue
    const key = `${entry.name}@${entry.version}`
    const known = seen.get(key)
    // a version some production dependency also needs isn't dev-only
    if (!known) seen.set(key, entry)
    else if (known.dev && !entry.dev) seen.set(key, { ...known, dev: entry.dev })
  }
  return [...seen.values()]
}
