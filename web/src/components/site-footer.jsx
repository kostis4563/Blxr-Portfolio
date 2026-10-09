import { Icon } from './icon'
import { GridToggle } from './figma'
import {
  link,
  HOME_PATH,
  PROJECTS_PATH,
  LIBRARY_PATH,
  BLOG_PATH,
  CV_PATH,
  USES_PATH,
  REVIEWS_PATH,
  CONTACT_PATH,
  PAYMENT_PATH,
  VOLUNTEER_PATH,
  GALLERY_PATH,
  SECURITY_PATH,
  IB_PATH,
  LISTENING_PATH,
} from '../lib/router'
import { GITHUB_URL, DISCORD_URL, CONTACT_EMAIL, SOCIAL_ICON_PATHS } from '../lib/profile'

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', to: HOME_PATH },
      { label: 'Projects', to: PROJECTS_PATH },
      { label: 'Library', to: LIBRARY_PATH },
      { label: 'Blog', to: BLOG_PATH },
      { label: 'Gallery', to: GALLERY_PATH },
      { label: 'IB grades', to: IB_PATH },
      { label: 'Listening', to: LISTENING_PATH },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'CV', to: CV_PATH },
      { label: 'Uses', to: USES_PATH },
      { label: 'Reviews', to: REVIEWS_PATH },
      { label: 'Volunteering', to: VOLUNTEER_PATH },
      { label: 'Security', to: SECURITY_PATH },
    ],
  },
  {
    title: 'Work with me',
    links: [
      { label: 'Contact', to: CONTACT_PATH },
      { label: 'Payment', to: PAYMENT_PATH },
      { label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
]

const SOCIALS = [
  { label: 'GitHub', href: GITHUB_URL, path: SOCIAL_ICON_PATHS.GitHub },
  { label: 'Discord', href: DISCORD_URL, path: SOCIAL_ICON_PATHS.Discord },
]

const QUIET =
  'rounded outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30 motion-reduce:transition-none'

const ICON_BUTTON = `flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-hover ${QUIET}`

export default function SiteFooter({ id, className = '', gutter = 'px-6', showGrid = false }) {
  const year = new Date().getFullYear()

  return (
    <footer id={id} className={`border-t border-dashed border-line text-[12.5px] text-ink-muted ${className}`}>
      <div className={`flex flex-col gap-10 py-12 md:flex-row md:justify-between ${gutter}`}>
        <div className="flex max-w-60 flex-col items-start gap-3">
          <a {...link(HOME_PATH)} aria-label="Blxr home" className={`font-bagus text-[22px] leading-none text-ink-strong ${QUIET}`}>
            blxr
          </a>
          <p className="leading-relaxed text-ink-subtle">
            Backend and web tooling with Go, JavaScript and Python.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:flex sm:gap-16">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
              <p className="font-medium text-ink-strong">{column.title}</p>
              <ul className="flex flex-col gap-2.5">
                {column.links.map(({ label, to, href }) => (
                  <li key={label}>
                    <a {...(to ? link(to) : { href })} className={QUIET}>{label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className={`flex items-center justify-between gap-4 border-t border-dashed border-line py-4 ${gutter}`}>
        <p className="text-[12px] text-ink-subtle">© {year} Blxr · Athens, Greece</p>

        <ul className="-mr-2 flex items-center gap-0.5">
          {SOCIALS.map(({ label, href, path }) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={ICON_BUTTON}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                  <path d={path} />
                </svg>
              </a>
            </li>
          ))}
          <li>
            <a href={`mailto:${CONTACT_EMAIL}`} aria-label="Email" title="Email" className={ICON_BUTTON}>
              <Icon name="mail" className="h-4 w-4" />
            </a>
          </li>
          {showGrid && (
            <li className="flex items-center">
              <span aria-hidden="true" className="mx-1.5 h-4 border-l border-dashed border-line" />
              <GridToggle className={`aria-pressed:text-ink-strong [&>kbd]:hidden ${ICON_BUTTON}`} />
            </li>
          )}
        </ul>
      </div>
    </footer>
  )
}
