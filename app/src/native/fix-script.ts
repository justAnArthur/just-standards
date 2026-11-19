import type { RunRecord } from '../runs'

/** What the web host's `standards fix` works on: the run's facts, as the CLI would know them. */
export interface FixPlan {
  id: string
  business: string
  asset: string
  /** `pack/item` */
  items: string[]
  worker: string
  model: string
  /** The asset's checkout, absolute. */
  path: string
  /** owner/name on GitHub. */
  repo: string
  /** The asset's URL, or its repo's page. */
  site: string
  started_at: string
}

/** One line Claude Code prints, and how long after the one before it. */
export interface Step {
  delay: number
  line: Record<string, unknown>
}

/** A recorded fix run's lines, as Claude Code printed them: up to its permission question, then each answer's ending. */
export interface FixScript {
  started: RunRecord
  requestId: string
  opening: Step[]
  allowed: Step[]
  denied: Step[]
  /** The record once the session ends, after either answer, or after a stop. */
  finish(how: 'allowed' | 'denied' | 'stopped', at: string): RunRecord
}

const itemId = (key: string) => key.slice(key.indexOf('/') + 1)

let uuids = 0
const uuid = () => `00000000-0000-4000-8000-${String(++uuids).padStart(12, '0')}`

const usage = { input_tokens: 4, output_tokens: 180, cache_read_input_tokens: 21_400, cache_creation_input_tokens: 2_100 }

