import { join } from 'node:path'
import type { Context } from '../../core/checks/context.ts'
import { remoteFile, run } from '../../core/checks/github.ts'
import { expandHome } from '../../core/load.ts'
import type { Outcome } from '../../core/schema.ts'

/** The asset's tracked files: its local checkout, else its default branch on GitHub. */
export interface Checkout {
  where: string
  local: boolean
  files: string[]
  read: (path: string) => Promise<string | undefined>
}

const MAX_BYTES = 1_000_000

export async function checkout({ asset }: Context): Promise<Checkout | Outcome> {
  if (asset.path) {
    const root = expandHome(asset.path)
    const listed = await run(['git', 'ls-files'], root)
    if (!listed.ok) return { state: 'error', evidence: `${root} is not a git checkout` }
    return {
      where: root,
      local: true,
      files: listed.stdout.split('\n').filter(Boolean),
      read: async path => {
        const file = Bun.file(join(root, path))
        return (await file.exists()) && file.size <= MAX_BYTES ? file.text() : undefined
      },
    }
  }
  if (!asset.repo) return { state: 'error', evidence: `asset ${asset.id} has neither a path nor a repo` }
  const repo = asset.repo
  const tree = await run(['gh', 'api', `repos/${repo}/git/trees/HEAD?recursive=1`, '--jq', '.tree[] | select(.type == "blob") | .path'])
  if (!tree.ok) return { state: 'error', evidence: `can't list github.com/${repo}: ${tree.stderr}` }
  return { where: `github.com/${repo}`, local: false, files: tree.stdout.split('\n').filter(Boolean), read: path => remoteFile(repo, path) }
}

export const isOutcome = (value: Checkout | Outcome): value is Outcome => 'state' in value
