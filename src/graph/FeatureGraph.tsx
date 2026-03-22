import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Feature } from '../types'
import { completenessOf } from '../features'

// ── Status colours (mirroring CSS custom properties) ──────────────────────────

const STATUS_NODE_COLOR: Record<string, string> = {
  active:     '#2d7a4f', // warm green
  draft:      '#8c7340', // warm amber
  frozen:     '#2e4a78', // navy
  deprecated: '#7a2e2e', // desaturated red
}

const STATUS_GLOW: Record<string, string> = {
  active:     '#4aad72',
  draft:      '#c4a255',
  frozen:     '#5b82cc',
  deprecated: '#cc5b5b',
}

function nodeColor(f: Feature) {
  return STATUS_NODE_COLOR[f.status] ?? STATUS_NODE_COLOR.draft
}

function nodeGlow(f: Feature) {
  return STATUS_GLOW[f.status] ?? STATUS_GLOW.draft
}

// ── Domain colours ─────────────────────────────────────────────────────────────

const KNOWN_DOMAINS = [
  'ai-integration', 'cli', 'concept', 'content', 'design-system',
  'documentation', 'editor-integration', 'frontend', 'personal', 'schema',
  'server', 'tooling', 'ux', 'web-app',
]

function domainColor(domain: string | undefined): string {
  const idx = KNOWN_DOMAINS.indexOf(domain ?? '')
  if (idx < 0) return '#8c7340'
  const hue = (idx / KNOWN_DOMAINS.length) * 360
  return d3.hsl(hue, 0.45, 0.45).formatHex()
}

function domainGlow(domain: string | undefined): string {
  const idx = KNOWN_DOMAINS.indexOf(domain ?? '')
  if (idx < 0) return '#c4a255'
  const hue = (idx / KNOWN_DOMAINS.length) * 360
  return d3.hsl(hue, 0.6, 0.65).formatHex()
}

function nodeRadius(f: Feature & { completeness_pct?: number }) {
  const pct = f.completeness_pct ?? 50
  return 5 + (pct / 100) * 9
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  featureKey: string
  title: string
  status: string
  completeness_pct: number
  domain?: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string
  target: SimNode | string
}

