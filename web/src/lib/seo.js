import { projectsList } from './projects'
import { libraryList, findLibraryItem } from './library'
import { USES_UPDATED } from './uses'
import { CV_UPDATED } from './cv'
import { libraryPath, normalizePath, parseRoute, projectPath } from './router'

export const SITE_URL = 'https://blxr.net'
export const SITE_NAME = 'blxr'

const OG_IMAGE = `${SITE_URL}/og.png`

const HOME_DESCRIPTION =
  'Blxr — IB Diploma student in Athens building backend and web tooling with Go, JavaScript ' +
  'and Python. Security tooling projects, skills, CV and contact.'

const PROJECTS_DESCRIPTION =
  'Everything Blxr has built — security tooling, web apps and mobile apps — with case studies, ' +
  'stacks and source code.'

const LIBRARY_DESCRIPTION =
  'The UIs and scripts built for FiveM servers — interfaces, HUDs and standalone resources.'

const REVIEWS_DESCRIPTION =
  'What clients and collaborators say about working with Blxr. Worked with me? Leave a review.'

const USES_DESCRIPTION =
  'The desk, the machine and the software behind blxr.net: a MacBook Air, a 240 Hz display, ' +
  'the editor, terminal, fonts, hosting and music.'

const CV_DESCRIPTION =
  'CV of Blxr, a full stack developer in Athens: experience, selected projects, education, skills and certifications. Printable.'

const CONTACT_DESCRIPTION =
  'How to reach Blxr: email for anything, a private thread on blxr.net, or GitHub and Discord. ' +
  'Based in Athens, Greece (EET / EEST).'

export function metaFor(pathname) {
  const path = normalizePath(pathname)
  const route = parseRoute(path)
  const base = { path, route: path }

  if (route.name === 'home') {
    return {
      ...base,
      title: 'Blxr — Student Developer Portfolio, Projects & CV',
      description: HOME_DESCRIPTION,
    }
  }

  if (route.name === 'projects') {
    return {
      ...base,
      title: 'Projects — Security Tooling, Web & Mobile Apps by Blxr',
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
      title: 'FiveM Library — UIs, HUDs & Scripts by Blxr',
      description: LIBRARY_DESCRIPTION,
      noindex: libraryList.every((entry) => entry.placeholder),
    }
  }

  if (route.name === 'reviews') {
    return {
      ...base,
      title: 'Reviews — What Clients Say About Working With Blxr',
      description: REVIEWS_DESCRIPTION,
    }
  }

  if (route.name === 'uses') {
    return {
      ...base,
      title: 'Uses — The Setup Behind blxr.net',
      description: USES_DESCRIPTION,
    }
  }

  if (route.name === 'cv') {
    return {
      ...base,
      title: 'CV — Blxr, Full Stack Developer in Athens',
      description: CV_DESCRIPTION,
    }
  }

  if (route.name === 'contact') {
    return {
      ...base,
      title: 'Contact — Get in Touch With Blxr',
      description: CONTACT_DESCRIPTION,
    }
  }

  if (route.name === 'login') {
    return {
      ...base,
      title: `Sign in — ${SITE_NAME}`,
      description: 'Sign in to blxr.net or create an account.',
      noindex: true,
    }
  }

  if (route.name === 'dashboard') {
    return {
      ...base,
      title: `Dashboard — ${SITE_NAME}`,
      description: 'Owner dashboard for blxr.net.',
      noindex: true,
    }
  }

  if (route.name === 'profile') {
    return {
      ...base,
      title: `Profile — ${SITE_NAME}`,
      description: 'A member profile on blxr.net.',
      noindex: true,
    }
  }

  return {
    ...base,
    title: `Not found — ${SITE_NAME}`,
    description: 'That page does not exist on blxr.net.',
    noindex: true,
  }
}

export function lastmodFor(pathname) {
  const route = parseRoute(pathname)
  if (route.name === 'uses') return USES_UPDATED
  if (route.name === 'cv') return CV_UPDATED
  return null
}

const APP_CATEGORY = {
  'Security Tooling': 'SecurityApplication',
  'Mobile Apps': 'LifestyleApplication'
}
const appCategoryFor = (p) => APP_CATEGORY[p.category] ?? 'UtilitiesApplication'

const osFor = (p) => {
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
    name: 'Blxr',
    alternateName: 'kostis4563',
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
          name: 'Blxr',
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
  } else if (route.name === 'reviews') {
    items.push({ name: 'Reviews', item: urlOf('/reviews') })
  } else if (route.name === 'uses') {
    items.push({ name: 'Uses', item: urlOf('/uses') })
  } else if (route.name === 'cv') {
    items.push({ name: 'CV', item: urlOf('/cv') })
  } else if (route.name === 'contact') {
    items.push({ name: 'Contact', item: urlOf('/contact') })
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
  const ogImage = ogItem?.image ? `${SITE_URL}${ogItem.image}` : OG_IMAGE
  const jsonLd = withCrumbs(jsonLdFor(route), crumbsFor(ogRoute))

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="author" content="${SITE_NAME}" />`,
    noindex
      ? '<meta name="robots" content="noindex" />'
      : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    noindex ? '' : `<link rel="canonical" href="${escapeAttr(canonical)}" />`,

    `<meta property="og:type" content="${ogRoute.name === 'library' && ogRoute.itemId ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,

    '<meta property="og:locale" content="en_US" />',
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(ogImage)}" />`,
    ...(ogItem
      ? [`<meta property="article:published_time" content="${ogItem.date || '2026'}" />`]
      : [
          '<meta property="og:image:width" content="1200" />',
          '<meta property="og:image:height" content="630" />',
        ]),
    `<meta property="og:image:alt" content="${ogItem ? escapeAttr(`${ogItem.title} preview`) : 'The blxr wordmark'}" />`,

    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`,

    ogRoute.name === 'home'
      ? '<link rel="preload" href="/api/weather" as="fetch" crossorigin="anonymous" fetchpriority="low" />'
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
  document.title = title
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
