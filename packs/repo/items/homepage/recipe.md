## Done when
The check passes: the repo's homepage is an absolute URL that answers 200.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 5: the live demo or docs URL, else `https://github.com/<owner>/<repo>#readme`; check it answers with `curl -sI`. A repo setting: set it directly and mention it in the PR body.
- Take the live URL from `package.json` `homepage`, README links or deploy config.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
`gh` has no admin rights on the repo: say so in the PR body with the URL to set.

## Don't
- Don't set a URL you haven't seen answer; report a dead demo instead of linking it.
