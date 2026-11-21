## Done when
The check passes: the GitHub description is one line of 20–100 characters that says what the repo is, with no trailing period.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 5: `gh repo edit --description`, one line, at most 100 characters, says what it is, no trailing period. This is a repo setting, not a file: set it directly and mention it in the PR body.
- Write it from the README and the code (house example: `Versioned CI/CD workflows for monorepos: bump, publish, deploy`).
- For a fork, say what the fork is for.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
`gh` has no admin rights on the repo: say so in the PR body with the description to set.

## Don't
- Don't repeat the repo name or start with "A repo for".
