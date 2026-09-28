import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import Root from './root.jsx'
import { reportWebVitals } from './lib/vitals'
import { installErrorReporting } from './lib/report-errors'
import { applyDevicePrefs } from './lib/prefs'
import { installSecrets } from './lib/secrets'
import { consoleHello } from './lib/console-hello'
import { gateEnabled, gatePassed, loadTurnstile } from './lib/captcha'

if (gateEnabled() && !gatePassed()) loadTurnstile().catch(() => {})

applyDevicePrefs()
installErrorReporting()
installSecrets()
consoleHello()

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
