/**
 * Signature helpers for reward callbacks (offer walls, AdMob SSV). Pure WebCrypto + std MD5.
 */
import { crypto as stdCrypto } from 'jsr:@std/crypto@1'
import { encodeHex } from 'jsr:@std/encoding@1/hex'

const enc = new TextEncoder()

export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function md5Hex(message: string): Promise<string> {
  return encodeHex(await stdCrypto.subtle.digest('MD5', enc.encode(message)))
}

export async function hmacHex(hash: 'SHA-1' | 'SHA-256', key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash }, false, ['sign'])
  return encodeHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)))
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4)
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** ECDSA DER signature → raw r||s (64 bytes) as WebCrypto expects for P-256. */
export function derToRawSignature(der: Uint8Array): Uint8Array<ArrayBuffer> {
  if (der[0] !== 0x30) throw new Error('not a DER sequence')
  let offset = 2
  if (der[1] & 0x80) offset = 2 + (der[1] & 0x7f)
  const readInt = () => {
    if (der[offset] !== 0x02) throw new Error('expected DER integer')
    const len = der[offset + 1]
    let bytes = der.slice(offset + 2, offset + 2 + len)
    offset += 2 + len
    while (bytes.length > 32 && bytes[0] === 0) bytes = bytes.slice(1)
    const out = new Uint8Array(32)
    out.set(bytes, 32 - bytes.length)
    return out
  }
  const raw = new Uint8Array(64)
  raw.set(readInt(), 0)
  raw.set(readInt(), 32)
  return raw
}

export type AdMobKeyFetcher = (keyId: string) => Promise<CryptoKey | null>

const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json'
let keyCache: { at: number; keys: Map<string, CryptoKey> } | null = null

/** Google's published SSV keys, cached for an hour (they rotate rarely). */
export const fetchAdMobKey: AdMobKeyFetcher = async (keyId) => {
  if (!keyCache || Date.now() - keyCache.at > 3_600_000 || !keyCache.keys.has(keyId)) {
    const res = await fetch(ADMOB_KEYS_URL)
    const json = (await res.json()) as { keys?: { keyId: number | string; base64: string }[] }
    const keys = new Map<string, CryptoKey>()
    for (const k of json.keys ?? []) {
      const spki = Uint8Array.from(atob(k.base64), (c) => c.charCodeAt(0))
      keys.set(
        String(k.keyId),
        await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      )
    }
    keyCache = { at: Date.now(), keys }
  }
  return keyCache.keys.get(keyId) ?? null
}

/**
 * Verify an AdMob rewarded-ad SSV callback. Google signs every query parameter that
 * precedes `signature` (in order), i.e. the raw query string up to "&signature=".
 */
export async function verifyAdMobCallback(
  rawQuery: string,
  getKey: AdMobKeyFetcher = fetchAdMobKey
): Promise<boolean> {
  const query = rawQuery.replace(/^\?/, '')
  const sigIdx = query.indexOf('&signature=')
  if (sigIdx < 0) return false
  const message = query.slice(0, sigIdx)
  const params = new URLSearchParams(query)
  const signature = params.get('signature')
  const keyId = params.get('key_id')
  if (!signature || !keyId) return false
  const key = await getKey(keyId)
  if (!key) return false
  try {
    const raw = derToRawSignature(base64UrlToBytes(signature))
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, enc.encode(message))
  } catch {
    return false
  }
}
