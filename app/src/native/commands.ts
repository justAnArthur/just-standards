import { commands, type Host } from '@just-apps/host-contract'

// Type aliases, not interfaces: `CommandMap` needs the implicit index signature only aliases get.
/** Where the CLI runs from and the workspace it reads; `~` allowed in both. */
type Paths = { checkout: string; workspace: string }

export type NativeCommands = {
  /** Runs `standards <args>` to completion: its stdout, or a rejection naming the missing folder or with its stderr's tail. */
  standards_json: { args: Paths & { args: string[] }; result: string }
  /** Starts `standards <args>` as run `key`: each stdout line arrives as `STANDARDS_LINE`, then one `STANDARDS_EXIT`. */
  standards_start: { args: Paths & { key: string; args: string[] }; result: void }
  /** Writes one line to run `key`'s stdin: a fix run's answer to a permission question. */
  standards_write: { args: { key: string; line: string }; result: void }
  /** Stops run `key` and whatever it spawned. */
  standards_kill: { args: { key: string }; result: void }
  /** The home folder, to show paths with `~`. */
  home_dir: { args: undefined; result: string }
}

export const STANDARDS_LINE = 'standards://line'
export const STANDARDS_EXIT = 'standards://exit'

export interface StandardsLine {
  key: string
  line: string
}

/** `code` is null when the run was killed. */
export interface StandardsExit {
  key: string
  code: number | null
  stderr: string
}

export const native = (host: Host) => commands<NativeCommands>(host)
