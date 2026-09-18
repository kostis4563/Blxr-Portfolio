import { useState, useCallback } from 'react'
import ReviewPanel from './components/review-panel'
import { SubTabs } from './components/settings-ui'
import { Note } from './components/boards/ui'
import { currentSession } from './lib/supabase'
import { useI18n } from './lib/i18n'

const bearer = () => ({ bearer: currentSession()?.access_token })

export default function DashboardReviewPanel({ item }) {
  const { lang } = useI18n()
  const [denied, setDenied] = useState(false)
  const [pending, setPending] = useState(0)
  const onData = useCallback((data) => setPending(data.stats.pending), [])
  const onUnauthorized = useCallback(() => setDenied(true), [])

  return (
    <div className="w-full">
      <SubTabs item={item} label="Review panel sections" badges={{ reviews: pending }} />
      {denied ? (
        <Note tone="error">
          The server did not accept this session as the owner. In its env file, <code className="font-mono text-[12px]">SITE_OWNER_EMAIL</code> (or{' '}
          <code className="font-mono text-[12px]">STATS_OWNER_EMAIL</code>) has to be this account’s email, next to <code className="font-mono text-[12px]">SUPABASE_URL</code> and{' '}
          <code className="font-mono text-[12px]">SUPABASE_PUBLISHABLE_KEY</code>. Restart the server after changing it.
        </Note>
      ) : (
        <ReviewPanel tab={item.id} auth={bearer} lang={lang} onData={onData} onUnauthorized={onUnauthorized} />
      )}
    </div>
  )
}
