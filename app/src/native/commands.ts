import type { ClaudeCommands } from '@just-apps/claude-code'
import { commands, type Host } from '@just-apps/host-contract'

// Type aliases, not interfaces: `CommandMap` needs the implicit index signature only aliases get.
/** Where the CLI runs from and the workspace it reads; `~` allowed in both. An empty workspace is left out (`workspace init`, `github`). */
type Paths = { checkout: string; workspace: string }

export type NativeCommands = {
  /** Runs `standards <args>` to completion: its stdout, or a rejection naming the missing folder or with its stderr's tail. */
  standards_json: { args: Paths & { args: string[] }; result: string }
  /** Starts `standards <args>` as run `key`: each stdout line arrives as `STANDARDS_LINE` (stderr as `STANDARDS_STDERR`), then one `STANDARDS_EXIT`. */
  standards_start: { args: Paths & { key: string; args: string[] }; result: void }
  /** Writes one line to run `key`'s stdin: a fix run's answer to a permission question, or the Enter gh waits for. */
  standards_write: { args: { key: string; line: string }; result: void }
  /** Stops run `key` and whatever it spawned. */
  standards_kill: { args: { key: string }; result: void }
  /** The home folder, to show paths with `~`. */
  home_dir: { args: undefined; result: string }
  /** A folder picked in the system's dialog; null when cancelled. */
  pick_folder: { args: { prompt: string }; result: string | null }
  /** The claude-code crate's: the Claude Code profiles on this machine. */
  list_profiles: ClaudeCommands['list_profiles']
}

export const STANDARDS_LINE = 'standards://line'
export const STANDARDS_STDERR = 'standards://stderr'
export const STANDARDS_EXIT = 'standards://exit'

/** A stdout line, or with `STANDARDS_STDERR` a stderr line. */
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
