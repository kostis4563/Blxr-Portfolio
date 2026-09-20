import { useSyncExternalStore } from 'react'
import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

const PERSIST_KEY = 'blxr-auth-persist'

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

let client = null

export function supabase() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  }
  return client
}

export function probeClient() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return null
  return createClient(URL, ANON_KEY, {
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

function start() {
  if (started) return
  started = true
  const sb = supabase()
  if (!sb) {
    update({ session: null })
    return
  }
  sb.auth.getSession().then(({ data }) => {
    if (state.session === undefined) update({ session: data.session ?? null })
  })
  sb.auth.onAuthStateChange((event, next) => {
    update({ session: next ?? null, recovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : state.recovery })
  })
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
