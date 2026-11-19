import { join } from 'node:path'
import { z } from 'zod'
import { runDir } from './runs.ts'

/** The input of the `finish` tool, as a worker calls it at the end of a run. */
export const Finish = z.object({
  pr_url: z
    .string()
    .regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/)
    .optional()
    .describe('The URL of the pull request you opened. Leave it out when there is none.'),
  summary: z.string().min(1).describe('A short summary of what you changed, or why you could not.'),
  missing: z.array(z.string()).optional().describe('Anything a person must still do, one entry each.'),
})
export type Finish = z.infer<typeof Finish>

/** Newest first; the client's version is echoed when it is one of these. */
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const TOOL = {
  name: 'finish',
  description: 'Ends the run: records the pull request, a short summary and what a person must still do. Call it once, last, then stop.',
  inputSchema: z.toJSONSchema(Finish),
}

export const finishFile = (wsDir: string, runId: string) => join(runDir({ dir: wsDir }, runId), 'finish.json')

interface Request {
  id?: string | number | null
  method: string
  params?: { protocolVersion?: string; name?: string; arguments?: unknown }
}

const text = (value: string, isError = false) => ({ content: [{ type: 'text', text: value }], ...(isError ? { isError } : {}) })

async function answer(request: Request, file: string) {
  const { method, params } = request
  if (method === 'initialize') {
    const asked = params?.protocolVersion ?? ''
    return {
      result: {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'standards', version: '1.0.0' },
      },
    }
  }
  if (method === 'ping') return { result: {} }
  if (method === 'tools/list') return { result: { tools: [TOOL] } }
  if (method === 'tools/call') {
    if (params?.name !== TOOL.name) return { error: { code: -32602, message: `no tool ${params?.name}` } }
    const parsed = Finish.safeParse(params.arguments ?? {})
    // A tool error, not a protocol error, so the worker sees what to fix and can call again.
    if (!parsed.success) return { result: text(parsed.error.issues.map(i => `${i.path.join('.') || '(input)'}: ${i.message}`).join('\n'), true) }
    await Bun.write(file, `${JSON.stringify(parsed.data, null, 2)}\n`)
    return { result: text('Recorded. The run is finished: stop now.') }
  }
  return { error: { code: -32601, message: `no method ${method}` } }
}

/** A Model Context Protocol server over newline-delimited JSON-RPC, with the one tool `finish`, which writes the run's `finish.json`. */
export async function serveMcp(wsDir: string, runId: string, input: AsyncIterable<string>, write: (line: string) => void) {
  const file = finishFile(wsDir, runId)
  for await (const line of input) {
    if (!line.trim()) continue
    let request: Request
    try {
      request = JSON.parse(line)
    } catch {
      write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }))
      continue
    }
    // Notifications (`notifications/initialized` among them) get no answer.
    if (request.id === undefined || request.id === null) continue
    write(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...(await answer(request, file)) }))
  }
}
