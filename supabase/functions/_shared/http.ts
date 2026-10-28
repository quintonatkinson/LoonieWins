/** Shared JSON / CORS helpers for LoonieWins Edge Functions. */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, signature',
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

/**
 * Require Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (or optional CRON_SECRET).
 * Cron / GitHub Actions / dashboard schedules already send the service_role JWT.
 * Returns a 401 Response when unauthorized; null when OK.
 */
export function requireServiceBearer(req: Request): Response | null {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim() ?? ''
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return json(401, {
      ok: false,
      reason: 'unauthorized',
      hint: 'Send Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>',
    })
  }
  const okService = Boolean(serviceKey) && timingSafeEqual(token, serviceKey)
  const okCron = Boolean(cronSecret) && timingSafeEqual(token, cronSecret)
  if (!okService && !okCron) {
    return json(401, { ok: false, reason: 'unauthorized' })
  }
  return null
}

/** Abortable fetch with a hard timeout (ms). */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 12_000, ...rest } = init
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}
