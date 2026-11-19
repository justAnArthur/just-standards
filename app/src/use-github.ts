import { useHost } from '@just-apps/app-kit'
import type { GithubAuth, GithubStatusProps } from '@justanarthur/modo-ui-standards'
import { useEffect, useMemo, useRef, useState } from 'react'
import { foldLogin, LOGIN, type Login, loginFailure, parseAuth } from './github'
import { native, STANDARDS_EXIT, STANDARDS_LINE, STANDARDS_STDERR, type StandardsExit, type StandardsLine } from './native/commands'
import { messageOf } from './use-standards'

/**
 * Who `gh` is signed in as (`standards github status`), and the sign-in: `standards github login` streams gh's
 * one-time code, and Open GitHub sends the Enter gh waits for. The result is GithubStatus's props.
 */
export function useGithub(checkout: string): GithubStatusProps {
  const host = useHost()
  const call = useMemo(() => native(host), [host])
  const [status, setStatus] = useState<GithubAuth>()
  const [login, setLogin] = useState<Login>()
  const [error, setError] = useState<string>()
  const key = useRef<string>(undefined)

  const refresh = async () => {
    try {
      setStatus(parseAuth(await call('standards_json', { checkout, workspace: '', args: ['github', 'status'] })))
    } catch (e) {
      setStatus({ loggedIn: false })
      setError(messageOf(e))
    }
  }
  const latest = useRef(refresh)
  latest.current = refresh

  useEffect(() => {
    void refresh()
  }, [call, checkout])

  useEffect(() => {
    // gh prints to stderr; stdout is folded too, in case a version prints there.
    const fold = (payload: unknown) => {
      const { key: from, line } = payload as StandardsLine
      if (from === key.current) setLogin(login => login && foldLogin(login, line))
    }
    const offs = [
      host.on(STANDARDS_STDERR, fold),
      host.on(STANDARDS_LINE, fold),
      host.on(STANDARDS_EXIT, payload => {
        const { key: from, code, stderr } = payload as StandardsExit
        if (from !== key.current) return
        key.current = undefined
        setLogin(undefined)
        setError(loginFailure(code, stderr))
        void latest.current()
      }),
    ]
    return () => offs.forEach(off => off())
  }, [host])

  function signIn() {
    const next = crypto.randomUUID()
    key.current = next
    setError(undefined)
    setLogin(LOGIN)
    call('standards_start', { key: next, checkout, workspace: '', args: ['github', 'login'] }).catch(e => {
      key.current = undefined
      setLogin(undefined)
      setError(messageOf(e))
    })
  }

  function openGithub() {
    if (!key.current || !login) return
    call('standards_write', { key: key.current, line: '' }).catch(e => console.error('[standards] gh enter:', e))
    if (!login.opensItself) void host.os.openExternal(login.url)
  }

  const cancel = () => key.current && call('standards_kill', { key: key.current }).catch(e => console.error('[standards] gh cancel:', e))

  return { status, signingIn: Boolean(login), code: login?.code, error, onSignIn: signIn, onOpenGithub: openGithub, onCancel: cancel }
}
