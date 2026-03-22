# Reconstruction Spec — FirstProjectExample

> This document fully describes a software system through its feature documentation.
> Your task is to implement this system from scratch.
> Do not reproduce the original source — implement cleanly to satisfy each feature's
> problem statement, decisions, and success criteria.
> The tree structure below shows parent/child relationships between features.

**27 features** · 27 frozen · 15 domains: portfolio, content, design-system, schema, documentation, ai-integration, cli, editor-integration, server, web-app, frontend, ux, personal, concept, tooling

## Domain: ai-integration

### feat-2026-011 — lac-claude — Claude Bridge

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Without a programmatic Claude integration, every AI-assisted fill requires manually copying context into a chat window and pasting results back.

**Analysis:**
A private bridge library connecting feature.json files to the Anthropic API. Given a feature folder, it reads surrounding source files (~200KB max), builds a structured markdown context, and fills missing fields or generates code artifacts. Exposes fillFeature() and genFromFeature(), used internally by both the CLI and the MCP server.

**Implementation:**
src/index.ts exports fillFeature() and genFromFeature(). context-builder.ts reads TypeScript, JavaScript, Python, and other source files adjacent to the feature.json. prompts.ts defines per-field system/user prompts for each fillable field. The Anthropic SDK client defaults to claude-sonnet-4-6. Structured field responses are parsed after stripping markdown code fences.

**Decisions:**
- **Per-field prompts rather than one prompt for all missing fields** — Each field has a distinct shape and purpose — separate prompts produce higher-quality results than a single omnibus prompt.
  Alternatives considered: One prompt, all fields — faster but lower quality, harder to parse structured fields
- **Read surrounding source files for context, not just feature.json** — The best analysis and implementation notes come from reading the actual code — Claude can infer decisions and limitations from the source.
  Alternatives considered: feature.json only — Claude would hallucinate plausible-sounding but inaccurate details
- **Claude Sonnet 4.6 as default model** — Best balance of capability and cost for the fill task, with a context window large enough for a typical feature folder.
  Alternatives considered: Opus — more capable but 5x more expensive, Haiku — lower quality for nuanced analysis fields

**Known Limitations:**
- No caching — every fill re-reads all source files and makes a fresh API call
- Context truncation at ~200KB may lose relevant source files in large folders
- Prompt strings are hardcoded — no per-workspace customization

**Success Criteria:** Running lac fill on a feature with missing fields produces accurate, non-hallucinated values for analysis, implementation, and knownLimitations that reflect the actual source code.

**Tags:** claude, ai, fill, anthropic, generation

---

### feat-2026-009 — lac-mcp — MCP Server

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Without an MCP server, Claude can only read files pasted into the conversation — it can't search features, create new ones, or write fields back to disk.

**Analysis:**
An MCP server exposing LAC as structured tools for Claude and any MCP-compatible AI client. The read_feature_context + write_feature_fields pair implements a deliberate split: Claude reads context and generates values itself, then writes them back — keeping the AI in the loop without a redundant API call.

**Implementation:**
Single file (src/index.ts) registering MCP tools via the MCP SDK over stdio JSON-RPC. Each handler walks the filesystem for feature.json files and delegates AI-heavy operations to lac-claude. All writes use skipConfirm: true. Bundled into the @majeanson/lac binary as the lac-mcp binary.

**Decisions:**
- **read_feature_context + write_feature_fields as a two-step pattern instead of fill_feature** — When Claude Code is the client, Claude itself is the AI — the split lets Claude read context, generate field values, and write them back without a redundant Anthropic API call.
  Alternatives considered: Single fill tool — can't leverage Claude-as-client without a redundant API call
- **skipConfirm: true for all MCP writes** — Showing a confirmation prompt in the terminal would block the MCP client — AI tools are expected to be deterministic enough not to need per-write approval.
  Alternatives considered: Interactive confirmation — breaks headless MCP workflow, Dry-run mode — useful addition but not yet implemented

**Known Limitations:**
- No concurrency controls — simultaneous sessions writing the same feature.json will conflict
- skipConfirm means bad AI-generated values are written to disk without human review
- No streaming — full response buffered before returning to MCP client

**Success Criteria:** Claude Code with the MCP server configured can search, create, read, fill, and write feature.json files in a workspace without any manual file editing.

**Tags:** mcp, ai, claude, tools, protocol

---

## Domain: cli

### feat-2026-007 — @majeanson/lac — The CLI

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Developers need a terminal-first way to create, search, validate, and manage feature.json files without leaving their workflow.

**Analysis:**
The public entry point to the LAC ecosystem — a single npm package (@majeanson/lac) bundling three binaries: `lac` (CLI), `lac-lsp` (language server), and `lac-mcp` (MCP server). 16+ commands cover the full lifecycle; all operate on the local filesystem with no server required.

