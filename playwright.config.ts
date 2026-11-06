import { defineConfig, devices } from '@playwright/test'

/** 390×844 and 360×800 — common phone browser sizes (Chromium mobile UA). */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    ...devices['Pixel 7'],
  },
  projects: [
    {
      name: 'mobile-390x844',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPhone 13'].userAgent,
      },
    },
    {
      name: 'mobile-360x800',
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        userAgent: devices['Pixel 7'].userAgent,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
