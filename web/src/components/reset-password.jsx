import { useState, useEffect, useId, useRef } from 'react'
import { authRequestReset, authVerifyReset, authUpdatePassword } from '../lib/auth'
import { passwordChecks, passwordProblem } from '../lib/password'
import { link, LOGIN_PATH } from '../lib/router'
import { clearRecovery } from '../lib/supabase'
import { Captcha } from './captcha'
import { Icon } from './icon'
import { LABEL, INPUT, CTA, SWITCH, QUIET, Field, PasswordInput } from './auth-ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_LENGTH = 6
const RESEND_AFTER = 60
const BLANK = Array(CODE_LENGTH).fill('')

const CTA_COPY = {
  email: { idle: 'Send code', busy: 'Sending…', kind: 'send' },
  code: { idle: 'Verify code', busy: 'Checking…', kind: 'verify' },
  password: { idle: 'Update password', busy: 'Updating…', kind: 'save' },
}

const BOX =
  'h-12 w-full min-w-0 rounded-xl border bg-surface-raised/60 text-center font-mono text-[18px] font-semibold caret-transparent transition-colors focus:bg-surface focus:outline-none disabled:cursor-not-allowed'

function CodeInput({ digits, onChange, onComplete, inputs, labelledBy, readOnly, verified, invalid }) {
  const focus = (i) => inputs.current[Math.min(Math.max(i, 0), CODE_LENGTH - 1)]?.focus()

  const put = (at, incoming) => {
    const start = incoming.length >= CODE_LENGTH ? 0 : at
    const next = [...digits]
    for (let k = 0; k < incoming.length && start + k < CODE_LENGTH; k++) next[start + k] = incoming[k]
    onChange(next)
    if (next.every(Boolean)) onComplete(next.join(''))
    else focus(start + incoming.length)
  }

  const clear = (i) => onChange(digits.map((d, k) => (k === i ? '' : d)))

  const tone = verified
    ? 'border-emerald-500/40 text-emerald-500'
    : invalid
      ? 'border-red-500/60 text-ink-strong'
      : 'border-line text-ink-strong hover:border-line-strong focus:border-ink-strong/60'

  return (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-6 gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
          aria-invalid={invalid || undefined}
          value={digit}
          readOnly={readOnly}
          disabled={verified}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const raw = digit && e.target.value.length > 1 ? e.target.value.replace(digit, '') : e.target.value
            const incoming = raw.replace(/\D/g, '')
            if (incoming) put(i, incoming)
            else if (!raw) clear(i)
          }}
          onPaste={(e) => {
            e.preventDefault()
            if (readOnly) return
            const incoming = e.clipboardData.getData('text').replace(/\D/g, '')
            if (incoming) put(i, incoming)
          }}
          onKeyDown={(e) => {
            if (readOnly) return
            if (e.key === 'Backspace' && !digit && i > 0) {
              e.preventDefault()
              clear(i - 1)
              focus(i - 1)
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              focus(i - 1)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              focus(i + 1)
            }
          }}
          className={`${BOX} ${tone}`}
        />
      ))}
    </div>
  )
}

function Requirement({ met, label }) {
  return (
    <li className={`flex items-center gap-2 text-[12px] transition-colors duration-200 ${met ? 'text-emerald-500' : 'text-ink-faint'}`}>
      <Icon name={met ? 'circleCheck' : 'circle'} className="h-[13px] w-[13px]" strokeWidth={2} />
      <span className="sr-only">{met ? 'Done:' : 'Missing:'}</span>
      {label}
    </li>
  )
}

