## Done when
The check passes on the default branch after the PR merges: `.env` is no longer tracked, `.gitignore` ignores it, and the PR body names the secrets that must be rotated.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 6 (secrets): untrack `.env` with `git rm --cached .env`, add it to `.gitignore`, never print its values, and say in the PR body which secrets must be rotated and that they stay in git history.
- If the code needs the variables, list their names (no values) in `.env.example` (`ai-ready/env-example`).

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
Always for the rotation: only a person can rotate the leaked secrets at their providers, and rewriting history is the owner's call. The untracking itself is yours.

## Don't
- Don't print, quote or copy any value from the file, in code, commits or the PR.
- Don't rewrite history or force-push.
