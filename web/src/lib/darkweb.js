export const DARKWEB_UPDATED = '2026-10-23'

export const STATS = [
  { term: 'Daily users', value: '3M+', label: 'people on Tor every day' },
  { term: 'Relays', value: '~9,000', label: 'run by volunteers' },
  { term: 'Hops', value: '3', label: 'relays between you and any site' },
  { term: 'Address', value: '56', label: 'characters in an onion address' },
]

export const STATS_SOURCE = 'Tor Metrics, October 2026'

export const SECTIONS = [
  { id: 'layers', label: 'Layers' },
  { id: 'tor', label: 'How Tor works' },
  { id: 'onion', label: '.onion' },
  { id: 'inside', label: 'What’s there' },
  { id: 'fingerprint', label: 'Fingerprint' },
  { id: 'history', label: 'History' },
  { id: 'myths', label: 'Myths' },
  { id: 'safety', label: 'Safety' },
]

export const LAYERS = [
  {
    id: 'surface',
    name: 'Surface web',
    depth: '0 m',
    reach: 'Any browser',
    text: 'Everything a search engine can find: news, Wikipedia, shops, videos, this page. It feels like the whole internet, but it’s only the part that’s been indexed.',
    examples: ['Google results', 'Wikipedia', 'kostis.wtf'],
  },
  {
    id: 'deep',
    name: 'Deep web',
    depth: '−200 m',
    reach: 'Any browser + a password',
    text: 'Everything behind a login, paywall or search box: your inbox, your bank, medical records, private cloud files. By far the biggest layer, and almost all of it is boring. You use it every day.',
    examples: ['Your inbox', 'Online banking', 'My own /dashboard'],
  },
  {
    id: 'dark',
    name: 'Dark web',
    depth: '−4,000 m',
    reach: 'Special software, like Tor Browser',
    text: 'Sites deliberately hidden on overlay networks — Tor, I2P, Freenet (now Hyphanet) — that run on top of the normal internet. A normal browser can’t open them at all. It’s tiny compared to the layers above.',
    examples: ['.onion sites', '.i2p sites', 'SecureDrop'],
  },
]

export const LAYERS_NOTE =
  'Deep ≠ dark. The famous iceberg picture, with the dark web as the giant part underwater, mixes the two up: the giant part is the deep web, and it’s mostly email.'

export const CIRCUITS = {
  web: {
    label: 'A normal website',
    nodes: [
      { id: 'you', label: 'You', short: 'You', role: 'Tor Browser', tone: 'end' },
      { id: 'guard', label: 'Guard', short: 'Guard', role: 'Relay 1', tone: 'l1' },
      { id: 'middle', label: 'Middle', short: 'Middle', role: 'Relay 2', tone: 'l2' },
      { id: 'exit', label: 'Exit', short: 'Exit', role: 'Relay 3', tone: 'l3' },
      { id: 'site', label: 'Website', short: 'Site', role: 'example.com', tone: 'end' },
    ],
    steps: [
      {
        at: 0,
        layers: 3,
        title: 'Your browser wraps the request three times',
        text: 'Tor Browser picks three relays and encrypts your request once for each, inside out: the exit’s layer first, then the middle’s, then the guard’s on the outside. Like an onion.',
        sees: { ip: true, destination: true, contents: true },
      },
      {
        at: 1,
        layers: 2,
        title: 'The guard peels off the outer layer',
        text: 'The guard knows your IP address — you connected to it — but inside its layer it only finds “pass this to the middle relay”. It has no idea where you’re going.',
        sees: { ip: true, destination: false, contents: false },
      },
      {
        at: 2,
        layers: 1,
        title: 'The middle relay peels the next one',
        text: 'It only ever talks to two other relays. It doesn’t know who you are or where you’re going. That blindness is the whole point of having a middle.',
        sees: { ip: false, destination: false, contents: false },
      },
      {
        at: 3,
        layers: 0,
        title: 'The exit peels the last layer and sends it out',
        text: 'The exit finally sees the destination and sends your request onto the normal internet. It still doesn’t know who you are. If the site uses HTTPS, it can’t read what you send either.',
        sees: { ip: false, destination: true, contents: 'https' },
      },
      {
        at: 4,
        layers: 0,
        title: 'The website only sees the exit',
        text: 'To the site, the request came from the exit relay. The reply travels back the same way, picking up a layer at each hop, and only your browser can unwrap all three.',
        sees: { ip: false, destination: true, contents: true },
      },
    ],
  },
  onion: {
    label: 'A .onion site',
    nodes: [
      { id: 'you', label: 'You', short: 'You', role: 'Tor Browser', tone: 'end' },
      { id: 'guard', label: 'Guard', short: 'G', role: 'Your relay 1', tone: 'l1' },
      { id: 'middle', label: 'Middle', short: 'M', role: 'Your relay 2', tone: 'l2' },
      { id: 'rendezvous', label: 'Rendezvous', short: 'RP', role: 'Meeting point', tone: 'meet' },
      { id: 'service-middle-2', label: 'Middle', short: 'M', role: 'Their relay 3', tone: 'l3' },
      { id: 'service-middle', label: 'Middle', short: 'M', role: 'Their relay 2', tone: 'l2' },
      { id: 'service-guard', label: 'Guard', short: 'G', role: 'Their relay 1', tone: 'l1' },
      { id: 'service', label: '.onion', short: 'Site', role: 'Hidden server', tone: 'end' },
    ],
    steps: [
      {
        at: 0,
        lit: [],
        title: 'The address is the key',
        text: 'Your browser looks up the address in Tor’s directory and gets a descriptor signed by the key the address encodes, listing a few “introduction points” — relays the site keeps circuits open to.',
      },
      {
        at: 3,
        lit: [0, 1, 2],
        title: 'You pick a meeting point',
        text: 'Your browser builds a normal three-hop circuit to a random relay and hands it a one-time secret. That relay becomes the rendezvous point.',
      },
      {
        at: 7,
        lit: [0, 1, 2],
        title: 'You ask the site to meet you there',
        text: 'Through one of its introduction points, you send the site an encrypted note: “meet me at this relay, here’s the secret”. Only the site can read it.',
      },
      {
        at: 3,
        lit: [0, 1, 2, 3, 4, 5, 6],
        title: 'The site builds its own circuit to the meeting point',
        text: 'The server connects to the rendezvous point through three relays of its own. It never learns your IP, and you never learn where it is.',
      },
      {
        at: 7,
        lit: [0, 1, 2, 3, 4, 5, 6],
        title: 'Six relays, no exit, end-to-end encrypted',
        text: 'The two circuits are joined. Traffic never leaves Tor, so there’s no exit relay to watch it, and it’s encrypted all the way from your browser to the server.',
      },
    ],
  },
}

