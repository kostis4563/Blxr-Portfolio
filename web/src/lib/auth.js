import { supabase, probeClient, isSupabaseConfigured, setRemember, clearRecovery, currentSession } from './supabase'
import { LOGIN_PATH, DASHBOARD_PATH, dashboardPath } from './router'

const SETTINGS_ACCOUNT_PATH = dashboardPath('settings/account')
import { notifyPasswordChanged, deleteAccountRequest } from './api'

export class AuthError extends Error {
  constructor(code, { fields = [], retryAfter = 0, status = 0 } = {}) {
    super(code)
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
    this.status = status
  }
}

export const AUTH_PROVIDERS = ['google', 'discord', 'github']

// Supabase error codes → the codes the login page knows how to word.
const CODE_MAP = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  weak_password: 'weak_password',
  validation_failed: 'invalid',
  over_request_rate_limit: 'locked',
  over_email_send_rate_limit: 'locked',
  same_password: 'same_password',
  signup_disabled: 'signup_disabled',
  provider_disabled: 'provider_disabled',
  email_provider_disabled: 'provider_disabled',
  otp_expired: 'link_expired',
  mfa_verification_failed: 'bad_code',
  mfa_challenge_expired: 'code_expired',
  mfa_factor_not_found: 'no_factor',
  mfa_totp_enroll_not_enabled: 'mfa_disabled',
  mfa_totp_verify_not_enabled: 'mfa_disabled',
  manual_linking_disabled: 'linking_disabled',
  identity_already_exists: 'identity_taken',
  single_identity_not_deletable: 'last_identity',
  email_address_not_authorized: 'invalid',
  insufficient_aal: 'needs_mfa',
  reauthentication_needed: 'reauth',
}

function wrap(error) {
  if (!error) return null
  const msg = String(error.message || '').toLowerCase()
  let code = CODE_MAP[error.code]
  if (!code) {
    if (msg.includes('failed to fetch') || msg.includes('network')) code = 'offline'
    else if (msg.includes('invalid login credentials')) code = 'invalid_credentials'
    else if (msg.includes('already registered')) code = 'email_taken'
    else if (msg.includes('rate limit')) code = 'locked'
    else if (msg.includes('captcha')) code = 'captcha'
    else if (msg.includes('invalid totp code') || msg.includes('invalid mfa code')) code = 'bad_code'
    else if (msg.includes('manual linking')) code = 'linking_disabled'
    else if (msg.includes('mfa') && msg.includes('not enabled')) code = 'mfa_disabled'
    else if (error.status === 422) code = 'invalid'
    else code = 'failed'
  }
  const fields = code === 'weak_password' ? ['password'] : []
  const retryAfter = code === 'locked' ? 60 : 0
  return new AuthError(code, { fields, retryAfter, status: error.status || 0 })
}

function client() {
  const sb = supabase()
  if (!sb) throw new AuthError('not_configured')
  return sb
}

async function run(fn) {
  const sb = client()
  let result
  try {
    result = await fn(sb)
  } catch (err) {
    throw wrap(err) || new AuthError('failed')
  }
  if (result?.error) throw wrap(result.error)
  return result?.data ?? null
}

export async function authLogin({ email, password, remember = true, captchaToken }) {
  setRemember(remember)
  const data = await run((sb) => sb.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined }))
  return data?.user ?? null
}

// Returns { user, confirmed }: `confirmed` is false when Supabase wants the
// address verified first, in which case there is no session yet.
export async function authRegister({ name, email, password, captchaToken }) {
  setRemember(true)
  const data = await run((sb) =>
    sb.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: callbackUrl(DASHBOARD_PATH), ...(captchaToken ? { captchaToken } : {}) },
    }),
  )
  // Supabase returns a user with an empty identities list for an existing email
  // rather than an error, so the response can't be used to enumerate accounts.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AuthError('email_taken', { fields: ['email'] })
  }
  return { user: data?.user ?? null, confirmed: Boolean(data?.session) }
}

// The link lands on /login; supabase-js raises PASSWORD_RECOVERY there and the
// page switches to the new-password form.
export function authRequestReset(email, { captchaToken } = {}) {
  return run((sb) => sb.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl(LOGIN_PATH), ...(captchaToken ? { captchaToken } : {}) }))
}

export async function authUpdatePassword(password) {
  const data = await run((sb) => sb.auth.updateUser({ password }))
  clearRecovery()
  const token = currentSession()?.access_token
  if (token) notifyPasswordChanged(token)
  return data?.user ?? null
}

// Full-page redirect to the provider; Supabase lands back on /login?next=…
// with a ?code= that the client exchanges on load.
export function authSignInWith(provider, next = DASHBOARD_PATH) {
  setRemember(true)
  return run((sb) => sb.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next) } }))
}

export async function authSignOut() {
  const sb = supabase()
  if (!sb) return
  await sb.auth.signOut().catch(() => {})
}

