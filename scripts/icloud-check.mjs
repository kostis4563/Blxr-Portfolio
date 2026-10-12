import { CalDavClient, CalendarMirror, CalDavError } from '../server/src/icloud.mjs'
import { busyFrom } from '../server/src/ical.mjs'
import { parseHours, isTimeZone, openSlots, pickCalendar } from '../server/src/booking.mjs'

const email = (process.env.ICLOUD_EMAIL || '').trim()
const password = (process.env.ICLOUD_APP_PASSWORD || '').replace(/\s+/g, '')
if (!email || !password) {
  console.error(`Set ICLOUD_EMAIL and ICLOUD_APP_PASSWORD first:

  1. https://account.apple.com → Sign-In and Security → App-Specific Passwords → +
  2. Name it "blxr.net" and copy the password (xxxx-xxxx-xxxx-xxxx)
  3. ICLOUD_EMAIL=you@icloud.com ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx node scripts/icloud-check.mjs

ICLOUD_EMAIL is the Apple Account email you sign in to iCloud with.`)
  process.exit(1)
}

const timeZone = isTimeZone(process.env.BOOKING_TIMEZONE) ? process.env.BOOKING_TIMEZONE : 'Europe/Athens'
const windows = parseHours(process.env.BOOKING_HOURS) || parseHours('mon-fri 10:00-18:00')
const client = new CalDavClient({ root: process.env.ICLOUD_CALDAV_URL || 'https://caldav.icloud.com', email, password })

let calendars
const started = Date.now()
try {
  calendars = await new CalendarMirror(client).sync()
} catch (err) {
  if (err instanceof CalDavError && err.code === 'auth') {
    console.error('iCloud said no. Check that ICLOUD_EMAIL is your Apple Account email and that the app-specific password was copied whole.')
    process.exit(1)
  }
  throw err
}

const target = pickCalendar(calendars, (process.env.BOOKING_CALENDAR || '').trim())
console.log(`Signed in to iCloud as ${email} in ${((Date.now() - started) / 1000).toFixed(1)} s.\n`)
for (const c of calendars) console.log(`  ${c === target ? '→' : ' '} ${c.name.padEnd(28)} ${c.events.length} events`)
if (!target) {
  console.log(`\nNo calendar is called "${process.env.BOOKING_CALENDAR}" — set BOOKING_CALENDAR to one of the names above.`)
  process.exit(1)
}
console.log(`\nBookings will go to "${target.name}" (→). Set BOOKING_CALENDAR to pick another.`)

const now = Date.now()
const busy = busyFrom(calendars.flatMap((c) => c.events), { from: now, to: now + 8 * 86_400_000, timeZone })
const slots = openSlots({ now, windows, timeZone, minutes: 30, notice: 12 * 60, days: 7, busy })
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
console.log(`\nBusy blocks in the next week: ${busy.length}. First free times (${timeZone}):`)
for (const at of slots.slice(0, 6)) console.log(`  ${fmt.format(at)}`)

console.log(`
Looks right? Add two repo secrets, then push to main:

  gh secret set BLXR_ICLOUD_EMAIL
  gh secret set BLXR_ICLOUD_APP_PASSWORD

For local runs put the same two ICLOUD_* values in server/.env.`)
