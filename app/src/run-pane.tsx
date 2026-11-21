import { allow, answer, deny, type Pending, type PermissionUpdate, setPermissionMode } from '@just-apps/claude-code'
import { Badge, Button, Diff, Markdown, Tabs } from '@justanarthur/modo-ui'
import { useIcon } from '@justanarthur/modo-ui/lib/icon-context'
import { AgentPrompt } from '@justanarthur/modo-ui-ai'
import { type FixRun, type MergeMethod, PrDetail, type PullRequest, RunTranscript, type ShownState, StateCell } from '@justanarthur/modo-ui-standards'
import { useEffect, useState } from 'react'
import { allowRules } from './config'
import { Refused } from './forms'
import { type RunView, runView } from './pr'
import { type Run, type RunRecord, toTranscript } from './runs'
import { messageOf } from './use-standards'

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
  const rules = allowRules(suggestions)
  if (rules.length) return rules.join(', ')
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

interface PendingPromptProps {
  pending: Pending
  respond: (line: string) => void
  /** "Always allow" also keeps its rules for the worker's next runs (`worker allow`). */
  onAllow?: (rules: string[]) => void
}

/** What Claude Code asks mid-run, answered as ai-desktop answers it: a control response on the run's stdin. */
export function PendingPrompt({ pending, respond, onAllow }: PendingPromptProps) {
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
        const rules = allowRules(suggestions)
        if (rules.length) onAllow?.(rules)
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
  /** "Always allow" answered: the rules go onto the run's worker. */
  onAllow: (rules: string[]) => void
  /** `standards pr view` of the run. */
  onReadPr: () => Promise<PullRequest>
  /** `standards pr merge` of the run, then its cells re-checked. */
  onMerge: (method: MergeMethod) => Promise<void>
  onStop: () => void
  /** Back to the cell the run was opened from. */
  onBack?: () => void
  onClose: () => void
}

