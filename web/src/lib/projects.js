export const projectsList = [
  {
    id: '7x0-site',
    title: '7x0.site',
    badge: 'Learning Platform',
    date: '2026',
    category: 'Security Tooling',
    url: 'https://7x0.site',
    urlLabel: 'Visit site',
    github: null,
    image: '/7x0-site-dashboard.webp',
    imageAlt: 'The 7x0.site learning dashboard',
    gallery: [
      { src: '/7x0-site-landing.webp', alt: 'The 7x0.site landing page' },
      { src: '/7x0-site-tos.webp', alt: 'The 7x0.site terms of service page' }
    ],
    accent: '#8b5cf6',
    logo: null,
    shortDescription: 'A learning and investigation hub where FiveM server staff and PC checkers study cheat detection, forensic tools and player-check workflows.',
    fullDescription: '7x0.site gives FiveM server staff and PC checkers one focused place to study detection methods and practise investigation workflows. After signing in, users can work through cheat-detection guides, learn forensic tools, analyse suspicious files and review the evidence involved in player checks. Quizzes and practice scans turn the material into hands-on training, helping staff sharpen their judgement before applying it in a live investigation. The experience pairs a concise public landing page with a structured member dashboard and clear terms for responsible use.',
    metrics: [
      { label: 'Type', value: 'Web platform' },
      { label: 'Language', value: 'TypeScript 95.1%' },
      { label: 'Focus', value: 'FiveM forensics' }
    ],
    features: [
      'Detection guides for understanding common FiveM cheats and suspicious behaviour',
      'Forensic-tool learning material for PC checking and evidence review',
      'Suspicious-file analysis and structured player-check workflows',
      'Quizzes that reinforce detection knowledge after each learning path',
      'Practice scans for applying investigation skills in realistic scenarios',
      'Signed-in dashboard that keeps learning and investigation tools organised'
    ],
    tags: ['TypeScript 95.1%', 'JavaScript 4.4%', 'CSS 0.5%', 'FiveM', 'Forensics']
  },

  {
    id: 'amitista',
    title: 'Amitista Studio',

    badge: 'Client Work',
    date: '2026',
    category: 'Studio',
    url: 'https://amitista.com',
    urlLabel: 'Visit site',

    github: null,

    image: '/amitista.webp',
    imageAlt: 'Amitista Studio logo',

    accent: '#8558e4',

    logo: '/amitista-logo.webp',
    shortDescription: 'A development studio building websites, applications, interfaces and game servers — I own it and lead its development.',
    fullDescription: 'Amitista Studio is a development studio taking on client work end to end, and the one I own and lead the development of. The work splits three ways: web development, from marketing sites through dashboards to full web platforms; applications and systems, meaning custom tools, backends and game server builds with FiveM included; and interface design. Every project runs the same four stages — brief, design, build, support — with the scope and the price settled before anything starts, and the people answering a client’s messages are the ones building the project. Based in Greece, currently open for new work.',
    metrics: [
      { label: 'Focus', value: 'Web · Apps · Game servers' },
      { label: 'Based in', value: 'Greece' },
      { label: 'Role', value: 'Owner & lead dev' }
    ],
    features: [
      'Web development: marketing sites, dashboards and full web platforms',
      'Applications and systems: custom tools, backends and game server builds, FiveM included',
      'Interface design shaped around how a product is actually used',
      'Brief, design, build, support — scope and price agreed before a line is written',
      'Clients talk to the developers directly, with no account managers in between',
      'Fixes, changes and maintenance once a project is live'
    ],
    tags: ['React', 'Vite', 'Tailwind CSS', 'Express', 'nginx']
  },

  {
    id: 'async',
    title: 'async',
    badge: 'Closed',
    date: '2026',
    category: 'Security Tooling',
    url: 'https://www.youtube.com/watch?v=X0A3AmD4fZY',

    urlLabel: 'Watch showcase',
    github: 'https://github.com/kostis4563/async-anticheat',
    image: '/async.webp',
    imageAlt: 'The async platform dashboard',

    accent: '#e45869',

    imagePosition: 'center 39%',

    logo: '/async-logo.webp',
    shortDescription: 'Scans a machine for forensic evidence of cheating in FiveM and gives a verdict based on what it finds.',
    fullDescription: 'async is a two-part product. The scanner is a native Windows application in C++17 with a Dear ImGui interface that runs on a suspected machine, collects forensic evidence and uploads a signed report. The platform is an Express API, React dashboard and Discord bot backed by SQLite, which ingests those reports, runs AI analysis over them and returns a structured verdict. It is source-available for reference rather than open source, and it does administrator-level scanning, so it is only meant for machines you own or have permission to inspect.',
    metrics: [
      { label: 'Detection Modules', value: '75+' },
      { label: 'Forensic Categories', value: '14' },
      { label: 'License', value: 'Proprietary' }
    ],
    features: [
      'Process, memory and file-system forensics matched against known cheat and injector families',
      'Windows artifact recovery from Shimcache, Amcache, Prefetch, BAM, SRUM and the NTFS change journal',
      'YARA byte-pattern and imphash matching on disk and in memory',
      'Browser-extension sweep across six browsers, flagging high-risk permission combinations',
      'Anti-debugging, VM detection and string obfuscation to resist tampering with the scanner itself',
      'AI verdicts with confidence and cited evidence, plus PIN-based report sharing'
    ],
    tags: ['C++17', 'Win32', 'Dear ImGui', 'Node.js', 'React', 'SQLite']
  },

  {
    id: 'web-scanner',
    title: 'Web Scanner',
    badge: 'Open Source',
    date: '2026',
    category: 'Security Tooling',

    url: null,
    github: 'https://github.com/kostis4563/web-scanner',
    image: null,

    accent: '#3b82f6',
    shortDescription: 'A native macOS app that scans a website for security weaknesses and exposed secrets, and explains how to fix what it finds.',
    fullDescription: 'A native macOS app written in Swift and SwiftUI that scans a website for security weaknesses, exposed secrets and hidden content, and explains what each finding means and how to fix it. All networking runs client-side through URLSession and every analysis happens locally on the machine, so nothing gets uploaded. The active probes use benign markers rather than working payloads and never send a state-changing request, and the tool is intended for domains you own or have written permission to test.',
    metrics: [
      { label: 'Secret Patterns', value: '65+' },
      { label: 'Scan Modes', value: '3' },
      { label: 'License', value: 'MIT' }
    ],
    features: [
      'Deep secret scan across 65+ credential patterns in HTML, JS, CSS, config files and source maps',
      'Exposed-file hunt for .env, .git/config, backups and SQL dumps, including blocked files recovered through side doors',
      'Wordlist-driven content discovery with recursion, extension fuzzing and open-directory detection',
      'Safe active probes for open redirect, reflected XSS, CRLF and host-header injection, using benign markers only',
      'Subdomain enumeration with dangling-service takeover fingerprints',
      'Findings rated Critical to Info and exportable as Markdown or JSON'
    ],
    tags: ['Swift', 'SwiftUI', 'macOS', 'URLSession']
  },

  {
    id: 'padoofood',
    title: 'PadooFood',

    badge: 'React Native',
    date: '2026',
    category: 'Mobile Apps',

    url: null,
    github: null,

    image: '/delivo.webp',
    imageAlt: 'The PadooFood store login screen',

    accent: '#e49258',
    logo: '/delivo-logo.webp',
    shortDescription: 'A food delivery app for iOS and Android, where a store signs in to manage its menu, orders and delivery settings.',
    fullDescription: 'PadooFood is a cross-platform food delivery app built with React Native and Expo, from the side of the business rather than the diner: the account that signs in manages a store, its incoming orders and its delivery settings. The interface is built around a warm single-accent palette taken from the app icon, with illustrated header artwork above a rounded sheet that carries the form. One codebase targets both iOS and Android.',
    metrics: [
      { label: 'Platform', value: 'iOS · Android' },
      { label: 'Framework', value: 'Expo' },
      { label: 'Language', value: 'TypeScript' }
    ],
    features: [
      'Email and password sign-in with a reveal toggle, remember-me and a password-reset route',
      'Store-side account: one login covering the menu, incoming orders and delivery settings',
      'Sign-up path offered alongside sign-in rather than behind a separate screen',
      'Illustrated header artwork over a rounded sheet that holds the form',
      'Single accent colour carried from the app icon through to the primary button',
      'Layout respecting the safe area around the dynamic island and the home indicator'
    ],
    tags: ['React Native', 'Expo', 'TypeScript', 'iOS', 'Android']
  }
]

