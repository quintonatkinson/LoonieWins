/**
 * Survey / offer wall callbacks → normalized credit or reversal instructions.
 * Pure (no Supabase) so every provider's signature rule is unit-tested.
 *
 * Points are always derived from the provider's USD payout × POINTS_PER_USD (default 1000,
 * same rate as AdGem), never from a client- or dashboard-configured virtual currency value,
 * so credits track real revenue.
 */
import { hmacHex, md5Hex, timingSafeEqual } from '../_shared/verify.ts'

export type PostbackAction =
  | { kind: 'credit'; provider: string; externalId: string; playerId: string; points: number; payoutUsd: number; raw: Record<string, string> }
  | { kind: 'reverse'; provider: string; externalId: string }
  | { kind: 'ignore'; reason: string }
  | { kind: 'reject'; status: number; reason: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function pointsFromUsd(usd: number, perUsd: number): number {
  return Number.isFinite(usd) && usd > 0 ? Math.max(1, Math.round(usd * perUsd)) : 0
}

/**
 * CPX Research. Postback URL (CPX dashboard → App settings):
 *   …/offerwall-postback?provider=cpx&status={status}&trans_id={trans_id}&user_id={user_id}
 *     &amount_usd={amount_usd}&offer_id={offer_id}&hash={secure_hash}
 * hash = md5(trans_id + "-" + CPX_SECURE_HASH). status 1 = completed, 2 = reversed.
 */
export async function handleCpx(q: URLSearchParams, secret: string, perUsd: number): Promise<PostbackAction> {
  if (!secret) return { kind: 'reject', status: 500, reason: 'CPX_SECURE_HASH not set' }
  const tx = q.get('trans_id') ?? ''
  const expected = await md5Hex(`${tx}-${secret}`)
  if (!tx || !timingSafeEqual((q.get('hash') ?? '').toLowerCase(), expected)) {
    return { kind: 'reject', status: 401, reason: 'bad_hash' }
  }
  const status = q.get('status')
  if (status === '2') return { kind: 'reverse', provider: 'cpx', externalId: tx }
  if (status !== '1') return { kind: 'ignore', reason: `status_${status}` }
  const playerId = q.get('user_id') ?? ''
  if (!UUID.test(playerId)) return { kind: 'reject', status: 400, reason: 'bad_user_id' }
  const payoutUsd = Number(q.get('amount_usd'))
  const points = pointsFromUsd(payoutUsd, perUsd)
  if (points <= 0) return { kind: 'ignore', reason: 'zero_payout' }
  return { kind: 'credit', provider: 'cpx', externalId: tx, playerId, points, payoutUsd, raw: Object.fromEntries(q) }
}

/**
 * BitLabs. Callback URL (BitLabs dashboard → Callbacks):
 *   …/offerwall-postback?provider=bitlabs&uid=[%USER:ID%]&tx=[%TX%]&raw=[%RAW%]&type=[%TYPE%]
 * BitLabs appends &hash = HMAC-SHA1(full callback URL without the hash param, BITLABS_SECRET).
 * type RECONCILIATION = chargeback; COMPLETE / SCREENOUT / START_BONUS / MAGIC_RECEIPT etc. pay.
 * `candidateUrls` are the public URL spellings the signature may have been computed over.
 */
export async function handleBitLabs(
  candidateUrls: string[],
  q: URLSearchParams,
  secret: string,
  perUsd: number
): Promise<PostbackAction> {
  if (!secret) return { kind: 'reject', status: 500, reason: 'BITLABS_SECRET not set' }
  const hash = (q.get('hash') ?? '').toLowerCase()
  let valid = false
  for (const url of candidateUrls) {
    const unsigned = url.replace(/([?&])hash=[^&]*(&|$)/, (_m, pre, post) => (post ? pre : '')).replace(/[?&]$/, '')
    if (timingSafeEqual(hash, await hmacHex('SHA-1', secret, unsigned))) {
      valid = true
      break
    }
  }
  if (!valid) return { kind: 'reject', status: 401, reason: 'bad_hash' }
  const tx = q.get('tx') ?? ''
  if (!tx) return { kind: 'reject', status: 400, reason: 'missing_tx' }
  const type = (q.get('type') ?? '').toUpperCase()
  const payoutUsd = Number(q.get('raw'))
  if (type === 'RECONCILIATION' || payoutUsd < 0) return { kind: 'reverse', provider: 'bitlabs', externalId: tx }
  const playerId = q.get('uid') ?? ''
  if (!UUID.test(playerId)) return { kind: 'reject', status: 400, reason: 'bad_user_id' }
  const points = pointsFromUsd(payoutUsd, perUsd)
  if (points <= 0) return { kind: 'ignore', reason: 'zero_payout' }
  return { kind: 'credit', provider: 'bitlabs', externalId: tx, playerId, points, payoutUsd, raw: Object.fromEntries(q) }
}
