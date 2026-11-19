#!/usr/bin/env bun
// Stands in for `claude -p --input-format stream-json --output-format stream-json` in the runs tests.
// FAKE_CLAUDE=no-pr ends without a PR URL; FAKE_CLAUDE=hang starts a child and waits forever.
import { lines } from '../runs.ts'

const interactive = Bun.argv.includes('--permission-prompt-tool')
const mode = process.env.FAKE_CLAUDE
const session_id = 'fake-session'
const PR = 'https://github.com/acme/widgets/pull/7'

const say = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`)
const input = lines(Bun.stdin.stream())[Symbol.asyncIterator]()
const next = async () => {
  const { value, done } = await input.next()
  return done ? undefined : JSON.parse(value)
}

const first = await next()
const prompt: string = first.message.content[0].text
say({
  type: 'system',
  subtype: 'init',
  session_id,
  cwd: process.cwd(),
  model: Bun.argv[Bun.argv.indexOf('--model') + 1],
  argv: Bun.argv.slice(2),
  config_dir: process.env.CLAUDE_CONFIG_DIR ?? null,
  leaked: Object.keys(process.env).filter(name => /^(CLAUDE|ANTHROPIC_)/.test(name) && name !== 'CLAUDE_CONFIG_DIR'),
})
say({ type: 'assistant', session_id, message: { role: 'assistant', content: [{ type: 'text', text: `On it. ${prompt.split('\n')[0]}` }] } })

if (mode === 'hang') {
  const child = Bun.spawn(['sleep', '600'])
  say({ type: 'system', subtype: 'fake_child', pid: child.pid })
  await child.exited
}

const tool = { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'gh pr create --fill' } }
let behavior = 'allow'
if (interactive) {
  say({ type: 'control_request', request_id: 'req_1', request: { subtype: 'can_use_tool', tool_name: tool.name, input: tool.input, tool_use_id: tool.id } })
  const answer = await next()
  if (answer?.type !== 'control_response' || answer.response.request_id !== 'req_1') process.exit(3)
  behavior = answer.response.response.behavior
}
say({ type: 'assistant', session_id, message: { role: 'assistant', content: [tool] } })
const output = behavior === 'allow' ? PR : 'The user denied this.'
say({ type: 'user', session_id, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, content: output }] } })
say({
  type: 'result',
  subtype: 'success',
  is_error: false,
  session_id,
  total_cost_usd: 0.0123,
  num_turns: 2,
  result: mode === 'no-pr' ? 'Could not open a pull request.' : `Opened the pull request.\n${PR}`,
})

// The session only ends when stdin closes.
while (await next());
