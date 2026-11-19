import { join } from 'node:path'
import { assertValue } from '../expect.ts'
import { expandHome } from '../load.ts'
import type { Asset, Check, Outcome, RepoExpect } from '../schema.ts'
import type { Context } from './context.ts'
import { remoteFile, run } from './github.ts'

type RepoCheck = Extract<Check, { kind: 'repo' }>

/** Reads the local checkout when the asset has one, otherwise the default branch on GitHub. */
function source(asset: Asset) {
  if (asset.path) {
    const root = expandHome(asset.path)
    return {
      where: root,
      read: async (path: string) => {
        const file = Bun.file(join(root, path))
        return (await file.exists()) ? file.text() : undefined
      },
      tracked: async (path: string) => (await run(['git', 'ls-files', '--error-unmatch', path], root)).ok,
    }
  }
  const repo = asset.repo as string
  return {
    where: `github.com/${repo}`,
    read: (path: string) => remoteFile(repo, path),
    tracked: async (path: string) => (await remoteFile(repo, path)) !== undefined,
  }
}

async function expectOne(expect: RepoExpect, src: ReturnType<typeof source>) {
  if ('untracked' in expect) return (await src.tracked(expect.untracked)) ? `${expect.untracked} is tracked in ${src.where}` : undefined
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
