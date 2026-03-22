const toolCalls = [
  {
    tool: 'mcp__lac__extract_feature_from_code',
    args: { path: 'src/mcp-authoring' },
    result: 'feature.json already exists — use read_feature_context instead',
    note: 'First call of the session. The extract was already done in a prior session; the tool caught it cleanly and redirected. No duplicate created.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__get_feature_status',
    args: { path: 'src/mcp-authoring' },
    result: 'feat-2026-023 | status: active | missing: none | stale: none | next: advance_feature(frozen)',
    note: 'Orientation before any action. Zero guesswork about where the feature stood — status, gaps, and exact next step returned in one call.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__roadmap_view',
    args: {},
    result: '⊙ ACTIVE (2): feat-2026-023, feat-2026-024 | ❄ FROZEN (22) | ✗ DEPRECATED (0)',
    note: 'Full workspace snapshot. feat-2026-023 visible under ACTIVE with P2 priority and no children yet. Used to confirm no duplicate existed before spawning.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__spawn_child_feature',
    args: {
      parentPath: 'src/mcp-authoring',
      dir: 'src/mcp-authoring/bugs/tool-path-resolution',
      title: 'Tool path not resolved on Windows',
      spawnReason: 'bug: Windows path separator breaks resolvePath',
    },
    result: '✓ Spawned feat-2026-025 under feat-2026-023. Parent lineage.children patched.',
    note: "This call created this feature. The parent's children array was updated atomically — no manual JSON editing. The bug is now a first-class tracked entity.",
    isNew: true,
  },
  {
    tool: 'mcp__lac__feature_changelog',
    args: { path: 'src/mcp-authoring' },
    result: 'feat-2026-023 | (unknown) ⊙ active | ↳ spawned child: feat-2026-025 | 2 decisions listed',
    note: 'Confirmed the spawn was recorded in the parent changelog. Status transitions and child links in one timeline view.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-authoring', to: 'frozen' },
    result: '✓ feat-2026-023 active → frozen',
    note: 'All required fields were present — the tool validated and transitioned without asking for anything. statusHistory[0] written automatically.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__advance_feature',
    args: { path: 'src/mcp-authoring', to: 'active', reason: 'Scope expanded: add streaming support' },
    result: '✓ feat-2026-023 frozen → active | reopen + stale-review annotations written',
    note: 'Reopen requires a reason — enforced by the tool. Two annotations were persisted: one for the reopen event, one flagging which fields are now stale.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__read_feature_context',
    args: { path: 'src/mcp-authoring' },
    result: '⚠ Stale fields: analysis, implementation, decisions | Full feature.json + McpAuthoring.tsx returned',
    note: 'Stale warning surfaced at the top, before any content. The reopen annotation triggered it. This is how the system keeps provenance honest after scope changes.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__cross_feature_impact',
    args: { file: 'src/mcp-authoring/McpAuthoring.tsx' },
    result: '3 features reference this file — feat-2026-001, feat-2026-002, feat-2026-024',
    note: 'Blast radius before any refactor. Three frozen or active features depend on McpAuthoring.tsx. Changes to the file would need to be coordinated across all three.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__audit_decisions',
    args: {},
    result: '2 risky-language flags | 4 possible UX duplicates | feat-2026-025 in missing-decisions list | 23 features clean',
    note: "This feature (feat-2026-025) appeared in the missing-decisions list immediately after being spawned — exactly as expected. The audit surfaces it so it doesn't rot as a permanent draft.",
    isNew: true,
  },
]

export default function McpBugTrace() {
  return (
    <div className="mcp-trace">
      <div className="mcp-trace-label">
        tool call trace — feat-2026-025, child of feat-2026-023
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
