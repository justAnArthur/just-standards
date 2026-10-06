<a href="https://github.com/justAnArthur/just-repo-standard"><img src=".github/banner.svg" alt="One standard for every repo: Audits a GitHub repo, then writes the README, banner, diagrams, topics and license it is missing." width="100%"></a>

# just-repo-standard

A [Claude Code](https://claude.com/claude-code) skill that brings a GitHub repo up to one standard: a README written from the code, a banner, Mermaid diagrams where the code has structure, description, topics, homepage, license, `.gitignore`, and archive state. It plans first and changes nothing on GitHub until you add `--apply`.

Built while auditing the 107 repos on this account, and the rules come from that run: coursework kept in its original language under an English summary, no license on code other people wrote, secrets reported and never printed.

## Install

```bash
git clone https://github.com/justAnArthur/just-repo-standard ~/.claude/skills/repo-standard
npm install --prefix ~/.claude/skills/repo-standard/scripts
```

Requirements:

- `gh`, logged in with the `repo` scope (`gh auth status`)
- `git` and Node 18+
- `rsvg-convert` to preview banners as PNG (`brew install librsvg`)
- network access for `npx @mermaid-js/mermaid-cli`, which checks that diagrams parse
- optional: `gitleaks`, for scanning history for secrets

Then make it yours: edit the **Configuration** table at the top of [`SKILL.md`](SKILL.md) (owner, your git author names, licenses, university topic), and the copyright holder in [`assets/licenses/MIT.txt`](assets/licenses/MIT.txt).

## Use

In Claude Code:

```text
/repo-standard my-repo                          audit and plan; changes nothing
/repo-standard my-repo --apply                  write README, banner, metadata, license; push; archive if the tier says so
/repo-standard my-repo --tier portfolio --apply pick the tier yourself
```

Plain requests work too: "standardize my-repo", "run the repo standard over all my coursework repos". For many repos, the skill works in batches and finishes one repo for you to check before doing the rest.

The two scripts also work without Claude:

```bash
# what's missing in one repo, as JSON
bash ~/.claude/skills/repo-standard/scripts/audit.sh owner/repo | jq .gaps

# render a banner from a spec (fields documented at the top of banner.mjs)
node ~/.claude/skills/repo-standard/scripts/banner.mjs references/banner-examples/flagship-modo.json banner.svg
```

## Tiers

| tier | for | gets |
|---|---|---|
| `flagship` | public, maintained | banner, full README with diagrams, description, 3–8 topics, homepage, MIT license, `.gitignore` |
| `portfolio` | public, finished: coursework, hackathons, thesis, hiring challenges | banner, portfolio README with results, CC BY-NC-ND 4.0 license, then archived |
| `private` | private, still used | short README, description |
| `notes` | study notes, vaults | one-paragraph README, description, then archived |
| `fork` | forks | a description saying what the fork is for; code untouched |
| `skip` | anything you exclude | nothing |

## How it works

```mermaid
flowchart LR
  A[audit.sh: metadata and gaps] --> B[Read the code]
  B --> C{Tier}
  C --> D[README from a template]
  D --> E[Banner and diagrams]
  E --> F[Description, topics, homepage]
  F --> G[License and .gitignore]
  G --> H{Release workflow on push?}
  H -->|no| I[Push to main]
  H -->|yes| J[Pull request]
  I --> K[Archive if the tier says so]
  J --> K
```

Every claim in a README has to come from the code or the existing docs. When the code does something other than what the title promises, the README says what the code does.

## What it won't do

Without your confirmation for that exact repo, it never deletes a repo, changes visibility, force-pushes, rewrites history, closes or merges PRs, or touches a fork's code. It never prints secret values; it untracks them and tells you what to rotate. It adds no license where other people wrote the code.

## Structure

```text
SKILL.md                      configuration, tiers, procedure, guardrails
references/readme.md          README templates per tier
references/visuals.md         banner, diagram, screenshot and badge rules
references/topics.md          topic vocabulary and course codes
references/banner-examples/   two complete banner specs
scripts/audit.sh              one-repo audit → JSON with gaps
scripts/banner.mjs            banner renderer: outlined Inter / Geist Mono, light and dark in one SVG
assets/licenses/              MIT and CC BY-NC-ND 4.0 texts
assets/fonts/                 Inter and Geist Mono, with their OFL license files
```

## License

[MIT](LICENSE). The fonts in `assets/fonts` are under the SIL Open Font License (license files next to them). `assets/licenses/CC-BY-NC-ND-4.0.txt` is Creative Commons' legal code, shipped for the portfolio tier.
