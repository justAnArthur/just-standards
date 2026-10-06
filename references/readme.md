# README templates

House voice (from just-map, just-ai-avatar, modo): terse, code-first, lowercase is fine in prose,
no emoji headings, no badges for things that don't exist, no "Features ✨" lists of marketing.
Lead with the banner, then what it is in one or two sentences, then a command the reader can run.
Drop any section that would be empty. Banner, diagram, screenshot and badge rules: `visuals.md`.

## flagship — library / CLI

````markdown
<a href="<homepage>"><img src=".github/banner.svg" alt="<banner title>: <banner subtitle>" width="100%"></a>

# <repo-name>

<What it is and what makes it different, 1–2 sentences.>

**[Live demo →](<url>)**

```bash
bun add <package>
```

## Use

```ts
<smallest real example, taken from the code or tests>
```

## How it works

<2–4 sentences, then one Mermaid diagram if the code has a pipeline / protocol / structure>

## Develop

```bash
bun install
bun run dev
bun test
bun run build
```

## Structure

```
<path>    <what it is>        # monorepos only
```

## Releases

Versioning, npm publishing and GitHub releases run via
[just-github-actions-n-workflows](https://github.com/justAnArthur/just-github-actions-n-workflows).
<scope convention, tag format>          # only if .justactions.yml / bump workflow exists

## License

MIT
````

## flagship — app / site

Same as above, but replace the install block and `## Use` with:

````markdown
## Run

```bash
cp .env.example .env    # <list the required vars and where to get them>
bun install
bun run dev             # http://localhost:<port>
```

## Deploy

<one or two lines: where it runs and how it gets there (Vercel hook, docker compose over SSH, …)>
````

## portfolio — finished work

````markdown
<a href="https://github.com/justAnArthur/<repo>"><img src=".github/banner.svg" alt="<banner title>: <banner subtitle>" width="100%"></a>

# <Human-readable title>

<What it does, one sentence.> Built for <course name in English> (<code>) at FIIT STU in <season year>,
or for <hackathon / company challenge>.

> Finished and archived. <result, grade or placement if the original docs state it>

## What it does

- <3–5 concrete bullets from the code or report>

## How it works

<one Mermaid diagram of the algorithm / protocol / architecture, when there is one>

## Results

<table or numbers from the report, if it has any>

## Run

```bash
<the real command(s)>
```

## Stack

<language, frameworks, notable libraries>

## Documentation

- [<report file>](<path>) — <what it is>

## License

[CC BY-NC-ND 4.0](LICENSE): share it with credit, but no changes and no commercial use. Don't hand it
in as your own coursework.

---

## Pôvodná dokumentácia (SK)

<original Slovak README content, unchanged>
````

## private — still in use

````markdown
# <repo-name>

<What it is, one sentence.>

```bash
<install / run commands>
```
````

## notes

````markdown
# <Course name> (<course code>)

Study notes for <course> at <university>, <semester/year>. Archived.

<optional: short list of the main topics or files>
````