export const SEES = [
  { id: 'ip', label: 'Who you are' },
  { id: 'destination', label: 'Where you’re going' },
  { id: 'contents', label: 'What you send' },
]

export const ONION_EXAMPLES = [
  { label: 'Tor Project', address: '2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid' },
  { label: 'BBC News', address: 'bbcnewsd73hkzno2ini43t4gblxvycyac5aw4gnv7t2rccijh7745uqd', vanity: 'bbcnews' },
  { label: 'DuckDuckGo', address: 'duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad', vanity: 'duckduckgo' },
  { label: 'Facebook', address: 'facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd', vanity: 'facebook' },
]

export const ONION_PARTS = {
  key: { label: 'Public key', text: 'The site’s ed25519 public key, 32 bytes. Whoever holds the matching private key is the site — no certificate authority needed.' },
  checksum: { label: 'Checksum', text: 'Two bytes of SHA3-256 over the key. A single typo makes it fail, so mistyped addresses don’t silently go somewhere else.' },
  version: { label: 'Version', text: 'The protocol version, 3. Every modern onion address ends in d.' },
}

export const USES = {
  good: {
    title: 'People who need privacy',
    items: [
      { title: 'Journalists and their sources', text: 'SecureDrop runs on onion services so whistleblowers can hand documents to newsrooms like The Guardian and The New York Times without revealing who they are.' },
      { title: 'People living under censorship', text: 'Where news and social media are blocked, Tor — with bridges like Snowflake that disguise the connection — gets people onto the open web.' },
      { title: 'Big names, onion editions', text: 'The BBC, The New York Times, Facebook, DuckDuckGo, Proton and even the CIA run official .onion sites.' },
      { title: 'Ordinary privacy', text: 'Activists, abuse survivors hiding from someone who tracks them, researchers, and people who simply don’t want to be followed around by ads.' },
    ],
  },
  bad: {
    title: 'And why it’s infamous',
    items: [
      { title: 'Darknet markets', text: 'Drugs, fake IDs and stolen goods sold for crypto. The big ones get seized every few years — Silk Road, AlphaBay, Hydra — and new ones replace them.' },
      { title: 'Stolen data', text: 'Leaked databases, passwords and card numbers, resold in bulk. This is why “check if your email was leaked” services exist.' },
      { title: 'Ransomware leak sites', text: 'Gangs post companies’ stolen files on onion sites to pressure them into paying.' },
      { title: 'Scams. Lots of scams.', text: 'Fake markets, phishing clones of real sites and fake “hitman” services. A big share of what’s there exists only to take your money.' },
    ],
  },
}

