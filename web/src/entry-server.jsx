import { renderToString } from 'react-dom/server'
import Root from './root.jsx'
import { langOf, localizedPaths, setServerPath, staticPaths } from './lib/router'
import { preloadTable } from './lib/i18n'
import { LANGUAGES } from './lib/languages'
import { headTags } from './lib/seo'

export async function render(path = '/') {
  const lang = langOf(path)
  await preloadTable(lang)
  setServerPath(path)
  return {
    html: renderToString(<Root />),
    head: headTags(path),
    lang,
    dir: LANGUAGES.find((l) => l.code === lang)?.dir === 'rtl' ? 'rtl' : 'ltr',
  }
}

export { staticPaths, localizedPaths }

export { metaFor } from './lib/seo'

export const NOT_FOUND_PATH = '/404'
