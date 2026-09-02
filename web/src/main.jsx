import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import Root from './root.jsx'
import { langOf } from './lib/router'
import { preloadTable } from './lib/i18n'
import { reportWebVitals } from './lib/vitals'

const container = document.getElementById('root')
const hydrate = () => {
  if (container.firstElementChild) {
    hydrateRoot(container, <Root />)
  } else {
    createRoot(container).render(<Root />)
  }
}

const mount = () => {
  if (typeof requestAnimationFrame !== 'function') return hydrate()
  requestAnimationFrame(() => requestAnimationFrame(hydrate))
}

const served = document.documentElement.lang || 'en'
if (served === 'en' || served !== langOf(window.location.pathname)) {
  mount()
} else {

  preloadTable(served).then(mount, mount)
}

reportWebVitals()
