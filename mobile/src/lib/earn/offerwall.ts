/**
 * Offerwall (AdGem) — Expo env keys. Sandbox mock when unset.
 */

export type OfferwallProviderId = 'adgem' | 'mock'

export interface OfferwallOffer {
  id: string
  title: string
  reward: number
  timeLabel: string
  timeKind: 'lightning' | 'clock' | 'game' | 'video' | 'offer'
  tag: string
  url?: string
  provider: OfferwallProviderId
  sandbox?: boolean
}

export interface OfferwallSession {
  provider: OfferwallProviderId
  configured: boolean
  wallUrl: string | null
  offers: OfferwallOffer[]
  note: string
}

const MOCK_OFFERS: OfferwallOffer[] = [
  {
    id: 'mock-tech',
    title: 'Tech Opinion Panel',
    reward: 500,
    timeLabel: '3 Mins',
    timeKind: 'lightning',
    tag: 'Hot',
    provider: 'mock',
    sandbox: true,
  },
  {
    id: 'mock-grocery',
    title: 'Grocery Habits Survey',
    reward: 1200,
    timeLabel: '15 Mins',
    timeKind: 'clock',
    tag: 'High Reward',
    provider: 'mock',
    sandbox: true,
  },
  {
    id: 'mock-poll',
    title: 'Quick Poll: Streaming',
    reward: 50,
    timeLabel: '30 Sec',
    timeKind: 'lightning',
    tag: 'Easy',
    provider: 'mock',
    sandbox: true,
  },
]

function readEnv(key: string): string | undefined {
  const v = (process.env as Record<string, string | undefined>)[key]
  return v?.trim() || undefined
}

export function getOfferwallConfig(): {
  provider: OfferwallProviderId
  appId: string | null
  configured: boolean
} {
  const forced = (readEnv('EXPO_PUBLIC_OFFERWALL_PROVIDER') || '').toLowerCase()
  const appId = readEnv('EXPO_PUBLIC_ADGEM_APP_ID') ?? null
  const configured = Boolean(appId && appId !== 'your-adgem-app-id')
  if (forced === 'mock' || !configured) {
    return { provider: 'mock', appId: null, configured: false }
  }
  return { provider: 'adgem', appId, configured: true }
}

export function buildAdGemWallUrl(appId: string, playerId: string): string {
  const base = readEnv('EXPO_PUBLIC_ADGEM_WALL_URL') || 'https://api.adgem.com/v1/wall'
  const u = new URL(base)
  u.searchParams.set('appid', appId)
  u.searchParams.set('playerid', playerId)
  return u.toString()
}

export function openOfferwallSession(playerId: string | null | undefined): OfferwallSession {
  const cfg = getOfferwallConfig()
  if (cfg.configured && cfg.provider === 'adgem' && cfg.appId && playerId) {
    const wallUrl = buildAdGemWallUrl(cfg.appId, playerId)
    return {
      provider: 'adgem',
      configured: true,
      wallUrl,
      offers: [
        {
          id: 'adgem-wall',
          title: 'Open AdGem Offerwall',
          reward: 0,
          timeLabel: 'Offers',
          timeKind: 'offer',
          tag: 'Live',
          url: wallUrl,
          provider: 'adgem',
        },
      ],
      note: 'Live AdGem wall. Credits via postback (type=offerwall).',
    }
  }
  return {
    provider: 'mock',
    configured: false,
    wallUrl: null,
    offers: MOCK_OFFERS,
    note: 'Sandbox offerwall (no EXPO_PUBLIC_ADGEM_APP_ID).',
  }
}

export function isSandboxOffer(offer: OfferwallOffer): boolean {
  return offer.provider === 'mock' || Boolean(offer.sandbox)
}
