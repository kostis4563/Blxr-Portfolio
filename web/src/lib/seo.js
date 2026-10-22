import { projectsList } from './projects'
import { libraryList, findLibraryItem } from './library'
import { USES_UPDATED } from './uses'
import { CV_UPDATED } from './cv'
import { SECURITY_UPDATED } from './security'
import { FOCUS_VERSION, FOCUS_MIN_MACOS, FOCUS_DOWNLOAD } from './focus-release'
import { postsList, findPost, BLOG_UPDATED } from './blog'
import { blogPath, libraryPath, normalizePath, parseRoute, projectPath, BLOG_FEED_PATH } from './router'
import { setDocumentTitle } from './title-animation'

export const SITE_URL = 'https://kostis.wtf'
export const SITE_NAME = 'blxr'

const OG_IMAGE = `${SITE_URL}/og.png`

const HOME_DESCRIPTION =
  'Kostis — IB Diploma student in Athens building backend and web tooling with Go, JavaScript ' +
  'and Python. Security tooling projects, skills, CV and contact.'

const PROJECTS_DESCRIPTION =
  'Everything Kostis has built — security tooling, web apps and mobile apps — with case studies, ' +
  'stacks and source code.'

const LIBRARY_DESCRIPTION =
  'The UIs and scripts built for FiveM servers — interfaces, HUDs and standalone resources.'

const BLOG_DESCRIPTION =
  'Writing by Kostis — notes on what I build, break and learn: backend, web tooling, security and the setup behind it.'

const REVIEWS_DESCRIPTION =
  'What clients and collaborators say about working with Kostis. Worked with me? Leave a review.'

const USES_DESCRIPTION =
  'The desk, the machine and the software behind kostis.wtf: a MacBook Air, a 240 Hz display, ' +
  'the editor, terminal, fonts, hosting and music.'

const CV_DESCRIPTION =
  'CV of Kostis, a full stack developer in Athens: experience, education, skills and languages. Printable.'

const SECURITY_DESCRIPTION =
  'Report a security issue in kostis.wtf or a project by Kostis: private email, keys, disclosure timeline, ' +
  'scope and safe harbour.'

const IB_DESCRIPTION =
  'IB grade calculator: turn paper and IA marks into a 1–7 grade, add up your diploma points out of 45 with TOK ' +
  'and EE, and check them against your offers.'

const LISTENING_DESCRIPTION = 'What Kostis is playing on Spotify right now, the last 50 songs, and the top tracks and artists lately.'

const CONTACT_DESCRIPTION =
  'How to reach Kostis: email for anything, a private thread on kostis.wtf, or GitHub and Discord. ' +
  'Based in Athens, Greece (EET / EEST).'

const BOOK_DESCRIPTION =
  'Book a video call with Kostis. Pick a free time straight from my calendar, shown in your own time zone, ' +
  'and get a calendar invite by email right away.'

const PAYMENT_DESCRIPTION =
  'Payment methods Kostis accepts: PayPal, Paysafecard, Revolut, Wise, SEPA bank transfer and crypto (BTC, ETH, USDT, LTC).'

const LINKS_DESCRIPTION =
  'All of Kostis’s links on one page: GitHub, Discord, email, Amitista Studio and the best of kostis.wtf.'

const GALLERY_DESCRIPTION =
  'Gallery by Kostis: photos I took and UI designs I made, from city light to dashboards and product screens.'

const QUOTE_DESCRIPTION =
  'Words Kostis lives by: one main quote up top and more added over time, each one dated, some with a note on what it means.'

const TERMINAL_DESCRIPTION =
  'kostis.wtf as a shell: type help, about, projects or contact, cd between pages, and find the commands that are not in help.'

const STATUS_DESCRIPTION =
  'Live uptime for kostis.wtf and its API: checked every few minutes, with 90 days of history and recent incidents.'

const CHANGELOG_DESCRIPTION =
  'Every change to my public projects, read live from GitHub and grouped by day: what was added, fixed, changed and removed, newest first.'

