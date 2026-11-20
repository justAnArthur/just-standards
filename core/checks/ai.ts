import { tmpdir } from 'node:os'
import { get } from '../expect.ts'
import { expandHome } from '../load.ts'
import type { Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'
import { resolve } from './http.ts'

type AiCheck = Extract<Check, { kind: 'ai' }>

const SCHEMA = JSON.stringify({
  type: 'object',
  properties: { state: { enum: ['pass', 'fail'] }, evidence: { type: 'string' } },
  required: ['state', 'evidence'],
})
// No WebFetch: it hands the model a summary of the page, so quotes in the evidence were unverifiable. The engine fetches the pages instead.
const TOOLS = ['Read', 'Grep', 'Glob']
const MAX_PAGE_CHARS = 60_000
const DROPPED = 'script, style, svg, noscript, template, iframe, link, meta[name="viewport"]'
const NOISY_ATTR = /^(class|style|srcset|sizes|data-.*|aria-hidden|loading|decoding|fetchpriority)$/

// Markers of a Claude Code session this process may run inside; a nested `claude` would join it.
export const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(CLAUDE|ANTHROPIC_)/.test(name)))

/** A page's HTML with what a reader doesn't see left out: scripts, styles, SVG, comments, class names; whitespace collapsed. */
export async function readable(html: string) {
  const stripped = await new HTMLRewriter()
    .on(DROPPED, { element: element => void element.remove() })
    .on('*', {
      element(element) {
        const noisy = [...element.attributes].map(([name]) => name).filter(name => NOISY_ATTR.test(name))
        for (const name of noisy) element.removeAttribute(name)
      },
    })
    .onDocument({ comments: comment => void comment.remove() })
    .transform(new Response(html))
    .text()
  return stripped.replace(/\s+/g, ' ').replace(/> </g, '>\n<').trim()
}

type Page = { url: string; html: string } | { url: string; error: string }

async function fetchPage(url: string): Promise<Page> {
  try {
    const response = await get(url)
    if (!response.ok) return { url, error: `answered ${response.status}` }
    const html = await readable(await response.text())
    return { url, html: html.length > MAX_PAGE_CHARS ? `${html.slice(0, MAX_PAGE_CHARS)}\n(cut at ${MAX_PAGE_CHARS} characters)` : html }
  } catch (error) {
    return { url, error: `did not respond (${(error as Error).message})` }
  }
}

function prompt(check: AiCheck, { asset, item }: Context, pages: Page[]) {
  const where = [asset.url && `URL: ${asset.url}`, asset.path && 'Local checkout: the current directory', asset.repo && `GitHub: ${asset.repo}`]
  const shown = pages.map(page =>
    'html' in page ? `The HTML of ${page.url} as served (scripts, styles, SVG and class names removed):\n\n\`\`\`html\n${page.html}\n\`\`\`` : '',
  )
  return [
    `You judge one standard for one asset. Look, don't change anything.`,
    `Standard: ${item.title}. Why it matters: ${item.why}`,
    `Asset: ${asset.id} (${asset.kind}${asset.stack ? `, ${asset.stack}` : ''})`,
    ...where.filter(Boolean),
    '',
    check.prompt,
    '',
    'Answer pass or fail, and evidence in one or two sentences a person can verify. Quote text exactly as it is in the HTML.',
    ...shown.filter(Boolean),
  ].join('\n')
}

export async function ai(check: AiCheck, ctx: Context): Promise<Outcome> {
  const { url } = ctx.asset
  const pages = url ? await Promise.all(check.pages.map(path => fetchPage(resolve(path, url)))) : []
  const failed = pages.find(page => 'error' in page)
  if (failed && 'error' in failed) return { state: 'error', evidence: `${failed.url} ${failed.error}` }

  const cwd = ctx.asset.path ? expandHome(ctx.asset.path) : tmpdir()
  const args = ['claude', '-p', '--model', check.model, '--output-format', 'json', '--json-schema', SCHEMA]
  const proc = Bun.spawn([...args, '--tools', ...TOOLS, '--allowedTools', ...TOOLS, '--no-session-persistence'], {
    cwd,
    env: cleanEnv(),
    // on stdin: the pages make the prompt long
    stdin: new Blob([prompt(check, ctx, pages)]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  if (code !== 0) return { state: 'error', evidence: `claude exited ${code}: ${stderr.trim().slice(0, 300)}` }
  const output = JSON.parse(stdout) as { is_error: boolean; result: string; structured_output?: Outcome }
  if (output.is_error || !output.structured_output) return { state: 'error', evidence: output.result.slice(0, 300) }
  return output.structured_output
}
