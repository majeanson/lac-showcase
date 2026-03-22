const toolCalls = [
  {
    tool: 'mcp__lac__search_features',
    args: { query: 'feat-2026-023' },
    result: 'Found 1 feature: feat-2026-023 — MCP-Assisted Feature Authoring (active)',
    note: 'Located the parent. Confirmed it exists, is active, and has no children yet. This call is about to change that.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__create_feature',
    args: { dir: 'src/mcp-child', title: 'The Loop Closes — MCP Full Tool Surface', status: 'active' },
    result: 'Created feature.json (key: feat-2026-002 ← misfire)',
    note: 'Counter was at 2. Workspace has 23 features. Classic. The key gets corrected in step 05 — but this time we catch it in the *next call*, not after the whole session.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__get_lineage',
    args: { featureKey: 'feat-2026-002' },
    result: '⊙ feat-2026-002 (active) — The Loop Closes — MCP Full Tool Surface',
    note: 'No parent shown — confirms the lineage field is empty and the key is wrong. Called immediately after create so the misfire costs one extra write_feature_fields call, not a confused app.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__read_feature_context',
    args: { path: 'src/mcp-authoring' },
    result: 'All fillable fields populated. Full context returned (feat-2026-023 + McpAuthoring.tsx).',
    note: 'Read the parent in full before writing anything semantic. Grounded the analysis, decisions, and this trace in the actual code rather than vibes.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__write_feature_fields',
    args: { path: 'src/mcp-child', fields: '12 fields' },
    result: '✓ Wrote featureKey (→ feat-2026-024), title, status, analysis, decisions (4), implementation, knownLimitations (3), tags (7), lineage, successCriteria, domain, priority',
    note: 'Key corrected. All semantic content generated in-context from the parent read and written in one atomic call. No editor opened. No copy-paste.',
    isNew: false,
  },
  {
    tool: 'mcp__lac__lint_workspace',
    args: {},
    result: '24 passed, 0 failed — 24 features checked',
    note: 'Whole workspace green. Not just this feature — every feature.json in the repo validated against the canonical schema. The counter misfire did not break anything.',
    isNew: true,
  },
  {
    tool: 'mcp__lac__generate_from_feature',
    args: { path: 'src/mcp-child', type: 'component', dryRun: true },
    result: 'Error: ANTHROPIC_API_KEY not set — fell back to in-context generation',
    note: 'Tool attempted. API key not wired into .lac/config.json yet. Component written directly by Claude from read_feature_context output. The loop is 6/7 automated. Close enough.',
    isNew: true,
  },
]

export default function McpChild() {
  return (
    <div className="mcp-trace">
      <div className="mcp-trace-label">
        tool call trace — feat-2026-024, child of feat-2026-023
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
