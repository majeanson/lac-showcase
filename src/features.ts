import type { Feature, FeatureNode } from './types'

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
