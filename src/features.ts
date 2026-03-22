import type { Feature, FeatureNode } from './types'

// Score how complete a feature.json is (0–100) based on optional fields present
export function completenessOf(f: Feature): number {
  const checks = [
    !!f.analysis,
    !!f.implementation,
    !!(f.decisions && f.decisions.length > 0),
    !!f.successCriteria,
    !!(f.knownLimitations && f.knownLimitations.length > 0),
    !!(f.tags && f.tags.length > 0),
    !!f.domain,
  ]
  const score = checks.filter(Boolean).length / checks.length
  return Math.round(score * 100)
}

// Load all feature.json files in the project at build time
const modules = import.meta.glob<{ default: Feature }>(
  '../**/feature.json',
  { eager: true }
)

export function loadFeatures(): Feature[] {
  return Object.values(modules)
    .map((m) => m.default)
    .filter((f) => f?.featureKey)
    .sort((a, b) => a.featureKey.localeCompare(b.featureKey))
}

export function buildTree(features: Feature[]): FeatureNode[] {
  const roots = features.filter((f) => !f.lineage?.parent)

  function getChildren(key: string): Feature[] {
    return features.filter((f) => f.lineage?.parent === key)
  }

  function flatten(feature: Feature, depth: number): FeatureNode[] {
    return [
      { ...feature, depth },
      ...getChildren(feature.featureKey).flatMap((c) => flatten(c, depth + 1)),
    ]
  }

  // Roots first, then any orphaned children
  const inTree = new Set<string>()
  const result = roots.flatMap((r) => flatten(r, 0))
  result.forEach((n) => inTree.add(n.featureKey))

  // Append anything not reached (parent key doesn't exist yet)
  const orphans = features
    .filter((f) => !inTree.has(f.featureKey))
    .map((f) => ({ ...f, depth: 0 }))

  return [...result, ...orphans]
}
