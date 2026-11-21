# The recipe template

Every item's `recipe.md` follows this shape. `standards validate` fails a recipe without **Done when** or **Hand off only when**. The other sections are there when they have something to say.

A recipe is read by a worker (Claude Code) in a git worktree of the asset, after the business context and the stack notes. Write it for that reader: what to change, where, how to make what is missing, and when to stop.

```markdown
## Done when
The check passes on the PR's preview, and <what a visitor, a crawler or a reviewer now sees>.

## Make what is missing
How to produce each input from what the repo has (its design system, brand assets, content, docs), with the tools the
item lists in `tools`. "A person must add it" is not an answer here.

## Stacks
- **Next.js:** where it goes (Metadata API, a route handler, `next.config` headers…).
- **Payload + Next:** the global or collection that should own it.
- **Astro / static:** the file in `public/` or the tag in the layout.

## Hand off only when
A closed list, usually: a secret, a paid account, or a legal fact found neither on the site nor in the business
context. Anything else, make.

## Don't
The traps: what breaks the build, what fakes the check, what changes other sites in the same repo.
```

Rules for writing one:

- **Name the outcome, not the steps the check runs.** "Every page has its own title" is a goal; "add a `<title>`" is a step.
- **Make, don't defer.** If an input can be produced from the repo (a video from brand assets, an image from a template, copy from the site's own facts), say how. If the repo lacks what's needed, the item should `requires:` the `ai-ready` item that provides it.
- **Facts only from the site and the business context.** Never invent an address, a company ID, a price or a review.
- **Shared code is shared.** In a repo that serves several sites, fix it once where all sites get it, unless the standard is per site.
