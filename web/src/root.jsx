import { StrictMode, Suspense, lazy } from 'react'
import App from './app.jsx'
import CloudflareGateImpl from '#ssr-page/cloudflare-gate'

const CloudflareGate = import.meta.env.SSR ? CloudflareGateImpl : lazy(() => import('#client-page/cloudflare-gate'))

export default function Root() {
  return (
    <StrictMode>
      <App />
      <Suspense fallback={null}>
        <CloudflareGate />
      </Suspense>
    </StrictMode>
  )
}
