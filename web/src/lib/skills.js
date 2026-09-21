import { projectsList } from './projects'
import { libraryList } from './library'

export const SKILL_LEVELS = {
  advanced: { key: 'level.advanced', rank: 4, bar: 'bg-emerald-400' },
  comfortable: { key: 'level.comfortable', rank: 3, bar: 'bg-sky-400' },
  basic: { key: 'level.basic', rank: 2, bar: 'bg-zinc-300' },
  learning: { key: 'level.learning', rank: 1, bar: 'bg-amber-400' },
}

export const SKILL_CATEGORIES = [
  {
    nameKey: 'skills.languages',
    items: [
      { name: 'JavaScript', icon: '/icons/javascript.svg', level: 'comfortable', desc: 'Scripting language for the web' },
      { name: 'Python', icon: '/icons/python.svg', level: 'comfortable', desc: 'General purpose scripting & automation' },
      { name: 'CSS', icon: '/icons/css.svg', level: 'advanced', desc: 'Styling & layout for the web' },
      { name: 'HTML', icon: '/icons/html5.svg', level: 'advanced', desc: 'Markup that structures web pages' },
    ],
  },
  {
    nameKey: 'skills.frameworks',
    items: [
      { name: 'React', icon: '/icons/react_dark.svg', level: 'comfortable', desc: 'React is a JavaScript library for building user interfaces.' },
      { name: 'Bootstrap', icon: '/icons/bootstrap.svg', level: 'comfortable', desc: 'Bootstrap is a framework for building responsive websites.' },
      { name: 'Tailwind CSS', icon: '/icons/tailwindcss.svg', level: 'comfortable', desc: 'Utility-first CSS framework' },
      { name: 'discord.js', icon: '/icons/discordjs.svg', level: 'advanced', desc: 'Node.js library for Discord bots' },
    ],
  },
  {
    nameKey: 'skills.infrastructure',
    items: [
      { name: 'MySQL', icon: '/icons/mysql-icon-dark.svg', level: 'basic', desc: 'Relational database management' },
      { name: 'PM2', icon: '/icons/pm2.svg', level: 'comfortable', desc: 'Process manager for Node.js' },
      { name: 'Cloudflare', icon: '/icons/cloudflare.svg', level: 'basic', desc: 'CDN, DNS & edge security' },
    ],
  },
]

export const TOOL_CATEGORIES = [
  {
    nameKey: 'tools.development',
    wide: false,
    items: [
      { name: 'Git', icon: '/icons/git.svg', desc: 'Version control for code' },
      { name: 'GitHub', icon: '/icons/github_dark.svg', desc: 'Code hosting & collaboration' },
      { name: 'npm', icon: '/icons/npm.svg', desc: 'Package manager for Node.js' },
    ],
  },
  {
    nameKey: 'tools.design',
    wide: false,
    items: [
      { name: 'Figma', icon: '/icons/figma.svg', desc: 'Interface design & prototyping' },
      { name: 'Adobe', icon: '/icons/adobe.svg', desc: 'Creative software suite' },
      { name: 'Photoshop', icon: '/icons/photoshop.svg', desc: 'Image editing & compositing' },
      { name: 'Illustrator', icon: '/icons/illustrator.svg', desc: 'Vector graphics & illustration' },
      { name: 'Canva', icon: '/icons/canva.svg', desc: 'Quick graphic design' },
    ],
  },
  {
    nameKey: 'skills.editors',
    wide: true,
    items: [
      { name: 'VS Code', icon: '/icons/vscode.svg', desc: 'Code editor' },
      { name: 'Visual Studio', icon: '/icons/visual-studio.svg', desc: 'IDE for app development' },
      { name: 'Xcode', icon: '/icons/xcode.svg', desc: "Apple's IDE for iOS & macOS" },
      { name: 'Komodo', icon: '/icons/komodo_dark.svg', desc: 'Lightweight code editor' },
    ],
  },
  {
    nameKey: 'skills.systems',
    wide: true,
    items: [
      { name: 'macOS', icon: '/icons/apple_dark.svg', desc: "Apple's desktop OS" },
      { name: 'Windows', icon: '/icons/windows.svg', desc: "Microsoft's desktop OS" },
    ],
  },
]

export const CERTIFICATIONS = [
  { name: 'JavaScript', tierKey: 'tier.intermediate', issuer: 'HackerRank', date: null, url: null },
  { name: 'JavaScript', tierKey: 'tier.basic', issuer: 'HackerRank', date: null, url: null },
  { name: 'Python', tierKey: 'tier.basic', issuer: 'HackerRank', date: null, url: null },
  { name: 'Go', tierKey: 'tier.basic', issuer: 'HackerRank', date: null, url: null },
  { name: 'CSS', tierKey: 'tier.basic', issuer: 'HackerRank', date: null, url: null },
]

export const LIGHT_THEME_ICONS = {
  '/icons/apple_dark.svg': '/icons/apple.svg',
  '/icons/mysql-icon-dark.svg': '/icons/mysql-icon-light.svg',
  '/icons/github_dark.svg': '/icons/github.svg',
  '/icons/json_dark.svg': '/icons/json.svg',
  '/icons/komodo_dark.svg': '/icons/komodo.svg',
  '/icons/cursor_dark.svg': '/icons/cursor.svg',
  '/icons/devin_dark.png': '/icons/devin.png',
}

export const themedIconFor = (theme) => (url) => (theme   === 'light' ? LIGHT_THEME_ICONS[url] ?? url : url)

// Which shipped work used a skill, matched against project tags ('JavaScript 4.4%' counts as 'JavaScript').
const tagKey = (tag) => tag.replace(/\s+\d+(\.\d+)?%$/, '').toLowerCase()
const usesTag = (entry, key) => entry.tags?.some((tag) => tagKey(tag) === key)

export function skillUsage(name) {
  const key = name.toLowerCase()
  const featured = projectsList.filter((p) => usesTag(p, key)).map((p) => p.id)
  const library = libraryList.filter((e) => !e.placeholder && usesTag(e, key)).length
  return { featured, library, count: featured.length + library }
}
