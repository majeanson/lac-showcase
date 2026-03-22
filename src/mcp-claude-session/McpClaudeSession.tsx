const toolCalls = [
  {
    tool: 'mcp__lac__roadmap_view',
    args: {},
    result: '⊙ ACTIVE (2): feat-2026-023 [stale], feat-2026-024 | ◌ DRAFT (1): feat-2026-025 | ❄ FROZEN (22)',
    note: 'Session orientation. Three features not yet frozen — two active, one draft. Stale annotation on 023 means fields need review before it can advance. This call determined the full work order for the session.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__get_feature_status',
    args: { path: 'src/mcp-authoring' },
    result: 'feat-2026-023 | status: active | missing: none | stale: analysis, implementation, decisions | next: read_feature_context',
    note: 'Targeted status check on 023. Stale fields confirmed — the reopen annotation from a prior session flagged three fields. Zero ambiguity about what needs to happen before this feature can freeze.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__read_feature_context',
    args: { path: 'src/mcp-authoring' },
    result: '⚠ Stale: analysis, implementation, decisions | Full feature.json + McpAuthoring.tsx + McpBugTrace.tsx returned',
    note: 'Read the parent in full. Stale warning surfaced at the top. The tool returned all source files in the feature folder — McpAuthoring.tsx and McpBugTrace.tsx both included — giving full context for field regeneration.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__spawn_child_feature',
    args: {
      parentPath: 'src/mcp-authoring',
      dir: 'src/mcp-claude-session',
      title: 'Claude + MCP — Freeze the Whole Ecosystem',
      spawnReason: 'scope split: document the freeze-and-commit lifecycle session as a standalone traceable feature',
    },
    result: '✓ Spawned feat-2026-026 under feat-2026-023. Parent lineage.children patched.',
    note: "This feature was born here. The spawn call created the feature.json shell, patched 023's children array atomically, and returned the child path — no JSON editing, no counter arithmetic.",
    isNew: false,
  },
  {
    tool: 'mcp__lac__write_feature_fields',
    args: { path: 'src/mcp-claude-session', fields: '9 fields' },
    result: '✓ Wrote analysis, decisions (3), implementation, successCriteria, tags (7), knownLimitations (2), domain, priority',
    note: 'All semantic fields generated in-context from the session and written in one call. The feature went from a bare shell (title + problem only) to fully populated in a single MCP round-trip.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__write_feature_fields',
    args: { path: 'src/mcp-authoring', fields: 'analysis, implementation, decisions (updated)' },
    result: '✓ Stale fields resolved on feat-2026-023',
    note: '023\'s stale annotation cleared after fields were rewritten to reflect the current three-child state (024, 025, 026). The reopen reason was "add streaming support" — updated implementation now accurately reflects the expanded scope.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-authoring/bugs/tool-path-resolution', to: 'active' },
    result: '✓ feat-2026-025 draft → active',
    note: 'Draft features cannot skip to frozen — the schema enforces the full draft→active→frozen path. One extra call, but the statusHistory timeline stays clean.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-authoring/bugs/tool-path-resolution', to: 'frozen' },
    result: '✓ feat-2026-025 active → frozen',
    note: 'Bug child frozen. knownLimitations and tags were already present from the initial write — no additional fields needed. The transition guard validated and passed in one call.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-child', to: 'frozen' },
    result: '✓ feat-2026-024 active → frozen',
    note: 'feat-2026-024 had all required fields but was never advanced — still active from its creation session. One call to freeze it. statusHistory updated automatically.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-claude-session', to: 'frozen' },
    result: '✓ feat-2026-026 active → frozen',
    note: 'This feature frozen immediately after field fill — no iteration needed. The full lifecycle (spawn → fill → freeze) completed in one session, in one tool call chain.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-authoring', to: 'frozen' },
    result: '✓ feat-2026-023 active → frozen',
    note: 'Parent frozen last. All children (024, 025, 026) frozen first — the lineage is now fully consistent. Workspace goes from 22 → 26 frozen features in a single session.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__lint_workspace',
    args: {},
    result: '26 passed, 0 failed — 26 features checked',
    note: 'Full workspace lint after all transitions. Every feature.json validates against the canonical schema. Zero regressions across the 4 new freezes and 1 spawn.',
    isNew: false,
  },
]

export default function McpClaudeSession() {
  return (
    <div className="mcp-trace">
      <div className="mcp-trace-label">
        tool call trace — feat-2026-026, child of feat-2026-023
      </div>
      <ol className="mcp-trace-list">
        {toolCalls.map(({ tool, args, result, note, isNew }, i) => (
          <li key={i} className="mcp-trace-item">
            <div className="mcp-trace-header">
              <span className="mcp-trace-index">{String(i + 1).padStart(2, '0')}</span>
              <code className="mcp-trace-tool">{tool}</code>
              {isNew && <span className="mcp-trace-badge">NEW</span>}
            </div>
            <div className="mcp-trace-args">
              {Object.entries(args).map(([k, v]) => (
                <span key={k} className="mcp-trace-arg">
                  <span className="mcp-trace-arg-key">{k}</span>
                  <span className="mcp-trace-arg-val">{String(v)}</span>
                </span>
              ))}
            </div>
            <div className="mcp-trace-result">{result}</div>
            <div className="mcp-trace-note">{note}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
