import { useRoute } from '@just-apps/app-kit'
import { Badge, Button, Card, EmptyState, Spinner, Table } from '@justanarthur/modo-ui'
import { useIcon } from '@justanarthur/modo-ui/lib/icon-context'
import { cn } from '@justanarthur/modo-ui/lib/utils'
import {
  adoptedVersion,
  ago,
  BusinessesOverview,
  BusinessGrid,
  type CellStatus,
  cellKey,
  PackList,
  StateCell,
  WorkerList,
} from '@justanarthur/modo-ui-standards'
import { type ReactNode, useState } from 'react'
import type { Model, Status } from './model'
import { NO_CHECKOUT, type Pane } from './pane'
import { duration, RUN_GLYPH, RUN_LABEL } from './run-pane'
import type { Run } from './runs'

export const BUSINESS = '/business/'
export const PACKS = '/packs'
export const WORKERS = '/workers'
export const RUNS = '/runs'

export const businessRoute = (id: string) => `${BUSINESS}${encodeURIComponent(id)}`

function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-6 select-text', className)}>{children}</div>
}

function ScreenHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="text-display text-foreground">{title}</h1>
      {lead && <p className="truncate text-body text-muted-foreground">{lead}</p>}
    </div>
  )
}

/** A check run that failed, over the screen: the CLI's words, and a way to the paths. */
export function RunFailure({ message, onSettings, onDismiss }: { message: string; onSettings: () => void; onDismiss: () => void }) {
  const Close = useIcon('x')
  return (
    <div role="alert" className="mx-6 mt-4 flex shrink-0 items-start gap-3 rounded-box bg-destructive-wash py-1 pr-1 pl-3">
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words py-1 font-mono text-caption text-destructive-strong">{message}</p>
      <Button variant="ghost" size="compact" onClick={onSettings}>
        Settings
      </Button>
      <Button variant="ghost" size="icon-compact" aria-label="Dismiss" onClick={onDismiss}>
        <Close />
      </Button>
    </div>
  )
}

export function Loading() {
  return <Spinner className="m-auto" />
}

/** The workspace couldn't be read: a missing checkout or workspace, or the CLI failed. */
export function LoadError({ message, onSettings, onRetry }: { message: string; onSettings: () => void; onRetry: () => void }) {
  const Alert = useIcon('circle-alert')
  return (
    <EmptyState
      className="m-auto max-w-xl"
      icon={Alert}
      title="Can't read the standards workspace"
      description={
        <span className="flex flex-col gap-2">
          <span className="whitespace-pre-wrap break-words font-mono text-caption">{message}</span>
          <span>Check the just-standards checkout and the workspace in Settings.</span>
        </span>
      }
      actions={
        <>
          <Button onClick={onSettings}>Open Settings</Button>
          <Button variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        </>
      }
    />
  )
}

export function Businesses({ model, status }: { model: Model; status: Status }) {
  const [, go] = useRoute()
  return (
    <Screen>
      <ScreenHeader title="Businesses" lead={model.dir} />
      <BusinessesOverview
        businesses={model.businesses}
        packs={model.packs}
        status={status}
        onOpenBusiness={id => go(businessRoute(id))}
        className="flex-1"
      />
    </Screen>
  )
}

interface BusinessProps {
  model: Model
  status: Status
  id: string
  /** What the side pane shows: its cell, item or pack is lit in the grid. */
  pane?: Pane
  onPane: (pane: Pane) => void
  /** Starts one fix run of the picked cells, all on one asset. */
  onFix: (asset: string, items: string[], worker: string) => void
}

export function Business({ model, status, id, pane, onPane, onFix }: BusinessProps) {
  const [, go] = useRoute()
  const Building = useIcon('folder')
  const [picked, setPicked] = useState<string[]>([])
  const business = model.businesses.find(b => b.id === id)
  if (!business)
    return (
      <EmptyState
        className="m-auto"
        icon={Building}
        title={`No business ${id}`}
        description={`It isn't in ${model.dir}/businesses.`}
        actions={<Button onClick={() => go('/')}>All businesses</Button>}
      />
    )

  const adopted = model.packs
    .filter(pack => adoptedVersion(business, pack) !== undefined)
    .map(pack => `${pack.title} v${adoptedVersion(business, pack)}`)
  const assets = `${business.assets.length} ${business.assets.length === 1 ? 'asset' : 'assets'}`
  const keyOf = (kind: Pane['kind']) => (pane?.kind === kind ? pane.key : undefined)
  const lead = [assets, ...adopted, business.worker && `default worker ${business.worker}`].filter(Boolean).join(' · ')
  // The grid keeps a pick on one asset: Fix needs that asset's checkout.
  const pickedAsset = business.assets.find(a => a.id === picked[0]?.split(':')[0])
  const noCheckout = Boolean(pickedAsset && !pickedAsset.path)

  return (
    <Screen>
      <ScreenHeader title={business.name} lead={lead} />
      <BusinessGrid
        business={business}
        packs={model.packs}
        cells={status[id] ?? []}
        workers={model.workers}
        active={keyOf('cell')}
        activeItem={keyOf('item')}
        activePack={keyOf('pack')}
        onOpenCell={(cell: CellStatus) => onPane({ kind: 'cell', key: cellKey(cell.asset, cell.item) })}
        onOpenItem={key => onPane({ kind: 'item', key })}
        onOpenPack={key => onPane({ kind: 'pack', key })}
        selected={picked}
        onSelectedChange={setPicked}
        onFix={(cells, worker) => {
          setPicked([])
          onFix(cells[0]!.asset, cells.map(cell => cell.item), worker)
        }}
        fixDisabled={noCheckout}
        fixDisabledReason={noCheckout ? NO_CHECKOUT : undefined}
        className="flex-1"
      />
    </Screen>
  )
}

