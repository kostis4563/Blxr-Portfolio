import { CONTACT_EMAIL, GITHUB_URL, GITHUB_USERNAME, DISCORD_URL } from './profile'
import { PROJECTS_PATH, BLOG_PATH, CV_PATH, CONTACT_PATH, PAYMENT_PATH } from './router'

export const LINKS_INTRO = 'Full stack developer in Athens.'

export const LINKS = [
  { label: 'GitHub', detail: GITHUB_USERNAME, href: GITHUB_URL },
  { label: 'Discord', detail: 'blxr__', href: DISCORD_URL },
  { label: 'Amitista Studio', detail: 'amitista.com', href: 'https://amitista.com' },
  { label: 'Email', detail: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
]

export const SITE_LINKS = [
  { label: 'Projects', to: PROJECTS_PATH },
  { label: 'Blog', to: BLOG_PATH },
  { label: 'CV', to: CV_PATH },
  { label: 'Contact', to: CONTACT_PATH },
  { label: 'Payment', to: PAYMENT_PATH },
]
