import { allow, answer, deny, type Pending, type PermissionUpdate, setPermissionMode } from '@just-apps/claude-code'
import { Badge, Button, Diff, Markdown } from '@justanarthur/modo-ui'
import { useIcon } from '@justanarthur/modo-ui/lib/icon-context'
import { AgentPrompt } from '@justanarthur/modo-ui-ai'
import { type FixRun, RunTranscript, type ShownState, StateCell } from '@justanarthur/modo-ui-standards'
import { useEffect, useState } from 'react'
import { type Run, toTranscript } from './runs'

/** A run's state as the grid draws it, and what it is called. */
export const RUN_GLYPH: Record<FixRun['state'], ShownState> = { running: 'running', done: 'pr-open', failed: 'error', stopped: 'unchecked' }
export const RUN_LABEL: Record<FixRun['state'], string> = { running: 'Running', done: 'Done', failed: 'Failed', stopped: 'Stopped' }
const RUN_BADGE = { running: 'amber', done: 'blue', failed: 'red', stopped: 'gray' } as const

/** `640ms`, `4.2s`, `6m 12s`, as the kit writes them. */
export function duration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
const lines = (text: string) => (text ? text.replace(/\n$/, '').split('\n') : [])

/** An Edit or Write as a patch, for the question that asks to make it. */
function patchOf(tool: string, input: Record<string, unknown>) {
  const before = tool === 'Edit' ? str(input.old_string) : ''
  const after = str(tool === 'Edit' ? input.new_string : input.content)
  if ((tool !== 'Edit' && tool !== 'Write') || before === undefined || after === undefined) return
  const removed = lines(before)
  const added = lines(after)
  return [`@@ -1,${removed.length} +1,${added.length} @@`, ...removed.map(l => `-${l}`), ...added.map(l => `+${l}`)].join('\n')
}

/** What "Always allow" adds: `Bash(curl -sI:*)`, or `edits` for the accept-edits mode. */
function ruleOf(suggestions: PermissionUpdate[]) {
  const rules = suggestions.flatMap(s => (s.type === 'addRules' ? s.rules : []))
  if (rules.length) return rules.map(r => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName)).join(', ')
  if (suggestions.some(s => s.type === 'setMode' && s.mode === 'acceptEdits')) return 'edits'
}

interface Question {
  question: string
  header?: string
  options?: { label: string; description?: string }[]
  multiSelect?: boolean
}

function Questions({ pending: { requestId, input }, respond }: { pending: Pending; respond: (line: string) => void }) {
  const questions = (Array.isArray(input.questions) ? input.questions : []) as Question[]
  const [given, setGiven] = useState<string[]>([])
  const q = questions[given.length]
  if (!q) return null
  return (
    <AgentPrompt.Question
      key={given.length}
      question={q.question}
      tag={q.header}
      options={q.options ?? []}
      multiSelect={q.multiSelect}
      onSubmit={(labels, other) => {
        const all = [...given, q.multiSelect ? [...labels, other.trim()].filter(Boolean).join(', ') : other.trim() || (labels[0] ?? '')]
        if (all.length < questions.length) return setGiven(all)
        respond(answer(requestId, input, Object.fromEntries(questions.map((each, i) => [each.question, all[i]]))))
      }}
    />
  )
}

/** What Claude Code asks mid-run, answered as ai-desktop answers it: a control response on the run's stdin. */
export function PendingPrompt({ pending, respond }: { pending: Pending; respond: (line: string) => void }) {
  const { requestId, input, tool } = pending
  if (pending.kind === 'question') return <Questions pending={pending} respond={respond} />
  if (pending.kind === 'plan')
    return (
      <AgentPrompt.Plan
        onDecide={(decision, feedback) => {
          if (decision === 'keep-planning') return respond(deny(requestId, feedback.trim() || 'Keep planning.'))
          respond(allow(requestId))
          respond(setPermissionMode(decision === 'auto' ? 'acceptEdits' : 'default'))
        }}
      >
        <Markdown>{str(input.plan) ?? ''}</Markdown>
      </AgentPrompt.Plan>
    )
  const patch = patchOf(tool, input)
  const suggestions = pending.suggestions ?? []
  const mode = suggestions.find(s => s.type === 'setMode')?.mode
  return (
    <AgentPrompt.Permission
      tool={tool}
      command={str(input.command) ?? str(input.file_path) ?? JSON.stringify(input, null, 2)}
      detail={patch && <Diff lineNumbers={false} patch={patch} />}
      rule={ruleOf(suggestions)}
      hint={patch ? null : (pending.description ?? str(input.description) ?? null)}
      onAnswer={decision => {
        if (decision === 'deny') return respond(deny(requestId, 'Denied by the user.'))
        if (decision === 'once') return respond(allow(requestId))
        respond(allow(requestId, undefined, suggestions))
        if (mode) respond(setPermissionMode(mode))
      }}
    />
  )
}

