# lac-showcase

**A self-documenting portfolio built with Life-as-Code.**

A React app that reads its own `feature.json` files and renders them as a visual
feature tree. Every decision made while building the app is captured as a
`feature.json` — and the app renders those same files. The build process and the
content are the same thing: the self-documenting loop is closed.

---

## What it demonstrates

- **LAC CLI** (`@majeanson/lac`) — `lac init`, `lac spawn`, `lac fill`, `lac lint`
  used throughout the build
- **MCP server** (`@life-as-code/lac-mcp`) — Claude reads feature context directly
  from the repo via MCP during authoring
- **VS Code extension** (`lac-lens`) — inline feature status badges and hover
  context while editing source files
- **Feature schema** (`@life-as-code/feature-schema`) — all 22 features validate
  against the shared schema (schemaVersion 1)
- **lifeascode web app** — the hosted counterpart; this repo is the local,
  source-of-truth side of the same workflow
- **Life decisions domain** — `feat-2026-022` shows the same provenance model
  applied to personal decisions (career, relocation), not just code

---

## Run it locally

```bash
bun install
bun run dev
```

Build a static bundle:

```bash
bun run build
bun run preview
```

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/majeanson/lac-showcase)

This repo ships with a `vercel.json` that configures the build automatically —
no Vercel dashboard settings needed.

### One-time setup

1. Push this repo to GitHub (or GitLab / Bitbucket).

2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.

3. Vercel will detect `vercel.json` and pre-fill:
   - **Build command**: `bun run build`
   - **Output directory**: `dist`
   - **Install command**: `bun install`

   Leave everything as-is and click **Deploy**.

That's it. Vercel assigns a `*.vercel.app` URL on first deploy. Every push to
`main` redeploys automatically.

### Deploy via CLI

```bash
npm i -g vercel   # one-time
vercel            # first deploy — follow the prompts
vercel --prod     # promote to production URL
```

### What `vercel.json` contains

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "bun install"
}
```

No environment variables required — the app is fully static. Feature data is
embedded at build time via `import.meta.glob`.

### Use your own domain

In the Vercel dashboard → **Settings → Domains** → add your domain and follow
the DNS instructions. No code changes needed.

---

## Feature tree structure

22 features arranged in a depth-first tree rooted at `feat-2026-001`:

```
feat-2026-001  Why I Built This                  (root, frozen)
├── feat-2026-002  React App Shell               (vite scaffold, frozen)
│   ├── feat-2026-003  Design System
│   └── feat-2026-015  Focus / Graph views
├── feat-2026-004  What is Life-as-Code          (about section, frozen)
│   └── feat-2026-006  LAC Ecosystem Overview    (frozen)
│       ├── feat-2026-007  @majeanson/lac CLI
│       ├── feat-2026-008  lac-lens VS Code ext
│       ├── feat-2026-009  lac-mcp MCP server
│       ├── feat-2026-010  lac-lsp LSP
│       ├── feat-2026-011  lac-claude integration
│       ├── feat-2026-012  feature-schema package
│       └── feat-2026-013  lifeascode web app
└── feat-2026-022  Life Decisions as Code        (concept, active)
    ├── feat-2026-017  Career pivot example
    └── feat-2026-018  Relocation example
```

Feature data is loaded at build time via `import.meta.glob('../**/feature.json',
{ eager: true })` — no server, no API. The tree is assembled from `lineage.parent`
keys at runtime.

---

## CLI commands used to build this

Initialize the project and create the root feature:

```bash
lac init
# creates lac.config.json in the project root
```

Spawn child features from the root:

```bash
lac spawn --parent feat-2026-001
# interactive prompt → creates src/feature.json (feat-2026-002)

lac spawn --parent feat-2026-001
# creates src/about/feature.json (feat-2026-004)

lac spawn --parent feat-2026-001
# creates src/life-decisions/feature.json (feat-2026-022)

lac spawn --parent feat-2026-004
# creates src/ecosystem/feature.json (feat-2026-006)
```

Fill a feature using AI (MCP + Claude):

```bash
lac fill feat-2026-002
# Claude reads the repo context via MCP and drafts all fields
```

Lint the workspace to catch missing required fields:

```bash
lac lint
# checks all feature.json files against lac.config.json lintStatuses
```

---

## The toolchain

| package | what it is | link |
|---|---|---|
| `@majeanson/lac` | CLI — scaffold features, fill with AI, inspect lineage. Runs via `npx`. | [npm →](https://www.npmjs.com/package/@majeanson/lac) |
| `lac-lens` | VS Code extension — CodeLens annotations, hover cards, sidebar explorer. | [marketplace →](https://marketplace.visualstudio.com/items?itemName=majeanson.lac-lens) |
| `lac-mcp` | MCP server — exposes your feature workspace to Claude, Cursor, any MCP host. | bundled with CLI |
| `lifeascode` | Web app — browse features, visualise lineage trees, timeline of decisions. | [live demo →](https://lifeascode-ruddy.vercel.app/) |
| `feature-schema` | Canonical schema — single Zod source of truth across CLI, LSP, MCP, web app. | bundled |
| `lac-lsp` | Language server — real-time validation in any LSP-compatible editor. | bundled |
