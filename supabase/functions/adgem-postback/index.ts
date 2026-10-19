/**
 * AdGem offerwall postback → credits points server-side.
 *
 * Deploy:
 *   npx supabase functions deploy adgem-postback --project-ref oftunznsumfidavvbqz
 *
 * Secrets (Dashboard → Edge Functions → Secrets — NEVER in the client):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADGEM_POSTBACK_KEY   (AdGem dashboard Postback Key for HMAC)
 * Optional:
 *   ADGEM_APP_ID         (reject mismatched app_id)
 *   ADGEM_POINTS_PER_USD (default 1000 — maps payout USD → pts; prefer payout over amount)
 *
 * AdGem Postback URL (v2 GET example):
 *   https://oftunznsumfidavvbqz.supabase.co/functions/v1/adgem-postback
 *     ?player_id={player_id}&transaction_id={transaction_id}&amount={amount}
 *     &payout={payout}&campaign_id={campaign_id}&app_id={app_id}
 *     &request_id={request_id}&verifier={verifier}
 *
 * Verification (v2): HMAC-SHA256(hex) of the full request URL with `verifier`
 * query param stripped, keyed by ADGEM_POSTBACK_KEY.
 * v3: HMAC-SHA256(raw body) compared to `Signature` header.
 *
 * Security: service_role stays on the server only. Clients open the wall with
 * the public app id; completions are trusted only after this webhook verifies.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, signature',
}

function hexHmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  return crypto.subtle
    .importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((cryptoKey) => crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message)))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    )
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Prefer AdGem `payout` (true publisher USD) × POINTS_PER_USD so credits track
 * Quinton's revenue even if the dashboard virtual-currency `amount` rate drifts.
 * Fall back to `amount` only when payout is missing.
 */
function pointsFromPayload(
  amountRaw: string | null,
  payoutRaw: string | null,
  pointsPerUsd: number
): number {
  const payout = Number(payoutRaw)
  if (Number.isFinite(payout) && payout > 0) {
    return Math.max(1, Math.round(payout * pointsPerUsd))
  }
  const amount = Number(amountRaw)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  return 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const postbackKey = Deno.env.get('ADGEM_POSTBACK_KEY')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const expectedAppId = Deno.env.get('ADGEM_APP_ID')?.trim()
  const pointsPerUsd = Number(Deno.env.get('ADGEM_POINTS_PER_USD') || '1000')

  if (!postbackKey || !supabaseUrl || !serviceKey) {
    return json(500, {
      ok: false,
      reason: 'server_misconfigured',
      hint: 'Set ADGEM_POSTBACK_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the function',
    })
  }

  const url = new URL(req.url)
  let playerId: string | null = null
  let externalId: string | null = null
  let amountRaw: string | null = null
  let payoutRaw: string | null = null
  let campaignId: string | null = null
  let appId: string | null = null
  let raw: Record<string, unknown> = {}

  try {
    if (req.method === 'POST') {
      const rawBody = await req.text()
      const signature = req.headers.get('Signature') || req.headers.get('signature') || ''
      if (signature) {
        const expected = await hexHmacSha256(postbackKey, rawBody)
        if (!timingSafeEqual(expected.toLowerCase(), signature.toLowerCase())) {
          return json(401, { ok: false, reason: 'bad_signature' })
        }
      } else {
        // Allow unsigned POST only when explicitly disabled (not recommended)
        if (Deno.env.get('ADGEM_ALLOW_UNSIGNED') !== 'true') {
          return json(401, { ok: false, reason: 'missing_signature' })
        }
      }

      let body: Record<string, unknown> = {}
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>
      } catch {
        return json(400, { ok: false, reason: 'invalid_json' })
      }
      const data = (body.data as Record<string, unknown> | undefined) ?? body
      playerId = String(data.player_id ?? data.userid ?? '')
      externalId = String(
        data.conversion_id ?? data.transaction_id ?? body.request_id ?? ''
      )
      amountRaw = data.amount != null ? String(data.amount) : null
      payoutRaw = data.payout != null ? String(data.payout) : null
      campaignId = data.campaign_id != null ? String(data.campaign_id) : null
      appId = data.app_id != null ? String(data.app_id) : null
      raw = body
    } else {
      // v2 GET — verify HMAC over URL without verifier
      const verifier = url.searchParams.get('verifier') || ''
      if (verifier) {
        const verifyUrl = new URL(req.url)
        verifyUrl.searchParams.delete('verifier')
        const expected = await hexHmacSha256(postbackKey, verifyUrl.toString())
        if (!timingSafeEqual(expected.toLowerCase(), verifier.toLowerCase())) {
          return json(401, { ok: false, reason: 'bad_verifier' })
        }
      } else if (Deno.env.get('ADGEM_ALLOW_UNSIGNED') !== 'true') {
        return json(401, { ok: false, reason: 'missing_verifier' })
      }

      playerId = url.searchParams.get('player_id') || url.searchParams.get('userid')
      externalId =
        url.searchParams.get('transaction_id') ||
        url.searchParams.get('conversion_id') ||
        url.searchParams.get('request_id')
      amountRaw = url.searchParams.get('amount')
      payoutRaw = url.searchParams.get('payout')
      campaignId = url.searchParams.get('campaign_id') || url.searchParams.get('offer_id')
      appId = url.searchParams.get('app_id')
      raw = Object.fromEntries(url.searchParams.entries())
    }
  } catch (e) {
    return json(400, { ok: false, reason: 'parse_error', detail: String(e) })
  }

  if (expectedAppId && appId && appId !== expectedAppId) {
    return json(400, { ok: false, reason: 'app_id_mismatch' })
  }

  if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) {
    return json(400, { ok: false, reason: 'bad_player_id' })
  }
  if (!externalId) {
    return json(400, { ok: false, reason: 'missing_transaction_id' })
  }

  const points = pointsFromPayload(amountRaw, payoutRaw, pointsPerUsd)
  if (points <= 0) {
    return json(400, { ok: false, reason: 'bad_amount' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.rpc('credit_offerwall_completion', {
    p_provider: 'adgem',
    p_external_id: externalId,
    p_player_id: playerId,
    p_amount_points: points,
    p_payout_usd: payoutRaw != null ? Number(payoutRaw) : null,
    p_campaign_id: campaignId,
    p_raw: raw,
  })

  if (error) {
    console.error('[adgem-postback]', error.message)
    return json(500, { ok: false, reason: 'rpc_error', detail: error.message })
  }

  // AdGem expects HTTP 200 on success
  return json(200, { ok: true, result: data })
})
