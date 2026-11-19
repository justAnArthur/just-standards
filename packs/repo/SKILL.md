---
name: repo-standard
description: Audit one of the user's GitHub repos and bring it up to one standard — README with banner and diagrams, description, topics, homepage, LICENSE, .gitignore, archive state. Use when the user says /repo-standard, "standardize <repo>", "fix the readme/topics/description of <repo>", or asks to run the repo standard over several or all repos.
---

# repo-standard

Brings one repository up to the standard below.
Arguments: `<repo>` (name or owner/name), optional `--tier <tier>`, optional `--apply`.
Without `--apply` the skill only audits and prints the plan; nothing on GitHub changes.

## Configuration

Edit these for your own account; the rest of the skill refers to them.

| setting | value |
|---|---|
| owner (default when only a repo name is given) | `justAnArthur` |
| the user's git author names (not "other contributors") | `justAnArthur`, `artur`, `justanarthur`, `Arthur Kozubov` |
| flagship license | MIT — `assets/licenses/MIT.txt` (holder: `justAnArthur`) |
| portfolio license | CC BY-NC-ND 4.0 — `assets/licenses/CC-BY-NC-ND-4.0.txt` |
| university topic and course codes | `fiit-stu` — `references/topics.md` |
| original-docs heading for non-English READMEs | `## Pôvodná dokumentácia (SK)` |
| direct pushes to the default branch | allowed (PR only when a push runs release/deploy workflows) |

## Tiers

Pick the tier from the audit and the code. `--tier` overrides.

| tier | when | target |
|---|---|---|
| `flagship` | public, maintained, meant to be used or shown | banner, full README with diagrams where they fit, description, 3–8 topics, homepage if a demo/docs exist, MIT LICENSE, .gitignore |
| `portfolio` | public, finished (coursework, hackathon, hiring challenge, thesis) | banner, portfolio README with a diagram where it fits, description, topics, CC BY-NC-ND 4.0 LICENSE, then **archive** |
| `private` | private, still used | short README (what + how to run), description; banner optional, none when the repo ends archived |
| `notes` | private study notes / vaults | one-paragraph README, description, then archive |
| `fork` | fork | description only (say what the fork is for); never touch the code |
| `skip` | personal one-offs, backups, anything the user excludes | do nothing, report "skipped" |

## Procedure

1. **Audit.** `bash ~/.claude/skills/repo-standard/scripts/audit.sh <owner/repo>` → JSON with metadata,
   root files, README stats and a `gaps` list. Read it before anything else.
2. **Read the code** (not just the README). Shallow-clone into a scratch directory:
   `gh repo clone <owner/repo> <scratch>/<repo> -- --depth 1`. Look at the manifest
   (package.json / pyproject / pom.xml / build.gradle.kts / Cargo.toml), entry points, scripts,
   `.env.example`, `.github/workflows`, `.justactions.yml`, deploy config (vercel.json, Dockerfile,
   docker-compose), and any existing README / report files. Find the live URL from package.json
   `homepage`, README links, or deploy config — never guess one.
3. **Write the README** from `references/readme.md` for the tier. Every claim must come from the
   code or existing docs. When the code does something different from what the title or assignment
   says (an "A*" that is really greedy best-first search), say what the code does. Keep real content
   that is already there: put an English summary on top and keep the original text below, under the
   original-docs heading from Configuration if it isn't English, or `## Original README` if it is.
4. **Visuals** per `references/visuals.md`: render `.github/banner.svg` with `scripts/banner.mjs`
   and look at both themes before committing; add a Mermaid diagram where the code has a structure
   (monorepo, pipeline, protocol, solver loop, schema) and check it parses; add a screenshot for apps
   with a UI and a live URL; badges only for facts.
5. **Metadata** via `gh repo edit <owner/repo>`:
   - `--description` — one line, ≤ 100 chars, says what it is, no trailing period
     (house example: `Versioned CI/CD workflows for monorepos: bump, publish, deploy`).
   - `--add-topic` — from `references/topics.md`: exactly one kind, 1–4 stack, 1–3 domain, context if any.
     Remove topics that break the vocabulary with `--remove-topic`.
   - `--homepage` — the live demo/docs URL; for a library without one, `https://github.com/<owner>/<repo>#readme`.
     Check demo and homepage URLs respond (`curl -sI`). Report dead ones; never put a "Live demo"
     button on a banner that points at a dead URL.
