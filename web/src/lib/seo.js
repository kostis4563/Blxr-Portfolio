import { LANG_CODES, LOCALE_TAGS, DEFAULT_LANG } from './languages'
import { translate } from './i18n'
import { projectsList } from './projects'
import { libraryList, findLibraryItem } from './library'
import {
  alternatesFor,
  libraryPath,
  localizePath,
  parseRoute,
  projectPath,
  splitLocale,
} from './router'

export const SITE_URL = 'https://blxr.net'
export const SITE_NAME = 'blxr'

const OG_IMAGE = `${SITE_URL}/og.png`

const HOME_DESCRIPTION =
  "Blxr — a student in Athens doing the IB Diploma Programme, building backend and web tooling " +
  'with Go, JavaScript and Python. Security tooling projects, skills and contact.'

const PROJECTS_DESCRIPTION =
  'Everything I have built, with case studies, stacks and source.'

const LIBRARY_DESCRIPTION =
  'The UIs and scripts built for FiveM servers — interfaces, HUDs and standalone resources.'

const REVIEWS_DESCRIPTION =
  'What clients and collaborators say about working with Blxr. Worked with me? Leave a review.'

export function metaFor(pathname) {
  const { lang, route: routePath } = splitLocale(pathname)
  const path = localizePath(routePath, lang)
  const route = parseRoute(routePath)

  const pick = (literal, key) => (lang === DEFAULT_LANG ? literal : translate(lang, key, null, literal))
  const base = { path, lang, route: routePath }

  if (route.name === 'home') {
    return {
      ...base,
      title: 'Blxr Portfolio',

      description:
        lang === DEFAULT_LANG
          ? HOME_DESCRIPTION
          : `${translate(lang, 'hero.bio1')} ${translate(lang, 'hero.bio2')}`,
    }
  }

  if (route.name === 'projects') {
    return {
      ...base,
      title: `${pick('Projects', 'proj.archiveTitle')} — ${SITE_NAME}`,
      description: pick(PROJECTS_DESCRIPTION, 'home.libraryTagline'),
    }
  }

  if (route.name === 'library' && route.itemId) {
    const item = findLibraryItem(route.itemId)
    return {
      ...base,
      title: `${item.title} — ${pick('FiveM Library', 'lib.title')} — ${SITE_NAME}`,

      description: item.shortDescription,
      noindex: Boolean(item.placeholder),
    }
  }

  if (route.name === 'library') {
    return {
      ...base,
      title: `${pick('FiveM Library', 'lib.title')} — ${SITE_NAME}`,
      description: pick(LIBRARY_DESCRIPTION, 'lib.tagline'),
      noindex: libraryList.every((entry) => entry.placeholder),
    }
  }

  if (route.name === 'reviews') {
    return {
      ...base,
      title: `${pick('Reviews', 'rev.title')} — ${SITE_NAME}`,
      description: pick(REVIEWS_DESCRIPTION, 'rev.tagline'),
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

  // The shell is generic; the page titles itself once the profile loads.
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
    title: `${pick('Not found', 'nf.title')} — ${SITE_NAME}`,
    description: pick('That page does not exist on blxr.net.', 'nf.body'),
    noindex: true,
  }
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
    description: 'Student in Athens building backend and web tooling.',
    knowsAbout: ['Go', 'JavaScript', 'Python', 'Security tooling'],
    sameAs: ['https://github.com/kostis4563'],
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

          inLanguage: LANG_CODES,
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
      about: { '@id': `${SITE_URL}/#blxr` },
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
      hasPart: realEntries.map((entry) => ({
        '@type': 'SoftwareApplication',
        name: entry.title,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Windows',
        description: entry.shortDescription,
        url: `${SITE_URL}${libraryPath(entry.id)}`,
      })),
    }
  }

  return null
}

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function headTags(pathname) {
  const { path, route, lang, title, description, noindex } = metaFor(pathname)
  const canonical = `${SITE_URL}${path === '/' ? '/' : path}`
  const jsonLd = jsonLdFor(route)

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeAttr(canonical)}" />`,

    ...(noindex
      ? []
      : [
          ...alternatesFor(route).map(
            ({ lang: code, path: altPath }) =>
              `<link rel="alternate" hreflang="${code}" href="${escapeAttr(`${SITE_URL}${altPath === '/' ? '/' : altPath}`)}" />`,
          ),
          `<link rel="alternate" hreflang="x-default" href="${escapeAttr(`${SITE_URL}${route === '/' ? '/' : route}`)}" />`,
        ]),

    `<meta property="og:type" content="${route === '/' ? 'website' : 'article'}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,

    `<meta property="og:locale" content="${(LOCALE_TAGS[lang] || lang).replace('-', '_')}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="The blxr wordmark" />`,

    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,

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
