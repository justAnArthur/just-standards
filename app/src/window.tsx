import { CommandPalette, useCommand, useHost, useRoute } from '@just-apps/app-kit'
import { Button, DesktopShell, Sidebar } from '@justanarthur/modo-ui'
import { type IconName, useIcon } from '@justanarthur/modo-ui/lib/icon-context'
import { ago, cellKey } from '@justanarthur/modo-ui-standards'
import { useEffect, useMemo, useState } from 'react'
import { checkingCount, lastChecked } from './checks'
import type { Model } from './model'
import { PANE_LABEL, type Pane, PaneContent } from './pane'
import { RunPane } from './run-pane'
import { overlayRuns } from './runs'
import {
  BUSINESS,
  Business,
  Businesses,
  businessRoute,
  Loading,
  LoadError,
  PACKS,
  Packs,
  RUNS,
  RunFailure,
  Runs,
  WORKERS,
  Workers,
} from './screens'
import { useRuns } from './use-runs'
import { type Standards, useStandards } from './use-standards'

function useOpenSettings() {
  const host = useHost()
  const open = () =>
    host.window.open('settings', { route: '/settings', title: `${host.app.name} Settings`, width: 640, height: 560 })
  useCommand({ id: 'app.settings', title: 'Settings', shortcut: 'Mod+,', run: open })
  useEffect(() => host.on('app://open-settings', open))
  return open
}

const TITLES: Record<string, string> = { [PACKS]: 'Packs', [WORKERS]: 'Workers', [RUNS]: 'Runs' }

function Title({ route, business }: { route: string; business?: string }) {
  const [, go] = useRoute()
  if (!business)
    return (
      <span data-tauri-drag-region className="truncate text-body weight-medium text-foreground">
        {TITLES[route] ?? 'Businesses'}
      </span>
    )
  return (
    <span data-tauri-drag-region className="flex min-w-0 items-center gap-1.5 text-body weight-medium text-muted-foreground">
      <button type="button" className="cursor-pointer hover:text-foreground" onClick={() => go('/')}>
        Businesses
      </button>
      ›<span className="truncate text-foreground">{business}</span>
    </span>
  )
}

interface Row {
  route: string
  label: string
  icon: IconName
  count?: number
}

function NavRow({ route, label, icon, count }: Row) {
  const Icon = useIcon(icon)
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton icon={Icon} value={route}>
        {label}
      </Sidebar.MenuButton>
      {count !== undefined && <Sidebar.MenuBadge>{count}</Sidebar.MenuBadge>}
    </Sidebar.MenuItem>
  )
}

