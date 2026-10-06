import { CONTACT_EMAIL } from './profile'

export const SECURITY_UPDATED = '2026-10-06'

export const SECURITY_EXPIRES = '2027-10-06'

export const SECURITY_TXT_PATH = '/.well-known/security.txt'

export const SECURITY_INTRO =
  'Found a hole in blxr.net or something I built? Tell me privately first. I read every report myself and answer each one.'

export const SECURITY_SUBJECT = 'Security: '

export const SECURITY_LANGUAGES = ['en', 'el']

export const SECURITY_KEYS = [
  {
    id: 'pgp',
    label: 'PGP',
    note: 'Encrypt anything sensitive with this.',
    fingerprint: null,
    href: null,
  },
  {
    id: 'ssh',
    label: 'SSH',
    note: 'Check that a signed commit or server really is mine.',
    fingerprint: null,
    href: null,
  },
]

export const SECURITY_STEPS = [
  { title: 'You report it', body: 'Email me privately with the steps to reproduce, what it affects and a proof of concept if you have one.', when: 'Day 0' },
  { title: 'I acknowledge', body: 'You get a human reply confirming I have it, and a first read on severity.', when: '72 hours' },
  { title: 'I fix it', body: 'I keep you updated while I work on it. Critical issues go first, everything else is patched in order.', when: '≤ 90 days' },
  { title: 'We disclose', body: 'Once it is fixed you are free to write about it. I credit you, if you want the credit.', when: 'After the fix' },
]

export const SECURITY_SCOPE = {
  in: [
    'blxr.net and every page on it',
    'The API under blxr.net/api',
    'Accounts, sign-in and the dashboard',
    'Private messages and their encryption',
    'Public repos on my GitHub',
  ],
  out: [
    'Cloudflare, Supabase, GitHub and other third parties',
    'Denial of service and load testing',
    'Phishing or social engineering',
    'Scanner output with no working proof',
    'Missing headers or SPF / DMARC with no real impact',
    'Self-XSS and clickjacking on pages with no actions',
  ],
}

export const SECURITY_SAFE_HARBOUR =
  'If you act in good faith I will not take legal action or report you. That means staying in scope, using your own accounts, touching no more data than it takes to prove the bug, not degrading the site for anyone else, and giving me a fair chance to fix it before going public.'

export const SECURITY_BOUNTY =
  'There is no paid bug bounty. This is a one-person site. Valid reports get a proper thank-you and credit in the write-up, under the name you choose or anonymously.'

export function securityTxt(siteUrl) {
  const pgp = SECURITY_KEYS.find((key) => key.id === 'pgp')
  return [
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${SECURITY_EXPIRES}T00:00:00.000Z`,
    ...(pgp?.href ? [`Encryption: ${pgp.href}`] : []),
    `Preferred-Languages: ${SECURITY_LANGUAGES.join(', ')}`,
    `Canonical: ${siteUrl}${SECURITY_TXT_PATH}`,
    `Policy: ${siteUrl}/security`,
    '',
  ].join('\n')
}
