## Done when
The check passes on the default branch after the PR merges: `README.md` is at least 400 characters, written from the code for the repo's tier, with none of a template's boilerplate (`create-next-app`, "bootstrapped with"…), and every claim in it is true of the code.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its procedure step 2 (read the code) and step 3 (write the README for the tier), with the templates in `references/readme.md`.
- Read the manifest, entry points, scripts, `.env.example`, workflows and deploy config before writing a line.
- Keep real content that is already there: an English summary on top, the original below its heading.
- The live URL comes from `package.json` `homepage`, README links or deploy config, never a guess.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
Never: the README is written from the code.

## Don't
- Don't describe what the title or the assignment promises when the code does something else: say what the code does.
- Don't add badges for things that aren't true (a CI badge with no CI, coverage nobody measures).