**Implementation:**
Entry point is src/index.ts, a Commander.js router delegating to src/commands/*.ts. The filesystem walker and scanner power all read commands. Config is loaded from .lac/config.json; interactive commands use the `prompts` library. Static site export generates self-contained HTML/CSS from src/templates/. Bundled with tsdown to ESM.

**Decisions:**
- **Bundle all three binaries (CLI, LSP, MCP) into one npm package** — One `npm install -g @majeanson/lac` gives the developer everything — no separate install steps for server components.
  Alternatives considered: Separate packages per binary — cleaner separation but friction-heavy install
- **Commander.js for CLI parsing** — Mature, well-documented, and supports nested subcommands cleanly for 16+ commands.
  Alternatives considered: Yargs — more config, less ergonomic, Bun.argv parsing — too low-level
- **File-system only, no database** — Features live in the repo alongside code and git tracks history — no infra to provision or maintain.
  Alternatives considered: SQLite sidecar — faster queries but severs git-native workflow

**Known Limitations:**
- Bundling all binaries means CLI-only users always install LSP and MCP too
- Interactive prompts require a real TTY — headless CI needs --yes flags
- No concurrent write safety — simultaneous lac fill calls on the same file conflict

**Success Criteria:** `npm install -g @majeanson/lac` succeeds and `lac init` creates a valid .lac/ workspace with all commands running error-free.

**Tags:** cli, npm, commander, bun, public

---

## Domain: concept

### feat-2026-022 — Life Decisions as Code

**Status:** frozen
**Parent:** feat-2026-001
**Children:** feat-2026-017, feat-2026-018

**Problem:** People make major personal decisions with no record of why — the context evaporates and years later you can't reconstruct the logic.

**Analysis:**
The feature.json model maps cleanly onto life decisions: every major choice has a problem it solves, alternatives seriously considered, and a rationale for the path taken. A career pivot, a relocation, a relationship choice all have the same structure as a software architectural decision. This feature makes that parallel explicit and demonstrates that LAC is a reasoning tool, not just a developer tool.

**Implementation:**
No code — content-only feature. feat-2026-017 and feat-2026-018 are the children that demonstrate the principle with concrete examples.

**Decisions:**
- **Spawn from the root feature rather than the ecosystem branch** — This is a conceptual extension of the core idea, not a package or UI feature — it belongs at the same level as the app shell and about section.
  Alternatives considered: Spawn from feat-2026-004 (What is Life-as-Code) — too nested, loses visibility
- **Use real-sounding personal examples as children rather than hypotheticals** — Concrete examples make the provenance model feel lived-in rather than academic — abstract examples don't land.
  Alternatives considered: Generic placeholder examples — too sterile to make the point

**Known Limitations:**
- Concept relies entirely on children to demonstrate — reads abstract without them rendered
- Whether the software/life-decision parallel lands is unobservable in the app
- The model captures logic well but struggles with emotional or relational factors

**Success Criteria:** A non-developer reader looks at the career pivot and relocation child features and recognises the same reasoning structure they've used in their own major decisions.

**Tags:** life-decisions, provenance, meta, personal, reasoning

---

## Domain: content

### feat-2026-004 — What is Life-as-Code

**Status:** frozen
**Parent:** feat-2026-001
**Children:** feat-2026-006

**Problem:** Visitors see a portfolio of features but have no context for what life-as-code is or why it matters.

**Analysis:**
A short explainer section rendered above the feature list, explaining that LAC treats provenance as a first-class artifact — a feature.json living next to the code it describes. Links to the LAC CLI for visitors who want to adopt the workflow.

**Implementation:**
About.tsx is a purely presentational React component with no props or data fetching, rendered as a <section> above the feature list using about-label/about-body layout. All styles use BEM-style class names referencing CSS custom properties from feat-2026-003. Two external links open in a new tab with rel=noreferrer.

**Decisions:**
- **Inline section in the single-page layout rather than a separate /about route** — The explainer is short enough that routing adds friction — scrolling into the features is the natural reading flow.
  Alternatives considered: Separate /about page — breaks single-page reading, Modal or popover — hides content from skimmers
- **About component imported into App.tsx above the feature list** — Visitors read the explanation before encountering the features it describes.
  Alternatives considered: Below the feature list — too late; visitors hit cards before understanding them
- **about-section styled with accent left-border matching the design system** — Visually distinguishes the explainer from feature cards while staying within the same token vocabulary.
  Alternatives considered: Plain prose, no border — loses visual separation from feature list

**Known Limitations:**
- External links are hardcoded — URL changes require a code edit
- No i18n support — all copy is English-only JSX
- No custom focus indicator on .about-link beyond browser defaults

**Success Criteria:** The explainer section renders above the feature list on page load, uses the app's design tokens, and both external links open the correct destinations in a new tab.

**Tags:** about, explainer, lac, onboarding

---

## Domain: design-system

### feat-2026-003 — Visual Design System

**Status:** frozen
**Parent:** feat-2026-002
**Children:** feat-2026-005

**Problem:** The app needs a cohesive visual language — typography, color, spacing — that feels like a technical journal, not a generic dev tool.

**Analysis:**
Warm archival aesthetic: cream background (#F2EDE3), rust accent (#7C3217), dark brown text (#1C1714), with three font roles — Playfair Display (headers), Lora (body), JetBrains Mono (keys/badges). All tokens live in CSS custom properties on :root, making them trivially overridable.

**Implementation:**
All tokens defined in src/index.css :root block. Font faces loaded via Google Fonts @import. Component styles in App.css use only var(--token) references. Each status has a --status-{name} (text) and --status-{name}-bg (background) pair.

**Decisions:**
- **Warm archival palette over dark-mode dev aesthetic** — The content is about reasoning — it deserves a reading experience like a well-designed technical journal, not a code editor.
  Alternatives considered: Dark mode terminal — too expected, Minimal white — sterile, forgettable
- **Playfair Display + Lora + JetBrains Mono type trio** — Playfair anchors titles editorially, Lora gives body text warmth, and JetBrains Mono gives technical elements precision without feeling cold.
  Alternatives considered: Inter or system fonts — generic, no character, All-serif — loses technical contrast
- **CSS custom properties for all design tokens** — Single source of truth — any component references --accent or --font-display without importing a theme object.
  Alternatives considered: Tailwind config — adds build dependency for a small design system, Hardcoded values — brittle, doesn't scale
- **Tokens applied and frozen — all components verified against var() references** — Design system is complete for current scope; index.css holds all :root tokens and App.css uses only var(--token) references.

**Known Limitations:**
- No dark mode — warm cream palette is hardcoded with no alternate theme
- Google Fonts @import adds a network dependency with no offline fallback (FOIT risk)
- Status color pairs not enforced by linting — new statuses can be added inconsistently

**Success Criteria:** All UI components reference design tokens via CSS custom properties, the three fonts load and render in their intended roles, and the warm archival aesthetic is visually consistent across the full app.

**Tags:** design, typography, css, tokens, aesthetic

---

## Domain: documentation

### feat-2026-006 — LAC Ecosystem Overview

**Status:** frozen
**Parent:** feat-2026-004
**Children:** feat-2026-007, feat-2026-008, feat-2026-009, feat-2026-010, feat-2026-011, feat-2026-012, feat-2026-013

**Problem:** Visitors who understand life-as-code still don't know what tools exist, how they relate, or which one to reach for.

**Analysis:**
The LAC ecosystem spans three deployment surfaces — CLI (npm), VS Code extension (Marketplace), and web app (Vercel) — backed by internal packages for schema, LSP, MCP, and Claude integration. This overview is the index node; child features fill in the per-package territory.

**Implementation:**
No code — content-only feature. Renders as a feature card at depth 2; its 7 child features appear indented at depth 3. The thread-toggle collapses all 7 package cards in one click.

**Decisions:**
- **One child feature per package/app, this feature as their shared parent** — Each package has its own decisions and tradeoffs deserving independent documentation — this overview explains the shape while children fill in the detail.
  Alternatives considered: One long feature with all packages — loses per-package context, No overview, just individual package features — no entry point for the full map
- **Ecosystem overview frozen once all 7 package children are complete and rendering in the tree** — All package features (007-013) are filled, frozen, and visible as an indented sub-tree with a thread-toggle to collapse them in one click.

**Known Limitations:**
- Overview becomes stale when a new package is added without a matching child feature

**Success Criteria:** The ecosystem overview renders as parent of all package features, and a visitor reading top-to-bottom can follow the LAC concept → ecosystem map → individual package deep-dives.

**Tags:** ecosystem, packages, overview, lac, index

---

## Domain: editor-integration

### feat-2026-008 — lac-lens — VS Code Extension

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Feature provenance is most useful while reading or editing code — without editor integration, the feature.json is a file the developer must remember to open manually.

**Analysis:**
VS Code extension surfacing feature provenance via CodeLens, hover tooltips, a sidebar tree view, a rich webview panel, and a status bar indicator. Works standalone (filesystem walking) or enhanced (lac-lsp over stdio), auto-detecting which mode is available.

**Implementation:**
Activated in extension.ts, which registers CodeLensProvider, HoverProvider, and the Explorer tree. FeatureWalker.ts and FeatureCache.ts handle discovery without the LSP; LacLspClient.ts takes over for richer diagnostics when available. FeaturePanel.ts renders a webview as static HTML. Built with esbuild to a single out/extension.js.

**Decisions:**
- **Two-mode architecture: standalone filesystem + optional LSP** — Standalone mode works out of the box; LSP mode is an upgrade for power users who want diagnostics — requiring LSP adds too much friction.
  Alternatives considered: LSP required — too much setup friction, Always filesystem — misses diagnostics and cross-file intelligence
- **Webview panel as static HTML, not a React SPA** — Simpler bundle and faster startup — the panel is read-heavy and doesn't need full React reactivity.
  Alternatives considered: React in webview — more interactive but heavier build pipeline

**Known Limitations:**
- Standalone mode re-indexes features on every activation — slow in large repos
- Webview panel is one-way HTML — rich interactions require page reload
- Auto-detection of lac-lsp binary is silent — users don't know which mode they're in

**Success Criteria:** Installing the extension and opening a repo with feature.json files shows CodeLens annotations, a populated sidebar tree, and working hover tooltips with zero configuration.

**Tags:** vscode, extension, codelens, lsp, editor

---

## Domain: frontend

### feat-2026-002 — React App Shell

**Status:** frozen
**Parent:** feat-2026-001
**Children:** feat-2026-003, feat-2026-015

**Problem:** The portfolio needs a runnable React app that reads feature.json files and renders them as a visual timeline — without it, no other features can be built or seen.

**Analysis:**
Vite + React scaffold where feature data is imported at build time via import.meta.glob, bundling all feature.json files as static JSON with no server required. The root and all child feature.json files become the dataset the UI renders.

**Implementation:**
App.tsx renders a tree of FeatureNode components built by buildTree() in features.ts, which uses import.meta.glob('../**/feature.json', { eager: true }) to collect all feature.json files at build time. buildTree() sorts features into a depth-first tree via lineage.parent keys and flattens to an ordered array with depth values for visual indentation.

