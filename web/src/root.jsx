import { StrictMode } from 'react'
import App from './app.jsx'
import { I18nProvider } from './lib/i18n-provider'

export default function Root() {
  return (
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>
  )
}