const VOLUNTEER_DESCRIPTION =
  'Volunteering by Kostis: the events, drives and causes I gave my time to, with dates, hours, roles and photos.'

const TRAVEL_DESCRIPTION =
  'A world map of the countries Kostis has been to: Greece, Italy, Germany, France, Spain, Austria, Belgium and the UK.'

const FOCUS_DESCRIPTION =
  'Focus Lock, a Mac app by Kostis: pick a time and every app off your list is closed until it ends. ' +
  'Choose the apps and the sites blocked in Chrome in Settings.'

export function metaFor(pathname) {
  const path = normalizePath(pathname)
  const route = parseRoute(path)
  const base = { path, route: path }

  if (route.name === 'home') {
    return {
      ...base,
      title: 'Kostis — Student Developer Portfolio, Projects & CV',
      description: HOME_DESCRIPTION,
    }
  }

  if (route.name === 'projects') {
    return {
      ...base,
      title: 'Projects — Security Tooling, Web & Mobile Apps by Kostis',
      description: PROJECTS_DESCRIPTION,
    }
  }

  if (route.name === 'library' && route.itemId) {
    const item = findLibraryItem(route.itemId)
    return {
      ...base,
      title: `${item.title} — FiveM Library — ${SITE_NAME}`,

      description: item.shortDescription,
      noindex: Boolean(item.placeholder),
    }
  }

  if (route.name === 'library') {
    return {
      ...base,
      title: 'FiveM Library — UIs, HUDs & Scripts by Kostis',
      description: LIBRARY_DESCRIPTION,
      noindex: libraryList.every((entry) => entry.placeholder),
    }
  }

  if (route.name === 'blog' && route.slug) {
    const post = findPost(route.slug)
    return {
      ...base,
      title: `${post.title} — Blog — ${SITE_NAME}`,
      description: post.description,
      noindex: post.draft,
    }
  }

  if (route.name === 'blog') {
    return {
      ...base,
      title: 'Blog — Notes & Writing by Kostis',
      description: BLOG_DESCRIPTION,
      noindex: postsList.every((post) => post.draft),
    }
  }

  if (route.name === 'reviews') {
    return {
      ...base,
      title: 'Reviews — What Clients Say About Working With Kostis',
      description: REVIEWS_DESCRIPTION,
    }
  }

  if (route.name === 'uses') {
    return {
      ...base,
      title: 'Uses — The Setup Behind kostis.wtf',
      description: USES_DESCRIPTION,
    }
  }

  if (route.name === 'cv') {
    return {
      ...base,
      title: 'CV — Kostis, Full Stack Developer in Athens',
      description: CV_DESCRIPTION,
    }
  }

  if (route.name === 'security') {
    return {
      ...base,
      title: 'Security — Report a Vulnerability to Kostis',
      description: SECURITY_DESCRIPTION,
    }
  }

  if (route.name === 'ib') {
    return {
      ...base,
      title: 'IB Grade Calculator — Grades, Diploma Points and Offers',
      description: IB_DESCRIPTION,
    }
  }

  if (route.name === 'listening') {
    return {
      ...base,
      title: 'Listening — Kostis on Spotify',
      description: LISTENING_DESCRIPTION,
    }
  }

  if (route.name === 'contact') {
    return {
      ...base,
      title: 'Contact — Get in Touch With Kostis',
      description: CONTACT_DESCRIPTION,
    }
  }

  if (route.name === 'book') {
    return {
      ...base,
      title: 'Book a Call — Pick a Time With Kostis',
      description: BOOK_DESCRIPTION,
    }
  }

  if (route.name === 'payment') {
    return {
      ...base,
      title: 'Payment — How to Pay Kostis',
      description: PAYMENT_DESCRIPTION,
    }
  }

  if (route.name === 'links') {
    return {
      ...base,
      title: 'Links — Everywhere to Find Kostis',
      description: LINKS_DESCRIPTION,
    }
  }

  if (route.name === 'volunteer') {
    return {
      ...base,
      title: 'Volunteering: Events Kostis Gave Time To',
      description: VOLUNTEER_DESCRIPTION,
    }
  }

  if (route.name === 'travel') {
    return {
      ...base,
      title: 'Travel — Countries Kostis Has Been To',
      description: TRAVEL_DESCRIPTION,
    }
  }

  if (route.name === 'gallery') {
    return {
      ...base,
      title: 'Gallery: Photos and UI Design by Kostis',
      description: GALLERY_DESCRIPTION,
    }
  }

  if (route.name === 'quote') {
    return {
      ...base,
      title: 'Quotes — Words Kostis Lives By',
      description: QUOTE_DESCRIPTION,
    }
  }

  if (route.name === 'terminal') {
    return {
      ...base,
      title: 'Terminal — kostis.wtf from the Command Line',
      description: TERMINAL_DESCRIPTION,
    }
  }

  if (route.name === 'status') {
    return {
      ...base,
      title: 'Status — Live Uptime for kostis.wtf',
      description: STATUS_DESCRIPTION,
    }
  }

  if (route.name === 'changelog') {
    return {
      ...base,
      title: 'Changelog — What Changed, Straight from GitHub',
      description: CHANGELOG_DESCRIPTION,
    }
  }

  if (route.name === 'focus') {
    return {
      ...base,
      title: 'Focus Lock — A Mac App That Closes Everything Else',
      description: FOCUS_DESCRIPTION,
    }
  }

  if (route.name === 'hello') {
    return {
      ...base,
      title: `hello world — ${SITE_NAME}`,
      description: 'hello world, in pixel letters on a dark gradient. That is the whole page.',
      noindex: true,
    }
  }

  if (route.name === 'login') {
    return {
      ...base,
      title: `Sign in — ${SITE_NAME}`,
      description: 'Sign in to kostis.wtf or create an account.',
      noindex: true,
    }
  }

  if (route.name === 'loading') {
    return {
      ...base,
      title: `Loading — ${SITE_NAME}`,
      description: 'Still loading.',
      noindex: true,
    }
  }

  if (route.name === 'dashboard') {
    return {
      ...base,
      title: `Dashboard — ${SITE_NAME}`,
      description: 'Owner dashboard for kostis.wtf.',
      noindex: true,
    }
  }

  if (route.name === 'profile') {
    return {
      ...base,
      title: `Profile — ${SITE_NAME}`,
      description: 'A member profile on kostis.wtf.',
      noindex: true,
    }
  }

  return {
    ...base,
    title: `Not found — ${SITE_NAME}`,
    description: 'That page does not exist on kostis.wtf.',
    noindex: true,
  }
}