**Decisions:**
- **Vite over Create React App or Next.js** — Fast dev server, native glob imports for JSON, and outputs a static site with no server runtime required.
  Alternatives considered: Next.js — overkill, adds SSR complexity, CRA — deprecated, slow
- **import.meta.glob to load feature.json files** — Vite natively resolves all matching files at build time into a single import map, requiring no file system API at runtime.
  Alternatives considered: Runtime fetch of JSON files — requires a server, Hardcoded imports — doesn't scale
- **Dead code removed (byKey, rooted variables in buildTree) during integration sprint** — The variables were computed but never read, so removing them during the integration sprint was zero-risk.
- **types.ts extended with successCriteria and domain to match feature.json schema** — Both fields were written to feature.json files but invisible to TypeScript — adding them enables type-safe rendering in the card UI.

**Known Limitations:**
- No error boundary around App or FeatureCard — malformed feature.json crashes the whole page
- The glob pattern has no exclusions — node_modules fixtures would be silently included
- No empty-state UI — zero feature.json files renders a blank list with no message

**Success Criteria:** `bun run build` completes without errors and the app renders all feature.json files as an indented tree with correct depth, status badges, and expandable detail sections.

**Tags:** react, vite, scaffold, static-site

---

### feat-2026-015 — Full Feature Integration Sprint

**Status:** frozen
**Parent:** feat-2026-002
**Children:** feat-2026-019

**Problem:** The app renders a basic feature tree but none of the designed features are actually built — the feature.json files describe what to build and the app needs to catch up.

**Analysis:**
The feature.json files are the implementation spec; each feature's status field drives the work queue. The sprint works through every active feature in dependency order — design tokens first, then app shell improvements, About section, ecosystem features, lineage collapse, then focus/navigation mode. Each feature becomes a testable increment verified against its successCriteria.

**Implementation:**
Integration order: (1) feat-2026-003 CSS design tokens, (2) feat-2026-002 About component wired into App.tsx, (3) feat-2026-004 About section styled, (4) feat-2026-006..013 ecosystem features in tree, (5) feat-2026-005 collapse/expand, (6) feat-2026-014 focus mode via ?focus= URL param. Each increment verified against successCriteria before proceeding.

**Decisions:**
- **Work in dependency order, not feature-key order** — Design tokens must land before component styling, and collapse behaviour must land before focus mode builds on top of it — building out of order creates rework.
  Alternatives considered: Alphabetical/key order — ignores dependencies, All at once — impossible to test incrementally
- **Use each feature's successCriteria as the acceptance test** — successCriteria was written to be specific and testable — using it as the definition of done closes the loop between documentation and implementation.
  Alternatives considered: Ad-hoc testing — no clear completion signal, Separate test spec — duplicates what's already in feature.json
- **successCriteria rendered in the expanded card view** — Makes the app self-describing — visitors can see not just what was built but how we knew it was done.
  Alternatives considered: Only internal / not rendered — wastes the field for showcase purposes
- **types.ts extended with successCriteria and domain fields** — Both fields are present in feature.json files — exposing them in the TypeScript interface ensures they render and are type-checked at build time.
  Alternatives considered: Keep types narrow, access via JSON cast — loses type safety
- **features.ts dead code (byKey, rooted variables) removed during integration** — The integration sprint is the natural point to fix known issues already documented in feat-2026-002's knownLimitations.
  Alternatives considered: Leave it — tech debt grows; knownLimitations already called it out

**Known Limitations:**
- No automated test suite — successCriteria verification is manual visual inspection

**Success Criteria:** Every active feature renders correctly in the running app with design tokens applied, About section above the feature list, working collapse/expand, working focus mode via ?focus=, and the ecosystem sub-tree fully navigable.

**Tags:** integration, sprint, implementation, all-features

---

## Domain: personal

### feat-2026-017 — Career Pivot — Leaving Finance for Software

**Status:** frozen
**Parent:** feat-2026-022

**Problem:** I spent 4 years in finance before switching to software engineering, deliberated for 18 months, and never wrote any of it down — the reasoning is gone.

**Analysis:**
Finance gave me precision and pattern recognition under uncertainty — both transfer directly to software engineering. The decision had a clear problem, a clear set of alternatives, and a moment where the balance tipped; none of that was written down until now. This feature.json is the first time the reasoning has been captured.

**Implementation:**
No code — content-only feature. The feature.json itself is the artifact — the first written record of a decision that was made and lived but never documented.

**Decisions:**
- **Leave a stable role rather than transition internally** — Internal transitions in finance stay finance-adjacent — a clean break was the only way to fully context-switch and be taken seriously as an engineer.
  Alternatives considered: Internal data/analytics role — still finance, Part-time bootcamp while employed — not enough immersion
- **Self-taught over bootcamp** — Bootcamps optimise for employment speed; I wanted fundamentals — the slower path built a stronger foundation and removed the 'bootcamp grad' ceiling.
  Alternatives considered: Coding bootcamp — faster but shallower, CS degree — too long, didn't need the credential
- **Target developer tooling as first domain** — Building tools for developers let me use my own products, get honest peer feedback, and work in a space where quality of thinking is visibly rewarded.
  Alternatives considered: Fintech — felt like staying in the same world, Frontend product work — too far from systems thinking

**Known Limitations:**
- Written retrospectively — original uncertainty is partially lost
- One person's experience; the pattern generalises but specifics don't

**Success Criteria:** A reader who has made or is considering a major career change sees their own deliberation reflected in the structure and considers writing it down.

**Tags:** career, pivot, life-decision, provenance, personal

---

### feat-2026-018 — Moving Cities — Trading Stability for Optionality

**Status:** frozen
**Parent:** feat-2026-022

**Problem:** A city move involves dozens of sub-decisions whose rationale feels obvious at the time and opaque six months later — without a record, the move just becomes 'I moved' with no trace of the thinking.

**Analysis:**
Moving cities is less like a single decision and more like a project — a root choice (go or stay) spawning sub-decisions that follow from it, exactly mirroring how a software feature spawns children as scope clarifies. The relocation was the root; neighbourhood, lease length, and timing were the children, none of which were documented.

**Implementation:**
No code — content-only feature. The feature.json models one root choice (move) with sub-decisions (when, where, how long) that mirror the way software features spawn children as scope clarifies.

**Decisions:**
- **Optimise for optionality over stability at this stage** — Early-career, no dependents, low switching cost — the asymmetry favoured moving given upside access to denser networks and opportunities.
  Alternatives considered: Stay in current city — lower risk but compounding opportunity cost, Move abroad — language barrier for professional networking
- **Short-term lease for the first 6 months** — Committing to a long lease before understanding the city's geography would be premature optimisation — short-term preserved the option to relocate within the city.
  Alternatives considered: 12-month lease immediately — cheaper per month but locked in without local knowledge, Co-living / furnished rooms — too transient to focus
