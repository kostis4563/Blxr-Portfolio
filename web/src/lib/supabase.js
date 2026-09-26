import { useSyncExternalStore } from 'react'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

const PERSIST_KEY = 'blxr-auth-persist'
const SESSION_KEY = `sb-${/^https?:\/\/([^./]+)/.exec(URL || '')?.[1] ?? ''}-auth-token`

export const isSupabaseConfigured = () => Boolean(URL && ANON_KEY)

function persistTo() {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'session' ? sessionStorage : localStorage
  } catch {
    return null
  }
}

export function setRemember(remember) {
  try {
    localStorage.setItem(PERSIST_KEY, remember ? 'local' : 'session')
  } catch {
  }
}

const storage = {
  getItem(key) {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    const target = persistTo()
    if (!target) return
    try {
      ;(target === localStorage ? sessionStorage : localStorage).removeItem(key)
      target.setItem(key, value)
    } catch {
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
    }
  },
}

let lib = null
let loading = null
let client = null

export function loadSupabase() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return Promise.resolve(null)
  loading ??= import('@supabase/supabase-js').then((mod) => {
    lib = mod
    const sb = supabase()
    listen(sb)
    return sb
  })
  return loading
}

export function supabase() {
  if (typeof window === 'undefined' || !isSupabaseConfigured() || !lib) return null
  if (!client) {
    client = lib.createClient(URL, ANON_KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  }
  return client
}

export function probeClient() {
  if (typeof window === 'undefined' || !isSupabaseConfigured() || !lib) return null
  return lib.createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'blxr-auth-probe' },
  })
}

let state = { session: undefined, recovery: false }
let started = false
const listeners = new Set()

function update(patch) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

function storedSession() {
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null')
    if (!saved?.access_token || !saved.user || !(saved.expires_at * 1000 > Date.now() + 10_000)) return null
    return saved
  } catch {
    return null
  }
}

const hasStoredSession = () => {
  try {
    return Boolean(storage.getItem(SESSION_KEY))
  } catch {
    return false
  }
}

let listening = false
function listen(sb) {
  if (!sb || listening) return
  listening = true
  sb.auth.getSession().then(({ data }) => update({ session: data.session ?? null }))
  sb.auth.onAuthStateChange((event, next) => {
    update({ session: next ?? null, recovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : state.recovery })
  })
}

function start() {
  if (started) return
  started = true
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    update({ session: null })
    return
  }
  if (lib) return
  if (!hasStoredSession()) {
    update({ session: null })
    return
  }
  const saved = storedSession()
  if (saved) update({ session: saved })
  loadSupabase().catch(() => update({ session: null }))
}

const subscribe = (fn) => {
  listeners.add(fn)
  start()
  return () => listeners.delete(fn)
}
const getSnapshot = () => state
const SERVER_STATE = { session: undefined, recovery: false }
const getServerSnapshot = () => SERVER_STATE

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export const currentSession = () => state.session
export const clearRecovery = () => { if (state.recovery) update({ recovery: false }) }

export function profileOf(user) {
  if (!user) return null
  const meta = user.user_metadata || {}
  const email = user.email || ''
  const guest = Boolean(user.is_anonymous)
  return {
    id: user.id,
    name: guest ? 'Guest' : meta.name || meta.full_name || meta.user_name || meta.preferred_username || email.split('@')[0] || 'Account',
    email,
    avatar: guest ? null : meta.avatar_url || meta.picture || null,
    provider: guest ? 'guest' : user.app_metadata?.provider || 'email',
    guest,
    pendingEmail: guest ? user.new_email || '' : '',
  }
}
