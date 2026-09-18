# Supabase — mail and sign-in providers

Two things the dashboard needs set up by hand: sending auth mail as
`no-reply@blxr.net` (steps 1–4) and the Google button on `/login` (step 5). Everything in the app is already wired for both; this file is
only what to click.

Project ref: `mjgymhtgqxzrcnkthntp`, so the OAuth callback every provider gets is

```
https://mjgymhtgqxzrcnkthntp.supabase.co/auth/v1/callback
```

## Mail

Out of the box Supabase sends auth mail from `noreply@mail.app.supabase.io`,
capped at a couple of messages an hour. To send as `no-reply@blxr.net` you point
Supabase at an SMTP provider that is verified for the domain. The app and the
templates in [`email-templates/`](email-templates/) stay exactly the same.

Provider used here: [Resend](https://resend.com) — free tier covers 3,000
mails/month, has plain SMTP, and Supabase's dashboard links straight to it.
Any SMTP provider (Brevo, Postmark, SES, …) works the same way; only step 1
differs.

## 1. Verify the domain at the provider

1. Resend → **Domains → Add domain** → `blxr.net`, region EU.
2. Resend shows three DNS records (a DKIM `TXT` on `resend._domainkey`, and an
   `MX` + `TXT` SPF pair on `send`). Add them in **Cloudflare → DNS** for
   `blxr.net` exactly as shown — `MX`/`TXT` records are DNS-only, nothing to
   proxy.
3. Also add a DMARC record so Gmail/Outlook trust the domain:

   ```dns
   TXT  _dmarc.blxr.net  "v=DMARC1; p=none; rua=mailto:kostisnomikos@gmail.com"
   ```

   Switch `p=none` to `p=quarantine` once mail has been flowing for a couple of
   weeks and the reports look clean.
4. Back in Resend hit **Verify**. Usually a minute, up to an hour for DNS.
5. **API Keys → Create** → name `supabase-auth`, permission *Sending access*,
   domain `blxr.net`. Copy the key — it is the SMTP password below and is only
   shown once.

## 2. Point Supabase at it

Supabase dashboard → **Project Settings → Authentication → SMTP Settings** →
*Enable Custom SMTP*:

| Field | Value |
| :-- | :-- |
| Sender email | `no-reply@blxr.net` |
| Sender name | `blxr` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the API key from step 1.5 |
| Minimum interval between emails | `60` (seconds, per address — stops reset-link spam) |

Save, then **Authentication → Rate Limits → Emails per hour**: the default is
`2` (Supabase's own sender); with your own SMTP set it to something like `30`.

## 3. Check it

`/login#reset` with your own address. The mail should arrive from
`blxr <no-reply@blxr.net>`, and "show original" in Gmail should read
`SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. If it lands in spam on the first
send, that's normal for a brand-new domain; it settles after a few messages.

## 4. The "password changed" notice

Supabase has no template for this one, so the Node server sends it
(`server/src/mail.mjs`, route `POST /api/mail/password-changed`). Add to
`/etc/blxr-search.env` on the box and `systemctl restart blxr-search`:

```ini
RESEND_API_KEY=re_...                       # the same key as the SMTP form
SITE_URL=https://blxr.net
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## 5. Sign in with Google

Google only needs an OAuth client. Free, takes ten minutes.

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project (`blxr`) or pick one.
2. **APIs & Services → OAuth consent screen** (now "Google Auth Platform →
   Branding"): app name `blxr`, support email your Gmail, app domain
   `blxr.net`, add `blxr.net` under **Authorised domains**, developer contact
   your Gmail. Audience **External**. Then **Publish** it — while it stays in
   *Testing* only the test users you list can sign in and everyone else gets
   "access blocked".
3. **Credentials → Create credentials → OAuth client ID**, type *Web application*:

   | Field | Value |
   | :-- | :-- |
   | Name | `blxr web` |
   | Authorised JavaScript origins | `https://blxr.net`, `http://localhost:5173` |
   | Authorised redirect URIs | `https://mjgymhtgqxzrcnkthntp.supabase.co/auth/v1/callback` |

   The redirect URI is Supabase's, not the site's — the browser goes
   site → Google → Supabase → back to `/login?next=…`. Copy the client ID and
   secret.
4. Supabase → **Authentication → Sign In / Providers → Google**: enable,
   paste **Client ID** and **Client Secret**, save. Leave *Skip nonce check*
   off.
5. `/login` → the Google button. First sign-in creates the account with
   Google's name and avatar (`lh3.googleusercontent.com` is already allowed by
   the CSP).

## 6. Sign in with Discord

1. [discord.com/developers/applications](https://discord.com/developers/applications)
   → **New Application** → name `blxr`.
2. **OAuth2** in the left menu. Under **Redirects** add
   `https://mjgymhtgqxzrcnkthntp.supabase.co/auth/v1/callback` and **Save
   Changes**. Copy the **Client ID**; click **Reset Secret** once to get the
   **Client Secret** (it is only shown once).
3. Supabase → **Authentication → Sign In / Providers → Discord**: enable, paste
   both, save.
4. `/login` → the Discord button. Supabase asks Discord for `identify email`;
   the account gets the Discord username and avatar (`cdn.discordapp.com` is
   allowed by the CSP). Discord only checks the redirect after you log in, so a
   missing redirect shows up as "Invalid OAuth2 redirect_uri" *after* the
   login form, not before.

## 7. Sign in with GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   ([github.com/settings/applications/new](https://github.com/settings/applications/new)).
   Not a "GitHub App" — those are for installs on repos and need extra setup.

   | Field | Value |
   | :-- | :-- |
   | Application name | `blxr` |
   | Homepage URL | `https://blxr.net` |
   | Authorization callback URL | `https://mjgymhtgqxzrcnkthntp.supabase.co/auth/v1/callback` |

   Leave *Enable Device Flow* off.
2. **Register application**, then **Generate a new client secret**. Copy the
   **Client ID** and the secret (shown once).
3. Supabase → **Authentication → Sign In / Providers → GitHub**: enable, paste
   both, save.
4. `/login` → the GitHub button. Supabase asks for `user:email`, so it works
   even when the GitHub email is private — it takes the primary verified
   address. The account gets the GitHub login name and avatar
   (`avatars.githubusercontent.com` is allowed by the CSP).

## 8. Dashboard settings

`/dashboard#settings` talks to Supabase Auth directly. Three of its features
need a switch in the dashboard:

- **Two-factor (Security → Authenticator app)** — *Authentication →
  Multi-Factor → TOTP* → enable *Enroll* and *Verify*. Once a user has a
  verified factor, `/login` asks for the code and `/dashboard` refuses to open
  without it. There are no recovery codes; the settings page says so.
- **Connected accounts (Account → Connect)** — *Authentication → Settings →
  Allow manual linking*. Without it the Connect buttons answer "not enabled
  on this project yet". Providers already enabled in §5–7 are the ones offered.
- **Delete account (Data & privacy)** — needs `SUPABASE_SECRET_KEY` (*Project
  settings → API keys → Secret keys*, or the legacy `service_role` JWT) in
  `/etc/blxr-search.env`. The server checks the caller's own bearer token
  first, then calls `DELETE /auth/v1/admin/users/{id}`. Leave the variable
  unset and the button explains deletion is off.

Email changes send a confirmation to both the old and the new address
(*Authentication → Settings → Secure email change*, on by default); the
`change-email` template in `email-templates/` covers it. Profile fields, the
regional and notification preferences are stored in `user_metadata`
(`name`, `bio`, `website`, `location`, `prefs`), so nothing else needs a table.

## 9. Member profiles

`/dashboard#profile` lets every account build a public page at
`blxr.net/u/<handle>`. Unlike settings it needs a table, because other people
have to be able to read it:

1. Supabase → **SQL editor** → paste [`profiles.sql`](profiles.sql) → **Run**.
   It creates `public.profiles` with row-level security (anyone can read
   public/unlisted rows, only the owner can write their own), the
   `handle_available()` check the handle field calls while you type, and a
   public `avatars` storage bucket where each user may only write inside a
   folder named after their user id. Re-running it is safe.
2. Nothing else. The browser talks to the table with the publishable key;
   RLS does the gatekeeping. Uploaded photos are square-cropped to 320px WebP
   in the browser before upload (the bucket caps files at 1 MB).

Until step 1 is done the page says "Profiles are not set up on this project
yet". Photo uploads say the same about the bucket.

The file is versioned in place: the v2 block (layouts, cover photo, status,
"Now", showcase, section order, page theme) uses `add column if not exists`
and guarded constraints, so **re-run the whole file** after pulling changes
to it — nothing is dropped. Cover photos go in the same `avatars` bucket as
`<uid>/cover-<ts>.webp`, resized to 1200×480 in the browser.

Deleting an account (§8) cascades to its profile row; the avatar file is
removed by the app when the profile is deleted from the dashboard, and is
orphaned (harmless, 1 MB max) if the whole account is deleted instead.

## 10. Developer stats

`/dashboard#stats` shows your GitHub activity — commits, files edited and
lines changed by today / week / month / year / all time, across every public
repository you have committed to (your own, other people's and
organisations'), plus languages, commit rhythm, streaks and per-repository
totals. Nothing to connect and no table: the Node server asks GitHub whose
token it holds and builds the page for that account.

The one thing it needs is `GITHUB_TOKEN` in `/etc/blxr-search.env` — the
same token the home page's contribution graph uses; it gets there from the
`BLXR_GITHUB_TOKEN` repository secret on every deploy. Until it is set the
page says "Developer stats are not enabled on this server yet". Results are
cached an hour on the server.

What the token may read decides what is counted:

- **No permissions** — public repositories only; private commits just add
  up in the "private contributions" line at the bottom.
- **Classic token with `repo` + `user:email`** (GitHub → Settings →
  Developer settings → Tokens (classic)) — private repositories too, your
  own and every organisation's you can read. Prefer this one: a fine-grained
  token only covers one owner, so it would miss organisation repos.

Private repositories are never shown to visitors: the API hands out their
numbers as "Private repository" with no name, link or owner. Only you see
the names — you count as the owner when you are signed in to the dashboard
with an email the GitHub account has (that is what `user:email` is for), or
with a GitHub sign-in of the same login. `STATS_OWNER_EMAIL` in the server
env is a manual fallback.

## 11. Boards

`/dashboard#boards` is a kanban workspace: boards made of columns, cards you
drag between them, due dates, labels, checklists, comments, links, file
attachments and board art. Like profiles it needs tables, and like profiles
row-level security is the whole access model.

1. Supabase → **SQL editor** → paste [`boards.sql`](boards.sql) → **Run**.
   Re-running it is safe.

That creates:

- `public.boards` — one row per board. Its columns, labels, reminder
  settings and art references live inline as `jsonb`, because they are small,
  ordered and always read together with the board.
- `public.board_cards` — one row per card, with a float `position` so
  dropping a card between two others writes that one card and nothing else.
  A `before` trigger gives each card the next number on its board (`#7`),
  copies the board's owner onto it, and stamps `completed_at` when it is
  ticked off.
- `public.board_index` — a view that adds the five counters the board tiles
  show, so the list does not have to pull every card of every board. It is
  declared `security_invoker`, so it obeys the policies below rather than
  the view owner's rights.
- `public.boards_agenda()` — everything due across every board, for the
  **Coming up** strip above the board list.
- `public.boards_sweep_bin()` — clears deleted cards older than a day. The
  app calls it on load; nothing has to be scheduled.
- A **private** `boards` storage bucket for board art and card attachments,
  at `<user id>/<board id>/…`. Private means every read goes through a
  short-lived signed URL, so a leaked path is not a leaked file.

**Who sees what.** Every board belongs to exactly one account, and nobody
else can read it, find it or write to it. There is no sharing: the policies
are `auth.uid() = owner`. The one exception is the owner account, which
reads and writes everything — that address is set in `is_board_admin()` at
the top of the file:

```sql
select coalesce(auth.jwt() ->> 'email', '') = 'kostisnomikos@gmail.com';
```

Change the address there and re-run the file to move it.

**Limits** are enforced twice, by `check` constraints in the table and by the
same numbers in `web/src/lib/boards.js`, so the UI can refuse politely before
the database refuses bluntly: 60 boards an account, 12 columns and 400 cards
a board, 12 labels, 40 checklist steps, 120 comments, 12 links and 10 files a
card, 4 MB a file. Images are resized and cropped in the browser before
upload; a PDF or animated GIF over the limit is refused rather than re-encoded.

Deleting an account cascades to its boards and their cards. The files in
storage are cleared by the app when a board is deleted from the dashboard,
and are orphaned if the whole account is deleted instead.

## 12. Messages

`/dashboard#messages` is a direct line, the way a DM is: every account gets
one private conversation, and the person on the other end is always the
owner. There is no member-to-member messaging, so there is nothing to
invite, block or moderate. The owner sees every conversation as an inbox.

1. Supabase → **SQL editor** → paste [`messages.sql`](messages.sql) → **Run**.
   Re-running it is safe.

That creates:

- `public.threads` — one row per member, made the first time they open the
  page (`messages_open()`). It carries two stamps, `member_seen_at` and
  `owner_seen_at`; unread counts and the "Seen" receipt are read off those,
  and a trigger lets each side move only its own.
- `public.messages` — the messages, with `files`, `reactions` and
  `reply_to`. A `before` trigger stamps the author and which side they are
  on, lets the other side change nothing but reactions, and turns an unsend
  into a cleared row rather than a deleted one, so it still travels over
  realtime.
- `public.messages_inbox()` — the owner's list: every thread with who it
  belongs to (name, email, picture, handle, sign-in provider), its last
  message and how much is unread. It reads `auth.users`, so it runs as the
  definer and refuses anyone but the owner.
- `public.messages_owner()` — the owner's public face for the member's
  header: a name, a picture and a handle if there is a profile. Never the
  address.
- `public.messages_unread()` and `messages_seen(thread)` — the sidebar
  badge and the receipt.
- The two tables are added to the `supabase_realtime` publication, so
  inserts and updates reach the browser as they happen. Typing and presence
  go over private channels (`thread:<id>`, `messages:lobby`) gated by
  policies on `realtime.messages`. Both are conveniences: the page also
  polls, faster when the channel is not up, so a project without realtime
  is merely slower.
- A **private** `messages` storage bucket for attachments, at
  `<thread id>/…`, read through short-lived signed URLs.

**Who sees what.** The policies are `member = auth.uid() or is_site_owner()`
throughout. The owner account is the address in `is_site_owner()` at the top
of the file — the same one as `is_board_admin()` in `boards.sql`; change
both and re-run both files to move it. If the owner signs in they get the
inbox, not a thread of their own.

**Limits**: 4 000 characters and 6 files a message, 4 MB a file, the same
kinds as board attachments. A run of 60 messages loads at a time; older ones
on request.

Clearing a conversation (owner only, from its menu) deletes the thread and
cascades to its messages; the app removes the files first. Deleting an
account cascades the same way and orphans its files.

## Notes

- Until a provider is enabled in Supabase its button says "That sign-in
  method is turned off."
- A Google account and an email+password account with the same address are
  linked automatically because Google vouches for the address. GitHub/Discord
  don't always, in which case the button says the email is tied to a different
  sign-in method.
- `no-reply@blxr.net` is send-only. Nothing needs to receive at it; if you want
  replies, set a **Reply-To** in Resend's domain settings or use a real inbox
  (Cloudflare → Email → Email Routing forwards `hello@blxr.net` to Gmail for
  free).
- The API key lives only in Supabase's SMTP form. Never commit it; there is no
  env var for it in this repo.
- If Resend is ever swapped out, only the DNS records and the SMTP form change.
