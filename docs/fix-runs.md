# Fix runs (M5)

A fix run is a worker (a Claude Code preset from `workers.yml`) fixing one or more failing items on one asset. It works in its own git worktree and ends in a pull request.

The engine owns the run: the `standards` CLI creates the worktree, starts Claude Code, records what happened and finds the PR. The app only draws the run and answers Claude Code's permission questions, so a run also works from a terminal or CI.

## Commands

### `standards fix <business> <asset> <item…> --worker <id> [--interactive]`

1. **Checks before it starts.** The asset needs a `path` (a local git checkout) and a `repo`. Every item must apply to the asset, and the worker must exist. If any of these fails, the command exits 1 and says why. Nothing else happens.
2. **Creates the worktree.**
   - It fetches `origin` in the asset's checkout.
   - The worktree is `<path>/.worktrees/std-<first item id>` on branch `standards/<first item id>`, both started from `origin`'s default branch.
   - If that branch or folder already exists, the name gets `-2`, `-3`, and so on.
3. **Records the run** under `<workspace>/.state/runs/<id>/`:
   - `run.json` holds the run record (below). It is updated when the run ends.
   - `events.ndjson` holds every line Claude Code printed, as is.
   - `<id>` is `<UTC yyyymmdd-hhmmss>-<business>-<first item id>`.
4. **Starts Claude Code** in the worktree:
   - **Flags:** `claude -p --input-format stream-json --output-format stream-json --verbose --model <worker.model> [--effort <worker.effort>] --permission-mode <worker.permission_mode> [--allowedTools <worker.allow…>]`. With `--interactive` it adds `--permission-prompt-tool stdio`, so permission questions arrive as `control_request` lines.
   - **Environment:** the `CLAUDE*` and `ANTHROPIC_*` variables are removed. `CLAUDE_CONFIG_DIR` is set to `worker.profile`, unless that is `~/.claude`.
   - **The prompt:** `standards prompt` output for these items, sent as the first stream-json user message.
   - **Answers:** with `--interactive`, each line the CLI reads on its stdin goes to Claude Code's stdin. These are the app's control responses: allow, deny, interrupt.
   - **Ending:** after Claude Code prints its `result` line, the CLI closes Claude Code's stdin, so the session ends.
5. **Finds the PR.** It first looks for a GitHub pull request URL in the final result text. If there isn't one, it runs `gh pr list --head <branch> --json url,number` in the worktree.
6. **Prints NDJSON on stdout**, one object per line:
   - `{"type":"run","event":"started","run":<record>}`
   - `{"type":"claude","line":"<one raw stream-json line>"}`, for every line Claude Code prints
   - `{"type":"run","event":"finished","run":<record>}`
7. **Exit:**
   - **Exit code:** 0 when the run ends `done`, otherwise 1.
   - **On SIGTERM or SIGINT:** it kills Claude Code's process group, records `stopped` and exits.

### `standards runs [business…]`
Prints the run records as NDJSON, newest first.

### `standards runs transcript <id>`
Prints that run's `events.ndjson`.

### `standards runs sync`
- For every run whose PR is `open`, it reads the PR's state with `gh pr view`.
- When the PR is `merged` or `closed`, it updates the record, removes the worktree (`git worktree remove`) and deletes the local branch if it was merged.
- It prints the records it changed.

## Run record

The same shape as `FixRun` in `@justanarthur/modo-ui-standards`, plus where the run happened:

```ts
interface RunRecord {
  id: string
  business: string
  asset: string
  /** `pack/item` */
  items: string[]
  worker: string
  model: string
  branch: string
  worktree: string
  started_at: string
  finished_at?: string
  /** Left out while it runs. */
  ms?: number
  state: 'running' | 'done' | 'failed' | 'stopped'
  pr?: { url: string; number: number; state: 'open' | 'merged' | 'closed' }
  cost_usd?: number
  session_id?: string
  /** Why it failed or stopped. */
  error?: string
}
```

**When is a run `done`?** Only when Claude Code's `result` is a success and a PR was found. A successful session with no PR is `failed`, with the error "no pull request".

## How the app uses it

1. **Starting a run.** Fix with ▾ worker runs `standards fix … --worker <id> --interactive`, through a streaming native command that can also write to the process's stdin.
2. **The transcript.** The `claude` lines go into `@just-apps/claude-code`'s session reducer, and the result maps to the kit's `TranscriptItem[]` for `RunTranscript`.
3. **Permission questions** show with allow and deny. The answers go back on stdin, as ai-desktop does it.
4. **What a cell shows:**
   - `running` (the worker's initials) while a run covering the cell is live;
   - `pr-open` while its latest run has an open PR.
5. **CellDetail's history** lists the cell's runs: `standards runs`, plus the live one.
6. **The Runs screen** in the sidebar lists every run. A run opens to its transcript, read from `standards runs transcript <id>` for runs that have finished.
7. **On load** the app runs `standards runs sync`. When a PR has merged, it re-checks that run's cells.
8. **Fix stays disabled** for an asset without `path`, with the reason "no local checkout".
