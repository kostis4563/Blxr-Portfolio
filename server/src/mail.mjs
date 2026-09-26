const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const MAIL_FROM = process.env.MAIL_FROM || 'blxr <no-reply@blxr.net>'
const SITE_URL = (process.env.SITE_URL || 'https://blxr.net').replace(/\/$/, '')

export const mailConfigured = () => Boolean(RESEND_API_KEY)

const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function layout({ preheader, eyebrow, title, intro, footer }) {
  return `<div style="margin:0;padding:0;background-color:#0a0a0a;">
<span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;">
  <tr>
    <td align="center" style="padding:56px 24px 64px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:400px;">
        <tr><td style="padding-bottom:40px;font-family:${F};font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">blxr</td></tr>
        <tr><td style="padding-bottom:8px;font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#737373;">${eyebrow}</td></tr>
        <tr><td style="padding-bottom:10px;font-family:${F};font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${title}</td></tr>
        <tr><td style="padding-bottom:36px;font-family:${F};font-size:13.5px;line-height:1.65;color:#a3a3a3;">${intro}</td></tr>
        <tr><td style="border-top:1px dashed #2d2d2d;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding-top:20px;font-family:${F};font-size:12px;line-height:1.7;color:#737373;">${footer}</td></tr>
        <tr><td style="padding-top:40px;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#525252;"><a href="${SITE_URL}" style="color:#525252;text-decoration:none;">blxr.net</a></td></tr>
      </table>
    </td>
  </tr>
</table>
</div>`
}

export function describeClient(ua = '') {
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : null
  if (!browser && !os) return 'a browser'
  return [browser, os].filter(Boolean).join(' on ')
}

const whenText = (date) =>
  `${date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} at ${date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`

export function passwordChangedMail({ email, client, at = new Date() }) {
  const resetUrl = `${SITE_URL}/login#reset`
  return {
    subject: 'Your blxr password was changed',
    text: [
      'Your password was changed',
      '',
      `The password for ${email} was changed on ${whenText(at)} from ${client}. If that was you, there's nothing else to do.`,
      '',
      `Wasn't you? Reset your password right away: ${resetUrl}`,
    ].join('\n'),
    html: layout({
      preheader: 'The password for your blxr account was just changed.',
      eyebrow: 'Security',
      title: 'Your password was changed',
      intro: `The password for ${escapeHtml(email)} was changed on ${whenText(at)} from ${escapeHtml(client)}. If that was you, there&#39;s nothing else to do.`,
      footer: `Wasn&#39;t you? Someone else may have access to your account.<br><a href="${resetUrl}" style="color:#a3a3a3;text-decoration:underline;">Reset your password right away</a> and sign out of other sessions.`,
    }),
  }
}

export async function sendMail({ to, subject, text, html }, { signal } = {}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text, html }),
    signal,
  })
  if (!res.ok) throw new Error(`resend ${res.status}`)
}
