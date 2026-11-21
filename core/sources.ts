import { join } from 'node:path'
import { readable } from './checks/ai.ts'
import { get } from './expect.ts'
import { BUNDLED_PACKS, type Workspace } from './load.ts'

/** What `standards sources` last read of each source URL: its text's hash and when. Committed beside the packs. */
export const LOCK_FILE = join(BUNDLED_PACKS, 'sources.lock.json')

export interface Locked {
  sha256: string
  checked_at: string
  /** The items that follow it. */
  items: string[]
}

export interface SourceChange {
  url: string
  title: string
  items: string[]
  /** `new`: not in the lock yet; `changed`: its text differs; `gone`: it didn't answer 200; `same`. */
  state: 'new' | 'changed' | 'gone' | 'same'
  status?: number
}

/** A page's text without its markup, whitespace and the bits that change on every load (dates, build ids in scripts). */
async function textOf(html: string) {
  const text = (await readable(html)).replace(/<[^>]+>/g, ' ')
  // Long digit runs are request ids and timestamps some pages print on every load (support.google.com does).
  return text.replace(/\d{6,}/g, '').replace(/\s+/g, ' ').trim()
}

const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex')

/** Every source the loaded items cite, with the items citing it. */
export function sourcesOf(ws: Workspace) {
  const sources = new Map<string, { title: string; items: string[] }>()
  for (const pack of ws.packs.values()) {
    for (const item of pack.entries) {
      for (const source of item.sources) {
        const entry = sources.get(source.url) ?? { title: source.title, items: [] }
        entry.items.push(item.key)
        sources.set(source.url, entry)
      }
    }
  }
  return sources
}

/**
 * Reads every cited source and compares its text with the lock: a changed source means its items may need to follow it.
 * With `update`, writes the new hashes to the lock.
 */
export async function checkSources(ws: Workspace, { update = false, lockFile = LOCK_FILE } = {}) {
  const lock: Record<string, Locked> = (await Bun.file(lockFile).exists()) ? await Bun.file(lockFile).json() : {}
  const changes: SourceChange[] = []
  // Sources that differ only by #anchor are one page: read it once, which also spares sites (EUR-Lex) that answer
  // bursts with a challenge.
  const pages = new Map<string, Promise<{ status: number; hash?: string }>>()
  const read = (page: string) => {
    let pending = pages.get(page)
    if (!pending) {
      pending = get(page).then(
        async response => {
          // 200 only: a 202 is a bot challenge (EUR-Lex's WAF answers one with an empty body), not the page
          if (response.status !== 200) {
            await response.body?.cancel()
            return { status: response.status }
          }
          return { status: 200, hash: sha256(await textOf(await response.text())) }
        },
        () => ({ status: 0 }),
      )
      pages.set(page, pending)
    }
    return pending
  }
  for (const [url, { title, items }] of sourcesOf(ws)) {
    const page = await read(url.replace(/#.*$/, ''))
    if (!page.hash) {
      changes.push({ url, title, items, state: 'gone', status: page.status })
      continue
    }
    const hash = page.hash
    const before = lock[url]
    const state = !before ? 'new' : before.sha256 === hash ? 'same' : 'changed'
    changes.push({ url, title, items, state })
    // The items citing a source can change while its text doesn't: keep that list current either way.
    if (update) lock[url] = state === 'same' ? { ...before!, items } : { sha256: hash, checked_at: new Date().toISOString(), items }
  }
  if (update) {
    const cited = new Set(changes.map(change => change.url))
    for (const url of Object.keys(lock)) if (!cited.has(url)) delete lock[url]
    const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)))
    await Bun.write(lockFile, `${JSON.stringify(sorted, null, 2)}\n`)
  }
  return changes
}
