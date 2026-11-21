/**
 * Receives the page views of /stats/script.js, which runs only after consent. This example keeps nothing: a real site
 * would forward them to its self-hosted Umami. Nothing here identifies a visitor.
 */
export async function POST(request: Request) {
  const text = await request.text()
  if (text.length > 2048) return new Response(null, { status: 413 })
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
