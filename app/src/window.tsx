import { CommandPalette, useCommand, useHost, useRoute } from '@just-apps/app-kit'
import { Button, DesktopShell } from '@justanarthur/modo-ui'
import { useIcon } from '@justanarthur/modo-ui/lib/icon-context'
import { ago, CellDetail, cellKey } from '@justanarthur/modo-ui-standards'
import { useEffect, useState } from 'react'
import { checkingCount, lastChecked, settled } from './checks'
import { useFixRunsNext } from './coming-soon'
import type { Model, Status } from './model'
import { BUSINESS, Business, Businesses, Loading, LoadError, RunFailure } from './screens'
import { type Standards, useStandards } from './use-standards'

function useOpenSettings() {
  const host = useHost()
  const open = () =>
    host.window.open('settings', { route: '/settings', title: `${host.app.name} Settings`, width: 640, height: 560 })
  useCommand({ id: 'app.settings', title: 'Settings', shortcut: 'Mod+,', run: open })
  useEffect(() => host.on('app://open-settings', open))
  return open
}

function Title({ business }: { business?: string }) {
  const [, go] = useRoute()
  if (!business)
    return (
      <span data-tauri-drag-region className="mx-auto truncate text-caption text-muted-foreground">
        Businesses
      </span>
    )
  return (
    <span data-tauri-drag-region className="mx-auto flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
      <button type="button" className="cursor-pointer hover:text-foreground" onClick={() => go('/')}>
        Businesses
      </button>
      ›<span className="truncate text-foreground">{business}</span>
    </span>
  )
}

function RunChecks({ standards, onSettings }: { standards: Standards; onSettings: () => void }) {
  const Play = useIcon('play')
  const Stop = useIcon('square')
  const Settings = useIcon('settings')
  const { load, status, runs, check, stop } = standards
  const left = checkingCount(status)
  const last = lastChecked(status)
  const all = runs.some(scope => !scope.business)
  useCommand({ id: 'standards.check', title: 'Run checks', run: () => void check() })

  return (
    <span className="flex items-center gap-2">
      <span className="text-caption tabular-nums text-muted-foreground">
        {left > 0 ? `Checking · ${left} left` : last && `Checked ${ago(last, Date.now())}`}
      </span>
      {all ? (
        <Button variant="tertiary" size="compact" leadingIcon={Stop} onClick={stop}>
          Stop
        </Button>
      ) : (
        <Button variant="tertiary" size="compact" leadingIcon={Play} disabled={load.kind !== 'ready'} onClick={() => check()}>
          Run checks
        </Button>
      )}
      <CommandPalette />
      <Button variant="ghost" size="icon-compact" aria-label="Settings" onClick={onSettings}>
        <Settings />
      </Button>
    </span>
  )
}

interface CellPaneProps {
  model: Model
  status: Status
  business: string
  open: string
  onRecheck: (asset: string, item: string) => void
  onClose: () => void
}

function CellPane({ model, status, business: id, open, onRecheck, onClose }: CellPaneProps) {
  const business = model.businesses.find(b => b.id === id)
  const cell = status[id]?.find(c => cellKey(c.asset, c.item) === open)
  const pack = cell && model.packs.find(p => cell.item.startsWith(`${p.id}/`))
  const item = pack?.entries.find(i => i.key === cell?.item)
  const asset = business?.assets.find(a => a.id === cell?.asset)
  if (!business || !cell || !pack || !item || !asset) return null

  return (
    <CellDetail
      cell={settled(cell)}
      item={item}
      pack={pack}
      asset={asset}
      business={business}
      workers={model.workers}
      onRecheck={() => onRecheck(cell.asset, cell.item)}
      onClose={onClose}
      className="h-full select-text"
    />
  )
}

/** The main window: the Businesses screen or one business, the cell's detail in the side pane. */
export default function StandardsWindow() {
  const host = useHost()
  const standards = useStandards()
  const openSettings = useOpenSettings()
  const [route] = useRoute()
  const [open, setOpen] = useState<string>()
  useFixRunsNext()

  const id = route.startsWith(BUSINESS) ? decodeURIComponent(route.slice(BUSINESS.length)) : undefined
  useEffect(() => setOpen(undefined), [id])

  const { load, status, failure } = standards
  const model = load.kind === 'ready' ? load.model : undefined
  const pane = model && id && open && (
    <CellPane
      key={open}
      model={model}
      status={status}
      business={id}
      open={open}
      onRecheck={(asset, item) => standards.check({ business: id, asset, item })}
      onClose={() => setOpen(undefined)}
    />
  )
  // Tauri windows use titleBarStyle overlay on macOS: the traffic lights sit over the title bar.
  const macInset = host.kind === 'tauri' && host.os.platform === 'macos'

  return (
    <DesktopShell
      className="select-none"
      size="compact"
      platform={macInset ? 'mac' : 'linux'}
      title={<Title business={id && (model?.businesses.find(b => b.id === id)?.name ?? id)} />}
      trailing={<RunChecks standards={standards} onSettings={openSettings} />}
      main={
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {failure && <RunFailure message={failure} onSettings={openSettings} onDismiss={standards.dismissFailure} />}
          {load.kind === 'loading' && <Loading />}
          {load.kind === 'error' && <LoadError message={load.message} onSettings={openSettings} onRetry={standards.reload} />}
          {model && id && <Business model={model} status={status} id={id} open={open} onOpen={setOpen} />}
          {model && !id && <Businesses model={model} status={status} />}
        </div>
      }
      right={pane || undefined}
      rightOpen={Boolean(pane)}
      onRightOpenChange={next => !next && setOpen(undefined)}
      defaultPaneSize={36}
      rightLabel="Cell"
    />
  )
}
