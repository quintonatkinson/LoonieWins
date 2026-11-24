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

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (v === '::' || v === '::1') return true
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  if (v.startsWith('::ffff:')) return true
  return /^(fc|fd|fe[89ab])/.test(v)
}

/**
 * Only public http(s) destinations: blocks loopback, private, link-local and
 * metadata addresses, both as literals and as the host's resolved DNS records.
 */
export async function isPublicHttpUrl(raw: string): Promise<boolean> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (u.username || u.password) return false
  if (u.port && u.port !== '80' && u.port !== '443') return false
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) {
    return false
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !isPrivateIPv4(host)
  if (host.includes(':') || host.startsWith('[')) return !isPrivateIPv6(host)
  if (!host.includes('.')) return false

  const addrs: string[] = []
  for (const type of ['A', 'AAAA'] as const) {
    try {
      addrs.push(...(await Deno.resolveDns(host, type)))
    } catch {
      /* no records of this type */
    }
  }
  if (addrs.length === 0) return false
  return addrs.every((a) => (a.includes(':') ? !isPrivateIPv6(a) : !isPrivateIPv4(a)))
}

/** fetchWithTimeout that refuses non-public destinations, re-checking every redirect hop. */
export async function fetchPublicUrl(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  maxRedirects = 5
): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await isPublicHttpUrl(current))) {
      throw new Error('blocked_destination')
    }
    const res = await fetchWithTimeout(current, { ...init, redirect: 'manual' })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel()
      current = new URL(location, current).toString()
      continue
    }
    return res
  }
  throw new Error('too_many_redirects')
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
