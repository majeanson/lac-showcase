import { useState, useEffect, useMemo, useRef } from 'react'
import { loadFeatures, buildTree, completenessOf } from './features'
import type { Feature, FeatureNode } from './types'
import About from './about/About'
import McpAuthoring from './mcp-authoring/McpAuthoring'
import McpChild from './mcp-child/McpChild'
import McpBugTrace from './mcp-authoring/bugs/tool-path-resolution/McpBugTrace'
import McpClaudeSession from './mcp-claude-session/McpClaudeSession'
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
  focusFeature,
  onFocus,
  onExit,
}: {
  ancestors: Feature[]
  focusKey: string
  focusFeature: Feature | undefined
  onFocus: (key: string) => void
  onExit: () => void
}) {
  // Build chain steps: each child carries the spawnReason explaining why it was created
  // Step = { from: parent key, reason: spawnReason, to: child feature }
  const chainSteps = [...ancestors.slice(1), focusFeature].filter(Boolean) as Feature[]
  const hasReasons = chainSteps.some(f => f.lineage?.spawnReason)

  return (
    <>
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

      {hasReasons && (
        <div className="spawn-chain">
          {chainSteps.map((f, i) => {
            const parent = i === 0 ? ancestors[0] : ancestors[i]
            if (!f.lineage?.spawnReason) return null
            return (
              <div key={f.featureKey} className="spawn-chain-step">
                <span className="spawn-chain-from">{parent?.featureKey ?? '?'}</span>
                <span className="spawn-chain-arrow">↳</span>
                <span className="spawn-chain-reason">{f.lineage.spawnReason}</span>
                <span className="spawn-chain-to">{f.featureKey}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Filter Bar ─────────────────────────────────────────────

const STATUSES = ['active', 'draft', 'frozen', 'deprecated'] as const

function FilterBar({
  searchQuery,
  onSearchChange,
  activeTags,
  onTagToggle,
  activeStatuses,
  onStatusToggle,
  activeDomains,
  onDomainToggle,
  allTags,
  tagCounts,
  allDomains,
  domainCounts,
  matchCount,
  totalCount,
  onClear,
  view,
  graphColorBy,
  onColorByChange,
  sortBy,
  onSortByChange,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
  activeTags: Set<string>
  onTagToggle: (t: string) => void
  activeStatuses: Set<string>
  onStatusToggle: (s: string) => void
  activeDomains: Set<string>
  onDomainToggle: (d: string) => void
  allTags: string[]
  tagCounts: Record<string, number>
  allDomains: string[]
  domainCounts: Record<string, number>
  matchCount: number
  totalCount: number
  onClear: () => void
  view: 'tree' | 'graph'
  graphColorBy: 'status' | 'domain'
  onColorByChange: (cb: 'status' | 'domain') => void
  sortBy: 'default' | 'priority'
  onSortByChange: (s: 'default' | 'priority') => void
}) {
  const [open, setOpen] = useState(false)
  const activeFilterCount =
    (searchQuery ? 1 : 0) + activeTags.size + activeStatuses.size + activeDomains.size
  const hasFilter = activeFilterCount > 0

  return (
    <div className="filter-bar">
      <div className="filter-top-row">
        <input
          className="filter-search"
          type="search"
          placeholder="Search features…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        <button
          className={`filter-expand-btn${open ? ' is-open' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="filter-active-badge">{activeFilterCount}</span>
          )}
          <span className="filter-caret">{open ? '▲' : '▼'}</span>
        </button>
        {hasFilter && (
          <span className="filter-match-pill">
            {matchCount}<span className="filter-match-sep"> / </span>{totalCount}
          </span>
        )}
      </div>

      {open && (
        <div className="filter-panel">
          <div className="filter-section">
            <span className="filter-section-label">Status</span>
            <div className="filter-chips-row">
              {STATUSES.map(s => (
                <button
                  key={s}
                  className={`filter-chip filter-chip--${s}${activeStatuses.has(s) ? ' is-on' : ''}`}
                  onClick={() => onStatusToggle(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-section-label">Domain</span>
            <div className="filter-chips-row">
              {allDomains.map(d => (
                <button
                  key={d}
                  className={`filter-chip${activeDomains.has(d) ? ' is-on' : ''}`}
                  onClick={() => onDomainToggle(d)}
                >
                  {d}{domainCounts[d] ? <span className="filter-chip-count">{domainCounts[d]}</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-section-label">Tags</span>
            <div className="filter-chips-row">
              {allTags.map(t => (
                <button
                  key={t}
                  className={`filter-chip${activeTags.has(t) ? ' is-on' : ''}`}
                  onClick={() => onTagToggle(t)}
                >
                  {t}{tagCounts[t] > 1 ? <span className="filter-chip-count">{tagCounts[t]}</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-section-label">Sort</span>
            <div className="filter-chips-row">
              {(['default', 'priority'] as const).map(opt => (
                <button
                  key={opt}
                  className={`filter-chip${sortBy === opt ? ' is-on' : ''}`}
                  onClick={() => onSortByChange(opt)}
                >
                  {opt === 'default' ? 'tree order' : 'priority'}
                </button>
              ))}
            </div>
          </div>

          {view === 'graph' && (
            <div className="filter-section">
              <span className="filter-section-label">Color by</span>
              <div className="filter-chips-row">
                {(['status', 'domain'] as const).map(opt => (
                  <button
                    key={opt}
                    className={`filter-chip${graphColorBy === opt ? ' is-on' : ''}`}
                    onClick={() => onColorByChange(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasFilter && (
            <button className="filter-clear-all" onClick={onClear}>
              ✕ Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Feature Card ───────────────────────────────────────────

function FeatureCard({
  node,
  descendantCount,
  isCollapsed,
  onCollapse,
  onFocus,
  onJumpToGraph,
  onTagClick,
  focusState,
  activeTags,
}: {
  node: FeatureNode
  descendantCount: number
  isCollapsed: boolean
  onCollapse: () => void
  onFocus: () => void
  onJumpToGraph: () => void
  onTagClick: (tag: string) => void
  focusState: 'focused' | 'context' | 'dimmed' | 'normal'
  activeTags: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const entryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusState === 'focused' && entryRef.current) {
      entryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusState])

  const hasMore =
    node.analysis ||
    node.implementation ||
    node.successCriteria ||
    (node.decisions && node.decisions.length > 0) ||
    (node.knownLimitations && node.knownLimitations.length > 0)

  const hasChildren = descendantCount > 0

  const entryClass = [
    'feature-entry',
    node.lineage?.parent ? 'has-parent' : '',
    focusState !== 'normal' ? `feature-${focusState}` : '',
    node.status === 'deprecated' ? 'is-deprecated' : '',
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
          {node.priority != null && (
            <span className="priority-badge" title={`Priority ${node.priority}`}>P{node.priority}</span>
          )}
          {(() => {
            const pct = completenessOf(node)
            const tier = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low'
            return <span className={`completeness-badge completeness-badge--${tier}`} title={`Documentation completeness: ${pct}%`}>{pct}%</span>
          })()}
          </div>

          <h2 className="feature-title">{node.title}</h2>
          <p className="feature-problem">{node.problem}</p>

          {node.lineage?.spawnReason && (
            <p className="spawn-reason">↳ {node.lineage.spawnReason}</p>
          )}

          {node.tags && node.tags.length > 0 && (
            <div className="tags">
              {node.tags.map((t) => (
                <button key={t} className={`tag tag--clickable${activeTags.has(t) ? ' tag--active' : ''}`} onClick={() => onTagClick(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {((node.decisions?.length ?? 0) > 0 || (node.knownLimitations?.length ?? 0) > 0) && (
            <div className="card-counts">
              {(node.decisions?.length ?? 0) > 0 && (
                <span className="card-count-badge">{node.decisions!.length} decision{node.decisions!.length !== 1 ? 's' : ''}</span>
              )}
              {(node.knownLimitations?.length ?? 0) > 0 && (
                <span className="card-count-badge card-count-badge--dim">{node.knownLimitations!.length} limitation{node.knownLimitations!.length !== 1 ? 's' : ''}</span>
              )}
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
            <button
              className={`expand-toggle${jsonOpen ? ' is-active' : ''}`}
              onClick={() => setJsonOpen((v) => !v)}
              title="View the feature.json source — this card's raw data"
            >
              {jsonOpen ? '{ close }' : '{ json }'}
            </button>
            <button
              className="expand-toggle"
              onClick={onJumpToGraph}
              title="View in graph"
            >
              ◎ graph
            </button>
          </div>

          {jsonOpen && (
            <div className="json-viewer">
              <p className="json-viewer-label">source of this card — <code>{node.featureKey}/feature.json</code></p>
              <pre><code>{(() => { const { depth: _depth, ...feature } = node; return JSON.stringify(feature, null, 2) })()}</code></pre>
            </div>
          )}

          {open && (
            <div className="expanded-content">
              {node.successCriteria && (
                <section className="detail-section">
                  <h3>Success Criteria</h3>
                  <p>{node.successCriteria}</p>
                </section>
              )}

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
                      <strong>{d.decision}</strong>{d.date && <span className="decision-date">{d.date}</span>}
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

              {node.featureKey === 'feat-2026-023' && <McpAuthoring />}
              {node.featureKey === 'feat-2026-024' && <McpChild />}
              {node.featureKey === 'feat-2026-025' && <McpBugTrace />}
              {node.featureKey === 'feat-2026-026' && <McpClaudeSession />}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

// ── Mobile detection ───────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

// ── App ────────────────────────────────────────────────────

export default function App() {
  const isMobile = useIsMobile()
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

  // ── collapse state — all nodes start collapsed ────────────
  const allParentKeys = useMemo(
    () => new Set(allFeatures.filter((f) => childrenMap.has(f.featureKey)).map((f) => f.featureKey)),
    [allFeatures, childrenMap],
  )

  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => allParentKeys)

  // ── view mode ─────────────────────────────────────────────
  const [view, setView] = useState<'tree' | 'graph'>('tree')

  // ── filter state — URL-synced ─────────────────────────────
  const [searchQuery, setSearchQuery] = useState(() =>
    new URLSearchParams(window.location.search).get('q') ?? '')
  const [activeTags, setActiveTags] = useState<Set<string>>(() => {
    const v = new URLSearchParams(window.location.search).get('tags')
    return v ? new Set(v.split(',').filter(Boolean)) : new Set()
  })
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(() => {
    const v = new URLSearchParams(window.location.search).get('statuses')
    return v ? new Set(v.split(',').filter(Boolean)) : new Set()
  })
  const [activeDomains, setActiveDomains] = useState<Set<string>>(() => {
    const v = new URLSearchParams(window.location.search).get('domains')
    return v ? new Set(v.split(',').filter(Boolean)) : new Set()
  })
  const [graphColorBy, setGraphColorBy] = useState<'status' | 'domain'>(() => {
    const v = new URLSearchParams(window.location.search).get('colorBy')
    return v === 'domain' ? 'domain' : 'status'
  })
  const [sortBy, setSortBy] = useState<'default' | 'priority'>(() => {
    const v = new URLSearchParams(window.location.search).get('sort')
    return v === 'priority' ? 'priority' : 'default'
  })

  // ── URL sync ──────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (focusKey)                    params.set('focus', focusKey)
    if (searchQuery)                 params.set('q', searchQuery)
    if (activeTags.size)             params.set('tags', [...activeTags].join(','))
    if (activeStatuses.size)         params.set('statuses', [...activeStatuses].join(','))
    if (activeDomains.size)          params.set('domains', [...activeDomains].join(','))
    if (graphColorBy !== 'status')   params.set('colorBy', graphColorBy)
    if (sortBy !== 'default')        params.set('sort', sortBy)
    const search = params.toString()
    window.history.replaceState(null, '',
      search ? `${window.location.pathname}?${search}` : window.location.pathname)
  }, [focusKey, searchQuery, activeTags, activeStatuses, activeDomains, graphColorBy, sortBy])

  // ── derived filter data ───────────────────────────────────
  const { allTags, tagCounts } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of allFeatures) {
      for (const t of f.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return {
      allTags: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
      tagCounts: Object.fromEntries(counts),
    }
  }, [allFeatures])

  const { allDomains, domainCounts } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of allFeatures) {
      if (f.domain) counts[f.domain] = (counts[f.domain] ?? 0) + 1
    }
    return {
      allDomains: [...new Set(allFeatures.filter(f => f.domain).map(f => f.domain!))].sort(),
      domainCounts: counts,
    }
  }, [allFeatures])

  const globalStats = useMemo(() => ({
    features: allFeatures.length,
    decisions: allFeatures.reduce((n, f) => n + (f.decisions?.length ?? 0), 0),
    domains: new Set(allFeatures.filter(f => f.domain).map(f => f.domain!)).size,
  }), [allFeatures])

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const hasTags = activeTags.size > 0
    const hasStatuses = activeStatuses.size > 0
    const hasDomains = activeDomains.size > 0
    if (!q && !hasTags && !hasStatuses && !hasDomains) return allFeatures
    return allFeatures.filter(f => {
      if (q) {
        const decisionText = (f.decisions ?? []).map(d => `${d.decision} ${d.rationale}`).join(' ')
        const hay = `${f.featureKey} ${f.title} ${f.problem} ${f.analysis ?? ''} ${f.implementation ?? ''} ${f.successCriteria ?? ''} ${(f.tags ?? []).join(' ')} ${decisionText}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (hasTags && !f.tags?.some(t => activeTags.has(t))) return false
      if (hasStatuses && !activeStatuses.has(f.status)) return false
      if (hasDomains && (!f.domain || !activeDomains.has(f.domain))) return false
      return true
    })
  }, [allFeatures, searchQuery, activeTags, activeStatuses, activeDomains])

  const isFiltered = filteredFeatures !== allFeatures

  // Keys of matching features + all their ancestors (so tree context is preserved)
  const treeFilterKeys = useMemo((): Set<string> | null => {
    if (!isFiltered) return null
    const keys = new Set<string>()
    for (const f of filteredFeatures) {
      keys.add(f.featureKey)
      let cur: Feature | undefined = f
      while (cur?.lineage?.parent) {
        const parent = byKey.get(cur.lineage.parent)
        if (!parent) break
        keys.add(parent.featureKey)
        cur = parent
      }
    }
    return keys
  }, [filteredFeatures, byKey, isFiltered])

  // Auto-expand ancestors of matching features when a filter is active
  useEffect(() => {
    if (!treeFilterKeys) return
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      for (const key of treeFilterKeys) next.delete(key)
      return next
    })
  }, [treeFilterKeys])

  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
  }

  function toggleStatus(status: string) {
    setActiveStatuses(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status); else next.add(status)
      return next
    })
  }

  function toggleDomain(domain: string) {
    setActiveDomains(prev => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain); else next.add(domain)
      return next
    })
  }

  function clearFilters() {
    setSearchQuery('')
    setActiveTags(new Set())
    setActiveStatuses(new Set())
    setActiveDomains(new Set())
  }

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

  // ── focus context: ancestors (dimmed less) + focused feature's descendants (fully focused) ─
  const focusAncestorKeys = useMemo((): Set<string> => {
    if (!focusKey) return new Set()
    const ancs = getAncestors(focusKey, byKey)
    return new Set(ancs.map((a) => a.featureKey))
  }, [focusKey, byKey])

  const focusDescendantKeys = useMemo((): Set<string> => {
    if (!focusKey) return new Set()
    const result = new Set<string>()
    const queue = [focusKey]
    while (queue.length) {
      const key = queue.pop()!
      for (const child of childrenMap.get(key) ?? []) {
        result.add(child.featureKey)
        queue.push(child.featureKey)
      }
    }
    return result
  }, [focusKey, childrenMap])

  // ── visible tree: full tree minus collapsed sub-trees, filtered, sorted ────
  const visibleTree = useMemo((): FeatureNode[] => {
    const result: FeatureNode[] = []
    for (const node of fullTree) {
      if (treeFilterKeys && !treeFilterKeys.has(node.featureKey)) continue
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
    if (sortBy === 'priority') {
      result.sort((a, b) => {
        const pa = a.priority ?? 999
        const pb = b.priority ?? 999
        return pa !== pb ? pa - pb : a.featureKey.localeCompare(b.featureKey)
      })
    }
    return result
  }, [fullTree, collapsedKeys, byKey, treeFilterKeys, sortBy])

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
        <p className="tagline-sub">
          Each card below is a real <code>feature.json</code> file committed alongside this code.
          The data <em>is</em> the UI.
        </p>
      </header>

      <About />

      <div className="stats-bar">
        <span className="stats-item"><strong>{isFiltered ? filteredFeatures.length : globalStats.features}</strong> feature{(isFiltered ? filteredFeatures.length : globalStats.features) !== 1 ? 's' : ''}{isFiltered ? ` of ${globalStats.features}` : ''}</span>
        <span className="stats-sep">·</span>
        <span className="stats-item"><strong>{globalStats.decisions}</strong> decision{globalStats.decisions !== 1 ? 's' : ''}</span>
        <span className="stats-sep">·</span>
        <span className="stats-item"><strong>{globalStats.domains}</strong> domain{globalStats.domains !== 1 ? 's' : ''}</span>
      </div>

      {focusKey && (
        <Breadcrumb
          ancestors={ancestors}
          focusKey={focusKey}
          focusFeature={byKey.get(focusKey)}
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
        {view === 'tree' && allParentKeys.size > 0 && (
          <>
            <button className="tree-ctrl-btn" onClick={() => setCollapsedKeys(new Set())} title="Expand all threads">
              expand all
            </button>
            <button className="tree-ctrl-btn" onClick={() => setCollapsedKeys(allParentKeys)} title="Collapse all threads">
              collapse all
            </button>
          </>
        )}
      </div>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTags={activeTags}
        onTagToggle={toggleTag}
        activeStatuses={activeStatuses}
        onStatusToggle={toggleStatus}
        activeDomains={activeDomains}
        onDomainToggle={toggleDomain}
        allTags={allTags}
        tagCounts={tagCounts}
        allDomains={allDomains}
        domainCounts={domainCounts}
        matchCount={filteredFeatures.length}
        totalCount={allFeatures.length}
        onClear={clearFilters}
        view={view}
        graphColorBy={graphColorBy}
        onColorByChange={setGraphColorBy}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {view === 'graph' && isMobile && (
        <p className="mobile-graph-notice">Graph view requires a wider screen — showing list below.</p>
      )}

      {view === 'graph' && !isMobile ? (
        <FeatureGraph
          features={filteredFeatures}
          colorBy={graphColorBy}
          focusKey={focusKey}
          onNodeClick={(key) => {
            if (focusKey === key) {
              setFocusKey(null)
            } else {
              setFocusKey(key)
              const ancestors = getAncestors(key, byKey)
              setCollapsedKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                for (const a of ancestors) next.delete(a.featureKey)
                return next
              })
            }
          }}
          onNodeJump={(key) => {
            setFocusKey(key)
            const ancestors = getAncestors(key, byKey)
            setCollapsedKeys((prev) => {
              const next = new Set(prev)
              next.delete(key)
              for (const a of ancestors) next.delete(a.featureKey)
              return next
            })
            setView('tree')
          }}
        />
      ) : (
        <main className="features-list">
          {visibleTree.length === 0 && isFiltered && (
            <p className="filter-empty-state">No features match the current filter.</p>
          )}
          {visibleTree.map((node) => (
            <FeatureCard
              key={`${node.featureKey}-${node.depth}`}
              node={node}
              descendantCount={countDescendants(node.featureKey, childrenMap)}
              isCollapsed={collapsedKeys.has(node.featureKey)}
              onCollapse={() => toggleCollapse(node.featureKey)}
              onJumpToGraph={() => {
                setFocusKey(node.featureKey)
                setView('graph')
              }}
              onTagClick={toggleTag}
              activeTags={activeTags}
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
                  : node.featureKey === focusKey || focusDescendantKeys.has(node.featureKey)
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