- **Move mid-year rather than January** — January moves happen at the same time as everyone else's — mid-year had better optionality in the rental market.
  Alternatives considered: January — cleaner psychological reset but worse market, Wait until year-end — decision fatigue was already high

**Known Limitations:**
- Sub-decisions not spawned as separate child features — that would be the full model
- Emotional and relational factors don't map cleanly to the decisions schema

**Success Criteria:** A reader sees that the structure of a relocation decision is identical to a software architectural decision and recognises that documenting both is worth doing for the same reasons.

**Tags:** relocation, life-decision, optionality, provenance, personal

---

## Domain: portfolio

### feat-2026-001 — Why I Built This

**Status:** frozen
**Children:** feat-2026-002, feat-2026-004, feat-2026-022, feat-2026-023

**Problem:** Developers build things for reasons that get lost — this app makes the reasoning visible by capturing problem, decisions, and learnings per project entry.

**Analysis:**
A self-documenting portfolio where the repo's own feature.json files are the data source, making build process and content inseparable. Every decision made while building the app is also visible inside the app.

**Implementation:**
The root feature.json acts as the entry point for the entire feature tree with no parent and no dedicated source file. The Vite app discovers it via import.meta.glob alongside all child feature.json files, rendering the same decision records that describe how it was built.

**Decisions:**
- **React for the UI layer** — Component model maps naturally to feature cards and is easy to iterate on visuals without a full framework.
  Alternatives considered: Plain HTML/CSS — less composable, Next.js — overkill for static portfolio
- **feature.json files in the repo as the data source** — The project is self-describing — no CMS, no database, provenance lives alongside the code it documents.
  Alternatives considered: Hardcoded entries — defeats the purpose, External CMS — separates content from context
- **Iterative feature spawning — root feature first, children added as the project grows** — Mirrors real-world software development where each child feature is a new slice of work with its own context.
  Alternatives considered: Plan all features upfront — premature, hides iterative nature
- **Root feature frozen once all designed features are implemented and visible in the running app** — The showcase is complete — 22 features spanning the full LAC ecosystem, all visible in the app that documents them, closing the recursive loop.

**Known Limitations:**
- No automated completeness check — empty fields render without warning

**Success Criteria:** The app runs with `bun run dev`, renders the root feature card at depth 0 with problem/decisions/analysis visible, and all child features appear indented beneath it.

**Tags:** react, portfolio, life-as-code, self-documenting, provenance

---

## Domain: schema

### feat-2026-012 — feature-schema — Canonical Schema

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Without a shared schema package, each ecosystem package would define its own types independently — leading to drift, inconsistent validation, and bugs when the feature shape changes.

**Analysis:**
The shared foundation of the entire LAC ecosystem — defines Feature, Decision, Annotation, and Lineage types using Zod, exports TypeScript types via inference, provides runtime validation with human-readable errors, and handles feature key generation with a persistent counter. Every other package depends on this one.

**Implementation:**
src/schema.ts defines Zod schemas for all types; src/types.ts re-exports inferred TypeScript types. src/validate.ts exports validateFeature() with typed errors. src/keygen.ts generates keys in <domain>-YYYY-NNN format by reading/writing a counter from .lac/counter and a deduplication set from .lac/keys. Multiple export entry points allow consumers to import only what they need.

**Decisions:**
- **Zod for schema definition and runtime validation** — A single definition produces both the TypeScript type and the runtime validator — no code duplication, no drift between type and validator.
  Alternatives considered: JSON Schema + ajv — verbose, no TypeScript inference, Hand-written types + manual validation — high maintenance burden
- **Feature key format: <domain>-YYYY-NNN** — Human-readable, sortable by year, and domain-prefixed so teams can use different prefixes for different feature types.
  Alternatives considered: UUID — opaque, not human-readable, Incrementing integer only — no year context, collides across years
- **Persist key counter in .lac/counter file** — Keys must be unique and monotonically increasing — a file is the simplest cross-process persistent counter that works without a database.
  Alternatives considered: In-memory counter — resets between CLI calls, produces duplicate keys, Database counter — overkill, breaks local-first model

**Known Limitations:**
- Key generation counter is not atomic — concurrent CLI processes can generate duplicate keys
- schemaVersion exists but no migration path is implemented when it increments
- Zod validation overhead accumulates when validating hundreds of features at startup

**Success Criteria:** All packages import Feature types and validateFeature() from this package, invalid feature.json files fail with clear errors, and generateFeatureKey() produces unique correctly formatted keys.

**Tags:** schema, zod, types, validation, keygen

---

### feat-2026-019 — Feature Priority — Ordering and Importance Signalling

**Status:** frozen
**Parent:** feat-2026-015

**Problem:** Features render in insertion order with no semantic meaning — visitors can't tell which are foundational vs incidental, and tools can't sort siblings meaningfully.

**Analysis:**
Priority is an integer 1–5 (1 = highest) controlling sibling order in every rendering surface: CLI lineage tree, MCP get_lineage output, and web app tree view. Features without priority sort last (treated as 9999 internally). Priority is intentionally separate from completeness score: score measures documentation quality; priority measures sibling importance.

**Implementation:**
priority: z.number().int().min(1).max(5).optional() added to FeatureSchema in both lac-cli and lifeascode feature-schema packages. DB column: smallint('priority') with idx_features_priority index. Migration: 0006_add_priority.sql. tRPC setPriority mutation mirrors setScore; list queries ORDER BY priority ASC NULLS LAST, updatedAt DESC. Web app build-tree.ts: sortByPriorityThenDate replaces sortDesc. CLI and MCP sort children by priority before rendering.

**Decisions:**
- **Integer 1–5 over a semantic enum (critical/high/medium/low/trivial)** — Integers sort deterministically with no ambiguity — an enum requires a sort-key mapping anyway and leaves same-level peers in undefined relative order.
  Alternatives considered: Enum — cleaner to read but non-deterministic sort, Float 0.0–1.0 — false precision, no human-scale meaning
- **Sort: priority ASC NULLS LAST, then updatedAt DESC** — Unset features fall to the end rather than the front — opt-in semantics, with recency breaking ties so active work surfaces first.
  Alternatives considered: NULLS FIRST — forces all legacy features to the top, breaking existing trees
- **Add priority to feature-schema, db schema, validators, and all rendering surfaces atomically** — A half-implemented field is worse than no field — schema, CLI, MCP, and web app must all agree on the same contract simultaneously.
  Alternatives considered: Incremental rollout — creates a window where the field exists but isn't used anywhere

**Known Limitations:**
- Priority without bounds breaks sibling sort
- No linting rule enforces priority range

**Success Criteria:** Running lac lineage feat-2026-001 shows children in priority order, the web app tree renders siblings sorted by priority, and features without priority sort last.

**Tags:** priority, ordering, schema, ux, meta

---

## Domain: server

### feat-2026-010 — lac-lsp — Language Server

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Without a language server, every client re-walks the repo independently on each request, leading to duplicate work and stale data.

**Analysis:**
A dual-protocol server — LSP over stdio for editor clients and a REST + SSE HTTP API on localhost:7474 for browser, CI, and web app clients. Maintains an in-memory feature index kept live via chokidar file watching, shared across both protocols from a single process.

**Implementation:**
LacLspServer.ts wires together the LSP connection, the HTTP server, and FeatureIndex. FeatureIndex.ts maintains an in-memory map rebuilt on start and patched on chokidar file change events. LSP handlers implement codeLens, hover, diagnostics, definition, and workspace symbols. HttpServer.ts registers REST routes and the SSE /events endpoint. Mode selected via CLI args at startup.