const SHORT_LABELS = {
  projects: 'Projects',
  library: 'Library',
  blog: 'Blog',
  reviews: 'Reviews',
  uses: 'Uses',
  cv: 'CV',
  security: 'Security',
  ib: 'IB grades',
  listening: 'Listening',
  contact: 'Contact',
  book: 'Book a call',
  payment: 'Payment',
  links: 'Links',
  volunteer: 'Volunteering',
  travel: 'Travel',
  gallery: 'Gallery',
  quote: 'Quotes',
  terminal: 'Terminal',
  status: 'Status',
  changelog: 'Changelog',
  focus: 'Focus Lock',
  hello: 'hello world',
  login: 'Sign in',
  dashboard: 'Dashboard',
  profile: 'Profile',
  notFound: '404',
}

const LABEL_MAX = 18

export function labelFor(pathname) {
  const route = parseRoute(pathname)

  if (route.name === 'home') return 'Hello'

  if (route.name === 'library' && route.itemId) {
    const item = findLibraryItem(route.itemId)
    const head = item?.title?.split(/\s+[—–-]\s+/)[0]?.trim() || ''
    return head ? head.slice(0, LABEL_MAX) : SHORT_LABELS.library
  }

  if (route.name === 'blog' && route.slug) {
    const title = findPost(route.slug)?.title ?? ''
    return title ? title.slice(0, LABEL_MAX) : SHORT_LABELS.blog
  }

  return SHORT_LABELS[route.name] ?? ''
}

