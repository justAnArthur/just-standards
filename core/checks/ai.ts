import { tmpdir } from 'node:os'
import { expandHome } from '../load.ts'
import type { Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'

type AiCheck = Extract<Check, { kind: 'ai' }>

const SCHEMA = JSON.stringify({
  type: 'object',
  properties: { state: { enum: ['pass', 'fail'] }, evidence: { type: 'string' } },
  required: ['state', 'evidence'],
})
const TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch']

// Markers of a Claude Code session this process may run inside; a nested `claude` would join it.
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(CLAUDE|ANTHROPIC_)/.test(name)))

function prompt(check: AiCheck, { asset, item }: Context) {
  const where = [asset.url && `URL: ${asset.url}`, asset.path && 'Local checkout: the current directory', asset.repo && `GitHub: ${asset.repo}`]
  return [
    `You judge one standard for one asset. Look, don't change anything.`,
    `Standard: ${item.title}. Why it matters: ${item.why}`,
    `Asset: ${asset.id} (${asset.kind}${asset.stack ? `, ${asset.stack}` : ''})`,
    ...where.filter(Boolean),
    '',
    check.prompt,
    '',
    'Answer pass or fail, and evidence in one or two sentences a person can verify.',
  ].join('\n')
}

export async function ai(check: AiCheck, ctx: Context): Promise<Outcome> {
  const cwd = ctx.asset.path ? expandHome(ctx.asset.path) : tmpdir()
  const args = ['claude', '-p', prompt(check, ctx), '--model', check.model, '--output-format', 'json', '--json-schema', SCHEMA]
  const proc = Bun.spawn([...args, '--tools', ...TOOLS, '--allowedTools', ...TOOLS, '--no-session-persistence'], {
    cwd,
    env: cleanEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  if (code !== 0) return { state: 'error', evidence: `claude exited ${code}: ${stderr.trim().slice(0, 300)}` }
  const output = JSON.parse(stdout) as { is_error: boolean; result: string; structured_output?: Outcome }
  if (output.is_error || !output.structured_output) return { state: 'error', evidence: output.result.slice(0, 300) }
  return output.structured_output
}