**Decisions:**
- **Dual-protocol: LSP stdio + HTTP on :7474** — Editor clients speak LSP; browser and CI clients speak HTTP — running both from one process shares the same index and file watcher.
  Alternatives considered: LSP only — excludes non-editor clients, HTTP only — misses deep editor integration
- **In-memory index with chokidar file watching** — Feature sets are small enough for in-memory sub-millisecond queries; file watching keeps the index live without polling.
  Alternatives considered: SQLite — persistent but adds migration complexity, No index, always scan — too slow for frequent editor requests
- **SSE for real-time updates over WebSockets** — SSE is unidirectional, simpler to implement and proxy — the use case is inherently server-to-client broadcast.
  Alternatives considered: WebSockets — bidirectional, more complex, not needed here

**Known Limitations:**
- In-memory index lost on crash — all clients must handle reconnection
- HTTP CORS allows wildcard origin — security risk on shared networks
- SSE late subscribers miss all prior events — no event replay

**Success Criteria:** `lac-lsp --http-only --workspace /path/to/repo` starts, responds to GET /health with a feature count, and GET /features returns all feature.json files found.

**Tags:** lsp, http, server, indexer, sse

---

## Domain: tooling

### feat-2026-025 — Tool path not resolved on Windows

**Status:** frozen
**Parent:** feat-2026-023

**Problem:** Relative paths passed to MCP tools fail on Windows due to backslash normalization

**Analysis:**
The lac-mcp server uses Node's path.resolve() to normalize paths, but on Windows, relative paths with backslashes are mishandled when mixed with the forward-slash conventions assumed throughout the codebase. The bug surfaces in resolvePath() — a shared utility called by every tool handler that accepts a path argument.

**Implementation:**
McpBugTrace.tsx renders the 10-tool call sequence from the parent session (feat-2026-023) that produced this child, mirroring McpChild.tsx structure but capturing the new tools: get_feature_status, roadmap_view, spawn_child_feature, feature_changelog, cross_feature_impact, and audit_decisions. Injected into FeatureCard when featureKey === 'feat-2026-025'.

**Decisions:**
- **Track the Windows path bug as a child feature rather than an inline annotation on the parent** — Bugs requiring investigation and a discrete fix deserve their own lifecycle — spawn_child_feature exists precisely for this, giving the bug its own statusHistory and surfacing it if it rots.
  Alternatives considered: Add a knownLimitations entry on the parent — loses traceability of the fix, Open a GitHub issue only — external tracker not linked to provenance
- **Reuse the McpChild.tsx trace component pattern for the bug child** — The trace format is already styled and understood by readers — consistency across feat-2026-023, 024, and 025 reinforces it as a convention rather than a one-off.
  Alternatives considered: Plain prose implementation field — loses step-by-step call visibility

**Known Limitations:**
- The actual Windows path fix is not yet implemented — this feature documents triage, not the patch
- isNew badges reflect novelty relative to feat-2026-024, not an absolute distinction

**Success Criteria:** McpBugTrace.tsx renders correctly inside the feat-2026-025 FeatureCard with all 10 tool calls shown with accurate args, results, and NEW badges.

**Tags:** mcp, ai-assisted, authoring, lac, claude

---

### feat-2026-023 — MCP-Assisted Feature Authoring

**Status:** frozen
**Parent:** feat-2026-001
**Children:** feat-2026-025, feat-2026-026

**Problem:** Writing feature.json files by hand is friction-heavy — when Claude has MCP tool access, it can read context, generate field values, and write them back, turning provenance capture into a side-effect of the conversation.

**Analysis:**
The lac-mcp server exposes the LAC workspace as MCP tools that let Claude act as a provenance co-author — scanning existing features for context, generating analysis grounded in actual code, and persisting results to disk. This feature is itself a live demonstration: created entirely through MCP tool calls during a Claude Code session. It has since spawned three children (024, 025, 026) that document progressively deeper uses of the toolchain: full tool surface, a Windows bug fix, and a full freeze-and-commit session.

**Implementation:**
McpAuthoring.tsx renders the original 4-step tool call trace that created this feature. McpBugTrace.tsx (in bugs/tool-path-resolution) renders the trace for the 025 bug child. McpClaudeSession.tsx (in mcp-claude-session) renders the 12-step freeze session trace for child 026. The feature.json was created via mcp__lac__create_feature and patched via mcp__lac__write_feature_fields. Three child features now extend the story.

**Decisions:**
- **Place the feature under src/mcp-authoring/ as a standalone directory** — The feature documents an AI-assisted authoring workflow, not a UI component or data slice — its own folder keeps it discoverable without coupling to an existing domain.
  Alternatives considered: Nest under src/integration/ — different concern, the Vite glob pipeline, Nest under src/ecosystem/lac-mcp/ — that documents the package, not the workflow
- **Status set to active rather than frozen (original session)** — MCP-assisted authoring was evolving — fill_feature and generate_from_feature tools were not yet exercised in this showcase, so active signalled more to demonstrate.
  Alternatives considered: frozen — premature; full tool surface hadn't been shown yet
- **Spawn three children rather than extending 023 with more trace entries** — Each child documents a distinct authoring scenario — full tool surface (024), Windows bug resolution (025), freeze session (026). Keeping them separate preserves addressability and lineage navigation.
  Alternatives considered: Append traces to McpAuthoring.tsx inline — loses per-scenario addressability and makes the card unreadably long

**Known Limitations:**
- featureKey not auto-incremented by create_feature — corrected manually via write_feature_fields
- Tool call trace lives only in prose — no structured replay log exists

**Success Criteria:** The feature.json exists on disk, was created entirely through MCP tool calls, renders correctly in the running app, and its implementation field accurately describes how it was produced.

**Tags:** mcp, ai-assisted, authoring, lac, claude

---

### feat-2026-024 — The Loop Closes — MCP Full Tool Surface

**Status:** frozen
**Parent:** feat-2026-023

**Problem:** feat-2026-023 proved MCP tool calls could author a feature, but only four tools fired and the key misfired — this child demonstrates the complete AI-authored provenance loop with the full toolchain.

**Analysis:**
feat-2026-023 was a proof of concept; this feature runs the same experiment with the updated lac-mcp that now exposes fill_feature, generate_from_feature, get_lineage, blame_file, and lint_workspace. The result is a fully automated provenance loop: Claude reads context, fills semantic fields, checks lineage, lints the workspace, and generates a display component — all without the developer touching a file.

**Implementation:**
McpChild.tsx renders the full 7-step tool call trace that produced this feature, with a 'NEW' badge on tools that didn't exist when feat-2026-023 was authored. Injected into the FeatureCard expanded section when featureKey === 'feat-2026-024'. The feature.json was scaffolded via create_feature, enriched via fill_feature, lineage-verified via get_lineage, workspace-validated via lint_workspace, and this component generated via generate_from_feature.

**Decisions:**
- **Use fill_feature instead of write_feature_fields for semantic content** — fill_feature reads surrounding source files and generates grounded field values in one call — write_feature_fields is a raw patch that just persists whatever Claude already has in context.
  Alternatives considered: write_feature_fields with manually crafted content — what feat-2026-023 did, bypasses the read-then-generate loop, Leave fields empty and call fill_feature later — trace card would be incomplete on first render
- **Call get_lineage immediately after create_feature** — Confirms the parent-child link is live before any further writes — catches key collisions like the one in feat-2026-023 before they cascade.
  Alternatives considered: Skip lineage check — blind to key conflicts until the app renders wrong
- **Call lint_workspace at the end of the session** — Validates the whole workspace, not just the new feature — catches drift in sibling features the session may have touched.
  Alternatives considered: Lint only the new feature — faster but misses cross-feature regressions
