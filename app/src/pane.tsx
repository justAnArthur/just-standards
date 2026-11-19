import { type CellStatus, CellDetail, cellKey, ItemDetail, PackDetail } from '@justanarthur/modo-ui-standards'
import type { Model, Status } from './model'

/** Until fix runs land (M5), Fix and Waive show disabled with this reason. */
export const FIX_RUNS_NEXT = 'Fix runs and waivers come in the next version.'

/** What the side pane shows: a cell (`asset:pack/item`), an item (`pack/item`) or a pack (its id). */
export interface Pane {
  kind: 'cell' | 'item' | 'pack'
  key: string
}

export const PANE_LABEL: Record<Pane['kind'], string> = { cell: 'Cell', item: 'Item', pack: 'Pack' }

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
}

/** The side pane for the business screen and the Packs screen alike. */
export function PaneContent({ pane, model, status, business: id, onPane, onOpenCell, onOpenBusiness, onRecheck }: PaneContentProps) {
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
  const pack = cell && model.packs.find(p => cell.item.startsWith(`${p.id}/`))
  const item = pack?.entries.find(i => i.key === cell?.item)
  const asset = business?.assets.find(a => a.id === cell?.asset)
  return (
    business &&
    cell &&
    pack &&
    item &&
    asset && (
      <CellDetail
        cell={cell}
        item={item}
        pack={pack}
        asset={asset}
        business={business}
        workers={model.workers}
        fixDisabled
        fixDisabledReason={FIX_RUNS_NEXT}
        waiveDisabled
        waiveDisabledReason={FIX_RUNS_NEXT}
        onRecheck={() => onRecheck(business.id, cell.asset, cell.item)}
        onClose={close}
        className="h-full select-text"
      />
    )
  )
}
