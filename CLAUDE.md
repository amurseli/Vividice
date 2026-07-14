# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vividice is a static fantasy-world wiki built with **Astro + React islands**, deployed to GitHub Pages at `https://amurseli.github.io/Vividice/` (note the `/Vividice` base path — it affects every internal URL). All prose content (characters, places, cosmology) lives in an **external Obsidian vault repo, `Brain`**, and is consumed read-only at build time via Content Collections.

## Commands

Use the Makefile targets:

- `make dev` — dev server at `http://localhost:4321/Vividice/`
- `make up-fresh` — clears Astro cache (`.astro`, `node_modules/.astro`) then starts dev. **Run this after editing `content.config.ts` or adding new Brain entries** — the collection cache is otherwise stale.
- `make build` — static build to `./dist/` (this is what validates the Zod schemas; a bad frontmatter field fails the build)
- `make preview` — build + serve locally
- `make editor` — launches the standalone visual-novel intro editor at `http://localhost:4330` (`tools/intro-editor.mjs`, edits `src/data/intro.json`)

There is no test suite or linter. `make build` is the correctness gate.

## Content source: the Brain repo (READ-ONLY)

Content is **not** in this repo. It lives in `amurseli/Brain` under `Brain/Ficción/Vivídice/`. **Never edit, create, or delete files under the Brain path** — the user maintains it directly in Obsidian. When new content or a content transformation is needed, either give the user a Markdown block to paste into Obsidian, or do the transformation on the Vividice side (loader/remark plugin/post-processing).

- **Local**: Brain is expected at `/home/agusda/Documents/Brain`; override with the `BRAIN_PATH` env var.
- **CI**: `.github/workflows/deploy.yml` sparse-checkouts only `Brain/Ficción/Vivídice` from the Brain repo (auth via the `BRAIN_REPO_TOKEN` secret) and sets `BRAIN_PATH` to that clone.
- A push to `main`, `workflow_dispatch`, or a `repository_dispatch` with `event_type: brain-updated` (fired from the Brain repo) triggers build + deploy.

Brain subfolders map to collections: `1- Entidades` → personajes, `2 - Lugares` → lugares, `6- Cosmología` → cosmologia. (Note the inconsistent spacing/numbering in folder names — the `folder` fields in the data files below are authoritative, match them exactly.)

## Architecture

### Collections and the folder→category derivation pattern

Collections are defined in `src/content.config.ts` with Zod schemas. Two recurring conventions matter:

1. **`generateId` flattens the slug** to just the lowercased filename (dropping the subfolder), so URLs are clean.
2. **Category/reino is derived from the file path at runtime**, not stored in frontmatter. The source of truth for these groupings is a plain `.mjs` data file (so `astro.config.mjs` can import it too):
   - Lugares → `src/lib/categorias.data.mjs` (subfolders like `1- Regiones y Continentes`)
   - Personajes → `src/lib/reinos.data.mjs` (subfolders like `Sel`, `Kamasco`)
   - Cosmología → `src/lib/cosmologia.data.mjs` (subfolders like `1- Magia y Tecnología`)
   - The matching helpers (`categoriaDe`/`reinoDe`, `urlLugar`/`urlPersonaje`/`urlConcepto`) live in `src/lib/lugares.ts`, `src/lib/personajes.ts`, `src/lib/cosmologia.ts` and find the group by checking whether `entry.filePath` includes `/${folder}/`.

Zod schemas defensively handle Obsidian's quirks: fields use `.nullish()` (Obsidian writes `null` for empty properties, not absent keys), enums use `.preprocess()` to normalize case/accents, and `aliases` arrays are filtered of `null` entries. Follow these patterns when adding fields — a strict schema will fail the build on real vault data. The `cosmologia` collection goes further: **every field is optional**, so an entry can be a bare `.md` with no frontmatter — its display name falls back to the filename via `nombreDe()`.

### URL construction — always use `url()`

