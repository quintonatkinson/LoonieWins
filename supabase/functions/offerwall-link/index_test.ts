import { assertEquals } from 'jsr:@std/assert@1'
import { buildWalls } from './index.ts'
import { md5Hex } from '../_shared/verify.ts'

Deno.test('buildWalls only lists configured walls and signs CPX server-side', async () => {
  const uid = '11111111-1111-1111-1111-111111111111'
  assertEquals(await buildWalls(uid, () => undefined), [])
  const env: Record<string, string> = { CPX_APP_ID: '123', CPX_SECURE_HASH: 'sh', BITLABS_TOKEN: 'tok' }
  const walls = await buildWalls(uid, (k) => env[k])
  assertEquals(walls.map((w) => w.id), ['bitlabs', 'cpx'])
  const cpx = new URL(walls[1].url)
  assertEquals(cpx.searchParams.get('secure_hash'), await md5Hex(`${uid}-sh`))
  assertEquals(cpx.searchParams.get('ext_user_id'), uid)
})
