import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const OUT =
  process.env.LW_MOBILE_SHOTS ||
  '/cursor/stores/bc-75654b41-b9b0-482b-a0b9-b06dfd541779/media/web-first-mobile'

async function assertNoHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return el.scrollWidth - el.clientWidth
  })
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1)
}

test.describe('web-first mobile polish', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true })
  })

  test('home, profile, and enter sheet fit mobile viewport', async ({ page }, testInfo) => {
    const slug = testInfo.project.name.replace(/\s+/g, '-')
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('web-first-tagline')).toBeVisible()
    await assertNoHorizontalScroll(page)
    await page.screenshot({ path: path.join(OUT, `${slug}-01-home.png`), fullPage: false })

    await page.goto('/profile')
    await expect(page.getByTestId('web-first-about')).toBeVisible()
    await assertNoHorizontalScroll(page)
    await page.screenshot({ path: path.join(OUT, `${slug}-02-profile.png`), fullPage: false })

    await page.goto('/')
    const enterBtn = page.getByRole('button', { name: /enter next|1-tap enter|enter/i }).first()
    if (await enterBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await enterBtn.click()
      await expect(page.getByRole('dialog', { name: /contest entry/i })).toBeVisible()
      await assertNoHorizontalScroll(page)
      await page.screenshot({ path: path.join(OUT, `${slug}-03-enter-sheet.png`), fullPage: false })
    }

    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.getByRole('dialog', { name: /history/i })).toBeVisible()
    const sheetBox = await page.locator('#history-sheet').boundingBox()
    const viewport = page.viewportSize()
    expect(sheetBox && viewport).toBeTruthy()
    if (sheetBox && viewport) {
      expect(sheetBox.width).toBeGreaterThanOrEqual(viewport.width * 0.98)
    }
    await page.screenshot({ path: path.join(OUT, `${slug}-04-history-sheet.png`), fullPage: false })
  })

  test('PWA manifest and theme meta', async ({ page }) => {
    const manifest = await page.request.get('/manifest.json')
    expect(manifest.ok()).toBeTruthy()
    const json = (await manifest.json()) as { name?: string; display?: string }
    expect(json.name).toMatch(/LoonieWins/)
    expect(json.display).toBe('standalone')

    await page.goto('/')
    const theme = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(theme).toBeTruthy()
    const appleCap = await page
      .locator('meta[name="apple-mobile-web-app-capable"]')
      .getAttribute('content')
    expect(appleCap).toBe('yes')
  })
})
