import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import Root from './root.jsx'
import { reportWebVitals } from './lib/vitals'
import { installErrorReporting } from './lib/report-errors'
import { applyDevicePrefs } from './lib/prefs'

applyDevicePrefs()
installErrorReporting()

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

mount()

if (document.documentElement.hasAttribute('data-entry')) {
  setTimeout(() => document.documentElement.removeAttribute('data-entry'), 2000)
}

reportWebVitals()