const HEAD = 'h-9 text-caption weight-normal text-muted-foreground'
const PR_BADGE = { open: 'blue', merged: 'green', closed: 'gray' } as const

interface RunsProps {
  model: Model
  runs: Run[]
  /** The run open in the side pane. */
  active?: string
  onOpenRun: (id: string) => void
}

/** Every fix run, newest first: the recorded ones and this window's. */
export function Runs({ model, runs, active, onOpenRun }: RunsProps) {
  const Timer = useIcon('timer')
  const now = Date.now()
  const name = (id: string) => model.businesses.find(b => b.id === id)?.name ?? id
  return (
    <Screen className="overflow-y-auto">
      <ScreenHeader title="Runs" lead="Workers fixing failing cells, each in its own worktree, each ending in a pull request." />
      {runs.length ? (
        <Card border="outlined" className="pb-0">
          <Table containerClassName="overflow-x-auto">
            <Table.Header>
              <Table.Row>
                <Table.Head className={cn(HEAD, 'pl-4')}>Run</Table.Head>
                <Table.Head className={HEAD}>Items</Table.Head>
                <Table.Head className={HEAD}>Worker</Table.Head>
                <Table.Head className={HEAD}>Pull request</Table.Head>
                <Table.Head className={cn(HEAD, 'pr-4 text-right')}>Started</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {runs.map(({ record }) => (
                <Table.Row
                  key={record.id}
                  data-state={record.id === active ? 'selected' : undefined}
                  className="cursor-pointer last:border-b-0"
                  onClick={() => onOpenRun(record.id)}
                >
                  <Table.Cell className="py-2 pl-4">
                    <span className="flex items-center gap-2.5">
                      <StateCell.Glyph state={RUN_GLYPH[record.state]} worker={record.worker} />
                      <span className="flex min-w-0 flex-col">
                        <span className="whitespace-nowrap text-foreground">
                          {name(record.business)} · {record.asset}
                        </span>
                        <span className="whitespace-nowrap text-caption text-muted-foreground">
                          {[
                            RUN_LABEL[record.state],
                            duration(record.ms ?? now - Date.parse(record.started_at)),
                            record.cost_usd !== undefined && `$${record.cost_usd.toFixed(2)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="py-2">
                    <span className="flex flex-col font-mono text-caption">
                      {record.items.map(item => (
                        <span key={item}>{item}</span>
                      ))}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="py-2">
                    <span className="flex flex-col">
                      <span className="whitespace-nowrap">{record.worker}</span>
                      <span className="text-caption text-muted-foreground">{record.model}</span>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="py-2">
                    {record.pr ? (
                      <Badge size="compact" color={PR_BADGE[record.pr.state]}>
                        #{record.pr.number} {record.pr.state}
                      </Badge>
                    ) : (
                      <span className="text-caption text-muted-foreground">{record.error ?? '—'}</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap py-2 pr-4 text-right text-caption text-muted-foreground">
                    {ago(record.started_at, now)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      ) : (
        <EmptyState
          className="m-auto max-w-md"
          icon={Timer}
          title="No fix runs yet"
          description="Open a failing cell and pick Fix with a worker, or pick several failing cells on one asset in the grid."
        />
      )}
    </Screen>
  )
}

interface PacksProps {
  model: Model
  status: Status
  /** The pack open in the side pane, or the open item's. */
  active?: string
  onOpenPack: (pack: string) => void
}

export function Packs({ model, status, active, onOpenPack }: PacksProps) {
  return (
    <Screen className="overflow-y-auto">
      <ScreenHeader title="Packs" lead="The standards a business adopts, each a versioned set of items." />
      <PackList packs={model.packs} businesses={model.businesses} status={status} activePack={active} onOpenPack={onOpenPack} />
    </Screen>
  )
}

export function Workers({ model }: { model: Model }) {
  return (
    <Screen className="overflow-y-auto">
      <ScreenHeader title="Workers" lead="The Claude Code setups that fix runs start." />
      <WorkerList workers={model.workers} />
    </Screen>
  )
}
