## Done when
The check passes on the default branch after the PR merges: GitHub detects the license the tier asks for (MIT for flagship, CC BY-NC-ND 4.0 for portfolio), and the README's License section matches it. Or, where the skill says to add none, the PR says the cell should be waived.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 6 (files → LICENSE) and its rules on other people's work. Where the skill says to add no license (forks, private repos, co-authored code), add none and say in the PR body that this cell should be waived.
- The texts are in `assets/licenses/`; `{{YEAR}}` is the year the repo was created.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
Other people wrote part of the code (contributors besides the owner, named co-authors, code matching another repo): the owner decides the license; list who in the PR.

## Don't
- Don't replace an existing license; if it contradicts `package.json`, report it.
- Don't license course material written by instructors as the owner's.
