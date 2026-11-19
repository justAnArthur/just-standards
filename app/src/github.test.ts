import { expect, test } from 'bun:test'
import { DEVICE_URL, foldLogin, LOGIN, loginFailure, parseAuth } from './github'

const fold = (lines: string[]) => lines.reduce(foldLogin, LOGIN)

test('reads the one-time code; gh without a terminal opens nothing, so the app opens the page', () => {
  const login = fold([
    '! First copy your one-time code: 4F2A-9C1D',
    'Open this URL to continue in your web browser: https://github.com/login/device',
  ])
  expect(login).toEqual({ code: '4F2A-9C1D', url: DEVICE_URL, opensItself: false })
})

test('gh that waits for Enter opens the page itself', () => {
  expect(fold(['! First copy your one-time code: AB12-CD34'])).toEqual({ code: 'AB12-CD34', url: DEVICE_URL, opensItself: true })
})

test('the code survives gh painting it', () => {
  expect(fold(['\x1b[0;33m!\x1b[0m First copy your one-time code: \x1b[1m4f2a-9c1d\x1b[0m']).code).toBe('4F2A-9C1D')
})

test('other lines change nothing', () => {
  expect(fold(['- gh config set -h github.com git_protocol https', '✓ Authentication complete.'])).toEqual(LOGIN)
})

test('github status', () => {
  expect(parseAuth('{"loggedIn":true,"user":"you","protocol":"https"}')).toEqual({ loggedIn: true, user: 'you', protocol: 'https' })
  expect(parseAuth('{"loggedIn":false}')).toEqual({ loggedIn: false, user: undefined, protocol: undefined })
})

test('a sign-in fails with its last line; one that worked or was cancelled has no failure', () => {
  expect(loginFailure(0, '✓ Logged in as you')).toBeUndefined()
  expect(loginFailure(null, '')).toBeUndefined()
  expect(loginFailure(1, 'something\nerror: timed out waiting for authorization\n')).toBe('error: timed out waiting for authorization')
  expect(loginFailure(2, '')).toBe('gh auth login exited with 2')
})
