import type { Context } from '../../../../core/checks/context.ts'
import { resolve } from '../../../../core/checks/http.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'

/** Bytes read from each answer: enough for every signature, little for a soft 404 that answers the whole home page. */
const READ = 16_384

interface Probe {
  path: string
  /** what it gives away when served */
  leaks: string
  /** The answer looks like the real file, not a soft 404 page. */
  looks: (text: string, bytes: Uint8Array) => boolean
}

const notHtml = (text: string) => !/^\s*(<!doctype|<html|<head|<body|<\?xml)/i.test(text)
const envLines = (text: string) => notHtml(text) && /^\s*(export\s+)?[A-Z][A-Z0-9_]*\s*=/m.test(text)
const jsonObject = (text: string) => {
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
  } catch {
    return false
  }
}

export const PROBES: Probe[] = [
  { path: '/.git/HEAD', leaks: 'the git repository (source and history)', looks: text => /^(ref: refs\/|[0-9a-f]{40}\s*$)/.test(text.trim()) },
  { path: '/.git/config', leaks: 'the git repository (remotes, sometimes credentials)', looks: text => /^\s*\[(core|remote)/m.test(text) },
  { path: '/.env', leaks: 'environment secrets', looks: envLines },
  { path: '/.env.local', leaks: 'environment secrets', looks: envLines },
  { path: '/.env.production', leaks: 'environment secrets', looks: envLines },
  {
    path: '/.DS_Store',
    leaks: 'a folder listing',
    looks: (_, bytes) => bytes.length >= 8 && bytes[3] === 1 && new TextDecoder().decode(bytes.slice(4, 8)) === 'Bud1',
  },
  { path: '/wp-config.php.bak', leaks: 'database credentials', looks: text => notHtml(text) && /DB_(PASSWORD|USER|NAME)|define\s*\(/.test(text) },
  { path: '/wp-config.php~', leaks: 'database credentials', looks: text => notHtml(text) && /DB_(PASSWORD|USER|NAME)|define\s*\(/.test(text) },
  { path: '/server-status', leaks: "Apache's live request list", looks: text => /Apache Server Status|Server Version:/i.test(text) },
  { path: '/phpinfo.php', leaks: 'the PHP configuration', looks: text => /phpinfo\(\)|PHP Version \d/i.test(text) },
  { path: '/.vscode/settings.json', leaks: 'editor settings, sometimes paths and tokens', looks: text => notHtml(text) && jsonObject(text) },
  { path: '/.npmrc', leaks: 'registry tokens', looks: text => notHtml(text) && /_authToken|registry\s*=|always-auth/i.test(text) },
  { path: '/.htpasswd', leaks: 'password hashes', looks: text => notHtml(text) && /^[\w.-]+:(\$apr1\$|\$2[aby]\$|\{SHA\}|[./0-9A-Za-z]{13}$)/m.test(text) },
  { path: '/docker-compose.yml', leaks: 'the deployment, often with secrets', looks: text => notHtml(text) && /^services:\s*$/m.test(text) },
  { path: '/backup.sql', leaks: 'a database dump', looks: text => notHtml(text) && /CREATE TABLE|INSERT INTO|-- MySQL dump|PostgreSQL database dump/i.test(text) },
  { path: '/dump.sql', leaks: 'a database dump', looks: text => notHtml(text) && /CREATE TABLE|INSERT INTO|-- MySQL dump|PostgreSQL database dump/i.test(text) },
]

/** The first bytes of the body, without reading the rest. */
async function head(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  while (length < READ) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
  }
  await reader.cancel().catch(() => {})
  const bytes = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.length
  }
  return bytes.slice(0, READ)
}

type Answer = { path: string; status: number; exposed: boolean; firewall?: boolean } | { path: string; error: string }

async function probe(base: string, { path, looks }: Probe): Promise<Answer> {
  try {
    const response = await get(resolve(path, base))
    if (response.status !== 200) {
      await response.body?.cancel()
      return { path, status: response.status, exposed: false, firewall: challenged(response) !== undefined }
    }
    const bytes = await head(response)
    return { path, status: 200, exposed: looks(new TextDecoder().decode(bytes), bytes) }
  } catch (error) {
    return { path, error: (error as Error).message }
  }
}

/**
 * Files that must never be served: each answers something other than 200, or a 200 that isn't the file (a soft 404 page).
 * The home page is asked first: when the host's firewall already challenges the checker, a 403 says nothing about the files.
 * The probes go one at a time, so they don't arrive as a scanner's burst.
 */
export default async function exposedFiles({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  try {
    const control = await get(asset.url)
    await control.body?.cancel()
    const blocked = challenged(control)
    if (blocked) return { state: 'error', evidence: blocked }
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  const answers: Answer[] = []
  for (const p of PROBES) answers.push(await probe(asset.url, p))
  const failed = answers.filter(answer => 'error' in answer)
  if (failed.length === answers.length) return { state: 'error', evidence: `${asset.url} did not respond (${(failed[0] as { error: string }).error})` }

  const exposed = answers.filter(answer => 'exposed' in answer && answer.exposed).map(answer => answer.path)
  if (exposed.length > 0) {
    const what = [...new Set(exposed.map(path => PROBES.find(p => p.path === path)?.leaks))].join('; ')
    return { state: 'fail', evidence: `served as the real file: ${exposed.join(', ')} (${what})` }
  }
  const soft = answers.filter(answer => 'status' in answer && answer.status === 200).length
  const statuses = [...new Set(answers.flatMap(answer => ('status' in answer && answer.status !== 200 ? [answer.status] : [])))].sort()
  const firewall = answers.filter(answer => 'firewall' in answer && answer.firewall).length
  const how = [
    statuses.length > 0 && `answered ${statuses.join('/')}`,
    soft > 0 && `${soft} answered 200 with a page that isn't the file`,
    firewall > 0 && `${firewall} were challenged by the host's firewall`,
  ].filter(Boolean)
  const unanswered = failed.length > 0 ? `; ${failed.length} gave no answer` : ''
  return { state: 'pass', evidence: `none of ${PROBES.length} paths (${PROBES.slice(0, 4).map(p => p.path).join(', ')}…) is served: ${how.join(', ')}${unanswered}` }
}