export function fixScript(plan: FixPlan): FixScript {
  const first = itemId(plan.items[0]!)
  const branch = `standards/${first}`
  const worktree = `${plan.path}/.worktrees/std-${first}`
  const session_id = uuid()
  const requestId = uuid()
  const layout = `${worktree}/src/app/(frontend)/layout.tsx`
  const number = 10 + ([...plan.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 90)
  const pr = { url: `https://github.com/${plan.repo}/pull/${number}`, number }
  const started: RunRecord = {
    id: plan.id,
    business: plan.business,
    asset: plan.asset,
    items: plan.items,
    worker: plan.worker,
    model: plan.model,
    branch,
    worktree,
    started_at: plan.started_at,
    state: 'running',
  }

  let turn = 0
  const assistant = (content: unknown[], delay = 900): Step => ({
    delay,
    line: {
      type: 'assistant',
      message: { id: `msg_${session_id.slice(-6)}${++turn}`, model: `claude-${plan.model}-5-5`, content, usage },
      parent_tool_use_id: null,
      session_id,
      uuid: uuid(),
    },
  })
  const tool = (id: string, name: string, input: Record<string, unknown>, text?: string) =>
    assistant([...(text ? [{ type: 'text', text }] : []), { type: 'tool_use', id, name, input }])
  const result = (id: string, content: string, delay = 700, is_error = false): Step => ({
    delay,
    line: {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, ...(is_error && { is_error }) }] },
      parent_tool_use_id: null,
      session_id,
      uuid: uuid(),
    },
  })
  const end = (text: string, cost: number): Step => ({
    delay: 600,
    line: {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 48_200,
      num_turns: turn,
      total_cost_usd: cost,
      usage,
      result: text,
      session_id,
    },
  })

  const opening: Step[] = [
    {
      delay: 500,
      line: {
        type: 'system',
        subtype: 'init',
        session_id,
        cwd: worktree,
        model: `claude-${plan.model}-5-5`,
        permissionMode: 'acceptEdits',
        tools: ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'],
        claude_code_version: '2.1.325',
      },
    },
    assistant(
      [
        { type: 'thinking', thinking: 'The check reads the home page head. Find where the layout builds its metadata, then add what is missing.' },
        { type: 'text', text: 'I’ll find where the home page builds its Open Graph tags.' },
        { type: 'tool_use', id: 'toolu_grep', name: 'Grep', input: { pattern: 'openGraph', path: 'src' } },
      ],
      1400,
    ),
    result('toolu_grep', 'src/app/(frontend)/layout.tsx:18:  openGraph: {'),
    tool('toolu_read', 'Read', { file_path: layout }),
    result(
      'toolu_read',
      [
        "export const metadata: Metadata = {",
        `  title: '${plan.business}',`,
        "  openGraph: {",
        "    images: [{ url: '/og.png', width: 1200, height: 630 }],",
        '  },',
        '}',
      ].join('\n'),
    ),
    tool(
      'toolu_edit',
      'Edit',
      {
        file_path: layout,
        old_string: "    images: [{ url: '/og.png', width: 1200, height: 630 }],",
        new_string: [
          "    images: [{ url: '/og.png', width: 1200, height: 630 }],",
          `    videos: [{ url: '${plan.site}/media/hero-loop.mp4', type: 'video/mp4', width: 1280, height: 720 }],`,
        ].join('\n'),
      },
      'The layout sets an image but no video. I’ll add the hero loop as og:video, with its type and size.',
    ),
    result('toolu_edit', `The file ${layout} has been updated successfully.`),
    tool('toolu_build', 'Bash', { command: 'bun run build', description: 'Build the site' }),
    result('toolu_build', '▲ Next.js 16.1\n✓ Compiled successfully in 21.4s\n✓ Generating static pages (14/14)', 2200),
    tool(
      'toolu_curl',
      'Bash',
      { command: `curl -sI ${plan.site}/media/hero-loop.mp4`, description: 'Check the video answers 200 video/mp4' },
      'Before I open the PR, I’ll check the video URL answers as the check expects.',
    ),
    {
      delay: 300,
      line: {
        type: 'control_request',
        request_id: requestId,
        request: {
          subtype: 'can_use_tool',
          tool_name: 'Bash',
          input: { command: `curl -sI ${plan.site}/media/hero-loop.mp4`, description: 'Check the video answers 200 video/mp4' },
          tool_use_id: 'toolu_curl',
          permission_suggestions: [
            { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'curl -sI:*' }], behavior: 'allow', destination: 'localSettings' },
          ],
        },
      },
    },
  ]

  const done = `Opened ${pr.url}: the home page now sets og:video to the hero loop (video/mp4, 1280×720). The cell passes once it deploys.`
  const allowed: Step[] = [
    result('toolu_curl', 'HTTP/2 200\ncontent-type: video/mp4\ncontent-length: 2516582', 900),
    tool('toolu_commit', 'Bash', { command: `git commit -am "feat: og:video on the home page"`, description: 'Commit the change' }),
    result('toolu_commit', `[${branch} 3f2a91c] feat: og:video on the home page\n 1 file changed, 1 insertion(+)`),
    tool('toolu_pr', 'Bash', { command: `git push -u origin ${branch} && gh pr create --fill`, description: 'Push and open the PR' }),
    result('toolu_pr', `branch '${branch}' set up to track 'origin/${branch}'.\n${pr.url}`, 1800),
    assistant([{ type: 'text', text: done }]),
    end(done, 0.38),
  ]

  const stopped = 'I couldn’t confirm the video URL answers, so I’ve left the change committed in the worktree and opened no pull request.'
  const denied: Step[] = [
    result('toolu_curl', 'Denied by the user.', 400, true),
    assistant([{ type: 'text', text: stopped }]),
    end(stopped, 0.21),
  ]

  function finish(how: 'allowed' | 'denied' | 'stopped', at: string): RunRecord {
    const ended = { ...started, finished_at: at, ms: Date.parse(at) - Date.parse(plan.started_at), session_id }
    if (how === 'allowed')
      return {
        ...ended,
        state: 'done',
        pr: { ...pr, state: 'open' },
        cost_usd: 0.38,
        summary: `Fixed ${plan.items.map(itemId).join(', ')} on ${plan.asset} in \`${branch}\` and opened PR #${number}.`,
        missing: [`Check the preview deploy before merging: ${plan.site}`],
      }
    if (how === 'denied') return { ...ended, state: 'failed', cost_usd: 0.21, error: 'no pull request' }
    return { ...ended, state: 'stopped', error: 'stopped by SIGTERM' }
  }

  return { started, requestId, opening, allowed, denied, finish }
}

/** The line with the time Claude Code would have printed it at. */
export const stamped = ({ line }: Step, at: number) =>
  JSON.stringify(line.type === 'user' || line.type === 'assistant' ? { ...line, timestamp: new Date(at).toISOString() } : line)
