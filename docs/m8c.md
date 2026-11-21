# M8c: a run is done when its preview passes

The third step of the [M8 plan](m8-plan.md). Before M8c, the acadsys og:video run ended with tags pointing at a file that didn't exist, and nothing noticed. Now the engine checks the run's items on the PR and sends the worker back while they fail.

## The verify loop
- **Checking the PR:** after the worker's turn ends with a result and a PR, the engine checks the run's items on the PR's head commit (see below).
- **Waiting for a deployment:** in a repo that reports deployments, it waits up to 10 minutes for a preview deployment of that commit.
- **Sending the worker back:** when an item still fails, the engine sends the worker a new message in the same Claude Code process and session (stdin stays open; no `--resume`): what still fails, with the evidence, and to fix it on the same branch, push, wait for the checks and call `finish` again.
- **When it stops:**
  - every item passes;
  - nothing could be checked (a protected preview without a bypass, no deployment);
  - the worker named in `missing` what only a person can give;
  - or after 2 rounds.
- **The run record:**
  - `verified` is true when every item passed, false when some still failed, and left out when nothing could be checked;
  - `unverified` lists the items still failing;
  - `rounds` counts the send-backs;
  - `cost_usd` is the session's total.
- **The state stays `done`** (there is a PR). A PR that still fails, or still needs a person, is made a draft.

## What "checked on the PR" means
- **A website or web app** is read from the preview deployment, which stands in for production for the duration of the check (`alias` in `core/expect.ts`):
  - every production URL `get` fetches is fetched from the preview instead, with and without `www.`. That covers a sitemap's URLs, a canonical, an `og:image` or `og:video`, and links;
  - `sameUrl` takes a production URL and its preview twin for one, so a production canonical is "the page itself";
  - the crawl keeps sitemap URLs that map to the preview's host;
  - an `x-robots-tag` header on a preview is ignored: Vercel adds `noindex` to every preview.
- **A repo asset's items** are checked on the run's worktree, which holds the PR's branch. No deployment is needed.
- **Production-only items:** an item with `preview: false` can only be judged on production, and is skipped and listed as `skipped`. The labels re-check it after the merge. The bundled ones: `website/canonical-host`, `website/tls`, `eu-consumer/email-auth`, `ai-visibility/ai-crawlers`, `performance/cwv-field`, `performance/lighthouse`, `performance/ttfb`.

## App
The run pane's facts say "verified on the preview", "still failing on the preview" and "sent back once / N times". The preview section names the items only production can show.