export function lastmodFor(pathname) {
  const route = parseRoute(pathname)
  if (route.name === 'uses') return USES_UPDATED
  if (route.name === 'cv') return CV_UPDATED
  if (route.name === 'security') return SECURITY_UPDATED
  if (route.name === 'blog' && route.slug) {
    const post = findPost(route.slug)
    return post.updated || post.date
  }
  if (route.name === 'blog') return BLOG_UPDATED
  return null
}

const APP_CATEGORY = {
  'Security Tooling': 'SecurityApplication',
  'Mobile Apps': 'LifestyleApplication'
}
const appCategoryFor = (p) => APP_CATEGORY[p.category] ?? 'UtilitiesApplication'

const osFor = (p) => {
  if (p.category === 'Web Platforms') return 'Web browser'
  const named = ['Windows', 'macOS', 'iOS', 'Android'].filter((os) => p.tags.includes(os))
  return named.length ? named.join(', ') : 'Windows'
}

const isOrganization = (p) => p.category === 'Studio'

const projectNode = (p) => {
  const url = `${SITE_URL}${projectPath(p.id)}`
  if (isOrganization(p)) {
    return {
      '@type': 'Organization',
      name: p.title,
      description: p.shortDescription,
      url,
      sameAs: p.url ? [p.url] : undefined,
      member: { '@id': `${SITE_URL}/#blxr` },
    }
  }
  const license = p.metrics.find((m) => m.label === 'License')?.value
  return {
    '@type': 'SoftwareApplication',
    name: p.title,
    applicationCategory: appCategoryFor(p),
    operatingSystem: osFor(p),
    description: p.shortDescription,
    url,
    image: p.image ? `${SITE_URL}${p.image}` : undefined,
    datePublished: p.date,
    codeRepository: p.github ?? undefined,
    ...(license && license !== 'Proprietary' ? { license } : {}),
    author: { '@id': `${SITE_URL}/#blxr` },
  }
}

