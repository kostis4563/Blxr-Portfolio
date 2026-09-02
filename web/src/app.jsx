import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import GitHubContributions from './components/github-contribution'
import AnimatedFooter from './components/animated-footer'
import ProjectsPage from './projects-page'
import ProjectPage from './project-page'
import LibraryPage from './library-page'
import NotFoundPage from './not-found-page'
import ProjectCover from './components/project-cover'
import BannerCompare from './components/banner-compare'
import ThemeToggle from './components/theme-toggle'
import LanguagePicker from './components/language-picker'
import CommandPaletteHost from './components/command-palette-host'
import { CommandButton } from './components/command-button'
import { useTheme } from './lib/use-theme'
import { useI18n } from './lib/i18n'
import { projectsList, isVideoLink, URL_LABEL_KEY } from './lib/projects'
import { trackPointerGlow, resetPointerTilt } from './lib/pointer-glow'
import { imageProps, imageUrl, SIZES } from './lib/images'
import { useRoutePath, parseRoute, navigate, link, projectPath, HOME_PATH, PROJECTS_PATH } from './lib/router'
import { applyHead } from './lib/seo'
import { recordHit } from './lib/api'
import { rememberVisit } from './lib/recent'
import {
  CONTACT_EMAIL,
  GITHUB_USERNAME,
  GITHUB_JOINED,
  GITHUB_ACTIVE_SINCE,
  GITHUB_URL,
  DISCORD_URL,
  SOCIALS,
  SOCIAL_ICON_PATHS
} from './lib/profile'

const FOOTER_HEADING = ["LET'S", "BUILD"]

