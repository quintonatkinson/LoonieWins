/**
 * Guard for scheduled / server-only Edge Functions deployed with verify_jwt = false.
 * Callers (pg_cron net.http_post, GitHub Actions) must send
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>   (or <CRON_SECRET> if that secret is set).
 * The anon key is public, so it must never unlock push / email fan-out or ingest.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function isAuthorizedCronRequest(req: Request): boolean {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  const allowed = [Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), Deno.env.get('CRON_SECRET')].filter(
    (v): v is string => Boolean(v)
  )
  return allowed.some((secret) => timingSafeEqual(token, secret))
}

export function unauthorizedResponse(headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
