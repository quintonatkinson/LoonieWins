/**
 * Returns signed, player-scoped offer/survey wall URLs for the signed-in user.
 * Keeps provider secrets (CPX secure hash) server-side and lets you switch walls on/off
 * by setting secrets — no app release needed.
 *
 * Deploy: supabase functions deploy offerwall-link   (JWT verified: signed-in users only)
 * Secrets (set the ones you use):
 *   BITLABS_TOKEN                 BitLabs app token
 *   CPX_APP_ID + CPX_SECURE_HASH  CPX Research app id + secure hash
 *   ADGEM_APP_ID                  AdGem app id
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { md5Hex } from '../_shared/verify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

export interface Wall {
  id: 'bitlabs' | 'cpx' | 'adgem'
  title: string
  subtitle: string
  url: string
}

export async function buildWalls(uid: string, env: (k: string) => string | undefined): Promise<Wall[]> {
  const walls: Wall[] = []
  const bitlabs = env('BITLABS_TOKEN')
  if (bitlabs) {
    const u = new URL('https://web.bitlabs.ai/')
    u.searchParams.set('uid', uid)
    u.searchParams.set('token', bitlabs)
    walls.push({ id: 'bitlabs', title: 'Paid surveys', subtitle: '2–15 min · best payouts', url: u.toString() })
  }
  const cpxApp = env('CPX_APP_ID')
  const cpxHash = env('CPX_SECURE_HASH')
  if (cpxApp && cpxHash) {
    const u = new URL('https://offers.cpx-research.com/index.php')
    u.searchParams.set('app_id', cpxApp)
    u.searchParams.set('ext_user_id', uid)
    u.searchParams.set('secure_hash', await md5Hex(`${uid}-${cpxHash}`))
    walls.push({ id: 'cpx', title: 'More surveys', subtitle: 'New surveys all day', url: u.toString() })
  }
  const adgem = env('ADGEM_APP_ID')
  if (adgem) {
    const u = new URL('https://api.adgem.com/v1/wall')
    u.searchParams.set('appid', adgem)
    u.searchParams.set('playerid', uid)
    walls.push({ id: 'adgem', title: 'Games & app offers', subtitle: 'Biggest rewards · play to earn', url: u.toString() })
  }
  return walls
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return json(401, { ok: false, reason: 'not_signed_in' })
    return json(200, { ok: true, walls: await buildWalls(data.user.id, (k) => Deno.env.get(k)) })
  })
}