export const HISTORY = [
  { year: '1990s', title: 'The U.S. Navy invents onion routing', text: 'Paul Syverson, Michael Reed and David Goldschlag at the U.S. Naval Research Laboratory design onion routing to protect government communications.' },
  { year: '2002', title: 'Tor goes live', text: 'Roger Dingledine and Nick Mathewson, with Syverson, release the first version of Tor — “The Onion Router”.' },
  { year: '2006', title: 'The Tor Project', text: 'Tor becomes a nonprofit. The idea: a tool only the military used would be useless, because every user would obviously be military.' },
  { year: '2008', title: 'Tor Browser', text: 'Work starts on a browser that does it all for you, so using Tor stops requiring a weekend of configuration.' },
  { year: '2011', title: 'Silk Road', text: 'The first big darknet market opens, with anonymous sellers paid in Bitcoin. “The dark web” becomes a headline.' },
  { year: '2013', title: 'Silk Road falls, Snowden leaks', takedown: true, text: 'The FBI arrests Ross Ulbricht in a San Francisco library. Months later, Snowden documents show the NSA complaining it can’t unmask Tor users at scale.' },
  { year: '2014', title: 'Facebook joins', text: 'Facebook launches an official .onion address — one of the first big companies to do it.' },
  { year: '2017', title: 'Operation Bayonet', takedown: true, text: 'AlphaBay and Hansa go down together. Dutch police had secretly run Hansa for a month first, collecting evidence.' },
  { year: '2019', title: 'Newsrooms go onion', text: 'The BBC follows The New York Times (2017) with an onion site, so readers in censored countries can reach them.' },
  { year: '2021', title: 'Short addresses retired', text: 'The old 16-character v2 addresses stop working. Only the longer, stronger 56-character v3 kind remain.' },
  { year: '2022', title: 'Hydra seized', takedown: true, text: 'German police shut down Hydra, then the largest darknet market in the world.' },
  { year: '2024', title: 'Tor and Tails merge', text: 'The Tor Project and Tails, the amnesic operating system that runs from a USB stick, join forces.' },
  { year: '2025', title: 'Ulbricht pardoned', text: 'President Trump pardons Ross Ulbricht after more than eleven years of a life sentence.' },
]

export const MYTHS = [
  {
    myth: 'The dark web is 90% of the internet.',
    truth: 'That’s the deep web — inboxes, databases, anything behind a login — being confused with the dark web. The dark web is a tiny corner, and many .onion addresses are short-lived or aren’t websites at all.',
  },
  {
    myth: 'Using Tor is illegal.',
    truth: 'In most countries, including the US and the whole EU, it’s legal. What you do with it can be illegal, same as on the normal web. Some governments, like China, Russia and Iran, block or restrict it.',
  },
  {
    myth: 'Tor makes you completely anonymous.',
    truth: 'It hides your IP address. It doesn’t stop you logging into your own accounts, opening a file that phones home, or reusing a username. Most people who get caught make a mistake; the crypto rarely breaks.',
  },
  {
    myth: 'Everyone on it is a criminal.',
    truth: 'Most Tor traffic is people visiting ordinary websites privately. Onion services are a small slice of it, and plenty of those are newsrooms, email providers and search engines.',
  },
  {
    myth: 'The police can’t touch it.',
    truth: 'Takedowns happen all the time: Silk Road, AlphaBay, Hansa, Hydra. Investigators use seized servers, infiltration, crypto tracing and old forum posts — not some magic Tor exploit.',
  },
  {
    myth: 'Hackers built it.',
    truth: 'It came out of the U.S. Naval Research Laboratory, and the Tor Project still gets part of its funding from government grants.',
  },
]

export const SAFETY = [
  { title: 'Download Tor Browser only from torproject.org', text: 'Fake “Tor” apps and bundles with malware exist, especially in app stores and on forums.' },
  { title: 'Don’t log into anything that’s you', text: 'Signing into your real email or social account links the whole session to your name.' },
  { title: 'Don’t install add-ons or tweak settings', text: 'Every change makes you look different from everyone else, which is the opposite of what Tor is doing for you.' },
  { title: 'Don’t open downloads while online', text: 'PDFs and documents can load things from the internet outside Tor and reveal your real IP.' },
  { title: 'Treat every link as a scam', text: 'Link lists are full of phishing clones that differ by a few characters. Bookmark real addresses; never trust a search result.' },
  { title: 'Use the “Safest” level if you’re worried', text: 'It turns off JavaScript everywhere, which blocks most of the ways a site could attack your browser.' },
]

export const TOR_DOWNLOAD = 'https://www.torproject.org/download/'

export const SOURCES = [
  { label: 'The Tor Project', href: 'https://www.torproject.org/' },
  { label: 'Tor Metrics', href: 'https://metrics.torproject.org/' },
  { label: 'Onion services, explained', href: 'https://community.torproject.org/onion-services/overview/' },
  { label: 'EFF: Surveillance Self-Defense', href: 'https://ssd.eff.org/' },
]
