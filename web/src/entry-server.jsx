import { renderToString } from 'react-dom/server'
import Root from './root.jsx'
import { parseRoute, setServerPath, staticPaths } from './lib/router'
import { headTags } from './lib/seo'

export async function render(path = '/') {
  setServerPath(path)
  return {
    html: renderToString(<Root />),
    head: headTags(path),
  }
}

export { staticPaths, parseRoute }

export { metaFor, lastmodFor } from './lib/seo'

export const NOT_FOUND_PATH = '/404'

export { LOGIN_PATH, DASHBOARD_PATH, PROFILE_BASE_PATH, PROFILE_SHELL_FILE } from './lib/router'
