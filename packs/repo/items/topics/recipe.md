## Done when
The check passes: the repo has 3–8 GitHub topics from the vocabulary.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 5 with the vocabulary in `references/topics.md`: `gh repo edit --add-topic` / `--remove-topic`. A repo setting: set it directly and mention it in the PR body.
- Exactly one kind, 1–4 stack, 1–3 domain, and a context topic if one applies.
- Remove topics that break the vocabulary.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
`gh` has no admin rights on the repo: say so in the PR body with the topics to set.

## Don't
- Don't invent topics outside `references/topics.md`; add to the vocabulary only when no topic fits.