export default function ResetPassword({ email, onEmailChange, copy, describe, next, onDone, className }) {
  const id = useId()
  const [step, setStep] = useState('email')
  const [sentTo, setSentTo] = useState('')
  const [digits, setDigits] = useState(BLANK)
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [resent, setResent] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(0)
  const captcha = useRef(null)
  const inputs = useRef([])

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const cooling = wait > 0
  useEffect(() => {
    if (!cooling) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [cooling])

  const checks = passwordChecks(password)
  const ready = checks.every((check) => check.met)
  const complete = digits.every(Boolean)

  const send = async (to) => {
    if (!EMAIL_RE.test(to)) {
      setFieldError('Enter a valid email.')
      return
    }
    setBusy('send')
    setError(null)
    try {
      const captchaToken = captcha.current ? await captcha.current.run() : undefined
      await authRequestReset(to, { captchaToken })
      setResent(step === 'code')
      setSentTo(to)
      setDigits(BLANK)
      setStep('code')
      const t = Date.now()
      setNow(t)
      setResendAt(t + RESEND_AFTER * 1000)
    } catch (err) {
      setError(describe(err, 'reset'))
    } finally {
      setBusy(null)
    }
  }

  const verify = async (code) => {
    if (busy) return
    setBusy('verify')
    setError(null)
    try {
      await authVerifyReset(sentTo, code)
      setStep('password')
    } catch (err) {
      setError(describe(err, 'reset-code'))
      setDigits(BLANK)
      inputs.current[0]?.focus()
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!ready) return
    const problem = passwordProblem(password, { email: sentTo })
    if (problem) {
      setFieldError(problem)
      return
    }
    setBusy('save')
    setError(null)
    try {
      await authUpdatePassword(password)
      onDone()
    } catch (err) {
      setError(describe(err, 'update'))
      setPassword('')
    } finally {
      setBusy(null)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (busy) return
    if (step === 'email') send(email.trim())
    else if (step === 'code') { if (complete) verify(digits.join('')) }
    else save()
  }

  const changeEmail = () => {
    setStep('email')
    setDigits(BLANK)
    setError(null)
    setResent(false)
  }

  const cta = CTA_COPY[step]
  const verified = step === 'password'

  return (
    <form onSubmit={submit} noValidate aria-busy={Boolean(busy) || undefined} className={className}>
      <p className={`${LABEL} mb-2`}>{copy.eyebrow}</p>
      <h1 className="text-[24px] font-bold tracking-tight text-ink-strong">{copy.title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        {step === 'email' ? (
          'Enter your email and we will send you a 6-digit code.'
        ) : verified ? (
          <>Code accepted for <span className="text-ink-strong">{sentTo}</span>. Pick a new password to finish.</>
        ) : (
          <>If an account exists for <span className="text-ink-strong">{sentTo}</span>, a code is on its way. It expires in an hour.</>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {step === 'email' ? (
          <Field label="Email" error={fieldError}>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              autoFocus
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                onEmailChange(e.target.value)
                setFieldError(null)
              }}
              aria-invalid={Boolean(fieldError) || undefined}
              className={INPUT}
            />
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3">
              <span id={`${id}-code`} className={LABEL}>Code</span>
              {!verified && (
                <button type="button" onClick={changeEmail} disabled={Boolean(busy)} className={`${QUIET} disabled:cursor-not-allowed disabled:opacity-50`}>
                  Use a different email
                </button>
              )}
            </span>
            <CodeInput
              digits={digits}
              onChange={(value) => {
                setDigits(value)
                if (error) setError(null)
              }}
              onComplete={verify}
              inputs={inputs}
              labelledBy={`${id}-code`}
              readOnly={Boolean(busy)}
              verified={verified}
              invalid={Boolean(error) && !verified}
            />
            {verified ? (
              <p role="status" className="flex items-center gap-1.5 text-[12px] text-emerald-500">
                <Icon name="check" className="h-[13px] w-[13px]" strokeWidth={2.2} />
                Code verified
              </p>
            ) : (
              <p className="text-[12px] text-ink-muted">
                {resent ? 'New code sent.' : "Didn't get it?"}{' '}
                <button
                  type="button"
                  onClick={() => send(sentTo)}
                  disabled={Boolean(busy) || cooling}
                  className={`${SWITCH} disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline`}
                >
                  {busy === 'send' ? 'Sending…' : cooling ? `Resend in ${wait}s` : 'Send another'}
                </button>
              </p>
            )}
          </div>
        )}

        {verified && (
          <div className="grid animate-expand-in">
            <div className="min-h-0 overflow-hidden">
              <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-line pt-5">
                <input type="text" name="username" autoComplete="username" value={sentTo} readOnly hidden />
                <Field label="New password" error={fieldError}>
                  <PasswordInput
                    id={`${id}-password`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setFieldError(null)
                    }}
                    autoComplete="new-password"
                    autoFocus
                    invalid={Boolean(fieldError)}
                  />
                </Field>
                <ul aria-label="Password requirements" className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {checks.map((check) => (
                    <Requirement key={check.label} {...check} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3.5 py-2.5 text-[12.5px] text-red-500">
          {error}
        </p>
      )}

      {!verified && <Captcha handle={captcha} />}

      <button
        type="submit"
        disabled={Boolean(busy) || (step === 'code' && !complete) || (verified && !ready)}
        className={`${CTA} mt-6`}
      >
        <span>{busy === cta.kind ? cta.busy : cta.idle}</span>
        {busy !== cta.kind && <span aria-hidden="true">→</span>}
      </button>

      <p className="mt-5 text-center text-[12.5px] text-ink-muted">
        {verified ? (
          <>
            Changed your mind?{' '}
            <a {...link(next, () => { clearRecovery(); onDone() })} className={SWITCH}>Skip for now</a>
          </>
        ) : (
          <>
            Remembered it?{' '}
            <a {...link(LOGIN_PATH)} className={SWITCH}>Back to sign in</a>
          </>
        )}
      </p>
    </form>
  )
}
