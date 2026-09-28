import { StrictMode } from 'react'
import App from './app.jsx'
import CloudflareGate from './components/cloudflare-gate'

export default function Root() {
  return (
    <StrictMode>
      <App />
      <CloudflareGate />
    </StrictMode>
  )
}