function App() {

  const path = useRoutePath()
  const route = parseRoute(path)
  const currentView = route.name
  const [emailCopied, setEmailCopied] = useState(false)

  const [skillBadgesArmed, setSkillBadgesArmed] = useState(false)
  const armSkillBadges = () => {
    if (!skillBadgesArmed) setSkillBadgesArmed(true)
  }

  const [eduPanel, setEduPanel] = useState('overview')
  const [eduPeek, setEduPeek] = useState(null)

  const eduTabRefs = useRef({})

  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()

  const homeScrollRef = useRef(0)

  const hasLeftHomeRef = useRef(false)

  const openProject = (projectId) => {
    homeScrollRef.current = window.scrollY
    hasLeftHomeRef.current = true
    navigate(projectId ? projectPath(projectId) : PROJECTS_PATH)
  }

  useLayoutEffect(() => {
    if (currentView !== 'home' || !hasLeftHomeRef.current) return
    window.scrollTo(0, homeScrollRef.current)
  }, [currentView, path])

  useEffect(() => {
    applyHead(path)
  }, [path, t])

  useEffect(() => {
    recordHit(path)

    rememberVisit(path)
  }, [path])

  const isReturningHome = hasLeftHomeRef.current

  useEffect(() => {
    const header = document.getElementById('main-header')
    if (!header) return

    let frame = 0
    let last = -1

    const apply = () => {
      frame = 0
      const topOffset = Math.max(0, 16 - window.scrollY)
      if (topOffset === last) return
      last = topOffset
      header.style.top = `${topOffset}px`
    }

    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [currentView])

  const palette = <CommandPaletteHost theme={theme} onToggleTheme={toggleTheme} />

  if (currentView === 'notFound') {
    return (
      <>
        <NotFoundPage theme={theme} onToggleTheme={toggleTheme} />
        {palette}
      </>
    )
  }

  if (currentView === 'projects') {
    return (
      <>
        {route.projectId ? (
          <ProjectPage
            projectId={route.projectId}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        ) : (
          <ProjectsPage
            onBack={() => navigate(HOME_PATH)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
        {palette}
      </>
    )
  }

  if (currentView === 'library') {
    return (
      <>
        <LibraryPage
          openItemId={route.itemId}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {palette}
      </>
    )
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 1800)
    } catch {
    }
  }

  const handleMouseMove = (e) => trackPointerGlow(e)

  const handleArchiveMouseMove = (e) => trackPointerGlow(e, { tilt: true })
  const handleArchiveMouseLeave = resetPointerTilt

  const projectCards = [
    {

      projectId: 'amitista',
      title: 'Amitista Studio',
      category: t('cat.Studio'),
      year: '2026',
      url: 'https://amitista.com',
      urlLabel: 'Visit site',

      github: null,
      image: '/amitista.webp',
      imageAlt: 'Amitista Studio logo',

      imagePosition: 'center',

      logo: '/amitista-logo.webp',
      description: t('proj.amitista.short'),
      tags: ['React', 'Vite', 'Tailwind CSS']
    },
    {

      projectId: 'async',

      title: 'Async',
      category: t('cat.Security Tooling'),
      year: '2026',

      url: 'https://www.youtube.com/watch?v=X0A3AmD4fZY',
      urlLabel: 'Watch showcase',
      github: 'https://github.com/kostis4563/async-anticheat',
      image: '/async.webp',
      imageAlt: 'The async platform dashboard',

      imagePosition: 'center 39%',

      logo: '/async-logo.webp',

      description: t('proj.async.short'),
      tags: ['C++17', 'Node.js', 'React']
    },
  ]

  const archivePreviews = [...projectsList]
    .sort((a, b) => Number(Boolean(a.image)) - Number(Boolean(b.image)))
    .slice(0, 3)

  const archiveCategories = [...new Set(projectsList.map((p) => p.category).filter(Boolean))]

  const archiveYears = projectsList.map((p) => Number(p.date)).filter(Number.isFinite)
  const archiveRange = archiveYears.length
    ? [Math.min(...archiveYears), Math.max(...archiveYears)]
    : null
  const archiveRangeLabel = archiveRange
    ? (archiveRange[0] === archiveRange[1] ? `${archiveRange[0]}` : `${archiveRange[0]} – ${archiveRange[1]}`)
    : null

  const archiveLayers = [
    'z-[1] opacity-50 scale-[0.88] -rotate-6 -translate-x-9 -translate-y-14 group-hover:-translate-x-10 group-hover:-translate-y-[4.5rem] group-hover:-rotate-[7deg]',
    'z-[2] opacity-75 scale-94 -rotate-3 -translate-x-4 -translate-y-7 group-hover:-translate-x-5 group-hover:-translate-y-9 group-hover:-rotate-[3.5deg]',
    'z-[3] opacity-100 scale-100 rotate-0 translate-x-0 translate-y-0 group-hover:-translate-y-1'
  ]

  const experienceEntries = [
    {
      period: `2025 – ${t('common.present')}`,
      role: t('exp.async.role'),
      org: t('exp.async.org'),
      url: null,
      description: t('exp.async.desc'),
      stack: ['React', 'TailwindCSS', 'JavaScript', 'MySQL', 'Python', 'Go', 'Rust', 'C++']
    },
    {
      period: `2023 – ${t('common.present')}`,
      role: t('exp.free.role'),
      org: t('exp.free.org'),
      url: null,
      description: t('exp.free.desc'),
      stack: ['React', 'Next.js', 'TailwindCSS', 'JavaScript', 'Python']
    }
  ]

  const educationEntries = [
    {
      period: `2025 – ${t('common.present')}`,
      degree: t('edu.degree'),
      org: t('edu.org'),
      description: t('edu.desc'),
      subjects: [
        t('edu.subj.se'),
        t('edu.subj.cs'),
        t('edu.subj.dsa'),
        t('edu.subj.db'),
        t('edu.subj.web')
      ]
    }
  ]

  const ibSubjects = [
    { name: 'Computer Science', level: 'HL' },
    { name: 'Mathematics AA', level: 'HL' },
    { name: 'English B', level: 'HL' },
    { name: 'Business', level: 'SL' },
    { name: 'Physics', level: 'SL' },
    { name: 'Greek', level: 'SL' },
  ]

  const ibFacts = [
    { label: 'Grading', value: 'Out of 45' },
    { label: 'Structure', value: '3 HL · 3 SL' },
    { label: 'Duration', value: 'Two years' },
  ]

  const csTopics = [
    {
      title: 'Programming',
      points: [
        'Writing and debugging programs (Java, Python, and similar)',
        'Algorithms, functions, classes, and object-oriented programming',
      ],
    },
    {
      title: 'Computational thinking',
      points: [
        'Breaking problems down into smaller parts',
        'Designing solutions with algorithms and flowcharts',
        'Analysing how efficient a solution is',
      ],
    },
    {
      title: 'Data structures',
      points: ['How computers organise data: arrays, lists, stacks, queues, trees'],
    },
    {
      title: 'Computer systems',
      points: [
        'How hardware and software work together',
        'Processors, memory, operating systems, and networks',
      ],
    },
    {
      title: 'Databases',
      points: ['Storing and managing data with tables, queries, and relationships'],
    },
    {
      title: 'Networks & cybersecurity',
      points: ['How computers communicate', 'Security risks and how to protect against them'],
    },
  ]

  const ibCore = [
    {
      title: 'Theory of Knowledge (TOK)',
      desc: 'how we know what we know, in a 1,600-word essay and an exhibition',
    },
    {
      title: 'Extended Essay (EE)',
      desc: 'a self-directed 4,000-word research paper (~40 hours of work)',
    },
    {
      title: 'CAS',
      desc: 'Creativity, Activity & Service: a reflective portfolio across the two years',
    },
  ]

  const certifications = [
    { name: 'JavaScript', tier: t('tier.intermediate'), issuer: 'HackerRank', date: null, url: null },
    { name: 'JavaScript', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null },
    { name: 'Python', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null },
    { name: 'Go', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null },
    { name: 'CSS', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null }
  ]

  const skillLevels = {
    advanced: {
      label: t('level.advanced'),
      rank: 4,
      text: 'text-emerald-200',
      border: 'border-emerald-400/30',
      bar: 'bg-emerald-400',
      glow: 'shadow-[0_10px_24px_-10px_rgba(52,211,153,0.4),0_3px_12px_-6px_var(--shadow-cast)]'
    },
    comfortable: {
      label: t('level.comfortable'),
      rank: 3,
      text: 'text-sky-200',
      border: 'border-sky-400/30',
      bar: 'bg-sky-400',
      glow: 'shadow-[0_10px_24px_-10px_rgba(56,189,248,0.4),0_3px_12px_-6px_var(--shadow-cast)]'
    },

    basic: {
      label: t('level.basic'),
      rank: 2,
      text: 'text-zinc-200',
      border: 'border-zinc-400/30',
      bar: 'bg-zinc-300',
      glow: 'shadow-[0_10px_24px_-10px_rgba(161,161,170,0.35),0_3px_12px_-6px_var(--shadow-cast)]'
    },
    learning: {
      label: t('level.learning'),
      rank: 1,
      text: 'text-amber-200',
      border: 'border-amber-400/30',
      bar: 'bg-amber-400',
      glow: 'shadow-[0_10px_24px_-10px_rgba(251,191,36,0.4),0_3px_12px_-6px_var(--shadow-cast)]'
    }
  }

  const meterBars = ['h-[4px]', 'h-[6px]', 'h-[8px]', 'h-[10px]']

  const LIGHT_THEME_ICONS = {
    '/icons/apple_dark.svg': '/icons/apple.svg',
    '/icons/mysql-icon-dark.svg': '/icons/mysql-icon-light.svg',
    '/icons/github_dark.svg': '/icons/github.svg',
    '/icons/json_dark.svg': '/icons/json.svg',
    '/icons/komodo_dark.svg': '/icons/komodo.svg'
  }
  const themedIcon = (url) => (theme === 'light' ? LIGHT_THEME_ICONS[url] ?? url : url)

  const skillCategories = [
    {
      name: t('skills.languages'),
      items: [
        { name: 'JavaScript', icon: '/icons/javascript.svg', level: 'comfortable' },
        { name: 'Python', icon: '/icons/python.svg', level: 'comfortable' },
        { name: 'CSS', icon: '/icons/css.svg', level: 'advanced' },
        { name: 'HTML', icon: '/icons/html5.svg', level: 'advanced' },
        { name: 'Swift', icon: '/icons/swift.svg', level: 'basic' },
        { name: 'Java', icon: '/icons/java.svg', level: 'basic' }
      ]
    },
    {
      name: t('skills.frameworks'),
      items: [
        { name: 'React', icon: '/icons/react_dark.svg', level: 'advanced' },
        { name: 'Next.js', icon: '/icons/nextjs_icon_dark.svg', level: 'basic' },
        { name: 'discord.js', icon: '/icons/discordjs.svg', level: 'advanced' }
      ]
    },
    {
      name: t('skills.other'),
      items: [
        { name: 'Git', icon: '/icons/git.svg', level: 'comfortable' },
        { name: 'Docker', icon: '/icons/docker.svg', level: 'learning' },

        { name: 'npm', icon: '/icons/npm.svg', level: 'comfortable' },
        { name: 'PM2', icon: '/icons/pm2.svg', level: 'comfortable' },
        { name: 'MySQL', icon: themedIcon('/icons/mysql-icon-dark.svg'), level: 'comfortable' },
        { name: 'JSON', icon: themedIcon('/icons/json_dark.svg'), level: 'advanced' },
        { name: 'GitHub', icon: themedIcon('/icons/github_dark.svg'), level: 'comfortable' },

        { name: 'VPS Admin', icon: '/icons/vps.svg', level: 'advanced' },

        { name: 'Cloudflare', icon: '/icons/cloudflare.svg', level: 'basic' },
        { name: 'Figma', icon: '/icons/figma.svg', level: 'comfortable' },
        { name: 'Adobe', icon: '/icons/adobe.svg', level: 'comfortable' }
      ]
    },

    {
      name: t('skills.editors'),
      items: [
        { name: 'VS Code', icon: '/icons/vscode.svg', level: null },
        { name: 'Visual Studio', icon: '/icons/visual-studio.svg', level: null },
        { name: 'Xcode', icon: '/icons/xcode.svg', level: null },
        { name: 'PyCharm', icon: '/icons/pycharm.svg', level: null },
        { name: 'Komodo', icon: themedIcon('/icons/komodo_dark.svg'), level: null }
      ]
    },
    {
      name: t('skills.systems'),
      items: [
        { name: 'macOS', icon: themedIcon('/icons/apple_dark.svg'), level: null },
        { name: 'Windows', icon: '/icons/windows.svg', level: null },
        { name: 'Linux', icon: '/icons/linux.svg', level: null }
      ]
    }
  ]

  const navItemClass = 'h-9 w-9 flex items-center justify-center hover:text-ink-strong focus-visible:text-ink-strong aria-expanded:text-ink-strong transition-colors duration-200'

  const navPillClass = 'h-9 px-2 sm:ps-2 sm:pe-1.5 flex items-center gap-1.5 rounded-lg hover:text-ink-strong hover:bg-surface-hover focus-visible:text-ink-strong aria-expanded:text-ink-strong aria-expanded:bg-surface-hover transition-colors duration-200'

  const navDivider = 'mx-1 h-full border-l border-dashed border-line'

  return (
    <div className={`min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans ${isReturningHome ? '' : 'animate-view-in'}`}>

      <header
        id="main-header"
        className="w-full max-w-[768px] bg-bg/90 backdrop-blur-md text-ink h-[60px] fixed left-1/2 -translate-x-1/2 z-50 border-b border-l border-dashed border-r border-line transition-[border-color] duration-200"
        style={{ top: '16px' }}
      >
        <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-3">
          {}
          <div className="flex items-end gap-1.5 shrink-0">
            {}
            <img

              {...imageProps('/wordmark-nav.png')}
              alt="blxr"
              width="111"
              height="50"
              draggable={false}
              className="h-[42px] sm:h-[50px] w-auto select-none"
            />
            <span className="text-[10px] font-bold text-ink-strong tracking-tight leading-none mb-[12px]">dev</span>
          </div>

          <nav
            aria-label="Site links"
            className="flex items-center h-full text-ink-muted sm:-mr-4"
          >
            {}
            <CommandButton className={navPillClass} />

            <span aria-hidden="true" className={`${navDivider} hidden sm:block`} />

            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className={`${navItemClass} hidden sm:flex`} aria-label="Discord">
              <svg className="w-[16px] h-[16px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
              </svg>
            </a>

            <span aria-hidden="true" className={`${navDivider} hidden sm:block`} />

            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={`${navItemClass} hidden sm:flex`} aria-label="GitHub">
              <svg className="w-[16px] h-[16px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>

            <span aria-hidden="true" className={`${navDivider} hidden sm:block`} />

            <ThemeToggle theme={theme} onToggle={toggleTheme} className={navItemClass} />

            <span aria-hidden="true" className={`${navDivider} hidden sm:block`} />

            <LanguagePicker className={navPillClass} />
          </nav>
        </div>
      </header>

      {}
      <main className={`w-full max-w-[768px] mx-auto px-6 pt-24 pb-6 flex flex-col items-start border-l border-dashed border-r border-line min-h-screen bg-bg ${isReturningHome ? '' : 'animate-rise-in'}`}>

        <section className="flex flex-col items-start text-left w-[calc(100%+3rem)] border-b border-dashed border-line -mx-6 px-6 pb-12">

          {}
          <img

            {...imageProps('/pfp.webp', SIZES.avatar)}
            alt="Blxr avatar"
            width="64"
            height="64"
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className="w-[64px] h-[64px] rounded-[18px] object-cover mb-6 select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"
          />

          {}
          <h1 className="hero-title text-[28px] sm:text-[34px] font-extrabold tracking-[-0.03em] leading-[1.15] mb-3 animate-fade-in-up">
            {t('hero.greeting')}
          </h1>

          {}
          <div className="max-w-[68ch] text-[15px] text-ink-muted font-normal leading-[1.7] mb-6">
            <p className="animate-fade-in-up delay-150">{t('hero.bio1')}</p>
            <p className="animate-fade-in-up delay-300">{t('hero.bio2')}</p>
          </div>

          <div className="flex items-center gap-[18px] text-ink-muted">
            {SOCIALS.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink-strong transition-colors duration-200"
                aria-label={social.name}
              >
                <svg className="w-[15px] h-[15px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d={SOCIAL_ICON_PATHS[social.name]} />
                </svg>
              </a>
            ))}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="hover:text-ink-strong transition-colors duration-200"
              aria-label="Email"
            >
              <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </a>
          </div>

          <div className="w-full mt-8">
            <GitHubContributions
              username={GITHUB_USERNAME} since={GITHUB_JOINED}
              activeSince={GITHUB_ACTIVE_SINCE}
            />
          </div>
        </section>

        <section id="projects" className="scroll-mt-28 w-full mt-12">

          <div className="flex items-center justify-between w-full mb-6">
            <h2 className="text-[20px] font-bold text-ink-strong tracking-tight">{t('home.projects')}</h2>
            <a
              {...link(PROJECTS_PATH, () => openProject(null))}
              className="text-[13px] font-medium text-ink-muted hover:text-ink-strong flex items-center gap-1 transition-colors duration-200 cursor-pointer"
            >
              <span>{t('home.more')}</span>
              <span>→</span>
            </a>
          </div>

          <div className="flex flex-col gap-8 w-full">
            {projectCards.map((card, idx) => (
              <div
                key={idx}
                onMouseMove={handleMouseMove}

                onClick={() => openProject(card.projectId)}
                className="relative p-[1px] rounded-[32px] bg-surface-hover hover:bg-surface-hover-strong group overflow-hidden w-full cursor-pointer transition-[background-color,transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-[color:var(--shadow-cast)] focus-within:bg-surface-hover-strong motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {}
                <div
                  className="glow-follow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    '--glow-size': '300px',
                    background: 'radial-gradient(circle closest-side, var(--glow-strong) 0%, var(--glow-soft) 60%, transparent 100%)'
                  }}
                />

                {}
                <div className="relative bg-surface rounded-[31px] flex flex-col-reverse items-stretch w-full overflow-hidden">

                  <div

                    className="glow-follow opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[50px] z-0"
                    style={{
                      '--glow-size': '700px',
                      background: 'radial-gradient(circle closest-side, var(--glow-soft), transparent 80%)'
                    }}
                  />

                  <div className="flex-1 flex flex-col items-start text-left relative z-20 w-full p-5 sm:p-7">
                    {}
                    <div className="flex items-center gap-2 mb-3.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                      {card.category && <span>{card.category}</span>}
                      {card.category && card.year && (
                        <span className="w-[3px] h-[3px] rounded-full bg-ink-faint" />
                      )}
                      {card.year && <span>{card.year}</span>}
                    </div>

                    {}
                    <h3 className="text-[26px] leading-none font-bold text-ink-strong tracking-tight mb-2.5">
                      {card.title}
                    </h3>

                    {}
                    <p className="text-ink-muted text-[14px] leading-relaxed mb-5 font-normal max-w-[540px]">
                      {card.description}
                    </p>

                    {}

                    <div className="flex items-center gap-3 mt-auto w-full">
                      {}
                      <a
                        {...link(projectPath(card.projectId), () => openProject(card.projectId))}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted group-hover:text-ink-strong cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/70 focus-visible:ring-offset-4 focus-visible:ring-offset-surface transition-colors duration-200"
                      >
                        <span>{t('home.viewDetails')}</span>
                        <span className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
                      </a>

                      {}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {card.url && (
                          <a
                            href={card.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}

                            aria-label={
                              isVideoLink(card.url)
                                ? `Watch the ${card.title} showcase on YouTube`
                                : `Visit the ${card.title} website`
                            }
                            title={
                              card.urlLabel
                                ? t(URL_LABEL_KEY[card.urlLabel], null, card.urlLabel)
                                : t('proj.liveDemo')
                            }

                            className="w-8 h-8 rounded-lg text-ink-faint hover:text-ink-strong flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/70 transition-colors duration-200"
                          >
                            {isVideoLink(card.url) ? (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16L16 8m0 0H9.5m6.5 0v6.5" />
                              </svg>
                            )}
                          </a>
                        )}

                        {card.github && (
                          <a
                            href={card.github}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`View ${card.title} source on GitHub`}
                            title="View source"

                            className="w-8 h-8 rounded-lg text-ink-faint hover:text-ink-strong flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/70 transition-colors duration-200"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d={SOCIAL_ICON_PATHS.GitHub} />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="relative z-10 w-full aspect-[2.6/1] shrink-0 overflow-hidden">
                    {}
                    <img

                      {...imageProps(card.image, SIZES.contentColumn)}

                      alt={card.imageAlt ?? `${card.title} cover`}

                      loading={idx === 0 ? 'eager' : 'lazy'}
                      fetchPriority={idx === 0 ? 'high' : undefined}
                      decoding="async"
                      width="1200"
                      height="675"

                      style={{ objectPosition: card.imagePosition ?? 'center' }}
                      className={`w-full h-full object-cover group-hover:brightness-100 group-hover:scale-[1.04] transition-[transform,filter] duration-700 ease-out motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${theme === 'light' ? '' : 'brightness-[0.82]'}`}
                    />
                    {}
                  </div>

                </div>
              </div>
            ))}

            <a
              {...link(PROJECTS_PATH, () => openProject(null))}
              onMouseMove={handleArchiveMouseMove}
              onMouseLeave={handleArchiveMouseLeave}
              aria-label={`Browse the full projects library, ${projectsList.length} projects`}
              className="relative block p-[1px] rounded-[32px] bg-surface-hover hover:bg-surface-hover-strong transition-colors duration-300 group overflow-hidden w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              <div
                className="glow-follow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  '--glow-size': '300px',
                  background: 'radial-gradient(circle closest-side, var(--glow-strong) 0%, var(--glow-soft) 60%, transparent 100%)'
                }}
              />

              <div className="relative bg-surface rounded-[31px] flex flex-col md:flex-row items-stretch justify-between w-full overflow-hidden min-h-[300px]">

                <div
                  className="glow-follow opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[50px] z-0"
                  style={{
                    '--glow-size': '700px',
                    background: 'radial-gradient(circle closest-side, var(--glow-soft), transparent 80%)'
                  }}
                />

                <div className="flex-1 flex flex-col items-start text-left relative z-10 w-full p-6 sm:p-8 md:pb-8 pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-surface-raised flex items-center justify-center border border-line-strong shadow-sm mb-6">
                    <svg className="w-6 h-6 text-ink-strong" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5L3.5 8l8.5 4.5L20.5 8 12 3.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />
                    </svg>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-subtle">
                    <span>{t('home.archive')}</span>
                    <span className="w-1 h-1 shrink-0 rounded-full bg-ink-faint" />
                    <span>{t('home.projectsCount', { n: projectsList.length })}</span>
                    {archiveRangeLabel && (
                      <>
                        <span className="w-1 h-1 shrink-0 rounded-full bg-ink-faint" />
                        <span className="normal-case tracking-normal">{archiveRangeLabel}</span>
                      </>
                    )}
                  </div>

                  <h3 className="text-[26px] font-bold text-ink-strong tracking-tight mb-3">
                    {t('home.projectsLibrary')}
                  </h3>

                  <p className="text-ink-muted text-[15px] leading-relaxed mb-5 font-normal max-w-[420px]">
                    {t('home.libraryTagline')}
                  </p>

                  {}
                  {archiveCategories.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-6 max-w-[420px]">
                    {archiveCategories.map((category) => (
                      <span
                        key={category}
                        className="px-2.5 py-1 rounded-full border border-line bg-surface-raised text-[11.5px] text-ink-muted group-hover:border-line-strong group-hover:text-ink-secondary transition-colors duration-300"
                      >
                        {}
                        {t(`cat.${category}`, null, category)}
                      </span>
                    ))}
                  </div>
                  )}

                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-line-strong bg-surface-raised group-hover:bg-surface-hover-strong group-hover:border-line-strong text-ink-secondary group-hover:text-ink-strong font-semibold text-[13.5px] transition-all duration-200 mt-auto">
                    <span>{t('home.browseAll')}</span>
                    <span className="inline-block group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </span>
                </div>

                <div className="flex items-end justify-end self-stretch md:self-end w-full md:w-auto relative z-10 pl-6 md:pl-0">
                  <div className="w-[90%] md:w-[360px] aspect-[1.35] relative">
                    {archivePreviews.map((project, i) => (
                      <div
                        key={project.id}
                        className="absolute inset-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
                        style={{

                          transform: `translate3d(calc(var(--tilt-x, 0) * ${(i + 1) * 6}px), calc(var(--tilt-y, 0) * ${(i + 1) * 5}px), 0)`
                        }}
                      >
                        <div

                          className={`absolute inset-0 rounded-tl-2xl overflow-hidden border-t border-l border-line bg-surface-raised shadow-2xl origin-bottom-right transition-all duration-500 ease-out motion-reduce:transition-none ${archiveLayers.slice(-archivePreviews.length)[i]}`}
                        >
                          {}
                          {project.image ? (
                            <img

                              {...imageProps(project.image, '(min-width: 768px) 360px, 50vw')}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width="1200"
                              height="675"
                              className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700 ease-out motion-reduce:transition-none"
                            />
                          ) : (
                            <ProjectCover project={project} />
                          )}
                          <div className="absolute inset-0 bg-black/45 group-hover:bg-black/15 transition-colors duration-500" />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                          <span className="absolute bottom-3 left-4 text-[12px] font-semibold text-white/90 tracking-tight capitalize">
                            {project.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </a>
          </div>
        </section>

        <section id="experience" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12">
          <h2 className="text-[20px] font-bold text-ink-strong tracking-tight mb-8">{t('home.experience')}</h2>

          <div className="flex flex-col">

            {experienceEntries.map((entry) => (
              <div
                key={`${entry.org}-${entry.period}`}
                className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-1 sm:gap-6 py-4 border-b border-line last:border-b-0 text-left"
              >
                <div className="text-[12px] font-mono text-ink-subtle sm:pt-px">
                  {entry.period}
                </div>

                <div>
                  <h3 className="text-[14px] font-medium text-ink-strong">
                    {entry.role}
                    <span className="text-ink-subtle font-normal"> · </span>
                    {entry.url ? (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-normal text-ink-muted hover:text-purple-400 transition-colors duration-200"
                      >
                        {entry.org}
                      </a>
                    ) : (
                      <span className="font-normal text-ink-muted">{entry.org}</span>
                    )}
                  </h3>

                  <p className="text-ink-muted text-[12.5px] leading-relaxed font-light mt-1">
                    {entry.description}
                  </p>
                </div>
              </div>
            ))}

          </div>
        </section>

        <section id="skills" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] font-bold text-ink-strong tracking-tight mb-8">
            {t('home.skills')}
          </h2>

          {}
          <div
            className="flex flex-col gap-6 w-full text-[14px] group/skills"
            onPointerEnter={armSkillBadges}
            onFocusCapture={armSkillBadges}
            onTouchStart={armSkillBadges}
          >
            {skillCategories.map((category, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-6 w-full"
              >
                <span className="text-ink-subtle font-medium select-none">
                  {category.name}
                </span>

                {}
                <div className="sm:col-span-3 flex flex-wrap gap-x-5 gap-y-3 text-ink-secondary">
                  {category.items.map((skill, skillIdx) => {

                    const level = skill.level ? skillLevels[skill.level] : null
                    return (
                      <span
                        key={skillIdx}
                        tabIndex={level ? 0 : undefined}
                        data-skill=""
                        className="group/chip relative inline-flex outline-none group-has-[[data-skill]:hover]/skills:opacity-55 group-has-[[data-skill]:hover]/skills:blur-[2px] group-has-[[data-skill]:focus-visible]/skills:opacity-55 group-has-[[data-skill]:focus-visible]/skills:blur-[2px] hover:opacity-100! hover:blur-none! focus-visible:opacity-100! focus-visible:blur-none! transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                      >
                        {}
                        {level && skillBadgesArmed && (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 -translate-x-1/2 translate-y-1 origin-bottom scale-[0.94] opacity-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/chip:translate-y-0 group-hover/chip:scale-100 group-hover/chip:opacity-100 group-focus-visible/chip:translate-y-0 group-focus-visible/chip:scale-100 group-focus-visible/chip:opacity-100 motion-reduce:transition-none motion-reduce:scale-100"
                          >
                            <span
                              className={`relative flex items-center gap-2 whitespace-nowrap rounded-[10px] border bg-surface-inverted py-1 pl-2 pr-2.5 ${level.border} ${level.glow}`}
                            >
                              {}
                              <span aria-hidden="true" className="flex items-end gap-[2px]">
                                {meterBars.map((h, barIdx) => (
                                  <span
                                    key={barIdx}
                                    className={`w-[3px] shrink-0 rounded-[1.5px] ${h} ${
                                      barIdx < level.rank
                                        ? `${level.bar} opacity-0 scale-y-0 origin-bottom group-hover/chip:opacity-100 group-hover/chip:scale-y-100 group-focus-visible/chip:opacity-100 group-focus-visible/chip:scale-y-100 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:opacity-100 motion-reduce:scale-y-100 motion-reduce:transition-none`
                                        : 'bg-ink-on-inverted/15'
                                    }`}
                                    style={barIdx < level.rank ? { transitionDelay: `${120 + barIdx * 55}ms` } : undefined}
                                  />
                                ))}
                              </span>

                              <span className="h-[11px] w-px shrink-0 bg-ink-on-inverted/12" />

                              <span className={`text-[10.5px] font-semibold leading-none tracking-tight ${level.text}`}>
                                {level.label}
                              </span>

                              {}
                              <span
                                aria-hidden="true"
                                className={`absolute left-1/2 top-full -mt-[4px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 rounded-[1px] border-b border-r bg-surface-inverted ${level.border}`}
                              />
                            </span>
                          </span>
                        )}

                        {}
                        <span className="inline-flex items-center gap-2 text-ink-muted text-[12.5px] font-medium cursor-default transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/chip:text-ink-strong group-hover/chip:-translate-y-[3px] group-focus-visible/chip:text-ink-strong group-focus-visible/chip:-translate-y-[3px] group-active/chip:translate-y-0 motion-reduce:transition-none motion-reduce:group-hover/chip:translate-y-0 motion-reduce:group-focus-visible/chip:translate-y-0">
                          {}
                          <img

                            {...imageProps(skill.icon)}
                            alt={`${skill.name} logo`}
                            width="14"
                            height="14"
                            loading="lazy"
                            decoding="async"
                            className="w-3.5 h-3.5 object-contain opacity-85 group-hover/chip:opacity-100 group-hover/chip:scale-110 group-focus-visible/chip:opacity-100 group-focus-visible/chip:scale-110 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                          />
                          <span>{skill.name}</span>
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="education" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] font-bold text-ink-strong tracking-tight mb-8">
            {t('home.education')}
          </h2>

          {}
          <div className="flex flex-col">
            {educationEntries.map((entry, idx) => {
              const tabs = [
                { id: 'overview', label: t('edu.tab.overview') },
                { id: 'subjects', label: t('edu.tab.subjects') },
                { id: 'syllabus', label: t('edu.tab.syllabus') },
                { id: 'core', label: t('edu.tab.core') },
              ]

              const panel = eduPeek ?? eduPanel ?? 'overview'

              const onTabKeyDown = (e) => {
                const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
                let next = null
                if (step != null) {
                  const at = tabs.findIndex((tb) => tb.id === panel)
                  next = tabs[(at + step + tabs.length) % tabs.length]
                } else if (e.key === 'Home') next = tabs[0]
                else if (e.key === 'End') next = tabs[tabs.length - 1]
                if (!next) return
                e.preventDefault()
                setEduPanel(next.id)
                setEduPeek(null)
                eduTabRefs.current[`${idx}-${next.id}`]?.focus()
              }

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 border-b border-line py-4 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-6"
                >
                  <div className="text-[12px] font-mono text-ink-subtle sm:pt-px">
                    {entry.period}
                  </div>

                  <div className="min-w-0">
                    {}
                    <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium text-ink-strong">
                      <span>
                        {entry.degree}
                        <span className="font-normal text-ink-subtle"> · </span>
                        <span className="font-normal text-ink-muted">{entry.org}</span>
                      </span>

                      {}
                      <span className="group/info relative inline-flex">
                        <button
                          type="button"
                          aria-label={t('edu.ib.info')}
                          className="inline-flex h-[15px] w-[15px] cursor-help items-center justify-center rounded-full border border-line text-[9.5px] font-semibold leading-none text-ink-subtle transition-colors duration-200 hover:border-line-strong hover:text-ink-strong focus-visible:border-line-strong focus-visible:text-ink-strong focus:outline-none"
                        >
                          i
                        </button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-40 w-[min(19rem,74vw)] -translate-x-1/2 translate-y-1 rounded-xl border border-line bg-bg/95 p-3.5 text-[12px] font-normal leading-relaxed tracking-normal text-ink-muted opacity-0 shadow-2xl shadow-[color:var(--shadow-cast)] backdrop-blur-md transition-all duration-200 group-hover/info:translate-y-0 group-hover/info:opacity-100 group-focus-within/info:translate-y-0 group-focus-within/info:opacity-100"
                        >
                          {t('edu.ib.info')}
                        </span>
                      </span>
                    </h3>

                    {}
                    <div
                      role="tablist"
                      aria-label={entry.degree}
                      onMouseLeave={() => setEduPeek(null)}
                      onBlur={() => setEduPeek(null)}
                      className="mt-4 flex items-center gap-5 border-b border-line sm:gap-7"
                    >
                      {tabs.map((tab) => {
                        const active = panel === tab.id
                        return (
                          <button
                            key={tab.id}
                            ref={(el) => { eduTabRefs.current[`${idx}-${tab.id}`] = el }}
                            type="button"
                            role="tab"
                            id={`edu-tab-${idx}-${tab.id}`}
                            aria-selected={active}
                            aria-controls={`edu-panel-${idx}`}

                            tabIndex={eduPanel === tab.id ? 0 : -1}
                            onKeyDown={onTabKeyDown}
                            onMouseEnter={() => setEduPeek(tab.id)}
                            onFocus={() => setEduPeek(tab.id)}
                            onClick={() => { setEduPanel(tab.id); setEduPeek(null) }}
                            className="group relative cursor-pointer pb-2.5 text-[12.5px] font-medium tracking-wide focus:outline-none"
                          >
                            <span
                              className={`transition-colors duration-200 ${
                                active ? 'text-ink-strong' : 'text-ink-subtle group-hover:text-ink-secondary group-focus-visible:text-ink-secondary'
                              }`}
                            >
                              {tab.label}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`absolute inset-x-0 -bottom-px h-px origin-left bg-ink-strong transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                active ? 'scale-x-100' : 'scale-x-0'
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>

                    {}
                    <div
                      id={`edu-panel-${idx}`}
                      role="tabpanel"
                      aria-labelledby={`edu-tab-${idx}-${panel}`}
                      className="relative min-h-[10.5rem] pt-5 sm:min-h-[9rem]"
                    >
                      <div key={panel} className="animate-panel-in">
                        {panel === 'overview' && (
                          <div className="space-y-4">
                            <p className="max-w-xl text-[13px] font-light leading-relaxed text-ink-muted">
                              {entry.description}
                            </p>
                            {}
                            <dl className="grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
                              {ibFacts.map((fact) => (
                                <div key={fact.label} className="bg-bg px-3 py-2.5 sm:px-3.5">
                                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                                    {fact.label}
                                  </dt>
                                  <dd className="mt-1 text-[12.5px] font-medium text-ink-secondary">
                                    {fact.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                        {panel === 'subjects' && (
                          <ul className="grid max-w-xl gap-x-10 sm:grid-cols-2">
                            {ibSubjects.map((s) => (
                              <li
                                key={s.name}
                                className="flex items-center justify-between gap-3 border-b border-line py-2 text-[12.5px] last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                              >
                                <span className="text-ink-secondary">{s.name}</span>
                                {}
                                <span
                                  className={`shrink-0 rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${
                                    s.level === 'HL'
                                      ? 'border-line-strong bg-surface-raised text-ink-secondary'
                                      : 'border-line text-ink-faint'
                                  }`}
                                >
                                  {s.level}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {panel === 'syllabus' && (
                          <div>
                            {}
                            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                              Computer Science HL · course content
                            </p>
                            <dl className="max-w-2xl">
                              {csTopics.map((topic) => (
                                <div
                                  key={topic.title}
                                  className="grid gap-0.5 border-b border-line py-2 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4"
                                >
                                  <dt className="text-[12.5px] font-medium text-ink-secondary">
                                    {topic.title}
                                  </dt>
                                  <dd className="text-[12.5px] font-light leading-relaxed text-ink-subtle">
                                    {topic.points.join(' · ')}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                        {panel === 'core' && (
                          <div>
                            <dl className="max-w-2xl">
                              {ibCore.map((item) => (
                                <div
                                  key={item.title}
                                  className="grid gap-0.5 border-b border-line py-2 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4"
                                >
                                  <dt className="text-[12.5px] font-medium text-ink-secondary">
                                    {item.title}
                                  </dt>
                                  <dd className="text-[12.5px] font-light leading-relaxed text-ink-subtle">
                                    {item.desc}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                              TOK &amp; the Extended Essay add up to 3 points · CAS is pass/fail
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {}
            <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
              <div className="text-[12px] font-mono text-ink-subtle sm:pt-px">
                {t('home.certifications')}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  {certifications.map((cert, idx) => {
                    const Wrapper = cert.url ? 'a' : 'span'
                    const linkProps = cert.url
                      ? { href: cert.url, target: '_blank', rel: 'noreferrer' }
                      : {}

                    return (
                      <Wrapper
                        key={idx}
                        {...linkProps}
                        title={`${cert.issuer} verified certificate${cert.date ? ` · ${cert.date}` : ''}`}
                        className={`group/cert inline-flex items-baseline gap-1.5 rounded-lg border border-line bg-surface-raised/60 px-2.5 py-1 text-[12px] transition-colors duration-200 ${
                          cert.url ? 'hover:border-line-strong' : ''
                        }`}
                      >
                        <span className="font-medium text-ink-secondary transition-colors duration-200 group-hover/cert:text-ink-strong">
                          {cert.name}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                          {cert.tier}
                        </span>
                      </Wrapper>
                    )
                  })}
                </div>
                <p className="mt-3 text-[10.5px] text-ink-faint">
                  {t('cert.note')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] font-bold text-ink-strong tracking-tight mb-8">
            {t('home.contact')}
          </h2>

          <div className="flex flex-col items-start gap-5 w-full text-[14px]">
            <p className="text-ink-muted text-[13.5px] leading-relaxed font-light max-w-xl">
              {t('contact.intro')}
            </p>

            <div className="flex items-center gap-2 w-full rounded-[14px] bg-surface-raised/60 border border-line p-1.5 pl-4 transition-colors duration-200 hover:border-line-strong">
              <svg aria-hidden="true" className="w-4 h-4 shrink-0 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>

              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink-secondary hover:text-ink-strong transition-colors duration-200"
              >
                {CONTACT_EMAIL}
              </a>

              <button
                type="button"
                onClick={handleCopyEmail}
                aria-label={emailCopied ? t('contact.copied') : t('contact.copy')}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-line bg-bg text-[11.5px] font-medium text-ink-muted hover:text-ink-strong hover:border-line-strong active:scale-[0.97] transition-all duration-200 cursor-pointer"
              >
                {emailCopied ? (
                  <>
                    <svg aria-hidden="true" className="w-3 h-3 text-emerald-400/80" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-10.5" />
                    </svg>
                    {t('contact.copied')}
                  </>
                ) : (
                  <>
                    <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25V5.5A1.5 1.5 0 019.75 4h9A1.5 1.5 0 0120.25 5.5v9a1.5 1.5 0 01-1.5 1.5H16m-10.25-7.75h9a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z" />
                    </svg>
                    {t('contact.copy')}
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {SOCIALS.map((social) => {
                const Wrapper = social.url ? 'a' : 'span'
                const linkProps = social.url
                  ? { href: social.url, target: '_blank', rel: 'noreferrer' }
                  : {}

                return (
                  <Wrapper
                    key={social.name}
                    {...linkProps}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[12px] bg-surface-raised/60 border border-line text-[12.5px] text-ink-secondary transition-all duration-200 ${
                      social.url
                        ? 'hover:text-ink-strong hover:border-line-strong hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer group'
                        : ''
                    }`}
                  >
                    <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-ink-subtle group-hover:text-ink-strong transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d={SOCIAL_ICON_PATHS[social.name]} />
                    </svg>
                    <span className="font-medium">{social.name}</span>
                    {social.handle && <span className="text-ink-subtle">{social.handle}</span>}
                  </Wrapper>
                )
              })}
            </div>

            <p className="text-[11.5px] text-ink-faint">
              {t('contact.based')}
            </p>
          </div>
        </section>

        {}
        <div className="w-full mt-16">
          <BannerCompare />
        </div>

       <div className="relative h-[600px] w-full overflow-hidden">
      <AnimatedFooter
        headingLines={FOOTER_HEADING}

        theme={theme}

        leftImage={imageUrl('/hand-left.webp', 300)}
        rightImage={imageUrl('/hand-right.webp', 300)}

        headingClassName="italic font-serif"

        charClassName="bg-gradient-to-b from-ink-strong via-ink-secondary to-ink-subtle bg-clip-text text-transparent"
      >
        <div className="w-full  font-normal not-italic pt-4 border-t border-dashed border-[var(--hairline-strong)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-ink-muted">
          <span>{t('footer.copyright')}</span>
          <span className="flex items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-ink-strong transition-colors duration-200">GitHub</a>
            <span>/</span>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="hover:text-ink-strong transition-colors duration-200">Discord</a>
          </span>
        </div>
      </AnimatedFooter>
    </div>

      </main>

      {palette}

    </div>
  )
}

export default App
