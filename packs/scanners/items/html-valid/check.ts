import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import { crawl, type Page, pathOf } from '../../../../core/crawl.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'
import { exec, listed, spaced } from '../../shared.ts'

/** The home page and two pages sampled from the sitemap. */
const PAGES = 3
const SHOWN = 5
const USER_AGENT = 'just-standards/0.1 html-valid (+https://github.com/justAnArthur/just-standards; one page a second at most)'
const LOCAL_TIMEOUT_MS = 120_000
const nuUrl = () => process.env.STANDARDS_NU_URL ?? 'https://validator.w3.org/nu/'
/** The public checker asks for no excessive load: one request a second at most, from the whole process. */
const gapMs = () => Number(process.env.STANDARDS_NU_GAP_MS ?? 1_000)
const RETRY_MS = () => Number(process.env.STANDARDS_NU_RETRY_MS ?? 5_000)

/** One message of the checker's JSON output (`out=json`). */
export interface Message {
  type: 'error' | 'info' | 'non-document-error'
  subType?: string
  message: string
  lastLine?: number
  firstLine?: number
  url?: string
  /** the source around the problem, and which part of it the message is about */
  extract?: string
  hiliteStart?: number
  hiliteLength?: number
}

/** The local checker, preferred over the public one: `vnu` on the PATH, else `java -jar $STANDARDS_VNU_JAR`. */
export function localChecker(): string[] | undefined {
  const vnu = Bun.which('vnu')
  if (vnu) return [vnu]
  const jar = process.env.STANDARDS_VNU_JAR
  if (jar && Bun.which('java')) return ['java', '-jar', jar]
}

async function post(html: string) {
  await spaced('nu', gapMs())
  const url = new URL(nuUrl())
  url.searchParams.set('out', 'json')
  return get(url.href, {
    method: 'POST',
    body: html,
    headers: { 'content-type': 'text/html; charset=utf-8', 'user-agent': USER_AGENT, 'accept-encoding': 'gzip' },
  })
}

/** The public checker's messages for one page; a 5xx (it is busy, or the page is large) is asked once more, a little later. */
async function remote(html: string): Promise<Message[]> {
  let response = await post(html)
  if (response.status >= 500) {
    await response.body?.cancel()
    await Bun.sleep(RETRY_MS())
    response = await post(html)
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`the Nu checker answered ${response.status}`)
  }
  return ((await response.json()) as { messages?: Message[] }).messages ?? []
}