function jsonLdFor(path) {
  const route = parseRoute(path)

  const person = {
    '@type': 'Person',
    '@id': `${SITE_URL}/#blxr`,
    name: 'Kostis',
    alternateName: ['Blxr', 'kostis4563'],
    url: SITE_URL,
    image: `${SITE_URL}/pfp.webp`,
    description: 'Student in Athens building backend and web tooling.',
    jobTitle: 'Full stack developer',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Athens',
      addressCountry: 'GR',
    },
    knowsLanguage: ['en', 'el'],
    worksFor: {
      '@type': 'Organization',
      name: 'Amitista Studio',
      url: 'https://amitista.com',
    },
    knowsAbout: ['Go', 'JavaScript', 'Python', 'Security tooling'],
    sameAs: ['https://github.com/kostis4563', 'https://discord.com/users/981607036192190534'],
  }

  if (route.name === 'home') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        person,
        {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          url: SITE_URL,
          name: SITE_NAME,

          inLanguage: 'en',
          author: { '@id': `${SITE_URL}/#blxr` },
        },
        {
          '@type': 'ProfilePage',
          '@id': `${SITE_URL}/#profile`,
          url: SITE_URL,
          name: 'Kostis',
          inLanguage: 'en',
          dateModified: CV_UPDATED,
          mainEntity: { '@id': `${SITE_URL}/#blxr` },
          author: { '@id': `${SITE_URL}/#blxr` },
        },
      ],
    }
  }

  if (route.name === 'projects') {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Projects',
      description: PROJECTS_DESCRIPTION,
      url: `${SITE_URL}/projects`,
      author: { '@id': `${SITE_URL}/#blxr` },
      hasPart: projectsList.map(projectNode),
    }
  }

  const realEntries = libraryList.filter((entry) => !entry.placeholder)

  if (route.name === 'library' && route.itemId) {
    const item = findLibraryItem(route.itemId)
    if (item.placeholder) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: item.title,
      applicationCategory: 'GameApplication',

      operatingSystem: 'Windows',
      description: item.shortDescription,
      url: `${SITE_URL}${libraryPath(item.id)}`,
      image: item.image ? `${SITE_URL}${item.image}` : undefined,
      datePublished: item.date,
      codeRepository: item.github ?? undefined,
      isPartOf: { '@id': `${SITE_URL}/library#library` },
      author: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'blog' && route.slug) {
    const post = findPost(route.slug)
    const url = `${SITE_URL}${blogPath(post.slug)}`
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url,
      mainEntityOfPage: url,
      image: post.cover ? `${SITE_URL}${post.cover}` : OG_IMAGE,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      keywords: post.tags.length ? post.tags.join(', ') : undefined,
      wordCount: post.words,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/blog#blog` },
      author: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'blog') {
    const published = postsList.filter((post) => !post.draft)
    if (published.length === 0) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      name: 'Blog',
      description: BLOG_DESCRIPTION,
      url: `${SITE_URL}/blog`,
      inLanguage: 'en',
      author: { '@id': `${SITE_URL}/#blxr` },
      blogPost: published.map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        url: `${SITE_URL}${blogPath(post.slug)}`,
        datePublished: post.date,
        dateModified: post.updated || post.date,
      })),
    }
  }

  if (route.name === 'reviews') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Reviews',
      description: REVIEWS_DESCRIPTION,
      url: `${SITE_URL}/reviews`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'uses') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Uses',
      description: USES_DESCRIPTION,
      url: `${SITE_URL}/uses`,
      dateModified: USES_UPDATED,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'cv') {
    return {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: 'CV',
      description: CV_DESCRIPTION,
      url: `${SITE_URL}/cv`,
      dateModified: CV_UPDATED,
      mainEntity: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'security') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Security',
      description: SECURITY_DESCRIPTION,
      url: `${SITE_URL}/security`,
      dateModified: SECURITY_UPDATED,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'ib') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'IB Grade Calculator',
      description: IB_DESCRIPTION,
      url: `${SITE_URL}/ib`,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      author: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'listening') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Listening',
      description: LISTENING_DESCRIPTION,
      url: `${SITE_URL}/listening`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'contact') {
    return {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact',
      description: CONTACT_DESCRIPTION,
      url: `${SITE_URL}/contact`,
      mainEntity: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'book') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Book a call',
      description: BOOK_DESCRIPTION,
      url: `${SITE_URL}/book`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
      potentialAction: { '@type': 'ScheduleAction', target: `${SITE_URL}/book` },
    }
  }

  if (route.name === 'payment') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Payment',
      description: PAYMENT_DESCRIPTION,
      url: `${SITE_URL}/payment`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'links') {
    return {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: 'Links',
      description: LINKS_DESCRIPTION,
      url: `${SITE_URL}/links`,
      mainEntity: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'volunteer') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Volunteering',
      description: VOLUNTEER_DESCRIPTION,
      url: `${SITE_URL}/volunteer`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'travel') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Travel',
      description: TRAVEL_DESCRIPTION,
      url: `${SITE_URL}/travel`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'gallery') {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Gallery',
      description: GALLERY_DESCRIPTION,
      url: `${SITE_URL}/gallery`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'quote') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Quotes',
      description: QUOTE_DESCRIPTION,
      url: `${SITE_URL}/quote`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'terminal') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Terminal',
      description: TERMINAL_DESCRIPTION,
      url: `${SITE_URL}/terminal`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'status') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Status',
      description: STATUS_DESCRIPTION,
      url: `${SITE_URL}/status`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'changelog') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Changelog',
      description: CHANGELOG_DESCRIPTION,
      url: `${SITE_URL}/changelog`,
      author: { '@id': `${SITE_URL}/#blxr` },
      about: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'focus') {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Focus Lock',
      description: FOCUS_DESCRIPTION,
      url: `${SITE_URL}/focus`,
      image: `${SITE_URL}/focus/focus-lock.webp`,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: `macOS ${FOCUS_MIN_MACOS} or later`,
      softwareVersion: FOCUS_VERSION,
      downloadUrl: `${SITE_URL}${FOCUS_DOWNLOAD}`,
      author: { '@id': `${SITE_URL}/#blxr` },
    }
  }

  if (route.name === 'library') {
    if (realEntries.length === 0) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/library#library`,
      name: 'FiveM Library',
      description: LIBRARY_DESCRIPTION,
      url: `${SITE_URL}/library`,
      author: { '@id': `${SITE_URL}/#blxr` },
      hasPart: realEntries.map((entry) => ({
        '@type': 'SoftwareApplication',
        name: entry.title,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Windows',
        description: entry.shortDescription,
        url: `${SITE_URL}${libraryPath(entry.id)}`,
        image: entry.image ? `${SITE_URL}${entry.image}` : undefined,
        datePublished: entry.date,
      })),
    }
  }

  return null
}

