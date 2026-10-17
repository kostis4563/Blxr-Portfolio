import { CONTACT_EMAIL, GITHUB_URL, GITHUB_USERNAME } from './profile'

export const CV_UPDATED = '2026-10-17'

export const CV_NAME = 'Kostis Nomikos'
export const CV_LOCATION = 'Athens, Greece'

export const CV_ROLE = 'Full stack developer. First year of the IB Diploma.'

export const CV_SUMMARY =
  'Building software since 2024: React frontends, Node backends, and the Linux servers they run on. ' +
  'Mostly security tooling and FiveM interfaces, plus client sites through my own studio.'

export const CV_CONTACT = [
  { label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, sensitive: true },
  { label: 'Web', value: 'blxr.net', href: 'https://blxr.net' },
  { label: 'GitHub', value: `github.com/${GITHUB_USERNAME}`, href: GITHUB_URL },
]

export const CV_EXPERIENCE = [
  {
    role: 'Full Stack Developer',
    org: 'Async Scanner',
    url: 'https://github.com/kostis4563/async-anticheat',
    period: { from: '2025', to: '2026' },
    summary: 'Forensic screenshare tool: a C++ Windows scanner, Express API and React dashboard.',
  },
  {
    role: 'Freelance Developer',
    org: 'Self employed',
    url: null,
    period: { from: '2024', to: 2025 },
    summary: 'UIs, HUDs and resources for FiveM servers, with product design in Figma.',
  },
]

export const CV_EDUCATION = [
  {
    degree: 'IB Diploma Programme',
    org: 'Athens',
    period: { from: '2026', to: '2028' },
    note: 'Computer Science, Mathematics AA, Physics, Business, English B, Modern Greek.',
  },
]

export { SKILL_CATEGORIES as CV_SKILLS } from './skills'

export const CV_LANGUAGES = [
  { name: 'Greek', level: 'Native' },
  { name: 'English', level: 'Fluent' },
  { name: 'French', level: 'B1' },
]
