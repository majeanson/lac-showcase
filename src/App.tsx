import { useState, useEffect, useMemo, useRef } from 'react'
import { loadFeatures, buildTree } from './features'
import type { Feature, FeatureNode } from './types'
import About from './about/About'
import { FeatureGraph } from './graph/FeatureGraph'
import './App.css'

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  draft: 'Draft',
  frozen: 'Frozen',
  deprecated: 'Deprecated',
}

// ── Helpers (outside component) ───────────────────────────

function buildChildrenMap(features: Feature[]): Map<string, Feature[]> {
  const map = new Map<string, Feature[]>()
  for (const f of features) {
    const parent = f.lineage?.parent
    if (parent) {
      if (!map.has(parent)) map.set(parent, [])
      map.get(parent)!.push(f)
    }
  }
  return map
}

function countDescendants(key: string, childrenMap: Map<string, Feature[]>): number {
  const children = childrenMap.get(key) ?? []
  return children.reduce(
    (sum, c) => sum + 1 + countDescendants(c.featureKey, childrenMap),
    0,
  )
}

function getAncestors(key: string, byKey: Map<string, Feature>): Feature[] {
  const chain: Feature[] = []
  let current = byKey.get(key)
  while (current?.lineage?.parent) {
    const parent = byKey.get(current.lineage.parent)
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }
  return chain
}

// ── Breadcrumb ─────────────────────────────────────────────

function Breadcrumb({
  ancestors,
  focusKey,
  onFocus,
  onExit,
}: {
  ancestors: Feature[]
  focusKey: string
  onFocus: (key: string) => void
  onExit: () => void
}) {
  return (
    <nav className="breadcrumb" aria-label="Feature lineage">
      <button className="breadcrumb-exit" onClick={onExit}>
        ← all
      </button>
      {ancestors.map((a) => (
        <span key={a.featureKey} className="breadcrumb-item">
          <span className="breadcrumb-sep">/</span>
          <button className="breadcrumb-crumb" onClick={() => onFocus(a.featureKey)}>
            {a.featureKey}
          </button>
        </span>
      ))}
      <span className="breadcrumb-item">
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{focusKey}</span>
      </span>
    </nav>
  )
}

// ── Feature Card ───────────────────────────────────────────

