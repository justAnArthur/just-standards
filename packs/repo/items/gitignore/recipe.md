## Done when
The check passes on the default branch after the PR merges: `.gitignore` exists, covers the main language's build output and `.idea/`, `.DS_Store`, `.env`, `node_modules/`, and none of those are tracked any more.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 6 (files → .gitignore): the github/gitignore template for the main language plus `.idea/`, `.DS_Store`, `.env`, `node_modules/`; untrack IDE files with `git rm -r --cached`.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
Never: the template and the untracking are all in the repo.

## Don't
- Don't untrack coursework deliverables (.zip, .docx, .pdf): they are part of the submission.
- Don't ignore lockfiles.
