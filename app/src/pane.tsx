import { type CellStatus, CellDetail, cellKey, ItemDetail, PackDetail } from '@justanarthur/modo-ui-standards'
import { useState } from 'react'
import type { Model, Status } from './model'
import { type Run, runsOf, toFixRun } from './runs'

/** Waivers come after fix runs: Waive shows disabled with this reason. */
export const WAIVERS_NEXT = 'Waivers come in the next version.'

/** Why Fix is off for an asset: a fix run works in a worktree of its local checkout. */
export const NO_CHECKOUT = 'no local checkout'

/**
 * What the side pane shows: a cell (`asset:pack/item`), an item (`pack/item`), a pack (its id), a fix run (its id,
 * or its process key until the CLI names it), or the form of a business or a worker (its id, empty for a new one).
 * `back` is the pane it was opened from.
 */
export interface Pane {
  kind: 'cell' | 'item' | 'pack' | 'run' | 'business' | 'worker'
  key: string
  back?: Pane
}

export const PANE_LABEL: Record<Pane['kind'], string> = {
  cell: 'Cell',
  item: 'Item',
  pack: 'Pack',
  run: 'Run',
  business: 'Business',
  worker: 'Worker',
}

interface PaneContentProps {
  pane: Pane
  model: Model
  status: Status
  /** The business on screen; the Packs screen has none, and its details cover every business. */
  business?: string
  onPane: (pane: Pane | undefined) => void
  /** Opens a cell on its business's screen. */
  onOpenCell: (cell: CellStatus, business: string) => void
  onOpenBusiness: (business: string) => void
  onRecheck: (business: string, asset: string, item: string) => void
  /** Every fix run, for a cell's history. */
  runs: Run[]
  /** Starts a fix run of the cell with the worker. */
  onFix: (business: string, asset: string, item: string, worker: string) => void
}

/** The side pane for the business screen and the Packs screen alike. */
export function PaneContent({ pane, model, status, business: id, onPane, onOpenCell, onOpenBusiness, onRecheck, runs, onFix }: PaneContentProps) {
  const close = () => onPane(undefined)
  const business = id === undefined ? undefined : model.businesses.find(b => b.id === id)

  if (pane.kind === 'pack') {
    const pack = model.packs.find(p => p.id === pane.key)
    return (
      pack && (
        <PackDetail
          pack={pack}
          businesses={model.businesses}
          status={status}
          onOpenItem={key => onPane({ kind: 'item', key })}
          onOpenBusiness={onOpenBusiness}
          onClose={close}
          className="h-full select-text"
        />
      )
    )
  }

  if (pane.kind === 'item') {
    const pack = model.packs.find(p => pane.key.startsWith(`${p.id}/`))
    const item = pack?.entries.find(i => i.key === pane.key)
    return (
      pack &&
      item && (
        <ItemDetail
          item={item}
          pack={pack}
          businesses={business ? [business] : model.businesses}
          status={business ? { [business.id]: status[business.id] ?? [] } : status}
          onOpenCell={onOpenCell}
          onOpenPack={key => onPane({ kind: 'pack', key })}
          onClose={close}
          className="h-full select-text"
        />
      )
    )
  }

  const cell = business && status[business.id]?.find(c => cellKey(c.asset, c.item) === pane.key)
  return business && cell && <CellPane {...{ pane, model, business, cell, runs, onPane, onRecheck, onFix }} />
}

interface CellPaneProps extends Pick<PaneContentProps, 'pane' | 'model' | 'onPane' | 'onRecheck' | 'runs' | 'onFix'> {
  business: Model['businesses'][number]
  cell: CellStatus
}

/** A cell: its checks open in place, its fix runs open as their own pane, with a way back. */
function CellPane({ pane, model, business, cell, runs, onPane, onRecheck, onFix }: CellPaneProps) {
  const [check, setCheck] = useState<string | null>(null)
  const pack = model.packs.find(p => cell.item.startsWith(`${p.id}/`))
  const item = pack?.entries.find(i => i.key === cell.item)
  const asset = business.assets.find(a => a.id === cell.asset)
  if (!pack || !item || !asset) return null
  const fixRuns = runsOf(runs, business.id, cell.asset, cell.item).map(toFixRun)
  return (
    <CellDetail
      cell={cell}
      item={item}
      pack={pack}
      asset={asset}
      business={business}
      workers={model.workers}
      fixRuns={fixRuns}
      run={check}
      onRunChange={id => {
        if (id && fixRuns.some(run => run.id === id)) return onPane({ kind: 'run', key: id, back: pane })
        setCheck(id)
      }}
      onFix={worker => onFix(business.id, cell.asset, cell.item, worker)}
      fixDisabled={!asset.path}
      fixDisabledReason={asset.path ? undefined : NO_CHECKOUT}
      waiveDisabled
      waiveDisabledReason={WAIVERS_NEXT}
      onRecheck={() => onRecheck(business.id, cell.asset, cell.item)}
      onClose={() => onPane(undefined)}
      className="h-full select-text"
    />
  )
}