/** The window's sections, with the workspace's counts once it has loaded; the business routes sit under Businesses. */
function Nav({ route, model, runs }: { route: string; model?: Model; runs?: number }) {
  const [, go] = useRoute()
  const groups: { label: string; rows: Row[] }[] = [
    {
      label: 'Status',
      rows: [
        { route: '/', label: 'Businesses', icon: 'folder', count: model?.businesses.length },
        { route: RUNS, label: 'Runs', icon: 'timer', count: model && runs },
      ],
    },
    {
      label: 'Library',
      rows: [
        { route: PACKS, label: 'Packs', icon: 'square-library', count: model?.packs.length },
        { route: WORKERS, label: 'Workers', icon: 'brain', count: model?.workers.length },
      ],
    },
  ]
  return (
    <Sidebar variant="inset" value={route.startsWith(BUSINESS) ? '/' : route} onValueChange={go}>
      <Sidebar.Content>
        {groups.map(group => (
          <Sidebar.Group key={group.label}>
            <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {group.rows.map(row => (
                <NavRow key={row.route} {...row} />
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>
    </Sidebar>
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

interface Opened {
  route: string
  pane: Pane
}

/** The main window: the sidebar's sections, and a cell, item, pack or fix run in the side pane. */
export default function StandardsWindow() {
  const host = useHost()
  const standards = useStandards()
  const openSettings = useOpenSettings()
  const [route, go] = useRoute()
  // The pane belongs to the route it was opened on, so a cell opened for another business's screen shows once you get there.
  const [opened, setOpened] = useState<Opened>()
  const pane = opened?.route === route ? opened.pane : undefined
  const setPane = (next: Pane | undefined) => setOpened(next && { route, pane: next })

  const id = route.startsWith(BUSINESS) ? decodeURIComponent(route.slice(BUSINESS.length)) : undefined
  const { load, failure } = standards
  const model = load.kind === 'ready' ? load.model : undefined
  const runs = useRuns({
    paths: standards.paths,
    ready: load.kind === 'ready',
    workers: model?.workers ?? [],
    recheck: (business, asset, item) => standards.check({ business, asset, item }),
  })
  // The cells as the grid draws them: a live run's worker, an open PR.
  const status = useMemo(() => overlayRuns(standards.status, runs.all), [standards.status, runs.all])

  /** Starts a fix run and opens it in the pane; Back returns to `back`. */
  const fix = (business: string, asset: string, items: string[], worker: string, back?: Pane) =>
    setPane({ kind: 'run', key: runs.start(business, asset, items, worker), back })

  const found = pane?.kind === 'run' ? runs.find(pane.key) : undefined
  const runPane = model && pane && found && (
    <RunPane
      key={`run:${pane.key}`}
      run={found.run}
      business={model.businesses.find(b => b.id === found.run.record.business)?.name ?? found.run.record.business}
      live={Boolean(found.key && found.run.live)}
      loaded={Boolean(found.key) || runs.loaded(found.run.record.id)}
      onRead={() => runs.read(found.run.record.id)}
      onRespond={line => found.key && runs.respond(found.key, line)}
      onStop={() => found.key && runs.stop(found.key)}
      onBack={pane.back && (() => setPane(pane.back))}
      onClose={() => setPane(undefined)}
    />
  )
  const content = runPane || (model && pane && pane.kind !== 'run' && (id || route === PACKS) && (
    <PaneContent
      key={`${pane.kind}:${pane.key}`}
      pane={pane}
      model={model}
      status={status}
      business={id}
      onPane={setPane}
      onOpenCell={(cell, business) => {
        const next: Pane = { kind: 'cell', key: cellKey(cell.asset, cell.item) }
        const to = businessRoute(business)
        if (to === route) return setPane(next)
        setOpened({ route: to, pane: next })
        go(to)
      }}
      onOpenBusiness={business => go(businessRoute(business))}
      onRecheck={(business, asset, item) => standards.check({ business, asset, item })}
      runs={runs.all}
      onFix={(business, asset, item, worker) => fix(business, asset, [item], worker, pane)}
    />
  ))
  // Tauri windows use titleBarStyle overlay on macOS: the traffic lights sit over the sidebar's corner.
  const macInset = host.kind === 'tauri' && host.os.platform === 'macos'

  return (
    <DesktopShell
      className="select-none"
      titleBar="card"
      platform={macInset ? 'mac' : 'linux'}
      title={<Title route={route} business={id && (model?.businesses.find(b => b.id === id)?.name ?? id)} />}
      trailing={<RunChecks standards={standards} onSettings={openSettings} />}
      left={<Nav route={route} model={model} runs={runs.all.length} />}
      main={
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {failure && <RunFailure message={failure} onSettings={openSettings} onDismiss={standards.dismissFailure} />}
          {load.kind === 'loading' && <Loading />}
          {load.kind === 'error' && <LoadError message={load.message} onSettings={openSettings} onRetry={standards.reload} />}
          {model &&
            (id ? (
              <Business
                key={id}
                model={model}
                status={status}
                id={id}
                pane={pane}
                onPane={setPane}
                onFix={(asset, items, worker) => fix(id, asset, items, worker)}
              />
            ) : route === PACKS ? (
              <Packs
                model={model}
                status={status}
                active={pane && (pane.kind === 'pack' ? pane.key : pane.key.split('/')[0])}
                onOpenPack={key => setPane({ kind: 'pack', key })}
              />
            ) : route === WORKERS ? (
              <Workers model={model} />
            ) : route === RUNS ? (
              <Runs
                model={model}
                runs={runs.all}
                active={found?.run.record.id}
                onOpenRun={key => setPane({ kind: 'run', key })}
              />
            ) : (
              <Businesses model={model} status={status} />
            ))}
        </div>
      }
      right={content || undefined}
      rightOpen={Boolean(content)}
      onRightOpenChange={next => !next && setPane(undefined)}
      defaultPaneSize={36}
      rightLabel={pane ? PANE_LABEL[pane.kind] : 'Side pane'}
    />
  )
}