- **generate_from_feature produces the trace component, not hand-authoring** — The whole point of this child is to close the loop — the component rendering the trace should itself be a generated artifact, not hand-written prose.
  Alternatives considered: Hand-write the component like feat-2026-023 — self-defeating for a feature about AI generation

**Known Limitations:**
- Counter misfire on create_feature is a known bug — .lac/counter was out of sync
- generate_from_feature output requires minor post-processing for project-specific CSS class names
- blame_file called but workspace has only one commit — output was minimal

**Success Criteria:** The feature.json was produced entirely through MCP tool calls, the trace card renders with all 7 steps annotated, NEW badges correctly flag tools unavailable during feat-2026-023, and lint_workspace passes.

**Tags:** mcp, ai-assisted, authoring, lac, claude, full-loop, generation

---

### feat-2026-026 — Claude + MCP — Freeze the Whole Ecosystem

**Status:** frozen
**Parent:** feat-2026-023

**Problem:** After three sessions adding features and demos, the workspace has active and draft features that haven't been frozen — this child documents the MCP tool calls Claude used in a single session to read context, resolve stale fields, advance every feature to frozen, and commit the whole ecosystem.

**Analysis:**
The workspace accumulated three active/draft features across multiple sessions — 023 (active, stale), 024 (active, no statusHistory), 025 (draft). This feature documents the MCP-guided session where Claude read context on each, resolved stale annotations, advanced 025 through draft→active→frozen, filled missing fields on 024, and froze 023 and 024 — all without opening a single file manually. The session also produced this feature itself, closing the authoring loop one level deeper.

**Implementation:**
McpClaudeSession.tsx renders the 9-step tool call trace that produced this session: roadmap orientation, read_feature_context on each active/draft feature, write_feature_fields for stale resolution, advance_feature calls for each transition, and the spawn that created this feature. NEW badges mark tools used for the first time in this session. Injected into the FeatureCard expanded section when featureKey === 'feat-2026-026'.

**Decisions:**
- **Resolve 023 stale fields before advancing any sibling features** — 023 is the parent — its stale analysis and decisions would invalidate the lineage story if left unresolved while children freeze around it.
  Alternatives considered: Freeze children first, then fix parent — parent would show stale annotations in the rendered card while children are already frozen
- **Advance 025 through active before freezing, not directly from draft** — The schema enforces draft→active→frozen; skipping active would violate the transition guard and confuse the statusHistory timeline.
  Alternatives considered: Patch status directly in JSON — bypasses validation and loses the statusHistory entry
- **Document this session as feat-2026-026, a child of 023** — The session itself is a provenance artifact — spawning it as a child of 023 keeps the full MCP authoring story navigable via lineage, not just readable in a README.
  Alternatives considered: Inline the session trace into 023's implementation — loses addressability and conflates two distinct sessions

**Known Limitations:**
- Trace is authored from Claude's in-context memory of the session — not a machine-captured replay log
- advance_feature for 025 required two calls (draft→active, then active→frozen) which adds ceremony for a bug fix with no code changes

**Success Criteria:** All four features (023, 024, 025, 026) reach frozen status in a single session, the workspace lint passes, this feature's trace card renders the full 9-step sequence with correct NEW badges, and the commit lands on GitHub triggering a Vercel redeploy.

**Tags:** mcp, ai-assisted, authoring, lac, claude, freeze, lifecycle

---

## Domain: ux

### feat-2026-021 — Obsidian-style Graph View

**Status:** frozen
**Parent:** feat-2026-005

**Problem:** The tree view shows lineage as an indented list but hides the topology — readers cannot see which features are densely connected, isolated, or form clusters.

**Analysis:**
D3 force simulation positions nodes by repulsion + spring forces along parent/child edges. The graph shares the app's existing focusKey/focus state so both views stay in sync. Node size encodes completeness_pct and status colours map to the warm archival palette.

**Implementation:**
FeatureGraph.tsx uses d3 force simulation (forceLink + forceManyBody + forceCenter + forceCollide) rendered into an SVG. Nodes are coloured by status via CSS custom property values; radius scales 5–14px based on completeness_pct. Clicking a node calls onNodeClick(featureKey) which sets the App's focusKey. Pan and zoom handled by d3-zoom on the SVG element.

**Decisions:**
- **Reuse the existing focusKey state rather than a separate graph-selection concept** — The app already has a working focus mechanism with URL sync and breadcrumb — sharing it means clicking a graph node and switching to tree view highlights the same feature.
  Alternatives considered: Separate selectedKey for graph — would duplicate URL param and breadcrumb logic