**Never hand-concatenate internal paths.** `src/lib/url.ts` `url(...parts)` applies the `/Vividice` base correctly across dev/prod. Concatenating with template strings produces broken paths like `/Vividicelugares` in production. This applies to page links, image `src`, and audio `src` (see `musicSrc` in `narrative.ts`).

### Wikilinks

`src/lib/remark-wikilinks.mjs` is a custom remark plugin (a third-party one broke rendering under Astro 6) that turns Obsidian `[[Target]]` / `[[Target|alias]]` into real `<a>` tags. The slug→href map is built at config time in `astro.config.mjs` by reading the Brain directories directly (`buildLugaresHrefMap` / `buildPersonajesHrefMap`); unresolved links get a `wikilink--missing` class. If you add a new linkable collection, extend the map in `astro.config.mjs`.

### Body images (wiki figures)

Markdown body images render as wiki-style figures via the `src/lib/rehype-figures.mjs` rehype plugin (registered in `astro.config.mjs` with `{ base: SITE_BASE }`). It (1) prefixes the site base onto `/`-rooted image `src`s — Astro does **not** do this for raw markdown `![]()`, so a bare `/foo.jpg` would 404 on GitHub Pages — and (2) wraps a lone-image paragraph in `<figure>` + `<figcaption>` (caption = the `alt` text). The image `title` selects placement via the `PLACEMENT` map: none = centered block; `right`/`left` = float inside the column (framed, text wraps); `right-out` (aka `out`/`aparte`) = margin figure pushed into the right gutter, Wikipedia-style; `full` = breakout wider than the column. **Authoring rule:** floats only wrap text that comes *after* them in source order, so place a floating image *before* the paragraph it should sit beside. Put the file in `public/` (repo, e.g. `public/cosmologia/`) and write `![Caption](/cosmologia/foo.jpg "right-out")`. Styles (`.figure--right/left/out/full`, plus a `.prose::after` clearfix) live under `.prose` in `global.css`; detail pages wrap `<Content />` in `<div class="prose">`.

### Quotes & dialogue

The same `rehype-figures.mjs` plugin also styles in-world quotes:
- A markdown blockquote (`>`) renders as a centered serif **epigraph**. A paragraph inside it that starts with a dash (`—`/`--`) becomes the attribution (`.cita__fuente`, dashes → `— `).
- A plain paragraph whose 2+ lines each start with a dash is auto-detected as **dialogue** (`.dialogo`, `white-space: pre-line`, dashes → `— `) — authors type dash-led dialogue naturally.
- **Standard: quoted text is red.** Inside epigraphs and dialogue, any run between quotation marks (`"` `“” ` `«»`) is wrapped in `<span class="dicho">` (accent color) — the spoken phrase pops red, the narration/attribution stays normal. `wrapQuotes` toggles on each quote char and spans inline elements (e.g. `**bold**` inside a quote). Styles under `.prose` in `global.css`.

### Layout / rendering

- `src/layouts/BaseLayout.astro` is the shared shell. Its `width` prop (`narrow` | `wide` | `full` | `bleed`) controls the main container; `hideNav`/`hideFooter`/`transparentNav` handle fullscreen pages.
- `src/components/Navbar.tsx` is a React island (`client:load` for the mobile menu). Its `LINKS` array is the top-level nav — add new sections here.
- `src/components/EntryCard.astro` is deliberately collection-agnostic: it takes plain props, not an entry. Reuse it for any listing; variants are `default` | `hero` | `section`.

### The visual-novel intro (`/historias`)

`/historias` is not a content collection — it's an interactive visual novel. `src/components/VisualNovel.tsx` renders a branching script (`src/data/intro.json`) whose types/engine live in `src/lib/narrative.ts`: steps, flag-based conditionals (`when`/`next` rules), text variants, inline rich-text effects (`{{pause}}`, `[[wave accent]]…[[/]]`), and per-step music. Edit the script with `make editor`, not by hand.
