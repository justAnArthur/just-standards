import { company } from '@/content/business'
import { SITE_URL } from '@/lib/site'

const DAY = 86_400_000

/** RFC 9116: where to report a vulnerability. Expires is always 180 days ahead, so the file never goes stale. */
export function GET() {
  const expires = new Date(Math.ceil((Date.now() + 180 * DAY) / DAY) * DAY).toISOString()
  const body = [
    `Contact: mailto:${company.securityEmail}`,
    `Contact: tel:${company.phone.replace(/\s+/g, '')}`,
    `Expires: ${expires}`,
    'Preferred-Languages: sk, en',
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } })
}