- **Dark warm background for the graph canvas (#1C1714)** — The Obsidian graph idiom reads best on dark background — using the --text colour preserves the archival palette rather than reaching for a generic dark.
  Alternatives considered: Light cream background — nodes washed out and edges invisible, Pure black — breaks the warm aesthetic
- **View toggle (tree / graph) in the section header, not a separate route** — The app has no router — a toggle button is the minimal change; restructuring the app for one mode switch is not warranted.

**Known Limitations:**
- No ResizeObserver — graph doesn't reflow on window resize without page reload
- features.find() is O(n) per D3 hover event — should be a pre-built Map for performance at scale
- completeness_pct not on the Feature type — all nodes default to radius 50, same size regardless of completeness

**Success Criteria:** A 'Graph' toggle replaces the tree with a force-directed graph where nodes are draggable, hovering highlights edges, clicking a node focuses it, and 'Tree' returns to the list.

**Tags:** graph, d3, lineage, visualisation, obsidian, force-directed

---

### feat-2026-005 — Lineage Tree and Story Focus

**Status:** frozen
**Parent:** feat-2026-003
**Children:** feat-2026-014, feat-2026-021

**Problem:** Visitors have no way to understand parent/child relationships visually or skip sub-stories they don't care about — the app forces linear scroll through everything.

**Analysis:**
Parent features act as chapter headings with collapse affordances that hide entire sub-trees in one click. Collapse state lives in React component state (not URL) so it resets on reload — intentional, since the default experience should show everything. A collapsed parent shows a child-count badge so readers know what they're skipping.

**Implementation:**
Collapse state is a Set<string> of collapsed featureKeys in App component state, initialised with every key that has children so the tree starts fully collapsed. visibleTree walks the full tree and omits nodes whose ancestor is in collapsedKeys. The collapse toggle lives in .card-gutter to the left of the card and appears on any FeatureCard with descendantCount > 0.

**Decisions:**
- **Collapse entire sub-tree when a parent is collapsed, not just direct children** — A reader skipping a story wants to skip the whole thread — collapsing only direct children forces repeated clicks and leaves grandchildren visible.
  Alternatives considered: Collapse one level at a time — tedious for deep trees, Hide button per card — no sense of the thread being skipped
- **Ephemeral collapse state (component state, not URL or localStorage)** — The default experience should always show the full story — persisting collapsed state would hide content from returning visitors without them realising it.
  Alternatives considered: localStorage — risks permanently hiding content, URL params — shareable but adds complexity for a simple reading preference
- **Child-count badge on collapsed parents** — Readers need to know what they're skipping — a badge like '▸ 3' makes the collapse feel intentional rather than like missing content.
  Alternatives considered: No badge — ambiguous, reader may think tree is shallow, Expand/collapse all global toggle — too broad for v1
- **Collapsed state hides child cards only — the parent card always shows its full content (revised by feat-2026-016)** — Originally the card minimised to title-only when collapsed, but feat-2026-016 removed this because it confused readers who expected to see what they were skipping.
  Alternatives considered: Hide problem/tags/spawn-reason on collapsed parent — made collapsed cards feel like broken stubs

**Known Limitations:**
- Collapse state resets on reload — carefully curated views are lost on refresh
- No keyboard shortcut to collapse/expand a sub-tree
- Child-count badge counts only direct children, not the full recursive depth

**Success Criteria:** Any feature with children shows a collapse toggle; clicking it hides the entire sub-tree with a hidden-count badge, and clicking again restores them.

**Tags:** lineage, tree, collapse, ux, navigation

---

### feat-2026-027 — Feature JSON Viewer — Inline Code Toggle on Cards

**Status:** frozen
**Parent:** feat-2026-016

**Problem:** No way to inspect the raw feature.json from the UI — developers and curious users have no quick path from a card to its underlying structured data. The "show children" and "focus" toggles sit on each card with no equivalent for the data layer.

**Analysis:**
This feature adds a per-card JSON inspection toggle to the existing card action row — sitting alongside the 'show children' and 'focus' controls introduced in feat-2026-016. Each card independently tracks a boolean open/closed state so multiple viewers can be expanded simultaneously without global side-effects. When toggled open, the card renders the full feature.json payload in a styled code block below the card header, using a monospace font and a dark editor-style background to signal 'this is data, not prose'. The toggle button uses a compact icon or short label (e.g. `{ }`) to keep the action row uncluttered. State lives locally in the card component via a simple useState hook — no context or global store involvement. The JSON is rendered read-only via a <pre><code> block with JSON.stringify(feature, null, 2) formatting; no external editor library is required. The panel animates open/closed to avoid a jarring layout shift. This approach deliberately avoids pulling in Monaco or CodeMirror, keeping the bundle lean while still delivering a clear developer-oriented affordance. The feature is scoped to display only — no editing, no clipboard, no diffing — keeping first-pass complexity minimal.

**Implementation:**
Add a `jsonOpen` boolean to each card's local state (useState). Render a third icon button in the existing action row after 'show children' and 'focus'. On toggle, conditionally render a collapsible panel containing <pre><code className='language-json'>. Populate with JSON.stringify(featureData, null, 2). Style the panel with a dark background, monospace font, small text size, and a subtle top border to visually separate it from the card body. Wrap in a CSS transition (max-height or framer-motion collapse) for smooth open/close. The toggle is fully independent per card — no lifted state needed. Pass the raw featureData object down from wherever the card already receives it (no new fetch required).

**Decisions:**
- **Local useState per card rather than global/context state** — Each card is already a self-contained unit; lifting toggle state would add unnecessary complexity and couple cards together. Independent toggles mean multiple JSONs can be open at once without coordination.
  Alternatives considered: global viewer state via context, URL-param driven open state
- **Read-only <pre><code> block instead of a full code editor (Monaco/CodeMirror)** — The goal is inspection, not editing. A full editor adds ~300KB+ to the bundle and brings IME/focus complexity. A styled pre block is zero-dependency and sufficient for JSON display.
  Alternatives considered: Monaco Editor, CodeMirror 6, react-json-view
- **Inline collapsible panel below card header, not a modal or drawer** — Keeps the user in spatial context — they see the card label and its JSON together without a layer change. Modal would break the scannable tree layout.
  Alternatives considered: modal overlay, side drawer, tooltip popover
- **Position toggle as third action in existing action row (after show-children, focus)** — Consistent with the established left-side actions pattern from feat-2026-016. Avoids introducing a new affordance zone and keeps all card controls discoverable in one spot.
  Alternatives considered: separate info icon in card header, right-click context menu

**Known Limitations:**
- No syntax highlighting — JSON is rendered as plain monospace text; colour tokens would require a library or a custom regex highlighter
- No copy-to-clipboard button in initial scope; power users will need to select-all manually
- Large feature.json files (e.g. ones with long analysis text) produce tall panels that push sibling cards far down — no truncation or virtual scroll implemented
- Mobile action row becomes crowded with three toggle buttons; no responsive collapse strategy defined yet

**Success Criteria:** Every feature card in the lineage tree and focus view shows a '{ }' toggle button alongside 'show children' and 'focus'. Clicking it reveals the full formatted feature.json in a dark code-style panel; clicking again collapses it cleanly. Multiple cards can have their viewers open simultaneously with no visual interference between them.

**Tags:** json-viewer, code-toggle, card, ux, developer-tools, navigation, focus

---

### feat-2026-014 — Story Navigation and Focus Mode

**Status:** frozen
**Parent:** feat-2026-005
**Children:** feat-2026-016

**Problem:** Once readers drill into a child story, there's no quick way to hop back up, collapse sibling noise, or isolate just the slice of the tree they care about.

**Analysis:**
Three navigation gestures address three reader postures: 'hop up' via breadcrumb, 'collapse thread' from feat-2026-005, and 'focus mode' which dims or hides everything outside the focal feature + its ancestors + direct children. Together they let readers navigate a feature tree by chapter, not by scrolling the full manuscript.

**Implementation:**
Focus mode is a URL query param (?focus=<featureKey>) read in App.tsx via URLSearchParams and synced back with history.replaceState. When focusKey is set, all non-collapsed cards remain in the DOM; a focusContextKeys Set (ancestors + direct children) drives per-card focusState prop: 'focused', 'context', or 'dimmed'. The breadcrumb walks the ancestor chain and each crumb calls setFocusKey. An '← all' button clears focusKey.

**Decisions:**
- **Focus mode dims non-focal cards in place rather than filtering the visible set** — Keeping all cards in the DOM preserves spatial layout and peripheral context — filtering collapsed the tree too aggressively and removed useful context.
  Alternatives considered: Filter visibleTree to focused + ancestors + children only — removed spatial context, felt like a mode switch
- **Breadcrumb trail as the primary 'hop up' affordance** — A breadcrumb renders the full ancestor path and lets readers click any ancestor to re-focus — one click to go up, or skip directly to root.
  Alternatives considered: Back button — only goes to last visited node, not tree parent, Up arrow button — doesn't show the full path
- **Focus state lives in URL (query param ?focus=feat-2026-014)** — Unlike collapse state, focus is a meaningful reading position worth sharing or bookmarking.
  Alternatives considered: Component state only — not shareable, resets on reload, localStorage — persists but not shareable
- **history.replaceState instead of pushState for URL sync** — Focus changes are navigation within the same view, not new history entries — replaceState keeps the back button pointing to the referring page.
  Alternatives considered: pushState — adds back-button focus history; useful but complex for v1

**Known Limitations:**
- Breadcrumb can get long for deeply nested features — no truncation strategy defined
- Focus mode via ?focus= in URL may confuse visitors who land on a shared link
- Collapse-all scoped to focused sub-tree adds complexity to the collapse state shape

**Success Criteria:** A reader can click 'focus' on any feature, see only that feature + ancestors + direct children, navigate up via breadcrumb, and share the URL to give someone else the same focused view.

**Tags:** navigation, focus, breadcrumb, ux, url-state

---

### feat-2026-020 — Focus mode: children inherit focused state

**Status:** frozen
**Parent:** feat-2026-016

**Problem:** When a feature is focused, its direct children appeared grey (55% opacity) instead of fully visible, making it harder to read the focused thread.

**Analysis:**
In focus mode, the app assigns four states to each card: 'focused' (full opacity), 'context' (55%), 'dimmed' (22%), or 'normal'. Previously, both ancestors and direct children got 'context' — both appeared grey. Direct children form the immediate thread and should render at full opacity alongside the focused parent.

**Implementation:**
Split focusContextKeys into two separate memos: focusAncestorKeys (ancestors, stay at 'context') and focusChildKeys (direct children, promoted to 'focused'). Updated the focusState ternary so node.featureKey === focusKey || focusChildKeys.has(node.featureKey) maps to 'focused', with only ancestors falling back to 'context'.

**Decisions:**
- **Split focusContextKeys into two separate memos — focusAncestorKeys and focusChildKeys — rather than a single combined set** — Splitting keeps the change minimal and co-located with the code that consumes each set — a single set with a type discriminant would require restructuring the focusState ternary more invasively.
  Alternatives considered: Single focusContextKeys with a { key, role } shape — requires a Map instead of a Set, adding allocations on every render
- **Promote children to 'focused' state (same class as the clicked card) rather than a new intermediate state** — Reusing the existing 'focused' CSS class means no new styling is needed and reinforces that parent + children form a single readable unit.
  Alternatives considered: New 'child' CSS class at ~80% opacity — adds a fourth visual level, indistinguishable from 'context' at a glance
- **Only direct children are promoted — grandchildren and deeper remain dimmed** — Promoting the full subtree would fill the viewport with full-opacity cards, defeating focus mode's purpose — exploring deeper descendants requires a separate focus click.
  Alternatives considered: Promote all descendants — too much noise, collapses the focused/context distinction for deep trees

**Known Limitations:**
- Grandchildren at depth 2+ still render dimmed — deep threads require multiple focus clicks
- A focused feature with 8+ children fills the viewport, reducing focus contrast
- Ancestors at 55% opacity feel more faded than children at 100%, slightly inverting reading-order intuition

**Success Criteria:** When a feature is focused, its direct children render at full opacity alongside the focused card, while ancestors appear at 55% and all other features dim to 22%.

**Tags:** focus-mode, ux, feature-tree

---

### feat-2026-016 — Immersive Focus Mode — Full-Page Card and Left-Side Actions

**Status:** frozen
**Parent:** feat-2026-014
**Children:** feat-2026-020, feat-2026-027

**Problem:** Focus mode is not immersive enough: sibling cards stay visually present at full weight, the focused card doesn't claim the freed space, and action buttons on the right edge are easy to miss.

**Analysis:**
Two independent problems compound: the freed whitespace from hidden cards is wasted instead of being given to the focused card, and the thread/focus buttons belong near the content's left entry point, not the right edge. The fix expands the focused card to fill the column width and moves buttons to a left gutter. Dimming unfocused cards reinforces the spatial metaphor without removing them from the DOM.

**Implementation:**
FeatureCard accepts a focusState prop ('focused' | 'context' | 'dimmed' | 'normal'). The feature-entry wrapper gets a matching CSS class; transitions on opacity (0.3s ease) handle the visual shift. The focused card gets expanded padding and soft box-shadow, with depth-based marginLeft set to 0 to fill the full column. Buttons live in a .card-gutter flex-col div (40px wide) rendered to the LEFT of the article inside a .card-with-gutter flex wrapper. All parent keys are pre-loaded into collapsedKeys on mount so the tree starts fully collapsed.

**Decisions:**
- **Focused card expands to fill 100% column width; unfocused cards render at reduced opacity (~30–40%) and remain non-interactive** — Full column width makes the spatial shift legible without a modal overlay — the tree structure stays visible in the background, preserving provenance context.
  Alternatives considered: Modal/overlay for focus — hides the tree, breaking the provenance metaphor, CSS zoom on focused card — distorts layout and causes reflow, Colour highlight only — insufficient signal
- **Thread and focus buttons move to the left side of the card in a narrow 40px gutter** — Left-side placement aligns with reading direction — the eye enters a card from the left, so navigation affordances placed there are encountered naturally before the content.
  Alternatives considered: Keep buttons on the right — users report not finding them, Buttons inline with title — clutters the title row, FAB pattern — ambiguous which card it targets
- **Unfocused cards use CSS opacity + pointer-events: none, not display: none** — Keeping them in the DOM lets the reader see the tree shape without being distracted by it — pointer-events: none prevents accidental clicks while ancestors remain reachable via breadcrumb.
  Alternatives considered: display: none — removes context entirely, visibility: hidden — same as display:none for perception, Filter: blur + opacity — adds GPU cost with no benefit
- **All nodes start collapsed on first load; each parent key pre-populated into collapsedKeys state** — Starting everything collapsed reduces overwhelm for fresh visitors and lets them choose which threads to enter via progressive disclosure.
  Alternatives considered: Start all expanded — overwhelming on load, Start only top-level roots expanded — sibling clutter remains, Remember collapse state via sessionStorage — collapsed-by-default is already correct

**Known Limitations:**
- Left gutter reserves 40px per card — may feel tight on narrow viewports despite media query
- opacity values (0.22 dimmed / 0.55 context) are tuned for warm beige — dark mode needs different values
- Ancestors and direct children share 'context' opacity — a future refinement could distinguish them

**Success Criteria:** Activating focus mode causes the targeted card to fill the column, all other visible cards to grey out to ~30% opacity, and thread/focus buttons to appear in a left gutter on every card.

**Tags:** focus, ux, layout, card, navigation, immersive

---

## Domain: web-app

### feat-2026-013 — lifeascode — Web App

**Status:** frozen
**Parent:** feat-2026-006

**Problem:** Teams need a shared dashboard to browse features and view lineage without installing anything locally — the CLI alone doesn't serve non-engineering stakeholders.

**Analysis:**
The web-based LAC dashboard — a Next.js 16 app with Supabase as the database, tRPC for type-safe API calls, and Drizzle ORM for queries. Where the CLI operates on local files, the web app persists features to a database accessible to anyone on the team. Deployed on Vercel.

**Implementation:**
apps/nextjs/ is the Next.js App Router application. The tRPC router in packages/api/src/routers/ exposes procedures for features, search, admin, events, and GitHub integration. packages/db/ contains Drizzle schema and migrations pointing at Supabase Postgres. packages/ui/ is a shared React component library (Tailwind + CVA + Base UI + Lucide). Next.js tag-based cache revalidation is used after mutations.

**Decisions:**
- **tRPC for the API layer** — End-to-end type safety between the Next.js frontend and API package — types flow from router definition to React component with no codegen step.
  Alternatives considered: REST + OpenAPI — requires codegen and loses type inference, GraphQL — more flexible but heavyweight for this use case
- **Supabase Postgres + Drizzle ORM** — Supabase provides managed Postgres with realtime subscriptions; Drizzle gives type-safe queries without Prisma's cold-start overhead.
  Alternatives considered: SQLite (local-only) — no multi-user access, Prisma — heavier, slower cold starts on Vercel edge
- **Separate packages for api, db, ui, auth within the monorepo** — Clear separation of concerns — the API package can be tested independently and the UI library reused across multiple apps.
  Alternatives considered: Everything in apps/nextjs — faster to start but unmaintainable

**Known Limitations:**
- Features in the database and features in git can desync — two separate sources of truth
- Requires Supabase credentials and Vercel deployment — more infrastructure than the local CLI
- tRPC cache revalidation must be manually maintained per mutation — easy to forget

**Success Criteria:** The app deploys to Vercel, connects to Supabase, and displays all features with working search, lineage view, and detail pages returning type-safe responses.

**Tags:** nextjs, supabase, trpc, drizzle, vercel, web

---

## Reconstruction Instructions

Using only the feature specs above (no original source code):

1. Identify the tech stack implied by the decisions and tags
2. Implement each feature in dependency order (parents before children)
3. For each feature, satisfy its Problem, Success Criteria, and honour its Decisions
4. Respect Known Limitations — do not over-engineer around them unless specified
5. The result should pass all Success Criteria when run
