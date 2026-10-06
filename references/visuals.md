# Visuals: banner, diagrams, screenshots, badges

A README should not be a wall of text. Each repo gets a banner. A diagram goes in wherever the code has
a structure worth seeing. Screenshots are for apps that have a UI. Badges only when the facts behind them are real.

## Banner — `.github/banner.svg`

Required for `flagship` and `portfolio`, optional for `private`, never for `notes`, `fork`, `skip`.
The house look comes from hackyeah-review's hero: 1200×600, light and dark from one file, Inter
text converted to outlines so it renders the same everywhere.

1. Write a spec JSON in a scratch directory (fields are documented at the top of `scripts/banner.mjs`;
   full examples in `references/banner-examples/`).
2. Render: `node ~/.claude/skills/repo-standard/scripts/banner.mjs spec.json <repo>/.github/banner.svg`
   (first run only: `npm install --prefix ~/.claude/skills/repo-standard/scripts`).
   The script refuses text that doesn't fit. Shorten the copy; don't fight the layout.
3. Look at it once in each theme before committing:
   `rsvg-convert -w 1200 banner.svg -o light.png`, then render a `--dark` copy the same way and Read both PNGs.
4. Put it as the first line of the README, linked to the live site or else the repo:
   `<a href="<homepage>"><img src=".github/banner.svg" alt="<title>: <subtitle>" width="100%"></a>`

What goes in it:

| slot | flagship | portfolio |
|---|---|---|
| `name` | repo name | repo name |
| `eyebrow` | `@scope/pkg on npm · MIT` or where it runs (never a version number: it goes stale on the next release) | `FIIT STU · <course in English> · <year>`, or `HackYeah 2025 · <category>` |
| `title` | what it does, ≤ 5 words | what it is, ≤ 5 words |
| `subtitle` | one sentence, ≤ 2 lines | one sentence: the problem and the approach |
| `cta` | `Live demo` / `Docs` when a URL exists | only when a demo exists |
| bottom | `code` install command, or `stats` if real numbers exist | `stats` from the report's results (max 4) |
| `visual` | a small drawing of the core idea | the core object of the assignment (board, graph, packet, circuit) |
| `footerLeft` / `footerRight` | live URL / stack | github.com/justAnArthur/<repo> / stack |
| `accent` | one colour per repo; keep it if the project already has a brand colour | amber `#fcd34d` by default |

Rules: every number on the banner comes from the code, README or report. No invented metrics. The
`visual` is 360×220. Draw it with rects, paths and `<text>` (outlined by the script). Use the classes
`card`, `line`, `fg`, `muted`, `faint`, `accent`, `accent-stroke`, never raw colours, so dark mode works.
The `icon` is a 32×32 glyph built from 2–3 shapes that hint at the subject.

## Diagrams: Mermaid, rendered natively by GitHub

Add one when the code has one of these. Never more than two per README.

| the repo has | diagram | where |
|---|---|---|
| ≥ 3 packages/apps in a monorepo | `flowchart LR` of packages and who depends on whom | under `## Structure` |
| a pipeline (CI, data flow, AI council, ETL) | `flowchart LR` of the stages | under `## How it works` |
| client ↔ server, a protocol, webhooks | `sequenceDiagram` of one real exchange | under `## How it works` |
| a search/solver loop, a state machine | `flowchart TD` / `stateDiagram-v2` | under `## How it works` |
| a database schema (migrations, drizzle, SQL) | `erDiagram` of the main tables, ≤ 8 | under `## Data model` |

Rules: build it from the code, not the old README; ≤ 12 nodes; node labels in plain words; no
`style`/`classDef` colours (GitHub themes diagrams itself). Check that it parses before committing:
`npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o /tmp/check.svg`.
Skip diagrams for single-file scripts with no structure.

## Screenshots: apps with a UI and a live URL

`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1440,900 --screenshot=<repo>/.github/screenshot.png <url>`
Read the PNG before committing: no cookie banners, login walls, or real personal data. Put it under the
first section as `![<what it shows>](.github/screenshot.png)`. For mobile apps, use the existing
screenshots in the repo (e.g. `docs/`) if they exist; don't fake device frames.

## Badges: only facts

Allowed, in one line under the title: npm version (published packages), CI status (only if the
workflow exists and passes), license (flagship only). Use shields.io. No "made with love", no
star/visitor counters, no badges on portfolio or private repos.