function crumbsFor(route) {
  if (route.name === 'home') return null
  const urlOf = (r) => `${SITE_URL}${r}`

  const items = [{ name: 'Home', item: urlOf('/') }]

  if (route.name === 'projects') {
    items.push({ name: 'Projects', item: urlOf('/projects') })
  } else if (route.name === 'blog') {
    items.push({ name: 'Blog', item: urlOf('/blog') })
    if (route.slug) {
      const post = findPost(route.slug)
      if (post) items.push({ name: post.title, item: urlOf(blogPath(post.slug)) })
    }
  } else if (route.name === 'reviews') {
    items.push({ name: 'Reviews', item: urlOf('/reviews') })
  } else if (route.name === 'uses') {
    items.push({ name: 'Uses', item: urlOf('/uses') })
  } else if (route.name === 'cv') {
    items.push({ name: 'CV', item: urlOf('/cv') })
  } else if (route.name === 'security') {
    items.push({ name: 'Security', item: urlOf('/security') })
  } else if (route.name === 'ib') {
    items.push({ name: 'IB grades', item: urlOf('/ib') })
  } else if (route.name === 'listening') {
    items.push({ name: 'Listening', item: urlOf('/listening') })
  } else if (route.name === 'contact') {
    items.push({ name: 'Contact', item: urlOf('/contact') })
  } else if (route.name === 'book') {
    items.push({ name: 'Book a call', item: urlOf('/book') })
  } else if (route.name === 'payment') {
    items.push({ name: 'Payment', item: urlOf('/payment') })
  } else if (route.name === 'links') {
    items.push({ name: 'Links', item: urlOf('/links') })
  } else if (route.name === 'volunteer') {
    items.push({ name: 'Volunteering', item: urlOf('/volunteer') })
  } else if (route.name === 'travel') {
    items.push({ name: 'Travel', item: urlOf('/travel') })
  } else if (route.name === 'gallery') {
    items.push({ name: 'Gallery', item: urlOf('/gallery') })
  } else if (route.name === 'quote') {
    items.push({ name: 'Quotes', item: urlOf('/quote') })
  } else if (route.name === 'terminal') {
    items.push({ name: 'Terminal', item: urlOf('/terminal') })
  } else if (route.name === 'status') {
    items.push({ name: 'Status', item: urlOf('/status') })
  } else if (route.name === 'changelog') {
    items.push({ name: 'Changelog', item: urlOf('/changelog') })
  } else if (route.name === 'focus') {
    items.push({ name: 'Focus Lock', item: urlOf('/focus') })
  } else if (route.name === 'library') {
    items.push({ name: 'FiveM Library', item: urlOf('/library') })
    if (route.itemId) {
      const item = findLibraryItem(route.itemId)
      if (item) items.push({ name: item.title, item: urlOf(`/library/${item.id}`) })
    }
  } else {
    return null
  }

  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, item }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item,
    })),
  }
}

