/**
 * AdMob rewarded video server-side verification (SSV) → points.
 *
 * AdMob console → Ad unit (Rewarded) → Server-side verification → Callback URL:
 *   https://<project-ref>.supabase.co/functions/v1/admob-ssv
 * The app passes the signed-in Supabase user id as serverSideVerificationOptions.userId.
 * Google signs the callback (ECDSA P-256); unsigned or replayed callbacks never pay.
 *
 * Deploy: supabase functions deploy admob-ssv --no-verify-jwt
 * Secrets (optional): ADMOB_POINTS_PER_VIDEO (default 20), ADMOB_DAILY_CAP (default 30)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { verifyAdMobCallback } from '../_shared/verify.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const q = url.searchParams
  // AdMob's "Verify URL" button pings without a signature — answer 200 so setup succeeds.
  if (!q.has('signature')) return json(200, { ok: true, ping: true })

  if (!(await verifyAdMobCallback(url.search))) return json(401, { ok: false, reason: 'bad_signature' })

  const playerId = q.get('user_id') ?? ''
  const tx = q.get('transaction_id') ?? ''
  if (!UUID.test(playerId) || !tx) return json(200, { ok: false, reason: 'missing_user_or_tx' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return json(500, { ok: false, reason: 'missing_env' })
  const supabase = createClient(supabaseUrl, serviceKey)

  const { data, error } = await supabase.rpc('credit_rewarded_video', {
    p_player_id: playerId,
    p_transaction_id: tx,
    p_points: Number(Deno.env.get('ADMOB_POINTS_PER_VIDEO') ?? 20) || 20,
    p_daily_cap: Number(Deno.env.get('ADMOB_DAILY_CAP') ?? 30) || 30,
    p_raw: Object.fromEntries(q),
  })
  if (error) return json(500, { ok: false, reason: error.message })
  return json(200, { ok: true, result: data })
})