export const BADGE_KEY = {
  amitista: 'badge.clientWork',
  'web-scanner': 'badge.openSource'
}
export const SHORT_KEY = {
  amitista: 'proj.amitista.short',
  async: 'proj.async.short',
  'web-scanner': 'proj.webscanner.short',
  padoofood: 'proj.delivo.short'
}
export const METRIC_KEY = {
  Focus: 'proj.amitista.metric.focus',
  'Based in': 'proj.amitista.metric.based',
  Role: 'proj.amitista.metric.role',
  'Detection Modules': 'proj.async.metric.modules',
  'Forensic Categories': 'proj.async.metric.categories',
  License: 'proj.async.metric.license',
  'Secret Patterns': 'proj.webscanner.metric.patterns',
  'Scan Modes': 'proj.webscanner.metric.modes',
  Platform: 'proj.delivo.metric.platform',
  Framework: 'proj.delivo.metric.framework',
  Language: 'proj.delivo.metric.language'
}

export const isVideoLink = (url) => /(?:^|\/\/|\.)(?:youtube\.com|youtu\.be)\//.test(url ?? '')

export const URL_LABEL_KEY = {
  'Watch showcase': 'proj.watchShowcase',
  'Visit site': 'proj.visitSite'
}

export const METRIC_VALUE_KEY = {
  Proprietary: 'metric.proprietary',
  'Owner & lead dev': 'metric.ownerLead'
}

export const findProject = (id) => projectsList.find((p) => p.id === id) ?? null
