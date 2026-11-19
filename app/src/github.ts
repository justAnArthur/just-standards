import type { GithubAuth } from '@justanarthur/modo-ui-standards'

/** What `standards github login` has printed so far: gh's one-time code, and how it means to open the device page. */
export interface Login {
  code?: string
  /** The device page, `https://github.com/login/device`. */
  url: string
  /**
   * gh opens the page itself once it reads Enter. Without a terminal it says "Open this URL" instead and doesn't
   * open anything, so the app opens it.
   */
  opensItself: boolean
}

export const DEVICE_URL = 'https://github.com/login/device'

export const LOGIN: Login = { url: DEVICE_URL, opensItself: true }

// gh paints its output when it thinks it has a terminal.
const plain = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '')

/** Folds one line gh printed in: `! First copy your one-time code: 4F2A-9C1D`, then `Open this URL …` or `Press Enter …`. */
export function foldLogin(login: Login, raw: string): Login {
  const line = plain(raw)
  const code = line.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)?.[1]
  const url = line.match(/https:\/\/\S+\/login\/device\b/)?.[0] ?? login.url
  if (code) return { ...login, code: code.toUpperCase(), url }
  if (/open this url/i.test(line)) return { ...login, url, opensItself: false }
  return { ...login, url }
}

/** `standards github status`. */
export function parseAuth(json: string): GithubAuth {
  const value = JSON.parse(json) as GithubAuth
  return { loggedIn: Boolean(value.loggedIn), user: value.user, protocol: value.protocol }
}

/** How a sign-in that ended went: nothing when it worked or was cancelled (killed), else why it didn't. */
export function loginFailure(code: number | null, stderr: string) {
  if (code === 0 || code === null) return undefined
  const last = plain(stderr).trim().split('\n').filter(Boolean).at(-1)
  return last ?? `gh auth login exited with ${code}`
}