interface RunPaneProps {
  run: Run
  /** The business's name, for the line under the title. */
  business: string
  /** Set while the run is this window's and its process goes on: Stop and the answers need it. */
  live: boolean
  /** The finished run's transcript has been read. */
  loaded: boolean
  onRead: () => Promise<void>
  onRespond: (line: string) => void
  onStop: () => void
  /** Back to the cell the run was opened from. */
  onBack?: () => void
  onClose: () => void
}

/** One fix run in the side pane: who and where, its state, cost and PR, then its live transcript and questions. */
export function RunPane({ run, business, live, loaded, onRead, onRespond, onStop, onBack, onClose }: RunPaneProps) {
  const Back = useIcon('arrow-left')
  const Close = useIcon('x')
  const Stop = useIcon('square')
  const External = useIcon('link')
  const [readError, setReadError] = useState<string>()
  const [now, setNow] = useState(Date.now())
  const { record, session } = run
  const running = record.state === 'running'

  useEffect(() => {
    if (live || loaded) return
    onRead().catch(e => setReadError(e instanceof Error ? e.message : String(e)))
  }, [live, loaded, record.id, record.state])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  const time = duration(record.ms ?? now - Date.parse(record.started_at))
  const facts = [record.model, record.branch, running ? `running for ${time}` : time, record.cost_usd !== undefined && `$${record.cost_usd.toFixed(2)}`]
  const pending = live ? session.pending[0] : undefined
  const items = toTranscript(session.turns)

  return (
    <div className="flex h-full min-h-0 flex-col select-text">
      <header className="flex shrink-0 items-start gap-2 px-3 pt-4 pb-3">
        {onBack && (
          <Button variant="ghost" size="icon-compact" aria-label="Back to the cell" onClick={onBack}>
            <Back />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1 pl-2">
          <h2 className="truncate text-subtitle text-foreground">Fix by {record.worker}</h2>
          <span className="truncate text-caption text-muted-foreground">
            {business} · {record.asset} · {record.items.join(', ')}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <StateCell.Glyph state={RUN_GLYPH[record.state]} worker={record.worker} size="small" />
            <Badge size="compact" color={RUN_BADGE[record.state]}>
              {pending ? 'Waiting on you' : RUN_LABEL[record.state]}
            </Badge>
            <span className="text-caption text-muted-foreground">{facts.filter(Boolean).join(' · ')}</span>
          </span>
        </div>
        {live && running && (
          <Button variant="secondary" size="compact" leadingIcon={Stop} onClick={onStop}>
            Stop
          </Button>
        )}
        {record.pr && (
          <Button variant="secondary" size="compact" trailingIcon={External} render={<a href={record.pr.url} target="_blank" rel="noreferrer" />}>
            PR #{record.pr.number} {record.pr.state}
          </Button>
        )}
        <Button variant="ghost" size="icon-compact" aria-label="Close" onClick={onClose}>
          <Close />
        </Button>
      </header>
      {(record.error || readError) && (
        <p className="mx-5 mb-3 shrink-0 whitespace-pre-wrap break-words rounded-box bg-destructive-wash px-3 py-2 font-mono text-caption text-destructive-strong">
          {record.error ?? readError}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border border-t">
        {items.length || running ? (
          <RunTranscript
            items={items}
            running={running && !pending}
            footer={pending && <PendingPrompt key={pending.requestId} pending={pending} respond={onRespond} />}
          />
        ) : (
          <p className="p-5 text-body text-muted-foreground">{loaded || live ? 'Claude Code printed nothing.' : 'Reading the transcript…'}</p>
        )}
      </div>
    </div>
  )
}
