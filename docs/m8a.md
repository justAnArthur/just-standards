# M8a: the model and the brief

The first step of the [M8 plan](m8-plan.md): what a catalog of about 100 standards across many sites in one repo needs before the standards themselves.

## Items
New fields in `item.yml`:

```yaml
category: sharing        # required: seo, sharing, ai, performance, accessibility, security, privacy, legal,
                         #   content, conversion, i18n, analytics, ops, brand, docs, code
severity: should         # must | should | nice (default should); "perfect" = every must and should passing
requires: [ai-ready/brand-assets]   # items that must pass first
tools: [ffmpeg]          # programs a worker needs to fix it
```

- **`category` is required.** Every bundled item now has a category and a severity.
- **`requires` must name a loaded item,** or `validate` fails.
- **What `requires` does:** a required item is looked for on the same asset, and on every asset sharing its repo (a website needs its repo's brand assets; the repo is compared case-insensitively).
  - While a required item fails there, the cell's status carries `blocked_by: [...]`; its own `state` is unchanged.
  - `fix` refuses the cell: "… is blocked by …: fix that first".
  - A required item the business doesn't adopt blocks nothing.
- **`tools`:** `fix` refuses to start when one isn't on `PATH`, and names the `brew install`. The tools that are installed are listed in the prompt and allowed as `Bash(<tool> *)`.

## Several sites in one repo
- **A run's worktree and branch carry the asset:** `.worktrees/std-<asset>-<item>` on `standards/<asset>-<item>`, so two sites of one repo never collide. The run id is `<stamp>-<business>-<asset>-<item>`.
- **The prompt names the other assets on the same repo,** and says that shared code changes them too.

## PR labels and targeted re-checks
- **Labels on the PR:** when a run ends with a PR, the engine creates a `std:<pack>/<item>` label in the repo for each item (`gh label create --force`) and puts it on the PR. A person can put the same labels on any PR.
- **What a full `standards runs sync` (no run ids) does:**
  1. lists each workspace repo's recently merged PRs that carry `std:` labels and were merged since the last sync (`.state/labels.json` keeps a cursor per repo; a first sync looks back 24 h);
  2. waits until the merge commit is live: a successful GitHub deployment in a production environment (`production_environment`, or a name matching production or github-pages); when a repo reports no production deployment, 15 minutes after the merge; and in any case after 2 hours, so the check shows what is live;
  3. checks those items again, and only those, on every asset of that repo in every business, and prints one line per PR: `{"type":"recheck","repo","pr","url","items","cells":[{business,asset,item}]}`.
- **The app** runs `runs sync` on load and then every 2 minutes. When a `recheck` line comes back, it reads the status again. Merging from the app no longer re-checks right away, before the merge is deployed.

## Context in the prompt
- **`businesses/<id>.context.md`:** free text a worker should know about the business: brand, legal entity and IDs, locations, languages, legacy URLs. It goes into every fix prompt and spec as "About <business>".
- **`stacks/<stack>.md`:** what the engine has learned about a stack, matched by the asset's `stack`. The workspace's `stacks/` wins over the bundled one. Bundled: `next` and `payload-next` (no route segment config with cacheComponents, root route handlers under `[locale]`, a page's `openGraph` replacing the layout's, and Payload globals for site-wide media).
- **The rules:** the worker makes what a standard needs from what the repo has. "A person must add it" is only for a secret, a paid account, or a legal fact found neither on the site nor in the context.

## `standards spec <business> <asset>`
A Markdown brief for whoever builds or rebuilds the asset, as a definition of done. It holds:
- the facts, the business context and the stack notes;
- a table of every adopted standard (category, title, severity, last state ✓ ✕ ! ·);
- then each standard under its category, with why, what it builds on, the check and the recipe.

`--severity must,should` and `--category seo,sharing` filter it.