/** One fix run in the side pane: who and where, its state, cost and PR, then its live transcript and questions. */
export function RunPane({ run, business, live, loaded, onRead, onRespond, onAllow, onReadPr, onMerge, onStop, onBack, onClose }: RunPaneProps) {
  const Back = useIcon('arrow-left')
  const Close = useIcon('x')
  const Stop = useIcon('square')
  const [readError, setReadError] = useState<string>()
  const [picked, setPicked] = useState<RunView>()
  const [now, setNow] = useState(Date.now())
  const { record, session } = run
  const running = record.state === 'running'

  const view = runView(record, picked)

  useEffect(() => {
    if (live || loaded || view !== 'transcript') return
    onRead().catch(e => setReadError(messageOf(e)))
  }, [live, loaded, record.id, record.state, view])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  const time = duration(record.ms ?? now - Date.parse(record.started_at))
  const facts = [
    record.model,
    record.branch,
    record.pr?.draft && 'draft PR',
    record.verified === true && 'verified on the preview',
    record.verified === false && 'still failing on the preview',
    record.rounds && `sent back ${record.rounds === 1 ? 'once' : `${record.rounds} times`}`,
    running ? `running for ${time}` : time,
    record.cost_usd !== undefined && `$${record.cost_usd.toFixed(2)}`,
  ]
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
        <Button variant="ghost" size="icon-compact" aria-label="Close" onClick={onClose}>
          <Close />
        </Button>
      </header>
      {record.pr && !running && (
        <Tabs size="compact" value={view} onValueChange={next => setPicked(next === 'pr' ? 'pr' : 'transcript')} className="shrink-0 px-5 pb-3">
          <Tabs.List aria-label="Show">
            <Tabs.Item value="pr" label={`Pull request #${record.pr.number}`} />
            <Tabs.Item value="transcript" label="Transcript" />
          </Tabs.List>
        </Tabs>
      )}
      {(record.error || (readError && view === 'transcript')) && (
        <p className="mx-5 mb-3 shrink-0 whitespace-pre-wrap break-words rounded-box bg-destructive-wash px-3 py-2 font-mono text-caption text-destructive-strong">
          {record.error ?? readError}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border border-t">
        {view === 'pr' ? (
          <PrView key={record.id} record={record} onRead={onReadPr} onMerge={onMerge} />
        ) : items.length || running ? (
          <>
            {!running && <FinishNote record={record} />}
            <RunTranscript
              items={items}
              running={running && !pending}
              footer={pending && <PendingPrompt key={pending.requestId} pending={pending} respond={onRespond} onAllow={onAllow} />}
            />
          </>
        ) : (
          <p className="p-5 text-body text-muted-foreground">{loaded || live ? 'Claude Code printed nothing.' : 'Reading the transcript…'}</p>
        )}
      </div>
    </div>
  )
}

const RESULT_BADGE = { pass: 'green', fail: 'red', error: 'amber' } as const

/** The run's items as checked on the PR's preview deployment, or why they weren't. */
function PreviewChecks({ preview }: { preview: NonNullable<RunRecord['preview']> }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-subtitle text-foreground">On the preview</h3>
      {preview.url && (
        <a href={preview.url} target="_blank" rel="noreferrer" className="truncate text-caption text-muted-foreground underline">
          {preview.url}
        </a>
      )}
      {preview.note && <p className="text-body text-muted-foreground">{preview.note}</p>}
      {preview.skipped?.length ? (
        <p className="text-caption text-muted-foreground">Only production can show {preview.skipped.join(', ')}: checked after the merge.</p>
      ) : null}
      {preview.results.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {preview.results.map(result => (
            <li key={result.item} className="flex items-start gap-2 text-body text-foreground">
              <Badge size="compact" color={RESULT_BADGE[result.state]}>
                {result.state}
              </Badge>
              <span className="min-w-0 break-words">
                {result.item}: <span className="text-muted-foreground">{result.evidence}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** What the worker said through `finish` (what it did, what a person must still do), a failed install, and the preview checks. */
export function FinishNote({ record }: { record: Pick<RunRecord, 'summary' | 'missing' | 'setup' | 'preview'> }) {
  const Alert = useIcon('circle-alert')
  const missing = record.missing ?? []
  const failedSetup = record.setup?.ok === false ? record.setup : undefined
  if (!record.summary && !missing.length && !record.preview && !failedSetup) return null
  return (
    <div className="flex flex-col gap-4 border-border border-b p-5">
      {failedSetup && (
        <p className="text-body text-status-warning">
          <code>{failedSetup.command}</code> failed in the worktree, so the worker had to install dependencies itself.
        </p>
      )}
      {record.summary && (
        <section className="flex flex-col gap-2">
          <h3 className="text-subtitle text-foreground">What the worker did</h3>
          <Markdown>{record.summary}</Markdown>
        </section>
      )}
      {missing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-subtitle text-foreground">Still for you to do</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {missing.map(step => (
              <li key={step} className="flex items-start gap-2 text-body text-foreground">
                <Alert size={14} strokeWidth={1.5} className="mt-1 shrink-0 text-status-warning" />
                {step}
              </li>
            ))}
          </ul>
        </section>
      )}
      {record.preview && <PreviewChecks preview={record.preview} />}
    </div>
  )
}

interface PrViewProps {
  record: RunRecord
  onRead: () => Promise<PullRequest>
  onMerge: (method: MergeMethod) => Promise<void>
}

/** The run's PR, read with `standards pr view`, under what the worker said; Merge merges it, Re-check reads it again. */
function PrView({ record, onRead, onMerge }: PrViewProps) {
  const [pr, setPr] = useState<PullRequest>()
  const [error, setError] = useState<string>()
  const [rechecking, setRechecking] = useState(false)
  const [merging, setMerging] = useState(false)

  async function read() {
    setRechecking(true)
    try {
      setPr(await onRead())
      setError(undefined)
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setRechecking(false)
    }
  }

  useEffect(() => {
    void read()
  }, [record.id, record.pr?.state])

  async function merge(method: MergeMethod) {
    setMerging(true)
    try {
      await onMerge(method)
      await read()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <FinishNote record={record} />
      {error && <Refused message={error} />}
      {(pr || !error) && (
        <PrDetail pr={pr} onMerge={merge} merging={merging} onRecheck={read} rechecking={rechecking} className="shrink-0 overflow-visible" />
      )}
    </div>
  )
}
