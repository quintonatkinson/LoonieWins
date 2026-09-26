/**
 * Survey / offer wall server-to-server callbacks (CPX Research, BitLabs) → points.
 * AdGem keeps its own function (adgem-postback); rewarded video uses admob-ssv.
 *
 * Deploy: supabase functions deploy offerwall-postback --no-verify-jwt
 * Secrets: CPX_SECURE_HASH, BITLABS_SECRET, optional OFFERWALL_POINTS_PER_USD (default 1000)
 * Callback URLs to paste into each provider dashboard: see handlers.ts.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { handleBitLabs, handleCpx, type PostbackAction } from './handlers.ts'

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return json(500, { ok: false, reason: 'missing_env' })

  const url = new URL(req.url)
  const q = url.searchParams
  const provider = (q.get('provider') ?? '').toLowerCase()
  const perUsd = Number(Deno.env.get('OFFERWALL_POINTS_PER_USD') ?? 1000) || 1000
  // The runtime may see an internal URL; BitLabs signs the public one.
  const publicUrl = `${supabaseUrl}/functions/v1/offerwall-postback${url.search}`
  const candidates = [publicUrl, req.url, req.url.replace(/^http:/, 'https:')]

  let action: PostbackAction
  if (provider === 'cpx') action = await handleCpx(q, Deno.env.get('CPX_SECURE_HASH') ?? '', perUsd)
  else if (provider === 'bitlabs') action = await handleBitLabs(candidates, q, Deno.env.get('BITLABS_SECRET') ?? '', perUsd)
  else return json(400, { ok: false, reason: 'unknown_provider' })

  if (action.kind === 'reject') return json(action.status, { ok: false, reason: action.reason })
  if (action.kind === 'ignore') return json(200, { ok: true, ignored: action.reason })

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } =
    action.kind === 'credit'
      ? await supabase.rpc('credit_offerwall_completion', {
          p_provider: action.provider,
          p_external_id: action.externalId,
          p_player_id: action.playerId,
          p_amount_points: action.points,
          p_payout_usd: action.payoutUsd,
          p_campaign_id: null,
          p_raw: action.raw,
        })
      : await supabase.rpc('reverse_offerwall_completion', {
          p_provider: action.provider,
          p_external_id: action.externalId,
        })
  // 5xx makes providers retry; the RPCs are idempotent on (provider, external_id).
  if (error) return json(500, { ok: false, reason: error.message })
  return json(200, { ok: true, result: data })
})
