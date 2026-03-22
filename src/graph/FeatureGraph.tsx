import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Feature } from '../types'

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
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string
  target: SimNode | string
}

interface TooltipState {
  x: number
  y: number
  feature: Feature
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FeatureGraph({
  features,
  focusKey,
  onNodeClick,
}: {
  features: Feature[]
  focusKey: string | null
  onNodeClick: (key: string) => void
}) {
  const svgRef      = useRef<SVGSVGElement>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Stable refs so simulation effect never re-runs due to prop changes
  const onNodeClickRef = useRef(onNodeClick)
  const focusKeyRef    = useRef(focusKey)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])
  useEffect(() => { focusKeyRef.current = focusKey }, [focusKey])

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
      completeness_pct: (f as Feature & { completeness_pct?: number }).completeness_pct ?? 50,
    }))

    const keySet = new Set(nodes.map(n => n.featureKey))
    const links: SimLink[] = features
      .filter(f => f.lineage?.parent && keySet.has(f.lineage.parent))
      .map(f => ({ source: f.lineage!.parent!, target: f.featureKey }))

    // ── Simulation ───────────────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
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

    svg.call(zoom)
    svg.on('click.bg', () => setTooltip(null))

    // ── Defs: glow filter ────────────────────────────────────────────────────
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'lac-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    filter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

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
        onNodeClickRef.current(d.featureKey)
      })
      .on('mouseenter', (event, d) => {
        const rect = svgEl.getBoundingClientRect()
        const f = features.find(f => f.featureKey === d.featureKey)
        if (f) setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, feature: f })

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
        const rect = svgEl.getBoundingClientRect()
        const f = features.find(f => f.featureKey === d.featureKey)
        if (f) setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, feature: f })
      })
      .on('mouseleave', () => {
        setTooltip(null)
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
        return f ? nodeColor(f) : '#8c7340'
      })
      .attr('fill-opacity', 0.9)
      .attr('stroke', d => {
        const f = features.find(f => f.featureKey === d.featureKey)
        return f ? nodeGlow(f) : '#c4a255'
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7)
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

    return () => { simulation.stop() }
  }, [features]) // only rebuild when the feature list itself changes

  // ── Focus ring: update stroke-width without touching the simulation ──────────
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    d3.select(svgEl)
      .select('.graph-nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .select('circle')
      .attr('stroke-width', (d: SimNode) => (focusKey === d.featureKey ? 3 : 1.5))
  }, [focusKey])

  // Legend counts
  const statusCounts = Object.entries(STATUS_NODE_COLOR).map(([status, color]) => ({
    status,
    color,
    count: features.filter(f => f.status === status).length,
  })).filter(s => s.count > 0)

  return (
    <div ref={wrapperRef} className="graph-canvas">
      <svg ref={svgRef} className="graph-svg" />

      {tooltip && (
        <div
          className="graph-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
        >
          <span className="graph-tooltip-key">{tooltip.feature.featureKey}</span>
          <span className="graph-tooltip-title">{tooltip.feature.title}</span>
          <span className="graph-tooltip-status" style={{ color: nodeGlow(tooltip.feature) }}>
            {tooltip.feature.status}
          </span>
          <span className="graph-tooltip-hint">click to focus</span>
        </div>
      )}

      <div className="graph-legend">
        <span className="graph-legend-total">{features.length} features</span>
        {statusCounts.map(({ status, color, count }) => (
          <span key={status} className="graph-legend-item">
            <span className="graph-legend-dot" style={{ background: color }} />
            <span>{status} · {count}</span>
          </span>
        ))}
        <span className="graph-legend-hint">node size = completeness</span>
      </div>
    </div>
  )
}
