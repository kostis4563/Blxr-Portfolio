import { Icon } from './icon'
import AccountMenu, { Avatar } from './account-menu'
import { useI18n } from '../lib/i18n'
import { useAuth, profileOf } from '../lib/supabase'
import { loginUrlFor } from '../lib/auth'
import { useUnread } from '../lib/messages-unread'
import { badgeOf } from '../lib/messages'
import { link, DASHBOARD_PATH, dashboardPath } from '../lib/router'

const MESSAGES_PATH = dashboardPath('messages')
const BADGE = 'rounded-full bg-ink-strong font-mono font-semibold leading-none text-ink-inverse'

function AvatarButton({ user, className = '', badge = 0, ...props }) {
  return (
    <button
      type="button"
      title={user.name}
      className={`${className} relative cursor-pointer rounded-lg outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover`}
      {...props}
    >
      <Avatar user={user} size={24} />
      {badge > 0 && (
        <span className={`${BADGE} absolute right-1 top-1 grid h-[15px] min-w-[15px] place-items-center px-1 text-[9px] ring-2 ring-bg`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

function SignedIn({ user, theme, onToggleTheme, itemClass }) {
  const { t } = useI18n()
  const unread = useUnread()

  const items = [
    { path: DASHBOARD_PATH, icon: 'grid', label: t('cmd.dashboard') },
    { path: MESSAGES_PATH, icon: 'message', label: t('cmd.messages'), badge: unread > 0 ? badgeOf(unread) : null },
  ]

  const trigger = ({ open, toggle }) => (
    <AvatarButton
      user={user}
      badge={unread}
      className={itemClass}
      onClick={toggle}
      aria-label={unread > 0 ? `${t('nav.account')}, ${unread} ${t('cmd.unread')}` : t('nav.account')}
      aria-expanded={open}
      aria-haspopup="menu"
    />
  )

  return (
    <div className="animate-menu-in">
      <AccountMenu user={user} theme={theme} onToggleTheme={onToggleTheme} placement="down" items={items} trigger={trigger} />
    </div>
  )
}

export default function NavAccount({ theme, onToggleTheme, pillClass = '', itemClass = '' }) {
  const { t } = useI18n()
  const { session } = useAuth()
  const user = profileOf(session?.user)

  if (!user) {
    return (
      <a {...link(loginUrlFor(DASHBOARD_PATH))} className={`${pillClass} cursor-pointer`} aria-label={t('nav.signIn')}>
        <Icon name="user" className="h-[16px] w-[16px] shrink-0" />
        <span className="hidden text-[12.5px] font-medium sm:inline">{t('nav.signIn')}</span>
      </a>
    )
  }

  return <SignedIn user={user} theme={theme} onToggleTheme={onToggleTheme} itemClass={itemClass} />
}
