export type NetworkTier = '2g' | '3g' | '4g' | '5g' | 'unknown'

export interface NetworkProfile {
  tier: NetworkTier
  saveData: boolean
  downlinkMbps?: number
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string
    saveData?: boolean
    downlink?: number
  }
}

export function getNetworkProfile(): NetworkProfile {
  if (typeof navigator === 'undefined') {
    return { tier: 'unknown', saveData: false }
  }
  const conn = (navigator as NavigatorWithConnection).connection
  const effectiveType = conn?.effectiveType || ''
  const saveData = Boolean(conn?.saveData)
  const downlinkMbps = conn?.downlink

  if (effectiveType.includes('2g')) return { tier: '2g', saveData, downlinkMbps }
  if (effectiveType.includes('3g')) return { tier: '3g', saveData, downlinkMbps }
  if (effectiveType.includes('4g')) return { tier: '4g', saveData, downlinkMbps }
  // Forward-compatible for future connection reports.
  if (effectiveType.includes('5g')) return { tier: '5g', saveData, downlinkMbps }
  return { tier: 'unknown', saveData, downlinkMbps }
}

export function getNetworkQueryBudget(profile: NetworkProfile) {
  if (profile.tier === '2g' || profile.saveData) {
    return {
      staleTime: 3 * 60 * 1000,
      gcTime: 8 * 60 * 1000,
      jitterMs: 2500,
    }
  }
  if (profile.tier === '3g') {
    return {
      staleTime: 2 * 60 * 1000,
      gcTime: 6 * 60 * 1000,
      jitterMs: 1800,
    }
  }
  return {
    staleTime: 90 * 1000,
    gcTime: 5 * 60 * 1000,
    jitterMs: 1200,
  }
}
