export function sanitizeContestUrl(url: string): string {
  if (!url || typeof url !== 'string') return url
  let u = url.trim()
  const feedSuffixes = [
    /\/feed\/?$/i,
    /\/rss\/?$/i,
    /\/atom\/?$/i,
    /\/atom\.xml\/?$/i,
  ]
  for (const re of feedSuffixes) {
    u = u.replace(re, '')
  }
  return u.replace(/\/$/, '') || u
}
