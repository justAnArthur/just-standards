import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

/** RFC 9116 §3: the file lives at the origin, whatever path the site is served under. */
export const securityTxtUrl = (url: string) => new URL('/.well-known/security.txt', url).href

/** The values of one field, by name, case-insensitively. */
const fields = (text: string, name: string) =>
  [...text.matchAll(new RegExp(`^${name}:[ \\t]*(.+?)\\s*$`, 'gim'))].map(match => match[1] as string)

/** `/.well-known/security.txt` answers 200 as text, with a Contact and an Expires that lies ahead. */
export default async function securityTxt({ asset }: Context, now = new Date()): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const url = securityTxtUrl(asset.url)
  let response: Response
  try {
    response = await get(url)
  } catch (error) {
    return { state: 'error', evidence: `${url} did not respond (${(error as Error).message})` }
  }
  const text = await response.text()
  if (response.status !== 200) return { state: 'fail', evidence: `${url} answered ${response.status}` }
  const type = response.headers.get('content-type') ?? ''
  // a soft 404: the site's HTML for an unknown path
  if (/html/.test(type) || /^\s*</.test(text)) return { state: 'fail', evidence: `${url} answers HTML (${type || 'untyped'}), not a security.txt` }

  const contact = fields(text, 'contact')
  const expires = fields(text, 'expires')
  const problems: string[] = []
  if (contact.length === 0) problems.push('no Contact: field')
  if (expires.length === 0) problems.push('no Expires: field')
  else {
    const date = new Date(expires[0] as string)
    if (Number.isNaN(date.getTime())) problems.push(`Expires: "${expires[0]}" is not a date`)
    else if (date <= now) problems.push(`it expired on ${expires[0]}`)
  }
  if (problems.length > 0) return { state: 'fail', evidence: `${url}: ${problems.join('; ')}` }
  return { state: 'pass', evidence: `${url}: Contact ${contact[0]}, Expires ${expires[0]}` }
}
