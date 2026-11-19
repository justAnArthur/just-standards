import { Input, List } from '@justanarthur/modo-ui'
import { GithubStatus } from '@justanarthur/modo-ui-standards'
import { useEffect, useState } from 'react'
import { useGithub } from './use-github'
import { usePaths } from './use-standards'

// Saved on blur or Enter, not per keystroke: each saved path reloads the main window from the CLI.
function PathInput({ value, onCommit, label }: { value: string; onCommit: (value: string) => void; label: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    else setDraft(value)
  }

  return (
    <Input
      aria-label={label}
      value={draft}
      onValueChange={setDraft}
      onBlur={commit}
      onKeyDown={event => event.key === 'Enter' && commit()}
      spellCheck={false}
      className="w-80 font-mono"
    />
  )
}

const GITHUB_NOTE = "gh opens a fix's pull request and merges it from the run's pane."

export default function Settings() {
  const { checkout, setCheckout, workspace, setWorkspace } = usePaths()
  const github = useGithub(checkout)

  return (
    <List>
      <List.Section title="Standards">
        <List.Row label="just-standards checkout" description="The CLI the app runs, with bun from your login shell's PATH.">
          <PathInput label="just-standards checkout" value={checkout} onCommit={setCheckout} />
        </List.Row>
        <List.Row label="Workspace" description="The folder with businesses/ and workers.yml.">
          <PathInput label="Workspace" value={workspace} onCommit={setWorkspace} />
        </List.Row>
      </List.Section>
      <List.Section title="GitHub">
        {/* Signed in it is one line on the right; the sign-in and its code need the row's width. */}
        {github.status?.loggedIn && !github.signingIn ? (
          <List.Row label="Account" description={GITHUB_NOTE}>
            <GithubStatus {...github} />
          </List.Row>
        ) : (
          <List.Row
            label="Account"
            description={
              <span className="flex flex-col gap-3">
                {GITHUB_NOTE}
                <GithubStatus {...github} className="pb-2" />
              </span>
            }
          />
        )}
      </List.Section>
    </List>
  )
}
