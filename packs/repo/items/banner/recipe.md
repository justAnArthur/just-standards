## Done when
The check passes on the default branch after the PR merges: `.github/banner.svg` exists, renders in GitHub's light and dark themes, and the README links it as its first line.

## Make what is missing
Follow the `repo-standard` skill in this pack (`SKILL.md`, with `references/` and `scripts/` beside it): its step 4 (visuals): render `.github/banner.svg` with `scripts/banner.mjs` from a spec, check both themes, and link it as the first line of the README.
- The spec's examples are in `references/banner-examples/`; the fonts the script embeds are in `assets/fonts/`.
- Look at the rendered SVG in both themes before committing.

The rules in this prompt win over the skill where they differ: open a pull request instead of pushing to the default branch, and don't archive, rename or change visibility.

## Hand off only when
Never: the banner is rendered from the repo's name, description and stack.

## Don't
- Don't put a "Live demo" button on the banner that points at a dead URL.
- Don't change the banner to please a linter: exclude `.github/banner.svg` in the linter's config (see the skill's "Repo linters").
