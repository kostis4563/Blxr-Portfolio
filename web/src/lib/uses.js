export const USES_UPDATED = '2026-09-20'

export const USES_INTRO =
  'The desk, the machine and the software behind everything on this site. Hover anything for the details.'

export const DESK = [
  {
    id: 'monitor',
    name: 'Alienware AW2521HF',
    kind: 'Display',
    specs: ['24.5" IPS', '1920 × 1080', '240 Hz'],
  },
  {
    id: 'laptop',
    name: 'MacBook Air 13"',
    kind: 'The machine',
    specs: ['Apple M4', '10-core · 24 GB', 'macOS 26'],
  },
  {
    id: 'keyboard',
    name: 'Corsair K65 Plus Wireless',
    kind: 'Keyboard',
    specs: ['75% layout', 'Hot-swap linear switches', '2.4 GHz · Bluetooth'],
  },
  {
    id: 'mouse',
    name: 'Logitech G · Lightspeed',
    kind: 'Mouse',
    specs: ['Wireless receiver', 'Logi Options+'],
  },
  {
    id: 'audio',
    name: 'AirPods',
    kind: 'Audio',
    specs: ['Bluetooth', 'Everywhere'],
  },
]

export const SOFTWARE = [
  {
    id: 'editor',
    titleKey: 'uses.editor',
    items: [
      { name: 'VS Code', icon: '/icons/vscode.svg', href: 'https://code.visualstudio.com' },
      { name: 'Xcode', icon: '/icons/xcode.svg' },
      { name: 'GitHub', icon: '/icons/github_dark.svg', href: 'https://github.com/kostis4563' },
      { name: 'Git', icon: '/icons/git.svg' },
    ],
  },
  {
    id: 'design',
    titleKey: 'uses.design',
    items: [
      { name: 'Figma', icon: '/icons/figma.svg', href: 'https://www.figma.com' },
      { name: 'Photoshop', icon: '/icons/photoshop.svg' },
      { name: 'Illustrator', icon: '/icons/illustrator.svg' },
      { name: 'After Effects', icon: '/icons/after-effects.svg' },
    ],
  },
  {
    id: 'everyday',
    titleKey: 'uses.everyday',
    items: [
      { name: 'Raycast', icon: '/icons/raycast.svg', href: 'https://www.raycast.com' },
      { name: 'Chrome', icon: '/icons/chrome.svg' },
      { name: 'Notion', icon: '/icons/notion.svg' },
      { name: 'Obsidian', icon: '/icons/obsidian.svg' },
      { name: 'Discord', icon: '/icons/discord.svg' },
      { name: 'Slack', icon: '/icons/slack.svg' },
      { name: 'Homebrew', icon: '/icons/homebrew.svg', href: 'https://brew.sh' },
      { name: 'Cloudflare', icon: '/icons/cloudflare.svg' },
    ],
  },
]

export const TERMINAL = {
  app: 'iTerm2 3.6',
  font: 'Monaco 12',
  lines: [
    { cmd: 'echo $SHELL', out: '/bin/zsh' },
    { cmd: 'sw_vers -productVersion', out: '26.5.1' },
    { cmd: 'node -v', out: 'v26.4.0' },
    { cmd: 'pnpm -v && bun -v', out: '10.34.5 · 1.3.14' },
    { cmd: 'brew --version', out: 'Homebrew 6.0.20' },
    { cmd: 'gh --version', out: 'gh 2.96.0' },
    { cmd: 'uv --version', out: 'uv 0.11.26' },
  ],
}

export const PIPELINE = [
  { id: 'push', name: 'git push', sub: 'main' },
  { id: 'actions', name: 'GitHub Actions', sub: 'self-hosted runner' },
  { id: 'build', name: 'Vite build', sub: '32 languages' },
  { id: 'nginx', name: 'nginx', sub: 'one Linux box' },
  { id: 'cloudflare', name: 'Cloudflare', sub: 'DNS · TLS · WAF' },
]

export const DATA_STORE = {
  name: 'Supabase',
  icon: '/icons/supabase.svg',
  href: 'https://supabase.com',
}

export const FONTS = [
  { name: 'Plus Jakarta Sans', role: 'Body & UI', className: 'font-sans font-semibold', sample: 'Aa' },
  { name: 'Playfair Display', role: 'Italic accents', className: 'font-serif italic', sample: 'BUILT' },
  { name: 'Vergilia', role: 'Headings', className: 'font-vergilia', sample: 'Aa' },
  { name: 'Menlo · Monaco', role: 'Editor & terminal', className: 'font-mono', sample: '{ }' },
]

export const MUSIC = {
  app: 'Spotify',
  icon: '/icons/spotify.svg',
}
