Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 6 (secrets): untrack `.env` with `git rm --cached .env`, add it to `.gitignore`, never print its values, and say in the PR body which secrets must be rotated and that they stay in git history.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.
