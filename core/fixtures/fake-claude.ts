#!/usr/bin/env bun
// Stands in for `claude -p --input-format stream-json --output-format stream-json` in the runs tests.
// FAKE_CLAUDE=no-pr ends without a PR URL; FAKE_CLAUDE=hang starts a child and waits forever.
// FAKE_FINISH='<json>' starts the `standards` MCP server from --mcp-config, as Claude Code does, and calls finish with it.
import { lines } from '../runs.ts'

const interactive = Bun.argv.includes('--permission-prompt-tool')
const mode = process.env.FAKE_CLAUDE
const session_id = 'fake-session'
const PR = 'https://github.com/acme/widgets/pull/7'

const say = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`)
const argAfter = (flag: string) => Bun.argv[Bun.argv.indexOf(flag) + 1]!

/** Speaks MCP to the configured `standards` server: initialize, tools/list, then a call to `finish`. */
async function callFinish(args: object) {
  const { command, args: argv } = JSON.parse(argAfter('--mcp-config')).mcpServers.standards
  const server = Bun.spawn([command, ...argv], { stdin: 'pipe', stdout: 'pipe' })
  const replies = lines(server.stdout)[Symbol.asyncIterator]()
  const call = async (id: number, method: string, params: object) => {
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    server.stdin.flush()
    const reply = JSON.parse((await replies.next()).value as string)
    if (reply.id !== id || reply.error) throw new Error(`${method}: ${JSON.stringify(reply)}`)
    return reply.result
  }
  await call(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fake-claude', version: '0' } })
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  const { tools } = await call(2, 'tools/list', {})
  if (!tools.some((tool: { name: string }) => tool.name === 'finish')) throw new Error('no finish tool')
  const result = await call(3, 'tools/call', { name: 'finish', arguments: args })
  server.stdin.end()
  await server.exited
  return result.content[0].text as string
}
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
  model: argAfter('--model'),
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
if (process.env.FAKE_FINISH) {
  const input = JSON.parse(process.env.FAKE_FINISH)
  const call = { type: 'tool_use', id: 'toolu_2', name: 'mcp__standards__finish', input }
  say({ type: 'assistant', session_id, message: { role: 'assistant', content: [call] } })
  const text = await callFinish(input)
  say({ type: 'user', session_id, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: call.id, content: text }] } })
}
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
