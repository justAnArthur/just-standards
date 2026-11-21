import { join } from 'node:path'
import { assertValue } from '../expect.ts'
import { expandHome } from '../load.ts'
import type { Asset, Check, Outcome, RepoExpect } from '../schema.ts'
import type { Context } from './context.ts'
import { remoteFile, run } from './github.ts'

type RepoCheck = Extract<Check, { kind: 'repo' }>

const MAX_GREP_BYTES = 1_000_000
const SHOWN = 5

/** Reads the local checkout when the asset has one, otherwise the default branch on GitHub. */
function source(asset: Asset) {
  if (asset.path) {
    const root = expandHome(asset.path)
    return {
      where: root,
      local: true,
      read: async (path: string) => {
        const file = Bun.file(join(root, path))
        return (await file.exists()) ? file.text() : undefined
      },
      tracked: async (path: string) => (await run(['git', 'ls-files', '--error-unmatch', path], root)).ok,
      files: async () => (await run(['git', 'ls-files'], root)).stdout.split('\n').filter(Boolean),
    }
  }
  const repo = asset.repo as string
  return {
    where: `github.com/${repo}`,
    local: false,
    read: (path: string) => remoteFile(repo, path),
    tracked: async (path: string) => (await remoteFile(repo, path)) !== undefined,
    files: async () => {
      const tree = await run(['gh', 'api', `repos/${repo}/git/trees/HEAD?recursive=1`, '--jq', '.tree[] | select(.type == "blob") | .path'])
      return tree.ok ? tree.stdout.split('\n').filter(Boolean) : []
    },
  }
}

type Source = ReturnType<typeof source>

async function grepFiles(expect: Extract<RepoExpect, { grep: string }>, src: Source) {
  if (!src.local) return `grep needs a local checkout; ${src.where} has none`
  const glob = new Bun.Glob(expect.in)
  const pattern = new RegExp(expect.grep, 'm')
  const hits: string[] = []
  for (const path of (await src.files()).filter(path => glob.match(path))) {
    const file = Bun.file(join(src.where, path))
    if (file.size > MAX_GREP_BYTES) continue
    const text = await file.text()
    const match = pattern.exec(text)
    if (!match) continue
    const line = text.slice(0, match.index).split('\n').length
    hits.push(`${path}:${line}`)
  }
  if (expect.none) return hits.length ? `/${expect.grep}/ in ${hits.slice(0, SHOWN).join(', ')}${hits.length > SHOWN ? ` and ${hits.length - SHOWN} more` : ''}` : undefined
  return hits.length ? undefined : `no file matching ${expect.in} contains /${expect.grep}/`
}

async function expectOne(expect: RepoExpect, src: Source) {
  if ('untracked' in expect) return (await src.tracked(expect.untracked)) ? `${expect.untracked} is tracked in ${src.where}` : undefined
  if ('glob' in expect) {
    const glob = new Bun.Glob(expect.glob)
    const found = (await src.files()).filter(path => glob.match(path)).length
    return found >= expect.min ? undefined : `${found} tracked files match ${expect.glob}, expected at least ${expect.min}`
  }
  if ('grep' in expect) return grepFiles(expect, src)
  return assertValue(expect.file, await src.read(expect.file), expect)
}

export async function repo(check: RepoCheck, { asset }: Context): Promise<Outcome> {
  if (!(asset.path || asset.repo)) return { state: 'error', evidence: `asset ${asset.id} has neither a path nor a repo` }
  const src = source(asset)
  if (asset.path && !(await run(['git', '-C', src.where, 'rev-parse', '--git-dir'])).ok) {
    return { state: 'error', evidence: `${src.where} is not a git checkout` }
  }
  const failures: string[] = []
  for (const expect of check.expect) {
    const failure = await expectOne(expect, src)
    if (failure) failures.push(failure)
  }
  if (failures.length > 0) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: src.where }
}
