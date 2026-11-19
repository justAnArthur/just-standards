import { useRoute } from '@just-apps/app-kit'
import { Button, EmptyState, Spinner } from '@justanarthur/modo-ui'
import { useIcon } from '@justanarthur/modo-ui/lib/icon-context'
import { cn } from '@justanarthur/modo-ui/lib/utils'
import {
  adoptedVersion,
  BusinessesOverview,
  BusinessGrid,
  type CellStatus,
  cellKey,
  PackList,
  WorkerList,
} from '@justanarthur/modo-ui-standards'
import type { ReactNode } from 'react'
import type { Model, Status } from './model'
import { FIX_RUNS_NEXT, type Pane } from './pane'

export const BUSINESS = '/business/'
export const PACKS = '/packs'
export const WORKERS = '/workers'

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
}

export function Business({ model, status, id, pane, onPane }: BusinessProps) {
  const [, go] = useRoute()
  const Building = useIcon('folder')
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
        fixDisabled
        fixDisabledReason={FIX_RUNS_NEXT}
        className="flex-1"
      />
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
