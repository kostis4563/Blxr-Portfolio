import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.RESEND_API_KEY = 're_unit_test'
process.env.MAIL_FROM = 'blxr <no-reply@blxr.test>'
process.env.SITE_URL = 'https://blxr.test/'
const { describeClient, passwordChangedMail, sendMail, mailConfigured } = await import('../src/mail.mjs')

const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  operaWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/113.0.0.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  curl: 'curl/8.7.1',
}

describe('describeClient', () => {
  const cases = [
    [UA.chromeMac, 'Chrome on macOS'],
    [UA.safariIphone, 'Safari on iOS'],
    [UA.firefoxLinux, 'Firefox on Linux'],
    [UA.edgeWindows, 'Edge on Windows'],
    [UA.operaWindows, 'Opera on Windows'],
    [UA.chromeAndroid, 'Chrome on Android'],
    [UA.curl, 'a browser'],
    ['', 'a browser'],
    [undefined, 'a browser'],
  ]
  for (const [ua, expected] of cases) {
    test(`${expected} ← ${String(ua).slice(0, 40)}`, () => assert.equal(describeClient(ua), expected))
  }
})

describe('passwordChangedMail', () => {
  const at = new Date('2026-09-24T13:05:00Z')

  test('names the account, time and device in both text and HTML', () => {
    const mail = passwordChangedMail({ email: 'kostis@example.com', client: 'Chrome on macOS', at })
    assert.equal(mail.subject, 'Your blxr password was changed')
    for (const body of [mail.text, mail.html]) {
      assert.match(body, /kostis@example\.com/)
      assert.match(body, /Chrome on macOS/)
      assert.match(body, /24 Sept? 2026 at 13:05 UTC/)
      assert.match(body, /https:\/\/blxr\.test\/login#reset/, 'SITE_URL trailing slash is dropped')
    }
  })

  test('escapes attacker-controlled values in the HTML part', () => {
    const mail = passwordChangedMail({
      email: '"><img src=x onerror=alert(1)>@example.com',
      client: '<script>alert("ua")</script>',
      at,
    })
    assert.doesNotMatch(mail.html, /<script>|<img src=x/)
    assert.match(mail.html, /&lt;script&gt;alert\(&quot;ua&quot;\)&lt;\/script&gt;/)
    assert.match(mail.html, /&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;/)
  })

  test('the HTML is a self-contained, image-free table layout', () => {
    const { html } = passwordChangedMail({ email: 'a@b.c', client: 'x', at })
    assert.doesNotMatch(html, /<img|<link|<script|url\(/i)
    assert.match(html, /role="presentation"/)
  })
})

describe('sendMail', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('posts to Resend with the key, sender and payload', async () => {
    let seen
    globalThis.fetch = async (url, init) => {
      seen = { url, init }
      return new Response('{}', { status: 200 })
    }
    const controller = new AbortController()
    await sendMail({ to: 'x@y.z', subject: 's', text: 't', html: '<p>h</p>' }, { signal: controller.signal })
    assert.equal(seen.url, 'https://api.resend.com/emails')
    assert.equal(seen.init.method, 'POST')
    assert.equal(seen.init.headers.authorization, 'Bearer re_unit_test')
    assert.equal(seen.init.signal, controller.signal)
    assert.deepEqual(JSON.parse(seen.init.body), { from: 'blxr <no-reply@blxr.test>', to: ['x@y.z'], subject: 's', text: 't', html: '<p>h</p>' })
  })

  test('throws on a non-2xx answer so callers can report it', async () => {
    globalThis.fetch = async () => new Response('nope', { status: 422 })
    await assert.rejects(sendMail({ to: 'x@y.z', subject: 's', text: 't', html: 'h' }), /resend 422/)
  })

  test('mailConfigured reflects RESEND_API_KEY', () => assert.equal(mailConfigured(), true))
})
