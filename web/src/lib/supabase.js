import { useSyncExternalStore } from 'react'
import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
// New projects hand out sb_publishable_… keys; the legacy anon JWT works the same.
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// Set to 'local' or 'session' by "Keep me signed in" before a sign-in; decides
// where supabase-js stores the session from then on.
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
    // private mode
  }
}

// supabase-js takes one storage for the client's lifetime, so this adapter
// reads from either store and writes to whichever `setRemember` picked.
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
      // storage full or blocked
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

let client = null

// Browser-only: the prerender never talks to Supabase.
export function supabase() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  }
  return client
}

// A throwaway client for checking a password without touching the real
// session: nothing is persisted and it has its own storage key, so the
// cross-tab broadcast never reaches the main client.
export function probeClient() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return null
  return createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'blxr-auth-probe' },
  })
}

// --- auth store -----------------------------------------------------------
// `session` is undefined while the first getSession() is in flight, then
// Session | null. `recovery` flips on when a password-reset link lands.

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

// Shape the UI needs from a Supabase user, with OAuth metadata folded in.
export function profileOf(user) {
  if (!user) return null
  const meta = user.user_metadata || {}
  const email = user.email || ''
  return {
    id: user.id,
    name: meta.name || meta.full_name || meta.user_name || meta.preferred_username || email.split('@')[0] || 'Account',
    email,
    avatar: meta.avatar_url || meta.picture || null,
    provider: user.app_metadata?.provider || 'email',
  }
}
