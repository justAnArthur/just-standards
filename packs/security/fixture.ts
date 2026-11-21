import type { Context } from '../../core/checks/context.ts'
import type { Outcome } from '../../core/schema.ts'

/** Runs `check` against a one-page local server answering `body` with `headers` on every path. */
export async function serve(headers: Record<string, string>, check: (ctx: Context) => Promise<Outcome>, body = '<html><body>Acme</body></html>') {
  const server = Bun.serve({ port: 0, fetch: () => new Response(body, { headers: { 'content-type': 'text/html', ...headers } }) })
  try {
    return await check({ asset: { id: 'site', kind: 'website', url: `http://localhost:${server.port}` } } as Context)
  } finally {
    server.stop(true)
  }
}