6. **Files**:
   - `LICENSE` for flagship: the flagship license from Configuration, `{{YEAR}}` = year created.
     Never replace an existing license; if it contradicts package.json, report it.
   - `LICENSE` for portfolio (coursework, thesis, hiring challenges, hackathons): the portfolio
     license from Configuration, copied verbatim. The README's `## License` section carries the short
     notice from `references/readme.md`. Commit: `chore: add CC BY-NC-ND 4.0 license`.
     Course material written by instructors (assignment PDFs, sample files) isn't the user's: say in
     the License section that it isn't covered.
   - Private repos and forks: no license file.
   - Other people's work: if `gh api repos/<repo>/contributors` lists humans besides the user's
     author names from Configuration (ignore bots), or the README names co-authors, add **no**
     LICENSE. Same when a large part of the code matches another repo: credit it in the README, add no
     license of your own, and let the user decide (keep public with the upstream's license, or private).
     List each case in the report.
   - `.gitignore`: add if missing (github/gitignore template for the main language, plus `.idea/`,
     `.DS_Store`, `.env`, `__pycache__/`, `node_modules/`). Untrack `.idea/`, `__pycache__/`,
     `.DS_Store` with `git rm -r --cached`. Leave coursework deliverables (.zip/.docx/.pdf) alone —
     they are part of the submission.
   - A committed `.env` or a secret in any tracked file: untrack or redact it going forward, tell the
     user to rotate it, and say it is still in git history. Never print secret values. Rewriting
     history (git filter-repo + force-push) is the user's call — see "Never" below.
7. **Commit and push.** Conventional types that do not trigger version bumps in
   just-github-actions-n-workflows: `docs: standardize README`, `chore: add MIT license`,
   `chore: add .gitignore and untrack IDE files`, `docs: add banner`. No `Co-Authored-By` trailer
   and no tool credit. Push straight to the default branch (see Configuration). Open a PR
   on a `docs/repo-standard` branch only when the branch is protected or a workflow runs on push to it
   (bump-version, publish, deploy). Tell the user to merge it with a merge commit, not squash.
8. **Archive** when the tier says so, after the push: `gh repo archive <owner/repo> --yes`.
   An already archived repo: `gh repo unarchive --yes`, apply, re-archive.
9. **Report** one line: `<repo> · <tier> · <what changed> · <anything the user must do>`.

## Shell gotchas

Interactive shells often alias `ls`, `mv`, `cp` or `rm` (eza, `-i`, `-v`) and some print trees on
`cd`. In scripts use `command mv -f`, `command cp -f`, `/bin/ls`, and redirect clone output to
/dev/null. zsh doesn't word-split unquoted variables; loop over arrays instead.

## Repo linters

Some repos lint everything, banner included (modo's Biome plugins reject literal colours in the
banner's `<style>`). Before pushing, run the repo's lint command if it has one; if it trips on
`.github/banner.svg`, exclude that one file in the linter config (Biome: `"files": {"includes":
["**", "!**/.github/banner.svg"]}`) in a `chore:` commit. Never change the banner to please a linter.

## Never, unless the user confirms that exact repo in chat

- Delete a repo, change visibility, transfer, rename, force-push or rewrite history.
- Close or merge PRs/issues (list them in the report instead).
- Touch the code of a fork.
If the user does confirm a deletion: `gh repo delete` needs the `delete_repo` scope; if the token
lacks it, ask the user to run `gh auth refresh -h github.com -s delete_repo` first.

## Running over many repos

Decisions come from a list the user gives, or from a triage page if one exists (e.g. an Artifact
with a `decisions` collection: doc id = repo name, field `action`; a repo without a doc follows its
recommendation). Map action → tier: `standardize` → flagship/private by visibility,
`standardize+archive` → portfolio, `archive` → archive only (no file changes), `skip` → skip,
`delete` / `private` → do nothing and list them for the user to confirm.
Run in batches of ~5 repos, one subagent per repo, each told to follow this skill with `--apply`.
Do the flagship tier first and show the user one finished repo before running the rest.
