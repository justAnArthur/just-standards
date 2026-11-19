import { run } from './checks/github.ts'
import { ghBin, RunError } from './runs.ts'

interface Account {
  state: string
  active: boolean
  login: string
  gitProtocol?: string
}

export interface GithubStatus {
  loggedIn: boolean
  user?: string
  protocol?: string
}

/** Who `gh` is signed in as on github.com. */
export async function githubStatus(): Promise<GithubStatus> {
  let status: Awaited<ReturnType<typeof run>>
  try {
    status = await run([ghBin(), 'auth', 'status', '--hostname', 'github.com', '--json', 'hosts'])
  } catch (error) {
    throw new RunError(`couldn't run ${ghBin()}: ${(error as Error).message}`)
  }
  let hosts: Record<string, Account[]> = {}
  try {
    hosts = JSON.parse(status.stdout).hosts ?? {}
  } catch {}
  const account = hosts['github.com']?.find(a => a.active && a.state === 'success')
  return account ? { loggedIn: true, user: account.login, protocol: account.gitProtocol } : { loggedIn: false }
}

/** `gh auth login` in the browser, on this process's stdio: gh prints a one-time code and waits for Enter. Resolves with its exit code. */
export function githubLogin() {
  const proc = Bun.spawn([ghBin(), 'auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'], {
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  return proc.exited
}
