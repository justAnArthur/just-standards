import { afterAll, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lines } from './runs.ts'

const CLI = join(import.meta.dir, '../cli/standards.ts')
const dir = await mkdtemp(join(tmpdir(), 'standards-mcp-'))

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

function server(run: string) {
  const proc = Bun.spawn(['bun', CLI, 'mcp', '--run', run, '--workspace', dir], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  const replies = lines(proc.stdout)[Symbol.asyncIterator]()
  const send = (message: object) => {
    proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
    proc.stdin.flush()
  }
  const call = async (id: number, method: string, params: object = {}) => {
    send({ id, method, params })
    return JSON.parse((await replies.next()).value as string)
  }
  return { proc, send, call }
}

test('initialize, tools/list and tools/call finish write finish.json', async () => {
  const { proc, send, call } = server('20261119-120000-acme-readme')

  const init = await call(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
  expect(init).toEqual({
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'standards', version: '1.0.0' } },
  })
  send({ method: 'notifications/initialized' })

  const { result } = await call(2, 'tools/list')
  expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual(['finish'])
  expect(result.tools[0].inputSchema).toMatchObject({ type: 'object', required: ['summary'] })
  expect(Object.keys(result.tools[0].inputSchema.properties)).toEqual(['pr_url', 'summary', 'missing'])

  const bad = await call(3, 'tools/call', { name: 'finish', arguments: { pr_url: 'not a url' } })
  expect(bad.result.isError).toBe(true)
  expect(bad.result.content[0].text).toContain('summary')

  const input = { pr_url: 'https://github.com/acme/widgets/pull/7', summary: 'Wrote the README.', missing: ['A logo'] }
  const done = await call(4, 'tools/call', { name: 'finish', arguments: input })
  expect(done).toEqual({ jsonrpc: '2.0', id: 4, result: { content: [{ type: 'text', text: 'Recorded. The run is finished: stop now.' }] } })
  expect(await Bun.file(join(dir, '.state/runs/20261119-120000-acme-readme/finish.json')).json()).toEqual(input)

  expect((await call(5, 'tools/call', { name: 'other' })).error.code).toBe(-32602)
  expect((await call(6, 'resources/list')).error.code).toBe(-32601)
  expect(await call(7, 'ping')).toEqual({ jsonrpc: '2.0', id: 7, result: {} })

  proc.stdin.end()
  expect(await proc.exited).toBe(0)
})

test("answers an unknown protocol version with its newest, and refuses a run id that isn't one", async () => {
  const { proc, call } = server('some-run')
  const init = await call(1, 'initialize', { protocolVersion: '1999-01-01', capabilities: {} })
  expect(init.result.protocolVersion).toBe('2025-11-25')
  proc.stdin.end()
  await proc.exited

  const climbing = server('../../etc')
  climbing.proc.stdin.end()
  expect(await climbing.proc.exited).toBe(1)
  expect(await new Response(climbing.proc.stderr).text()).toContain('no run ../../etc')
})
