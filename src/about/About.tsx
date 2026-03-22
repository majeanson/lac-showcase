const ecosystem = [
  {
    key: '@majeanson/lac',
    label: 'CLI',
    desc: 'The primary tool. Scaffold features, fill them with AI, inspect lineage. Runs via npx.',
    href: 'https://www.npmjs.com/package/@majeanson/lac',
    linkLabel: 'npm →',
  },
  {
    key: 'lac-lens',
    label: 'VS Code extension',
    desc: 'CodeLens annotations, hover cards, and a sidebar explorer — wired to the same .lac/ folder.',
    href: 'https://marketplace.visualstudio.com/items?itemName=majeanson.lac-lens',
    linkLabel: 'marketplace →',
  },
  {
    key: 'lac-mcp',
    label: 'MCP server',
    desc: 'Exposes your feature workspace to Claude Desktop, Cursor, and any MCP-compatible AI host.',
    href: 'https://github.com/majeanson/lac/tree/main/packages/lac-mcp',
    linkLabel: 'GitHub →',
  },
  {
    key: 'lifeascode',
    label: 'Web app',
    desc: 'Browse features, visualise lineage trees, follow a timeline of decisions. Built on Next.js + Supabase.',
    href: 'https://lifeascode-ruddy.vercel.app/',
    linkLabel: 'live demo →',
  },
  {
    key: 'feature-schema',
    label: 'Canonical schema',
    desc: 'Single Zod source of truth shared across CLI, LSP, MCP, and web app.',
    href: 'https://github.com/majeanson/lac/tree/main/packages/feature-schema',
    linkLabel: 'GitHub →',
  },
  {
    key: 'lac-lsp',
    label: 'Language server',
    desc: 'Real-time validation of .lac/ YAML files against the schema in any LSP-compatible editor.',
    href: 'https://github.com/majeanson/lac/tree/main/packages/lac-lsp',
    linkLabel: 'GitHub →',
  },
]

export default function About() {
  return (
    <section className="about-section">
      <div className="about-label">what is this?</div>

      <div className="about-body">
        <p className="about-lead">
          Software decisions get lost. The <em>why</em> behind a feature lives in a
          Slack thread, a forgotten PR comment, or someone's head — until it doesn't.
        </p>

        <p>
          <strong>Life-as-code</strong> is a workflow that treats provenance as a
          first-class artifact. Every feature gets a <code>feature.json</code> that
          lives next to the code: the problem being solved, the decisions made, the
          alternatives considered.
        </p>

        <p>
          This showcase is built with it. Every card below is a real{' '}
          <code>feature.json</code> file in this repo — the app reads itself.
        </p>

        <p>
          Life-as-code ships as a set of tools that wire this workflow into your
          editor, AI host, and CI — so the provenance stays with the code, always.
        </p>

        <div className="about-cta">
          <code className="about-cta-cmd">npx @majeanson/lac init</code>
          <a
            href="https://github.com/majeanson/lac"
            target="_blank"
            rel="noreferrer"
            className="about-link about-link--cta"
          >
            view on GitHub →
          </a>
        </div>
      </div>

      <div className="about-ecosystem">
        <div className="about-ecosystem-label">the toolchain</div>
        <div className="about-ecosystem-grid">
          {ecosystem.map(({ key, label, desc, href, linkLabel }) => (
            <div key={key} className="ecosystem-card">
              <div className="ecosystem-card-header">
                <code className="ecosystem-key">{key}</code>
                <span className="ecosystem-label-badge">{label}</span>
              </div>
              <p className="ecosystem-desc">{desc}</p>
              {href && linkLabel && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="about-link"
                >
                  {linkLabel}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
