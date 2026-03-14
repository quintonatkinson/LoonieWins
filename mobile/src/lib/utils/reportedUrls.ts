import { storage } from './storage'

const STORAGE_KEY = 'looniewins_reported_urls'

export async function getReportedUrls(): Promise<Set<string>> {
  try {
    const raw = await storage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((u): u is string => typeof u === 'string'))
  } catch {
    return new Set()
  }
}

export async function reportUrl(url: string): Promise<void> {
  if (!url || typeof url !== 'string') return
  const set = await getReportedUrls()
  set.add(url.trim())
  await storage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}
