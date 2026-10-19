/**
 * RevenueCat webhook → mirrors Pro entitlement onto profiles via service_role.
 *
 * Deploy:
 *   npx supabase functions deploy revenuecat-webhook --project-ref <ref>
 *
 * Secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVENUECAT_WEBHOOK_AUTH  (Authorization bearer you set in RevenueCat → Integrations → Webhooks)
 *
 * Idempotency: tracking.iap_webhook_events unique(provider, event_id)
 *   (migration 20261019_iap_webhook_idempotency.sql)
 *
 * Client never sees service_role. App only uses public RevenueCat SDK keys.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders, json, timingSafeEqual } from '../_shared/http.ts'

function tierFromProduct(productId: string | undefined | null): 'weekly' | 'monthly' | 'free' {
  if (!productId) return 'free'
  const id = productId.toLowerCase()
  if (id.includes('weekly')) return 'weekly'
  if (id.includes('monthly')) return 'monthly'
  return 'monthly'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, reason: 'method_not_allowed' })
  }

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!expectedAuth || !supabaseUrl || !serviceKey) {
    console.error('[revenuecat-webhook] misconfigured — missing secrets')
    return json(500, {
      ok: false,
      reason: 'server_misconfigured',
      hint: 'Set REVENUECAT_WEBHOOK_AUTH + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token || !timingSafeEqual(token, expectedAuth)) {
    return json(401, { ok: false, reason: 'unauthorized' })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json(400, { ok: false, reason: 'invalid_json' })
  }

  const event = (body.event as Record<string, unknown> | undefined) ?? body
  const type = String(event.type ?? body.type ?? '')
  const appUserId = String(event.app_user_id ?? event.appUserId ?? '')
  const productId = String(
    event.product_id ?? event.productId ?? event.new_product_id ?? ''
  )
  const expiration =
    (event.expiration_at_ms as number | undefined) ??
    (event.expiration_at as number | undefined)

  // RevenueCat event id (id / event.id / id field on envelope)
  const eventId = String(
    event.id ?? body.id ?? event.event_id ?? body.event_id ?? ''
  ).trim()

  if (!appUserId || !/^[0-9a-f-]{36}$/i.test(appUserId)) {
    // Anonymous RC ids — ignore quietly
    return json(200, { ok: true, skipped: true, reason: 'non_uuid_app_user' })
  }

  const revokeTypes = new Set([
    'EXPIRATION',
    'CANCELLATION',
    'SUBSCRIPTION_PAUSED',
    'BILLING_ISSUE',
  ])
  const grantTypes = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'PRODUCT_CHANGE',
    'NON_RENEWING_PURCHASE',
    'SUBSCRIPTION_EXTENDED',
  ])

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const webhookLog = () => admin.schema('tracking').from('iap_webhook_events')

  // Idempotency — skip if we already processed this event id
  if (eventId) {
    const { data: existing, error: existErr } = await webhookLog()
      .select('id')
      .eq('provider', 'revenuecat')
      .eq('event_id', eventId)
      .maybeSingle()
    if (existErr) {
      // Migration not applied yet — continue without idempotency log
      console.warn('[revenuecat-webhook] idempotency select', existErr.message)
    } else if (existing) {
      console.log('[revenuecat-webhook] duplicate event', eventId)
      return json(200, { ok: true, duplicate: true, event_id: eventId, type })
    }
  }

  let active = grantTypes.has(type)
  if (revokeTypes.has(type)) active = false
  if (!grantTypes.has(type) && !revokeTypes.has(type)) {
    // TRANSFER / TEST / etc. — record + no-op entitlement change
    if (eventId) {
      const { error: ignErr } = await webhookLog().upsert(
        {
          provider: 'revenuecat',
          event_id: eventId,
          event_type: type || 'unknown',
          app_user_id: appUserId,
          raw: body,
        },
        { onConflict: 'provider,event_id', ignoreDuplicates: true }
      )
      if (ignErr) console.warn('[revenuecat-webhook] idempotency log', ignErr.message)
    }
    return json(200, { ok: true, ignored: true, type })
  }

  const tier = active ? tierFromProduct(productId) : 'free'
  const expiresAt =
    expiration && Number.isFinite(expiration)
      ? new Date(expiration > 1e12 ? expiration : expiration * 1000).toISOString()
      : null

  const { data, error } = await admin.rpc('apply_iap_entitlement', {
    p_user_id: appUserId,
    p_tier: tier,
    p_product_id: productId || null,
    p_expires_at: expiresAt,
    p_active: active,
  })

  if (error) {
    console.error('[revenuecat-webhook] rpc', error.message)
    return json(500, { ok: false, reason: 'rpc_error', detail: error.message })
  }

  const result = (data ?? {}) as Record<string, unknown>
  if (result.ok === false) {
    return json(400, { ok: false, reason: result.reason ?? 'entitlement_rejected', result })
  }

  if (eventId) {
    const { error: logErr } = await webhookLog().upsert(
      {
        provider: 'revenuecat',
        event_id: eventId,
        event_type: type,
        app_user_id: appUserId,
        raw: body,
      },
      { onConflict: 'provider,event_id', ignoreDuplicates: true }
    )
    if (logErr) {
      // Table may be missing until migration runs — still succeed entitlement
      console.warn('[revenuecat-webhook] idempotency log', logErr.message)
    }
  }

  console.log('[revenuecat-webhook] ok', type, appUserId, tier, active)
  return json(200, { ok: true, type, event_id: eventId || null, result })
})