interface TooltipState {
  x: number
  y: number
  feature: Feature
  pinned: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FeatureGraph({
  features,
  focusKey,
  onNodeClick,
  onNodeJump,
  colorBy = 'status',
}: {
  features: Feature[]
  focusKey: string | null
  onNodeClick: (key: string) => void
  onNodeJump: (key: string) => void
  colorBy?: 'status' | 'domain'
}) {
  const svgRef            = useRef<SVGSVGElement>(null)
  const wrapperRef        = useRef<HTMLDivElement>(null)
  const simulationRef     = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const zoomRef           = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const pendingCenterRef  = useRef<string | null>(null)
  const clusterCentersRef = useRef<Record<string, { x: number; y: number }>>({})
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Stable refs so simulation effect never re-runs due to prop changes
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeJumpRef  = useRef(onNodeJump)
  const focusKeyRef    = useRef(focusKey)
  const colorByRef     = useRef(colorBy)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])
  useEffect(() => { onNodeJumpRef.current = onNodeJump }, [onNodeJump])
  useEffect(() => { focusKeyRef.current = focusKey }, [focusKey])
  useEffect(() => { colorByRef.current = colorBy }, [colorBy])

  // ── Center on a node by featureKey ───────────────────────────────────────────
  const centerOnNode = useCallback((key: string): boolean => {
    const svgEl     = svgRef.current
    const wrapperEl = wrapperRef.current
    const zoomBehavior = zoomRef.current
    const sim = simulationRef.current
    if (!svgEl || !wrapperEl || !zoomBehavior || !sim) return false

    const node = sim.nodes().find(n => n.featureKey === key)
    if (!node || node.x == null || node.y == null) return false

    const width  = wrapperEl.clientWidth
    const height = wrapperEl.clientHeight
    const scale  = 1.8
    const tx = width  / 2 - scale * node.x
    const ty = height / 2 - scale * node.y

    d3.select(svgEl)
      .transition()
      .duration(600)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))

    return true
  }, [])

  // ── Build simulation once per features list ─────────────────────────────────
  useEffect(() => {
    const svgEl     = svgRef.current
    const wrapperEl = wrapperRef.current
    if (!svgEl || !wrapperEl || features.length === 0) return

    const width  = wrapperEl.clientWidth
    const height = wrapperEl.clientHeight

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // ── Data ─────────────────────────────────────────────────────────────────
    const nodes: SimNode[] = features.map(f => ({
      featureKey:       f.featureKey,
      title:            f.title,
      status:           f.status,
      completeness_pct: completenessOf(f),
      domain:           f.domain,
    }))

    // Precompute domain cluster centres on a circle
    const presentDomains = [...new Set(features.map(f => f.domain).filter(Boolean) as string[])]
    const cr = Math.min(width, height) * 0.28
    const centers: Record<string, { x: number; y: number }> = {}
    presentDomains.forEach((d, i) => {
      const angle = (i / presentDomains.length) * 2 * Math.PI - Math.PI / 2
      centers[d] = { x: width / 2 + cr * Math.cos(angle), y: height / 2 + cr * Math.sin(angle) }
    })
    clusterCentersRef.current = centers

    const keySet = new Set(nodes.map(n => n.featureKey))
    const links: SimLink[] = features
      .filter(f => f.lineage?.parent && keySet.has(f.lineage.parent))
      .map(f => ({ source: f.lineage!.parent!, target: f.featureKey }))

    // ── Simulation ───────────────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .alphaDecay(0.08)      // settle in ~80 ticks ≈ 1.3s instead of the default ~300 ticks / 5s
      .velocityDecay(0.35)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.featureKey)
        .distance(90)
        .strength(0.5))
      .force('charge', d3.forceManyBody<SimNode>().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        return (f ? nodeRadius(f as Feature & { completeness_pct?: number }) : 10) + 5
      }))

    // ── Zoom ─────────────────────────────────────────────────────────────────
    const g = svg.append('g')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', event => { g.attr('transform', event.transform) })

    zoomRef.current = zoom
    svg.call(zoom)
    svg.on('click.bg', () => setTooltip(null))

    // ── Defs: glow filter ────────────────────────────────────────────────────
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'lac-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    filter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // ── Cluster label layer (populated by colorBy effect) ────────────────────
    g.append('g').attr('class', 'cluster-labels')

    // ── Links ─────────────────────────────────────────────────────────────────
    const linkSel = g.append('g')
      .attr('class', 'graph-links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#3a2e26')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 1.5)

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const nodeSel = g.append('g')
      .attr('class', 'graph-nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end',  (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          }),
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        if (event.ctrlKey || event.metaKey) {
          onNodeJumpRef.current(d.featureKey)
          return
        }

        const rect = svgEl.getBoundingClientRect()
        const f = features.find(f => f.featureKey === d.featureKey)

        setTooltip(prev => {
          // Toggle off if already pinned on the same node
          if (prev?.pinned && prev.feature.featureKey === d.featureKey) return null
          return f ? { x: event.clientX - rect.left, y: event.clientY - rect.top, feature: f, pinned: true } : null
        })

        onNodeClickRef.current(d.featureKey)
        centerOnNode(d.featureKey)
      })
      .on('mouseenter', (event, d) => {
        // Don't replace a pinned panel with a hover tooltip
        setTooltip(prev => {
          if (prev?.pinned) return prev
          const rect = svgEl.getBoundingClientRect()
          const f = features.find(f => f.featureKey === d.featureKey)
          return f ? { x: event.clientX - rect.left, y: event.clientY - rect.top, feature: f, pinned: false } : prev
        })

        linkSel
          .attr('stroke', l => {
            const s = (l.source as SimNode).featureKey
            const t = (l.target as SimNode).featureKey
            return s === d.featureKey || t === d.featureKey
              ? nodeGlow(features.find(f => f.featureKey === d.featureKey) ?? { status: 'draft' } as Feature)
              : '#3a2e26'
          })
          .attr('stroke-opacity', l => {
            const s = (l.source as SimNode).featureKey
            const t = (l.target as SimNode).featureKey
            return s === d.featureKey || t === d.featureKey ? 1 : 0.15
          })
          .attr('stroke-width', l => {
            const s = (l.source as SimNode).featureKey
            const t = (l.target as SimNode).featureKey
            return s === d.featureKey || t === d.featureKey ? 2 : 1.5
          })

        nodeSel.select('circle')
          .attr('fill-opacity', n => {
            const connected = links.some(l => {
              const s = (l.source as SimNode).featureKey
              const t = (l.target as SimNode).featureKey
              return (s === d.featureKey && t === n.featureKey) ||
                     (t === d.featureKey && s === n.featureKey) ||
                     n.featureKey === d.featureKey
            })
            return connected ? 1 : 0.2
          })
      })
      .on('mousemove', (event, d) => {
        setTooltip(prev => {
          if (prev?.pinned) return prev
          const rect = svgEl.getBoundingClientRect()
          const f = features.find(f => f.featureKey === d.featureKey)
          return f ? { x: event.clientX - rect.left, y: event.clientY - rect.top, feature: f, pinned: false } : prev
        })
      })
      .on('mouseleave', () => {
        setTooltip(prev => prev?.pinned ? prev : null)
        linkSel.attr('stroke', '#3a2e26').attr('stroke-opacity', 0.7).attr('stroke-width', 1.5)
        nodeSel.select('circle').attr('fill-opacity', 0.9)
      })

    // Circles
    nodeSel.append('circle')
      .attr('r', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        return f ? nodeRadius(f as Feature & { completeness_pct?: number }) : 8
      })
      .attr('fill', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        if (!f) return '#8c7340'
        return colorByRef.current === 'domain' ? domainColor(f.domain) : nodeColor(f)
      })
      .attr('fill-opacity', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        return f?.status === 'deprecated' ? 0.45 : 0.9
      })
      .attr('stroke', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        if (!f) return '#c4a255'
        return colorByRef.current === 'domain' ? domainGlow(f.domain) : nodeGlow(f)
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-dasharray', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        return f?.status === 'deprecated' ? '4 3' : null
      })
      .style('filter', 'url(#lac-glow)')

    // Labels
    nodeSel.append('text')
      .text(d => d.featureKey)
      .attr('text-anchor', 'middle')
      .attr('dy', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        return (f ? nodeRadius(f as Feature & { completeness_pct?: number }) : 8) + 12
      })
      .attr('font-size', '9px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('fill', '#7a6a5a')
      .attr('pointer-events', 'none')
      .attr('user-select', 'none')

    // ── Tick ─────────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0)
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Pick up any deferred centering request once layout settles
    simulation.on('end', () => {
      const pending = pendingCenterRef.current
      if (pending) {
        pendingCenterRef.current = null
        centerOnNode(pending)
      }
    })

    simulationRef.current = simulation

    // Apply cluster forces if colorBy is already 'domain' when simulation first builds
    if (colorByRef.current === 'domain') {
      const c = clusterCentersRef.current
      simulation
        .force('clusterX', d3.forceX<SimNode>(d => c[d.domain ?? '']?.x ?? width / 2).strength(0.18))
        .force('clusterY', d3.forceY<SimNode>(d => c[d.domain ?? '']?.y ?? height / 2).strength(0.18))
    }

    return () => {
      simulation.stop()
      simulationRef.current = null
      zoomRef.current = null
    }
  }, [features, centerOnNode]) // only rebuild when the feature list itself changes

  // ── Domain cluster forces: toggle when colorBy changes ───────────────────────
  useEffect(() => {
    const sim = simulationRef.current
    const wrapperEl = wrapperRef.current
    if (!sim || !wrapperEl) return
    const width  = wrapperEl.clientWidth
    const height = wrapperEl.clientHeight
    const c = clusterCentersRef.current
    if (colorBy === 'domain') {
      sim
        .force('clusterX', d3.forceX<SimNode>(d => c[d.domain ?? '']?.x ?? width / 2).strength(0.18))
        .force('clusterY', d3.forceY<SimNode>(d => c[d.domain ?? '']?.y ?? height / 2).strength(0.18))
    } else {
      sim.force('clusterX', null).force('clusterY', null)
    }
    sim.alpha(0.4).restart()
  }, [colorBy])

  // ── Focus ring + pan/zoom to focused node ────────────────────────────────────
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    d3.select(svgEl)
      .select('.graph-nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .select('circle')
      .attr('stroke-width', (d: SimNode) => (focusKey === d.featureKey ? 3 : 1.5))

    if (focusKey) {
      const alpha = simulationRef.current?.alpha() ?? 1
      if (alpha < 0.01) {
        // Simulation at rest — center immediately
        centerOnNode(focusKey)
      } else {
        // Simulation still running — defer to 'end' handler so we get settled positions.
        // Also set a 700ms fallback: if the simulation takes too long, center on best
        // available positions rather than making the user wait.
        pendingCenterRef.current = focusKey
        const t = window.setTimeout(() => {
          if (pendingCenterRef.current === focusKey) {
            pendingCenterRef.current = null
            centerOnNode(focusKey)
          }
        }, 700)
        return () => window.clearTimeout(t)
      }
    }
  }, [focusKey, centerOnNode])

  // ── Color-by: update circle fills + cluster labels when colorBy changes ──────
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    d3.select(svgEl)
      .select('.graph-nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .select('circle')
      .attr('fill', (d: SimNode) => {
        const f = features.find(f => f.featureKey === d.featureKey)
        if (!f) return '#8c7340'
        return colorBy === 'domain' ? domainColor(f.domain) : nodeColor(f)
      })
      .attr('stroke', (d: SimNode) => {
        const f = features.find(f => f.featureKey === d.featureKey)
        if (!f) return '#c4a255'
        return colorBy === 'domain' ? domainGlow(f.domain) : nodeGlow(f)
      })

    const labelG = d3.select(svgEl).select<SVGGElement>('.cluster-labels')
    labelG.selectAll('*').remove()
    if (colorBy === 'domain') {
      Object.entries(clusterCentersRef.current).forEach(([domain, pos]) => {
        labelG.append('text')
          .attr('x', pos.x)
          .attr('y', pos.y - 36)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-family', "'JetBrains Mono', monospace")
          .attr('fill', domainGlow(domain))
          .attr('fill-opacity', 0.6)
          .attr('pointer-events', 'none')
          .attr('user-select', 'none')
          .text(domain)
      })
    }
  }, [colorBy, features])

  // Legend counts
  const statusCounts = Object.entries(STATUS_NODE_COLOR).map(([status, color]) => ({
    status,
    color,
    count: features.filter(f => f.status === status).length,
  })).filter(s => s.count > 0)

  const domainLegend = KNOWN_DOMAINS
    .map(d => ({ domain: d, color: domainColor(d), count: features.filter(f => f.domain === d).length }))
    .filter(d => d.count > 0)

  return (
    <div ref={wrapperRef} className="graph-canvas">
      <svg ref={svgRef} className="graph-svg" />

      {tooltip && !tooltip.pinned && (
        <div
          className="graph-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
        >
          <span className="graph-tooltip-key">{tooltip.feature.featureKey}</span>
          <span className="graph-tooltip-title">{tooltip.feature.title}</span>
          <span className="graph-tooltip-status" style={{ color: colorBy === 'domain' ? domainGlow(tooltip.feature.domain) : nodeGlow(tooltip.feature) }}>
            {tooltip.feature.status}
          </span>
          <span className="graph-tooltip-hint">click to pin · ctrl+click to open</span>
        </div>
      )}

      {tooltip?.pinned && (
        <div className="graph-panel">
          <div className="graph-panel-header">
            <span className="graph-tooltip-key">{tooltip.feature.featureKey}</span>
            <button
              className="graph-panel-close"
              onClick={() => setTooltip(null)}
              aria-label="Close panel"
            >
              ×
            </button>
          </div>
          <span className="graph-tooltip-title">{tooltip.feature.title}</span>
          <span
            className="graph-tooltip-status"
            style={{ color: colorBy === 'domain' ? domainGlow(tooltip.feature.domain) : nodeGlow(tooltip.feature) }}
          >
            {tooltip.feature.status}
            {tooltip.feature.domain ? ` · ${tooltip.feature.domain}` : ''}
          </span>
          {tooltip.feature.problem && (
            <p className="graph-panel-problem">{tooltip.feature.problem}</p>
          )}
          <span className="graph-tooltip-hint">ctrl+click node to open in tree</span>
        </div>
      )}

      <div className="graph-legend">
        <span className="graph-legend-total">{features.length} features</span>
        {colorBy === 'domain'
          ? domainLegend.map(({ domain, color, count }) => (
              <span key={domain} className="graph-legend-item">
                <span className="graph-legend-dot" style={{ background: color }} />
                <span>{domain} · {count}</span>
              </span>
            ))
          : statusCounts.map(({ status, color, count }) => (
              <span key={status} className="graph-legend-item">
                <span className="graph-legend-dot" style={{ background: color }} />
                <span>{status} · {count}</span>
              </span>
            ))
        }
        <span className="graph-legend-hint">node size = completeness</span>
        <span className="graph-legend-hint">click — pin · ctrl+click — open in tree</span>
      </div>
    </div>
  )
}
