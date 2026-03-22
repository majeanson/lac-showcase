export interface Decision {
  decision: string
  rationale: string
  alternativesConsidered?: string[]
  date?: string | null
}

export interface Lineage {
  parent?: string
  spawnReason?: string
}

export interface Feature {
  featureKey: string
  title: string
  status: 'draft' | 'active' | 'frozen' | 'deprecated'
  problem: string
  analysis?: string
  implementation?: string
  decisions?: Decision[]
  knownLimitations?: string[]
  tags?: string[]
  lineage?: Lineage
  schemaVersion?: number
  owner?: string
  successCriteria?: string
  domain?: string
  priority?: number
}

export interface FeatureNode extends Feature {
  depth: number
}