function withCrumbs(ld, crumbs) {
  if (!ld || !crumbs) return ld ?? null
  if (Array.isArray(ld['@graph'])) {
    return { ...ld, '@graph': [...ld['@graph'], crumbs] }
  }
  return { '@context': 'https://schema.org', '@graph': [ld, crumbs] }
}

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function headTags(pathname) {
  const { path, route, title, description, noindex } = metaFor(pathname)
  const canonical = `${SITE_URL}${path === '/' ? '/' : path}`
  const ogRoute = parseRoute(route)
  const ogItem = ogRoute.name === 'library' && ogRoute.itemId ? findLibraryItem(ogRoute.itemId) : null
  const ogPost = ogRoute.name === 'blog' && ogRoute.slug ? findPost(ogRoute.slug) : null
  const ogCover = ogItem?.image || ogPost?.cover
  const ogImage = ogCover ? `${SITE_URL}${ogCover}` : OG_IMAGE
  const jsonLd = withCrumbs(jsonLdFor(route), crumbsFor(ogRoute))

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="author" content="${SITE_NAME}" />`,
    noindex
      ? '<meta name="robots" content="noindex" />'
      : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    noindex ? '' : `<link rel="canonical" href="${escapeAttr(canonical)}" />`,

    `<meta property="og:type" content="${ogItem || ogPost ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,

    '<meta property="og:locale" content="en_US" />',
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(ogImage)}" />`,
    ...(ogItem ? [`<meta property="article:published_time" content="${ogItem.date || '2026'}" />`] : []),
    ...(ogPost
      ? [
          `<meta property="article:published_time" content="${ogPost.date}" />`,
          `<meta property="article:modified_time" content="${ogPost.updated || ogPost.date}" />`,
          ...ogPost.tags.map((tag) => `<meta property="article:tag" content="${escapeAttr(tag)}" />`),
        ]
      : []),
    ...(ogCover
      ? []
      : [
          '<meta property="og:image:width" content="1200" />',
          '<meta property="og:image:height" content="630" />',
        ]),
    `<meta property="og:image:alt" content="${ogItem ? escapeAttr(`${ogItem.title} preview`) : ogPost?.cover ? escapeAttr(`${ogPost.title} cover`) : 'The blxr wordmark'}" />`,

    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`,

    ogRoute.name === 'blog' && postsList.length
      ? `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} — Blog" href="${SITE_URL}${BLOG_FEED_PATH}" />`
      : '',

    ogRoute.name === 'home'
      ? '<link rel="preload" href="/api/weather" as="fetch" crossorigin="anonymous" fetchpriority="low" />'
      : '',

    ogRoute.name === 'listening'
      ? '<link rel="preload" href="/api/spotify/now" as="fetch" crossorigin="anonymous" />\n    <link rel="preload" href="/api/spotify/recent" as="fetch" crossorigin="anonymous" />'
      : '',

    ogRoute.name === 'status' ? '<link rel="preload" href="/api/status" as="fetch" crossorigin="anonymous" />' : '',

    ogRoute.name === 'changelog' ? '<link rel="preload" href="/api/github/changelog" as="fetch" crossorigin="anonymous" />' : '',

    ogRoute.name === 'hello'
      ? '<link rel="preload" href="/fonts/hello-pixel-f4c3c487.woff2" as="font" type="font/woff2" crossorigin="anonymous" />'
      : '',

    jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
      : '',
  ]

  return tags.filter(Boolean).join('\n    ')
}

function setMeta(selector, create, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', value)
}

export function applyHead(pathname) {
  const { path, title, description, noindex } = metaFor(pathname)
  setDocumentTitle(title, labelFor(pathname))
  setMeta(
    'meta[name="description"]',
    () => Object.assign(document.createElement('meta'), { name: 'description' }),
    description,
  )

  const canonical = document.head.querySelector('link[rel="canonical"]')
  if (noindex) {

    canonical?.remove()
    return
  }
  setMeta(
    'link[rel="canonical"]',
    () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
    `${SITE_URL}${path === '/' ? '/' : path}`,
  )
}