// Keeps this session, revokes every other one for the account.
export function authSignOutOthers() {
  return run((sb) => sb.auth.signOut({ scope: 'others' }))
}

// --- settings ----------------------------------------------------------------

// `data` is merged into user_metadata one key deep, so send whole objects.
export async function authUpdateProfile(data) {
  const res = await run((sb) => sb.auth.updateUser({ data }))
  return res?.user ?? null
}

// Supabase mails both addresses; the change applies once each is confirmed.
export async function authUpdateEmail(email) {
  const res = await run((sb) => sb.auth.updateUser({ email }, { emailRedirectTo: callbackUrl(SETTINGS_ACCOUNT_PATH) }))
  return res?.user ?? null
}

// Confirms the current password before a change, on a side client so the
// real session (and its MFA level) is left alone.
export async function authVerifyPassword(email, password, { captchaToken } = {}) {
  const probe = probeClient()
  if (!probe) throw new AuthError('not_configured')
  let result
  try {
    result = await probe.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined })
  } catch (err) {
    throw wrap(err) || new AuthError('failed')
  }
  if (result.error) throw wrap(result.error)
  await probe.auth.signOut({ scope: 'local' }).catch(() => {})
}

// Redirects to the provider; Supabase lands back on the account settings.
export function authLinkIdentity(provider) {
  return run((sb) => sb.auth.linkIdentity({ provider, options: { redirectTo: callbackUrl(SETTINGS_ACCOUNT_PATH) } }))
}

// unlinkIdentity does not refresh the stored user, so the identities list
// would go stale; a session refresh pulls the new copy and notifies the store.
export async function authUnlinkIdentity(identity) {
  await run((sb) => sb.auth.unlinkIdentity(identity))
  await run((sb) => sb.auth.refreshSession()).catch(() => {})
}

// --- two-factor (TOTP) -------------------------------------------------------

export async function mfaFactors() {
  const data = await run((sb) => sb.auth.mfa.listFactors())
  return (data?.totp || []).filter((f) => f.status === 'verified')
}

// Starts enrolment; leftover unverified factors from abandoned attempts are
// cleared first so Supabase's per-user limit is not hit.
export async function mfaEnroll() {
  const sb = client()
  const { data } = await sb.auth.mfa.listFactors()
  for (const f of data?.all || []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
  const factor = await run((s) => s.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' }))
  return { id: factor.id, qr: svgDataUri(factor.totp.qr_code), secret: factor.totp.secret, uri: factor.totp.uri }
}

// supabase-js hands back `data:image/svg+xml;utf-8,<svg …>` with the markup
// unescaped; a `#` inside (colours) would be read as a fragment. Re-encode.
function svgDataUri(value) {
  const raw = String(value || '')
  let svg = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw
  try { svg = decodeURIComponent(svg) } catch { /* already plain */ }
  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`
}

export function mfaVerify(factorId, code) {
  return run((sb) => sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') }))
}

export function mfaUnenroll(factorId) {
  return run((sb) => sb.auth.mfa.unenroll({ factorId }))
}

// True when the account has a verified factor the current session has not
// passed yet. Reads the session JWT, no network.
export async function mfaRequired() {
  const sb = supabase()
  if (!sb) return false
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  return Boolean(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2')
}

// Sign-in step two: verifies a code against the first TOTP factor.
export async function mfaChallenge(code) {
  const factors = await mfaFactors()
  if (!factors.length) throw new AuthError('no_factor')
  return mfaVerify(factors[0].id, code)
}

// --- danger zone ----------------------------------------------------------------

export async function authDeleteAccount() {
  const token = currentSession()?.access_token
  if (!token) throw new AuthError('failed', { status: 401 })
  const res = await deleteAccountRequest(token)
  if (res.status === 204) {
    // The row is gone server-side; drop the local copy without calling Supabase.
    await client().auth.signOut({ scope: 'local' }).catch(() => {})
    return
  }
  let body = null
  try { body = await res.json() } catch { /* not json */ }
  if (res.status === 503) throw new AuthError('delete_disabled', { status: 503 })
  if (res.status === 401) throw new AuthError(body?.error === 'needs_mfa' ? 'needs_mfa' : 'reauth', { status: 401 })
  if (res.status === 429) throw new AuthError('locked', { status: 429, retryAfter: Number(res.headers.get('retry-after')) || 60 })
  throw new AuthError(body?.error === 'offline' ? 'offline' : 'failed', { status: res.status })
}

export { isSupabaseConfigured }

// /login?next=… — `next` may carry a hash, so it rides inside the query.
function callbackUrl(next) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const url = new URL(LOGIN_PATH, origin || 'http://localhost')
  if (next && next !== LOGIN_PATH) url.searchParams.set('next', next)
  return url.toString()
}

export const loginUrlFor = (next) => `${LOGIN_PATH}${next && next !== LOGIN_PATH ? `?${new URLSearchParams({ next })}` : ''}`