function FeatureCard({
  node,
  descendantCount,
  isCollapsed,
  onCollapse,
  onFocus,
  focusState,
}: {
  node: FeatureNode
  descendantCount: number
  isCollapsed: boolean
  onCollapse: () => void
  onFocus: () => void
  focusState: 'focused' | 'context' | 'dimmed' | 'normal'
}) {
  const [open, setOpen] = useState(false)
  const entryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusState === 'focused' && entryRef.current) {
      entryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusState])

  const hasMore =
    node.analysis ||
    node.implementation ||
    (node.decisions && node.decisions.length > 0) ||
    (node.knownLimitations && node.knownLimitations.length > 0)

  const hasChildren = descendantCount > 0

  const entryClass = [
    'feature-entry',
    node.lineage?.parent ? 'has-parent' : '',
    focusState !== 'normal' ? `feature-${focusState}` : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={entryRef}
      className={entryClass}
      style={{ '--depth': node.depth } as React.CSSProperties}
    >
      <div
        className="card-with-gutter"
        style={{ marginLeft: focusState === 'focused' ? 0 : Math.min(node.depth * 28, 112) }}
      >
        <div className="card-gutter">
          {hasChildren && (
            <button
              className={`thread-toggle${isCollapsed ? ' is-collapsed' : ''}`}
              onClick={onCollapse}
              title={isCollapsed ? `Expand thread (${descendantCount})` : 'Collapse thread'}
            >
              {isCollapsed ? `▸ ${descendantCount}` : `▾ ${descendantCount}`}
            </button>
          )}
          <button
            className="focus-btn"
            onClick={onFocus}
            title="Focus on this story"
          >
            ◎
          </button>
        </div>
        <article
          className={`feature-card status-${node.status}`}
        >
          <div className="card-meta">
          <span className="feature-key">{node.featureKey}</span>
          <span className={`status-badge status-${node.status}`}>
            {STATUS_LABEL[node.status] ?? node.status}
          </span>
          {node.domain && (
            <span className="domain-badge">{node.domain}</span>
          )}
          </div>

          <h2 className="feature-title">{node.title}</h2>
          <p className="feature-problem">{node.problem}</p>

          {node.lineage?.spawnReason && (
            <p className="spawn-reason">↳ {node.lineage.spawnReason}</p>
          )}

          {node.tags && node.tags.length > 0 && (
            <div className="tags">
              {node.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="card-footer-actions">
            {hasMore && (
              <button className="expand-toggle" onClick={() => setOpen((o) => !o)}>
                {open ? '— less' : '+ more context'}
              </button>
            )}
            {hasChildren && (
              <button className="expand-toggle" onClick={onCollapse}>
                {isCollapsed ? '+ show children' : '— hide children'}
              </button>
            )}
            <button className="expand-toggle" onClick={onFocus}>
              {focusState === 'focused' ? '← unfocus' : '⊙ focus'}
            </button>
          </div>

          {open && (
            <div className="expanded-content">
              {node.analysis && (
                <section className="detail-section">
                  <h3>Analysis</h3>
                  <p>{node.analysis}</p>
                </section>
              )}

              {node.implementation && (
                <section className="detail-section">
                  <h3>Implementation</h3>
                  <p>{node.implementation}</p>
                </section>
              )}

              {node.decisions && node.decisions.length > 0 && (
                <section className="detail-section">
                  <h3>Decisions</h3>
                  {node.decisions.map((d, i) => (
                    <div key={i} className="decision">
                      <strong>{d.decision}</strong>
                      <p>{d.rationale}</p>
                      {d.alternativesConsidered && d.alternativesConsidered.length > 0 && (
                        <p className="alternatives">
                          Considered: {d.alternativesConsidered.join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {node.knownLimitations && node.knownLimitations.length > 0 && (
                <section className="detail-section">
                  <h3>Known Limitations</h3>
                  <ul className="limitations-list">
                    {node.knownLimitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </section>
              )}

              {node.successCriteria && (
                <section className="detail-section">
                  <h3>Success Criteria</h3>
                  <p>{node.successCriteria}</p>
                </section>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────

export default function App() {
  const allFeatures = useMemo(() => loadFeatures(), [])
  const fullTree = useMemo(() => buildTree(allFeatures), [allFeatures])

  const byKey = useMemo(
    () => new Map(allFeatures.map((f) => [f.featureKey, f])),
    [allFeatures],
  )

  const childrenMap = useMemo(() => buildChildrenMap(allFeatures), [allFeatures])

  // ── focus state — URL-synced ──────────────────────────────
  const [focusKey, setFocusKey] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('focus'),
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (focusKey) {
      params.set('focus', focusKey)
    } else {
      params.delete('focus')
    }
    const search = params.toString()
    window.history.replaceState(
      null,
      '',
      search ? `${window.location.pathname}?${search}` : window.location.pathname,
    )
  }, [focusKey])

  // ── collapse state — all nodes start collapsed ────────────
  const allParentKeys = useMemo(
    () => new Set(allFeatures.filter((f) => childrenMap.has(f.featureKey)).map((f) => f.featureKey)),
    [allFeatures, childrenMap],
  )

  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => allParentKeys)

  // ── view mode ─────────────────────────────────────────────
  const [view, setView] = useState<'tree' | 'graph'>('tree')

  // When switching to tree with an active focusKey, ensure the card is reachable
  const switchToTree = () => {
    if (focusKey) {
      const ancestors = getAncestors(focusKey, byKey)
      setCollapsedKeys((prev) => {
        const next = new Set(prev)
        next.delete(focusKey)
        for (const a of ancestors) next.delete(a.featureKey)
        return next
      })
    }
    setView('tree')
  }

  const toggleCollapse = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // ── focus context: ancestors (dimmed less) + focused feature's children (fully focused) ─
  const focusAncestorKeys = useMemo((): Set<string> => {
    if (!focusKey) return new Set()
    const ancs = getAncestors(focusKey, byKey)
    return new Set(ancs.map((a) => a.featureKey))
  }, [focusKey, byKey])

  const focusChildKeys = useMemo((): Set<string> => {
    if (!focusKey) return new Set()
    const children = childrenMap.get(focusKey) ?? []
    return new Set(children.map((c) => c.featureKey))
  }, [focusKey, childrenMap])

  // ── visible tree: full tree minus collapsed sub-trees ────
  const visibleTree = useMemo((): FeatureNode[] => {
    const result: FeatureNode[] = []
    for (const node of fullTree) {
      let cur = byKey.get(node.featureKey)
      let hidden = false
      while (cur?.lineage?.parent) {
        if (collapsedKeys.has(cur.lineage.parent)) {
          hidden = true
          break
        }
        cur = byKey.get(cur.lineage.parent)
      }
      if (!hidden) result.push(node)
    }
    return result
  }, [fullTree, collapsedKeys, byKey])

  const ancestors = useMemo(
    () => (focusKey ? getAncestors(focusKey, byKey) : []),
    [focusKey, byKey],
  )

  return (
    <div className="app">
      <header className="site-header">
        <p className="eyebrow">life-as-code / provenance</p>
        <h1>
          Why I Built <em>This</em>
        </h1>
        <p className="tagline">
          Every project has a reason. Every decision has a rationale.
          <br />
          This is what that looks like when it's written down.
        </p>
      </header>

      <About />

      {focusKey && (
        <Breadcrumb
          ancestors={ancestors}
          focusKey={focusKey}
          onFocus={setFocusKey}
          onExit={() => setFocusKey(null)}
        />
      )}

      <div className="view-toolbar">
        <button
          className={`view-toggle${view === 'tree' ? ' view-toggle--active' : ''}`}
          onClick={switchToTree}
        >
          ≡ Tree
        </button>
        <button
          className={`view-toggle${view === 'graph' ? ' view-toggle--active' : ''}`}
          onClick={() => setView('graph')}
        >
          ◎ Graph
        </button>
      </div>

      {view === 'graph' ? (
        <FeatureGraph
          features={allFeatures}
          focusKey={focusKey}
          onNodeClick={(key) => {
            if (focusKey === key) {
              setFocusKey(null)
            } else {
              setFocusKey(key)
              // Uncollapse the node itself and every ancestor so it's
              // visible and scrolled-to when the user switches to tree view
              const ancestors = getAncestors(key, byKey)
              setCollapsedKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                for (const a of ancestors) next.delete(a.featureKey)
                return next
              })
            }
          }}
        />
      ) : (
        <main className="features-list">
          {visibleTree.map((node) => (
            <FeatureCard
              key={`${node.featureKey}-${node.depth}`}
              node={node}
              descendantCount={countDescendants(node.featureKey, childrenMap)}
              isCollapsed={collapsedKeys.has(node.featureKey)}
              onCollapse={() => toggleCollapse(node.featureKey)}
              onFocus={() => {
                  if (focusKey === node.featureKey) {
                    setFocusKey(null)
                  } else {
                    setFocusKey(node.featureKey)
                    setCollapsedKeys((prev) => {
                      const next = new Set(prev)
                      next.delete(node.featureKey)
                      return next
                    })
                  }
                }}
              focusState={
                !focusKey
                  ? 'normal'
                  : node.featureKey === focusKey || focusChildKeys.has(node.featureKey)
                  ? 'focused'
                  : focusAncestorKeys.has(node.featureKey)
                  ? 'context'
                  : 'dimmed'
              }
            />
          ))}
        </main>
      )}

      <footer className="site-footer">
        <p>
          Built with{' '}
          <a href="https://github.com/majeanson/lac" target="_blank" rel="noreferrer">
            life-as-code
          </a>{' '}
          · every decision documented
        </p>
      </footer>
    </div>
  )
}
