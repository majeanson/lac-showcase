const toolCalls = [
  {
    tool: 'mcp__lac__search_features',
    args: { query: 'showcase' },
    result: 'Found 1 feature: feat-2026-004 — What is Life-as-Code',
    note: 'Scanned existing features to avoid key collisions and understand current coverage.',
  },
  {
    tool: 'mcp__lac__create_feature',
    args: { dir: 'src/mcp-authoring', title: 'MCP-Assisted Feature Authoring', status: 'active' },
    result: 'Created feature.json (key: auto — misfired)',
    note: 'Scaffolded the feature shell. Auto-key collided with feat-2026-001; resolved in the next call.',
  },
  {
    tool: 'mcp__lac__write_feature_fields',
    args: { fields: '10 fields' },
    result: '✓ Wrote featureKey, analysis, decisions, implementation, tags, domain, priority, lineage, successCriteria, knownLimitations',
    note: 'Claude generated all semantic content and patched it in one call. No editor opened.',
  },
  {
    tool: 'mcp__lac__read_feature_context',
    args: { path: 'src/mcp-authoring' },
    result: 'All fillable fields populated. Full context returned.',
    note: 'Used as the sole input to generate this component.',
  },
]

export default function McpAuthoring() {
  return (
    <div className="mcp-trace">
      <div className="mcp-trace-label">tool call trace — how this feature was authored</div>
      <ol className="mcp-trace-list">
        {toolCalls.map(({ tool, args, result, note }, i) => (
          <li key={i} className="mcp-trace-item">
            <div className="mcp-trace-header">
              <span className="mcp-trace-index">{String(i + 1).padStart(2, '0')}</span>
              <code className="mcp-trace-tool">{tool}</code>
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
