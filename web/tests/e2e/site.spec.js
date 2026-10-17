import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  const own = new URL(baseURL).origin
  await page.route((url) => url.origin !== own, (route) => route.abort())
})

const scriptErrors = (page) => {
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

const PAGES = [
  ['/', /Kostis/],
  ['/projects', /Things I've built/],
  ['/blog', /Blog/],
  ['/login', /Sign in to your account/],
  ['/cv', /Kostis Nomikos/],
  ['/contact', /Say hello/],
  ['/uses', /Uses/],
  ['/library', /FiveM Library/],
]

for (const [path, heading] of PAGES) {
  test(`${path} renders and hydrates without script errors`, async ({ page }) => {
    const errors = scriptErrors(page)
    const res = await page.goto(path)
    expect(res.status()).toBe(200)
    await expect(page.locator('h1').first()).toHaveText(heading)
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
}

test('an unknown path gets the 404 page with a 404 status', async ({ page }) => {
  const errors = scriptErrors(page)
  const res = await page.goto('/definitely-not-a-page')
  expect(res.status()).toBe(404)
  await expect(page.locator('h1').first()).toHaveText(/Page not found/)
  await page.waitForLoadState('networkidle')
  expect(errors).toEqual([])
})

test('header links switch pages in place, without a full reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { window.stayedOnPage = true })
  await page.getByRole('link', { name: 'Projects', exact: true }).first().click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.locator('h1').first()).toHaveText(/Things I've built/)
  expect(await page.evaluate(() => window.stayedOnPage)).toBe(true)
})

test('a saved light theme is applied before the page paints', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('blxr-theme', 'light'))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('the theme toggle changes the theme and it survives a reload', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.locator('button[aria-label*="theme" i]').first().click()
  await expect(html).not.toHaveAttribute('data-theme', before)
  const after = await html.getAttribute('data-theme')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after)
})
