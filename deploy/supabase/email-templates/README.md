# Supabase email templates

Same look as `/login`: dark, left-aligned, no card. Wordmark, a mono
uppercase label, the title, one short paragraph, one pill button, a dashed
hairline, then the fallback link. Inline styles only, no images, so nothing to
host and nothing for Gmail to strip.

Supabase has no way to load these from a file, so paste each one into
**Authentication → Email Templates** in the dashboard (body field, source
mode) and set the subject to the one listed here. Sender stays Supabase's
default until custom SMTP is set up.

| Template in dashboard | File | Subject |
| :-- | :-- | :-- |
| Confirm sign up | `confirm-signup.html` | `Confirm your blxr account` |
| Reset password | `reset-password.html` | `Reset your blxr password` |
| Magic link | `magic-link.html` | `Sign in to blxr` |
| Change email address | `change-email.html` | `Confirm your new blxr email` |
| Invite user | `invite.html` | `You're invited to blxr` |
| Reauthentication | `reauthentication.html` | `Your blxr verification code` |

The "password changed" notice isn't a Supabase template — the server sends
it from `server/src/mail.mjs` in the same style.

`{{ .ConfirmationURL }}` already carries the `redirect_to` the app passed
(`/login?next=…`), so the links land on the login page and forward from there.
The reauthentication one shows `{{ .Token }}` as a code instead of a button.

To preview a template locally, replace the `{{ … }}` placeholders and open the
file in a browser; all six share the same shell, so a change to one should be
made to all.
