// deno test --allow-env supabase/functions/
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { handleBitLabs, handleCpx } from './handlers.ts'
import { hmacHex, md5Hex, verifyAdMobCallback } from '../_shared/verify.ts'

const uid = '11111111-1111-1111-1111-111111111111'

Deno.test('CPX: valid hash credits payout × rate; bad hash rejected; status 2 reverses', async () => {
  const secret = 's3cret'
  const hash = await md5Hex(`tx1-${secret}`)
  const ok = await handleCpx(new URLSearchParams({ status: '1', trans_id: 'tx1', user_id: uid, amount_usd: '0.45', hash }), secret, 1000)
  assertEquals(ok.kind, 'credit')
  if (ok.kind === 'credit') assertEquals(ok.points, 450)
  const bad = await handleCpx(new URLSearchParams({ status: '1', trans_id: 'tx1', user_id: uid, amount_usd: '99', hash: 'x' }), secret, 1000)
  assertEquals(bad.kind, 'reject')
  const rev = await handleCpx(new URLSearchParams({ status: '2', trans_id: 'tx1', user_id: uid, hash }), secret, 1000)
  assertEquals(rev.kind, 'reverse')
})

Deno.test('BitLabs: HMAC-SHA1 over URL without hash; reconciliation reverses', async () => {
  const secret = 'bl-secret'
  const base = `https://ref.supabase.co/functions/v1/offerwall-postback?provider=bitlabs&uid=${uid}&tx=t9&raw=1.20&type=COMPLETE`
  const hash = await hmacHex('SHA-1', secret, base)
  const url = `${base}&hash=${hash}`
  const q = new URL(url).searchParams
  const ok = await handleBitLabs([url], q, secret, 1000)
  assertEquals(ok.kind, 'credit')
  if (ok.kind === 'credit') assertEquals(ok.points, 1200)
  const tampered = new URL(url.replace('raw=1.20', 'raw=99')).searchParams
  assertEquals((await handleBitLabs([url.replace('raw=1.20', 'raw=99')], tampered, secret, 1000)).kind, 'reject')
  const recBase = base.replace('COMPLETE', 'RECONCILIATION').replace('raw=1.20', 'raw=-1.20')
  const recUrl = `${recBase}&hash=${await hmacHex('SHA-1', secret, recBase)}`
  assertEquals((await handleBitLabs([recUrl], new URL(recUrl).searchParams, secret, 1000)).kind, 'reverse')
})

Deno.test('AdMob SSV: accepts a Google-style DER signature, rejects tampering', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const message = `ad_network=5450213213286189855&ad_unit=123&reward_amount=1&reward_item=pts&timestamp=1700000000000&transaction_id=abc&user_id=${uid}`
  const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(message)))
  // raw r||s → DER, as Google sends it
  const int = (b: Uint8Array) => {
    let i = 0
    while (i < b.length - 1 && b[i] === 0) i++
    let v = b.slice(i)
    if (v[0] & 0x80) v = Uint8Array.from([0, ...v])
    return Uint8Array.from([0x02, v.length, ...v])
  }
  const r = int(raw.slice(0, 32)), s = int(raw.slice(32))
  const der = Uint8Array.from([0x30, r.length + s.length, ...r, ...s])
  const sig = btoa(String.fromCharCode(...der)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const getKey = async (id: string) => (id === '42' ? pair.publicKey : null)
  assert(await verifyAdMobCallback(`?${message}&signature=${sig}&key_id=42`, getKey))
  assert(!(await verifyAdMobCallback(`?${message.replace('abc', 'abd')}&signature=${sig}&key_id=42`, getKey)))
  assert(!(await verifyAdMobCallback(`?${message}&signature=${sig}&key_id=7`, getKey)))
})