/** Every page through one run of the local checker; the messages per page, in order. */
async function local(cmd: string[], pages: string[]): Promise<Message[][]> {
  const dir = await mkdtemp(join(tmpdir(), 'standards-vnu-'))
  try {
    const files = await Promise.all(pages.map(async (html, i) => {
      const file = join(dir, `page-${i}.html`)
      await Bun.write(file, html)
      return file
    }))
    const ran = await exec([...cmd, '--format', 'json', '--stdout', '--exit-zero-always', ...files], { timeoutMs: LOCAL_TIMEOUT_MS })
    if (ran.timedOut) throw new Error(`the local checker took over ${LOCAL_TIMEOUT_MS / 1000} s`)
    let messages: Message[]
    try {
      messages = (JSON.parse(ran.stdout) as { messages: Message[] }).messages
    } catch {
      throw new Error(`the local checker printed no JSON (${(ran.stderr || ran.stdout).trim().split('\n').at(-1)})`)
    }
    return files.map((_, i) => messages.filter(message => message.url?.endsWith(`/page-${i}.html`)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/**
 * `/fleet:12: Element “div” not allowed as child of element “ul” in this context. at <div class="card"> ×3`: the markup
 * the checker points at, since a framework's HTML is often one long line.
 */
export function describe(path: string, message: Message) {
  const markup = message.extract && message.hiliteStart !== undefined ? message.extract.substr(message.hiliteStart, message.hiliteLength) : ''
  const at = markup.trim() ? ` at ${short(markup.replace(/\s+/g, ' ').trim(), 60)}` : ''
  return `${path}:${message.lastLine ?? message.firstLine ?? '?'}: ${short(message.message.replace(/\s+/g, ' ').trim(), 140)}${at}`
}

/** Each distinct error of a page once, at the first markup it points at, with how many times it occurs. */
export function grouped(found: { path: string; message: Message }[]) {
  const groups = new Map<string, { first: { path: string; message: Message }; n: number }>()
  for (const entry of found) {
    const key = `${entry.path} ${entry.message.message}`
    const group = groups.get(key)
    if (group) group.n++
    else groups.set(key, { first: entry, n: 1 })
  }
  return [...groups.values()].map(({ first, n }) => `${describe(first.path, first.message)}${n > 1 ? ` ×${n}` : ''}`)
}

/** The site's HTML has no errors by the W3C Nu Html Checker, on the home page and two sampled pages. */
export default async function htmlValid({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const crawled = await crawl(asset.url, PAGES)
  const [home] = crawled
  const blocked = home && challenged(home)
  if (blocked) return { state: 'error', evidence: blocked }
  if (!home || home.error || home.status !== 200 || !home.html) {
    return { state: 'error', evidence: `the home page could not be read (${home?.error ?? `${home?.status}, ${home?.html ? 'HTML' : 'not HTML'}`}); nothing was validated` }
  }
  const pages: Page[] = crawled.filter(page => page.status === 200 && page.html && !challenged(page))
  const skipped = crawled.filter(page => !pages.includes(page)).map(page => `${pathOf(page.url)} (${page.error ?? page.status})`)

  const checker = localChecker()
  const by = checker ? `the local checker (${checker.at(-1)})` : new URL(nuUrl()).host
  // per page: its messages, or why it couldn't be checked
  let results: (Message[] | string)[]
  if (checker) {
    try {
      results = await local(checker, pages.map(page => page.html))
    } catch (error) {
      return { state: 'error', evidence: `${(error as Error).message}; nothing was validated` }
    }
  } else {
    // one page at a time, a second apart
    results = []
    for (const page of pages) results.push(await remote(page.html).catch((error: Error) => error.message))
  }
  for (const [i, result] of results.entries()) {
    const broken = typeof result !== 'string' && result.find(message => message.type === 'non-document-error')
    if (broken) results[i] = `${by} could not check it: ${broken.message}`
  }

  const kb = (page: Page) => `${Math.round(Buffer.byteLength(page.html) / 1024)} KB`
  const unchecked = pages.flatMap((page, i) => (typeof results[i] === 'string' ? [`${pathOf(page.final)} (${results[i]}, ${kb(page)} of HTML)`] : []))
  const checked = pages.filter((_, i) => typeof results[i] !== 'string')
  const errorsOf = (i: number) => (typeof results[i] === 'string' ? [] : (results[i] as Message[]).filter(m => m.type === 'error'))
  const errors = grouped(pages.flatMap((page, i) => errorsOf(i).map(message => ({ path: pathOf(page.final), message }))))
  const total = pages.reduce((sum, _, i) => sum + errorsOf(i).length, 0)
  const counts = checked.map(page => `${pathOf(page.final)} ${errorsOf(pages.indexOf(page)).length}`).join(', ')
  const notes = [skipped.length ? `not read: ${skipped.join(', ')}` : '', unchecked.length ? `not validated: ${unchecked.join(', ')}` : ''].filter(Boolean)
  const note = notes.length ? `; ${notes.join('; ')}` : ''
  if (total) return { state: 'fail', evidence: `${total} HTML errors by ${by} (${counts}): ${listed(errors, SHOWN)}${note}` }
  // a page the checker couldn't read proves nothing either way
  if (unchecked.length) {
    const checkedNote = checked.length ? `no errors on ${checked.map(page => pathOf(page.final)).join(', ')}, but ` : ''
    return { state: 'error', evidence: `${checkedNote}${notes.join('; ')}${checked.length ? '' : '; nothing was validated'}` }
  }
  return { state: 'pass', evidence: `no HTML errors by ${by} on ${checked.map(page => pathOf(page.final)).join(', ')}${note}` }
}
