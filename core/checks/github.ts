import { assertValue } from '../expect.ts'
import type { Check, GithubField, Outcome } from '../schema.ts'
import type { Context } from './context.ts'

type GithubCheck = Extract<Check, { kind: 'github' }>

export async function run(cmd: string[], cwd?: string) {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { ok: code === 0, stdout, stderr: stderr.trim() }
}

const QUERY = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
  description homepageUrl isArchived isPrivate licenseInfo{spdxId}
  repositoryTopics(first:30){nodes{topic{name}}}
}}`

interface Meta {
  description: string | null
  homepageUrl: string | null
  isArchived: boolean
  isPrivate: boolean
  licenseInfo: { spdxId: string } | null
  repositoryTopics: { nodes: { topic: { name: string } }[] }
}

const metas = new Map<string, Promise<Meta>>()

function meta(repo: string) {
  const cached = metas.get(repo)
  if (cached) return cached
  const [owner, name] = repo.split('/') as [string, string]
  const loaded = run(['gh', 'api', 'graphql', '-F', `owner=${owner}`, '-F', `name=${name}`, '-f', `query=${QUERY}`]).then(result => {
    if (!result.ok) throw new Error(result.stderr || `gh api graphql failed for ${repo}`)
    return JSON.parse(result.stdout).data.repository as Meta
  })
  metas.set(repo, loaded)
  return loaded
}

/** A file's text from the default branch on GitHub, or undefined when it isn't there. */
export async function remoteFile(repo: string, path: string) {
  const result = await run(['gh', 'api', `repos/${repo}/contents/${path}`, '-H', 'Accept: application/vnd.github.raw'])
  return result.ok ? result.stdout : undefined
}

async function field(repo: string, name: GithubField): Promise<string | string[] | undefined> {
  if (name === 'readme') return (await run(['gh', 'api', `repos/${repo}/readme`, '-H', 'Accept: application/vnd.github.raw'])).stdout || undefined
  const m = await meta(repo)
  const values: Record<Exclude<GithubField, 'readme'>, string | string[] | undefined> = {
    description: m.description ?? undefined,
    topics: m.repositoryTopics.nodes.map(node => node.topic.name),
    homepage: m.homepageUrl ?? undefined,
    license: m.licenseInfo?.spdxId,
    archived: String(m.isArchived),
    private: String(m.isPrivate),
  }
  return values[name]
}

export async function github(check: GithubCheck, { asset }: Context): Promise<Outcome> {
  if (!asset.repo) return { state: 'error', evidence: `asset ${asset.id} has no repo` }
  const failures: string[] = []
  try {
    for (const expect of check.expect) {
      const failure = await assertValue(expect.field, await field(asset.repo, expect.field), expect)
      if (failure) failures.push(failure)
    }
  } catch (error) {
    return { state: 'error', evidence: (error as Error).message }
  }
  if (failures.length > 0) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: `github.com/${asset.repo}` }
}
