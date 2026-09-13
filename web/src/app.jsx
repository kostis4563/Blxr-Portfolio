import { useState, useEffect, useRef, useLayoutEffect } from 'react'

const AUTOPLAY_MS = 6000
import GitHubContributions from './components/github-contribution'
import AnimatedFooter from './components/animated-footer'
import ProjectsPage from './projects-page'
import LibraryPage from './library-page'
import NotFoundPage from './not-found-page'
import ThemeToggle from './components/theme-toggle'
import LanguagePicker from './components/language-picker'
import CommandPaletteHost from './components/command-palette-host'
import { CommandButton } from './components/command-button'
import { useTheme } from './lib/use-theme'
import { useI18n } from './lib/i18n'
import { projectsList, SHORT_KEY, METRIC_KEY, METRIC_VALUE_KEY } from './lib/projects'
import { imageProps, SIZES } from './lib/images'
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

function App() {

  const path = useRoutePath()
  const route = parseRoute(path)
  const currentView = route.name
  const [emailCopied, setEmailCopied] = useState(false)

  const [skillBadgesArmed, setSkillBadgesArmed] = useState(false)
  const armSkillBadges = () => {
    if (!skillBadgesArmed) setSkillBadgesArmed(true)
  }

  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()

  const homeScrollRef = useRef(0)

  const hasLeftHomeRef = useRef(false)
  const projectsRef = useRef(null)
  const carouselRef = useRef(null)
  const carouselRafRef = useRef(0)
  const autoplayRemainingRef = useRef(null)
  const autoplaySlideRef = useRef(0)
  const [carouselPaused, setCarouselPaused] = useState(false)
  const [carouselVisible, setCarouselVisible] = useState(false)
  const [autoplayTick, setAutoplayTick] = useState(0)
  const [activeSlide, setActiveSlide] = useState(0)
  const toolboxRef = useRef(null)

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
    if (route.redirect) navigate(route.redirect, { replace: true })
  }, [route.redirect])

  useEffect(() => {
    recordHit(path)

    rememberVisit(path)
  }, [path])

  const isReturningHome = hasLeftHomeRef.current

  useEffect(() => {
    const el = toolboxRef.current
    if (!el) return

    const closeOnOutside = (e) => {
      if (el.open && !el.contains(e.target)) el.open = false
    }

    const closeOnEscape = (e) => {
      if (e.key !== 'Escape' || !el.open) return
      const hadFocus = el.contains(document.activeElement)
      el.open = false
      if (hadFocus) el.querySelector('summary')?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [currentView])

  useEffect(() => {
    if (currentView !== 'home') return
    const root = projectsRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const items = Array.from(root.querySelectorAll('[data-reveal]'))
    const pending = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92)
    if (!pending.length) return

    for (const el of pending) el.classList.add('reveal-pending')

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('reveal-in')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })

    for (const el of pending) observer.observe(el)

    return () => {
      observer.disconnect()
      for (const el of items) el.classList.remove('reveal-pending', 'reveal-in')
    }
  }, [currentView])

  const palette = <CommandPaletteHost theme={theme} onToggleTheme={toggleTheme} />

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 1800)
    } catch {
    }
  }

  const FEATURED_ORDER = ['amitista', 'async', '7x0-site']
  const featuredProjects = FEATURED_ORDER
    .map((id) => projectsList.find((project) => project.id === id))
    .filter(Boolean)
    .map((project) => ({
      ...project,
      categoryLabel: t(`cat.${project.category}`, null, project.category),
      description: t(SHORT_KEY[project.id], null, project.shortDescription),
      metrics: (project.metrics ?? [])
        .map((metric) => ({
          label: t(METRIC_KEY[metric.label], null, metric.label),
          value: t(METRIC_VALUE_KEY[metric.value], null, metric.value)
        }))
        .filter((metric) => metric.value.length <= 18)
        .slice(0, 2)
    }))

  const goToSlide = (index, behavior) => {
    const track = carouselRef.current
    if (!track) return
    const count = featuredProjects.length
    const next = ((index % count) + count) % count
    const slide = track.children[next]
    if (!slide) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2,
      behavior: behavior ?? (reduce ? 'auto' : 'smooth')
    })
  }

  const handleCarouselScroll = () => {
    const track = carouselRef.current
    if (!track) return
    if (carouselRafRef.current) return
    carouselRafRef.current = requestAnimationFrame(() => {
      carouselRafRef.current = 0
      const center = track.scrollLeft + track.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < track.children.length; i++) {
        const el = track.children[i]
        const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center)
        if (dist < bestDist) { bestDist = dist; best = i }
      }
      setActiveSlide((prev) => (prev === best ? prev : best))
    })
  }

  const handleCarouselKeyDown = (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goToSlide(activeSlide + 1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); goToSlide(activeSlide - 1) }
  }

  const autoplayEnabled = currentView === 'home' && carouselVisible && !carouselPaused && featuredProjects.length > 1

  useEffect(() => {
    if (currentView !== 'home') return
    const root = carouselRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let intersecting = false
    const sync = () => setCarouselVisible(intersecting && document.visibilityState === 'visible')
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting
      sync()
    }, { threshold: 0.5 })
    observer.observe(root)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      setCarouselVisible(false)
    }
  }, [currentView])

  useEffect(() => {
    if (!autoplayEnabled) return
    if (autoplaySlideRef.current !== activeSlide) {
      autoplaySlideRef.current = activeSlide
      autoplayRemainingRef.current = null
    }
    const duration = autoplayRemainingRef.current ?? AUTOPLAY_MS
    const started = Date.now()
    let fired = false
    const id = setTimeout(() => {
      fired = true
      autoplayRemainingRef.current = null
      goToSlide(activeSlide + 1)
      setAutoplayTick((tick) => tick + 1)
    }, duration)
    return () => {
      clearTimeout(id)
      autoplayRemainingRef.current = fired ? null : Math.max(0, duration - (Date.now() - started))
    }
  }, [autoplayEnabled, activeSlide, autoplayTick])

  const pauseCarousel = () => setCarouselPaused(true)
  const resumeCarousel = () => setCarouselPaused(false)

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

  const certifications = [
    { name: 'JavaScript', tier: t('tier.intermediate'), issuer: 'HackerRank', date: null, url: null },
    { name: 'JavaScript', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null },
    { name: 'Python', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null },
    { name: 'Go', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null },
    { name: 'CSS', tier: t('tier.basic'), issuer: 'HackerRank', date: null, url: null }
  ]

  const skillLevels = {
    advanced: { label: t('level.advanced'), rank: 4, bar: 'bg-emerald-400' },
    comfortable: { label: t('level.comfortable'), rank: 3, bar: 'bg-sky-400' },
    basic: { label: t('level.basic'), rank: 2, bar: 'bg-zinc-300' },
    learning: { label: t('level.learning'), rank: 1, bar: 'bg-amber-400' }
  }

  const meterSegments = [0, 1, 2, 3]

  const LIGHT_THEME_ICONS = {
    '/icons/apple_dark.svg': '/icons/apple.svg',
    '/icons/mysql-icon-dark.svg': '/icons/mysql-icon-light.svg',
    '/icons/github_dark.svg': '/icons/github.svg',
    '/icons/json_dark.svg': '/icons/json.svg',
    '/icons/komodo_dark.svg': '/icons/komodo.svg',
    '/icons/cursor_dark.svg': '/icons/cursor.svg',
    '/icons/devin_dark.png': '/icons/devin.png'
  }
  const themedIcon = (url) => (theme === 'light' ? LIGHT_THEME_ICONS[url] ?? url : url)

  const skillCategories = [
    {
      name: t('skills.languages'),
      items: [
        { name: 'JavaScript', icon: '/icons/javascript.svg', level: 'comfortable', desc: 'Scripting language for the web' },
        { name: 'Python', icon: '/icons/python.svg', level: 'comfortable', desc: 'General-purpose scripting & automation' },
        { name: 'CSS', icon: '/icons/css.svg', level: 'advanced', desc: 'Styling & layout for the web' },
        { name: 'HTML', icon: '/icons/html5.svg', level: 'advanced', desc: 'Markup that structures web pages' }
      ]
    },
    {
      name: t('skills.frameworks'),
      items: [
        { name: 'React', icon: '/icons/react_dark.svg', level: 'advanced', desc: 'UI library for building interfaces' },
        { name: 'discord.js', icon: '/icons/discordjs.svg', level: 'advanced', desc: 'Node.js library for Discord bots' }
      ]
    },
    {
      name: t('skills.infrastructure'),
      items: [
        { name: 'MySQL', icon: themedIcon('/icons/mysql-icon-dark.svg'), level: 'basic', desc: 'Relational database management' },
        { name: 'PM2', icon: '/icons/pm2.svg', level: 'comfortable', desc: 'Process manager for Node.js' },
        { name: 'Cloudflare', icon: '/icons/cloudflare.svg', level: 'basic', desc: 'CDN, DNS & edge security' }
      ]
    }
  ]

  const toolCategories = [
    {
      name: t('tools.development'),
      wide: false,
      items: [
        { name: 'Git', icon: '/icons/git.svg', desc: 'Version control for code' },
        { name: 'GitHub', icon: themedIcon('/icons/github_dark.svg'), desc: 'Code hosting & collaboration' },
        { name: 'npm', icon: '/icons/npm.svg', desc: 'Package manager for Node.js' }
      ]
    },
    {
      name: t('tools.design'),
      wide: false,
      items: [
        { name: 'Figma', icon: '/icons/figma.svg', desc: 'Interface design & prototyping' },
        { name: 'Adobe', icon: '/icons/adobe.svg', desc: 'Creative software suite' },
        { name: 'Photoshop', icon: '/icons/photoshop.svg', desc: 'Image editing & compositing' },
        { name: 'Illustrator', icon: '/icons/illustrator.svg', desc: 'Vector graphics & illustration' },
        { name: 'Canva', icon: '/icons/canva.svg', desc: 'Quick graphic design' }
      ]
    },
    {
      name: t('skills.editors'),
      wide: true,
      items: [
        { name: 'VS Code', icon: '/icons/vscode.svg', desc: 'Code editor' },
        { name: 'Visual Studio', icon: '/icons/visual-studio.svg', desc: 'IDE for app development' },
        { name: 'Xcode', icon: '/icons/xcode.svg', desc: "Apple's IDE for iOS & macOS" },
        { name: 'Komodo', icon: themedIcon('/icons/komodo_dark.svg'), desc: 'Lightweight code editor' }
      ]
    },
    {
      name: t('skills.systems'),
      wide: true,
      items: [
        { name: 'macOS', icon: themedIcon('/icons/apple_dark.svg'), desc: "Apple's desktop OS" },
        { name: 'Windows', icon: '/icons/windows.svg', desc: "Microsoft's desktop OS" }
      ]
    }
  ]

  const toolboxPreview = ['Git', 'Figma', 'VS Code', 'macOS']
    .map((name) => toolCategories.flatMap((category) => category.items).find((item) => item.name === name))
    .filter(Boolean)
  const toolboxCount = toolCategories.reduce((total, category) => total + category.items.length, 0)

  const navItemClass = 'h-9 w-9 flex items-center justify-center hover:text-ink-strong focus-visible:text-ink-strong aria-expanded:text-ink-strong transition-colors duration-200'

  const navPillClass = 'h-9 px-2 sm:ps-2 sm:pe-1.5 flex items-center gap-1.5 rounded-lg hover:text-ink-strong hover:bg-surface-hover focus-visible:text-ink-strong aria-expanded:text-ink-strong aria-expanded:bg-surface-hover transition-colors duration-200'

  const navDivider = 'mx-1 h-full border-l border-dashed border-line'

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
        <ProjectsPage
          onBack={() => navigate(HOME_PATH)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
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

  return (
    <div className={`min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-clip antialiased font-sans ${isReturningHome ? '' : 'animate-view-in'}`}>

      <header
        id="main-header"
        className="w-full max-w-[768px] bg-bg backdrop-blur-none md:bg-bg/90 md:backdrop-blur-md text-ink h-[60px] fixed top-0 left-1/2 -translate-x-1/2 z-50 border-b border-l border-dashed border-r border-line transition-[border-color] duration-200"
      >
        <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-3">
          {}
          <a
            {...link(HOME_PATH, () => window.scrollTo({ top: 0, behavior: 'smooth' }))}
            aria-label="blxr, back to top"
            className="group flex items-end gap-1.5 shrink-0 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/70 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
          >
            {}
            <img

              {...imageProps('/wordmark-nav.png')}
              alt="blxr"
              width="111"
              height="50"
              draggable={false}
              className="h-[42px] sm:h-[50px] w-auto select-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100"
            />
            <span className="text-[10px] font-bold text-ink-muted tracking-tight leading-none mb-[12px] transition-colors duration-200 group-hover:text-ink-strong">dev</span>
          </a>

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
            {(() => {
              const greeting = t('hero.greeting')
              const at = greeting.indexOf('Blxr')
              if (at === -1) return greeting
              return (
                <>
                  <span className="font-vergilia font-normal">{greeting.slice(0, at)}</span>
                  <span className="font-bagus font-normal">{greeting.slice(at, at + 4)}</span>
                  <span className="font-vergilia font-normal">{greeting.slice(at + 4)}</span>
                </>
              )
            })()}
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

        <section id="projects" className="scroll-mt-28 w-full mt-14">

          <div ref={projectsRef} className="flex flex-col items-center w-full">
            <div data-reveal className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-subtle">
                <span className="tabular-nums" aria-live="polite">
                  {String(activeSlide + 1).padStart(2, '0')}
                  <span className="mx-1.5 text-ink-faint">/</span>
                  {String(featuredProjects.length).padStart(2, '0')}
                </span>
              </span>
              <h2 className="mt-3 text-[22px] leading-none tracking-[-0.02em] text-ink-strong sm:text-[26px] font-bagus">
                {t('home.projects')}
              </h2>
            </div>

            <div
              data-reveal
              style={{ '--reveal-delay': '90ms' }}
              data-paused={autoplayEnabled ? undefined : ''}
              style={{ '--autoplay': `${AUTOPLAY_MS}ms` }}
              className="project-carousel relative mt-8 w-[calc(100%+3rem)] -mx-6"
              onKeyDown={handleCarouselKeyDown}
              onMouseEnter={pauseCarousel}
              onMouseLeave={resumeCarousel}
              onPointerDown={(event) => { if (event.pointerType !== 'mouse') pauseCarousel() }}
              onPointerUp={(event) => { if (event.pointerType !== 'mouse') resumeCarousel() }}
              onPointerCancel={(event) => { if (event.pointerType !== 'mouse') resumeCarousel() }}
              onFocusCapture={(event) => { if (event.target.matches?.(':focus-visible')) pauseCarousel() }}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) resumeCarousel()
              }}
            >
              <div
                ref={carouselRef}
                className="project-track"
                onScroll={handleCarouselScroll}
                aria-roledescription="carousel"
                aria-label={t('home.projects')}
              >
                {featuredProjects.map((project, idx) => {
                  const active = idx === activeSlide
                  return (
                    <article
                      key={project.id}
                      data-active={active ? '' : undefined}
                      aria-roledescription="slide"
                      aria-label={`${idx + 1} / ${featuredProjects.length}`}
                      className="project-slide"
                    >
                      <div className="project-panel group relative grid grid-cols-1 gap-2 rounded-[20px] border border-line bg-surface p-2 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                        <div className="project-media relative aspect-[16/11] min-w-0 overflow-hidden rounded-[13px] bg-surface-raised sm:aspect-auto sm:min-h-[248px]">
                          <img
                            {...imageProps(project.image, '(min-width: 768px) 320px, calc(100vw - 48px)')}
                            alt={project.imageAlt ?? `${project.title} cover`}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            fetchPriority={idx === 0 ? 'high' : undefined}
                            decoding="async"
                            width="1200"
                            height="825"
                            style={{ objectPosition: project.imagePosition ?? 'center' }}
                            className={`project-media-img absolute inset-0 h-full w-full object-cover ${theme === 'light' ? '' : 'brightness-[0.92]'}`}
                          />
                        </div>

                        <div className="project-copy flex min-w-0 flex-col px-3 pb-3 pt-3 sm:px-6 sm:py-5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            {project.logo && !project.logoInCover && (
                              <img
                                {...imageProps(project.logo, project.logoWide ? '72px' : '20px')}
                                alt=""
                                width={project.logoWide ? 72 : 20}
                                height={project.logoWide ? 18 : 20}
                                loading="lazy"
                                decoding="async"
                                className={`shrink-0 object-contain ${project.logoWide ? 'h-[18px] w-auto' : 'h-5 w-5'}`}
                              />
                            )}
                            <span className="min-w-0 truncate font-mono text-[11px] text-ink-subtle">
                              {project.categoryLabel}
                              {project.date && <> · {project.date}</>}
                            </span>
                          </div>

                          <h3 className="mt-4 text-[19px] font-semibold leading-tight tracking-tight text-ink-strong sm:text-[20px]">
                            <a
                              {...link(projectPath(project.id), () => openProject(project.id))}
                              tabIndex={active ? 0 : -1}
                              className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-[20px] focus-visible:after:ring-2 focus-visible:after:ring-ink-strong/60"
                            >
                              {project.title}
                            </a>
                          </h3>
                          <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-muted">{project.description}</p>

                          <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-strong">
                            <span className="project-underline">{t('proj.view')}</span>
                            <span className="project-arrow inline-block" aria-hidden="true">→</span>
                          </span>

                          {project.metrics.length > 0 && (
                            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-dashed border-line pt-4 sm:mt-auto">
                              {project.metrics.map((metric) => (
                                <div key={metric.label} className="min-w-0">
                                  <dd className="whitespace-nowrap text-[14px] font-semibold leading-snug tracking-tight text-ink-strong">{metric.value}</dd>
                                  <dt className="mt-0.5 whitespace-nowrap text-[10.5px] text-ink-subtle">{metric.label}</dt>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => goToSlide(activeSlide - 1)}
                aria-label="Previous project"
                className="project-nav left-4 hidden sm:flex"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => goToSlide(activeSlide + 1)}
                aria-label="Next project"
                className="project-nav right-4 hidden sm:flex"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            </div>

            <div data-reveal style={{ '--reveal-delay': '160ms' }} className="mt-5 flex items-center gap-1.5" role="tablist" aria-label="Choose project">
              {featuredProjects.map((project, idx) => (
                <button
                  key={project.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeSlide}
                  aria-label={project.title}
                  onClick={() => goToSlide(idx)}
                  className="project-dot"
                >
                  <span className="project-dot-fill">
                    {idx === activeSlide && (
                      <span key={`${activeSlide}-${autoplayTick}`} className="project-dot-progress" />
                    )}
                  </span>
                </button>
              ))}
            </div>

            <a
              {...link(PROJECTS_PATH, () => openProject(null))}
              data-reveal
              style={{ '--reveal-delay': '220ms' }}
              className="project-cta group relative mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-surface-inverted pl-5 pr-4 text-[13px] font-medium text-ink-on-inverted outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              <span>{t('home.browseAll')}</span>
              <span className="project-arrow inline-block" aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        <section id="skills" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] text-ink-strong tracking-tight mb-8 font-shake">
            {t('home.skills')}
          </h2>

          <div
            className="flex flex-col gap-5 w-full text-[14px]"
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

                <div className="sm:col-span-3 flex flex-wrap gap-x-5 gap-y-3">
                  {category.items.map((skill, skillIdx) => {
                    const level = skill.level ? skillLevels[skill.level] : null
                    return (
                      <span
                        key={skillIdx}
                        tabIndex={level ? 0 : undefined}
                        className="group/chip relative inline-flex items-center gap-2 text-ink-muted text-[12.5px] font-medium cursor-default outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong"
                      >
                        {}
                        {level && skillBadgesArmed && (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 -translate-x-1/2 translate-y-1 origin-bottom scale-[0.94] opacity-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/chip:translate-y-0 group-hover/chip:scale-100 group-hover/chip:opacity-100 group-focus-visible/chip:translate-y-0 group-focus-visible/chip:scale-100 group-focus-visible/chip:opacity-100 motion-reduce:transition-none motion-reduce:scale-100"
                          >
                            <span className="relative flex w-max max-w-[220px] flex-col rounded-lg border border-ink-on-inverted/10 bg-surface-inverted text-left shadow-[0_14px_32px_-16px_var(--shadow-cast)]">
                              {skill.desc && (
                                <span className="whitespace-normal px-3 pb-2 pt-2.5 text-[11.5px] font-medium leading-snug tracking-tight text-ink-on-inverted">
                                  {skill.desc}
                                </span>
                              )}

                              <span className="flex items-center justify-between gap-4 border-t border-dashed border-ink-on-inverted/10 px-3 py-2">
                                <span aria-hidden="true" className="flex items-center gap-[3px]">
                                  {meterSegments.map((segIdx) => (
                                    <span
                                      key={segIdx}
                                      className={`h-[3px] w-3.5 origin-left rounded-full ${
                                        segIdx < level.rank
                                          ? `${level.bar} scale-x-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/chip:scale-x-100 group-focus-visible/chip:scale-x-100 motion-reduce:scale-x-100 motion-reduce:transition-none`
                                          : 'bg-ink-on-inverted/12'
                                      }`}
                                      style={segIdx < level.rank ? { transitionDelay: `${140 + segIdx * 60}ms` } : undefined}
                                    />
                                  ))}
                                </span>

                                <span className="text-[9.5px] font-semibold uppercase leading-none tracking-[0.14em] text-ink-on-inverted/55">
                                  {level.label}
                                </span>
                              </span>

                              <span
                                aria-hidden="true"
                                className="absolute left-1/2 top-full -mt-[4px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 rounded-[1px] border-b border-r border-ink-on-inverted/10 bg-surface-inverted"
                              />
                            </span>
                          </span>
                        )}

                        <img
                          {...imageProps(skill.icon)}
                          alt=""
                          aria-hidden="true"
                          width="14"
                          height="14"
                          loading="lazy"
                          decoding="async"
                          className="w-3.5 h-3.5 object-contain opacity-70 transition-opacity duration-200 group-hover/chip:opacity-100 group-focus-visible/chip:opacity-100"
                        />
                        <span>{skill.name}</span>
                        {level && <span className="sr-only">{level.label}</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <details ref={toolboxRef} className="toolbox group/more relative z-30 mt-5 border-t border-dashed border-line pt-3.5">
            <summary className="-mx-2 grid min-h-10 w-[calc(100%+1rem)] grid-cols-1 items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 list-none cursor-pointer outline-none transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-line hover:bg-surface-hover/60 active:scale-[0.995] focus-visible:border-line-strong focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:grid-cols-4 sm:gap-6 motion-reduce:transition-none motion-reduce:active:scale-100 [&::-webkit-details-marker]:hidden">
              <span className="text-ink-subtle font-medium select-none transition-colors duration-200 group-hover/more:text-ink-secondary group-open/more:text-ink-secondary">
                {t('home.toolbox')}
              </span>

              <span className="sm:col-span-3 inline-flex min-w-0 items-center gap-2.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 group-hover/more:text-ink-strong group-open/more:text-ink-strong">
                <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                  {toolboxPreview.map((tool, toolIdx) => (
                    <span
                      key={tool.name}
                      className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-line bg-surface-raised shadow-[0_4px_10px_-7px_var(--shadow-cast)] transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover/more:-translate-y-0.5 group-hover/more:border-line-strong group-open/more:-translate-y-0.5 group-open/more:border-line-strong motion-reduce:transition-none motion-reduce:group-hover/more:translate-y-0 motion-reduce:group-open/more:translate-y-0"
                      style={{ transitionDelay: `${toolIdx * 25}ms` }}
                    >
                      <img
                        {...imageProps(tool.icon)}
                        alt=""
                        width="12"
                        height="12"
                        loading="lazy"
                        decoding="async"
                        className="h-3 w-3 object-contain opacity-80"
                      />
                    </span>
                  ))}
                </span>
                <span className="truncate">{t('tools.collection')}</span>
                <span className="shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums leading-none text-ink-subtle ring-1 ring-inset ring-line">
                  {toolboxCount}
                </span>
                <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-ink-subtle ring-1 ring-inset ring-line transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover/more:bg-surface-hover-strong group-hover/more:text-ink-strong group-open/more:bg-surface-hover-strong group-open/more:text-ink-strong">
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open/more:rotate-180 motion-reduce:transition-none"
                  >
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
            </summary>

            <div className="absolute left-0 right-0 top-full z-40 pt-2">
              <aside className="toolbox-panel relative max-h-[min(60vh,430px)] overflow-y-auto overscroll-contain rounded-[18px] border border-line-strong bg-surface/95 p-4 shadow-[0_28px_72px_-30px_var(--shadow-cast),0_8px_24px_-18px_var(--shadow-cast-soft)] backdrop-blur-xl [scrollbar-width:thin] sm:p-5" aria-label={t('tools.collection')}>
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-ink-faint/60 to-transparent" aria-hidden="true" />

                <div className="mb-4 flex items-center gap-2.5 border-b border-dashed border-line pb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-raised text-ink-secondary ring-1 ring-inset ring-line" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M9.4 8.6V6.9A1.8 1.8 0 0 1 11.2 5.1h1.6A1.8 1.8 0 0 1 14.6 6.9v1.7" />
                      <rect x="3" y="8.6" width="18" height="10.4" rx="2.3" />
                      <path d="M3 13.4h18" />
                    </svg>
                  </span>
                  <span className="text-[11.5px] font-semibold text-ink-secondary">{t('tools.collection')}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-subtle">{toolboxCount}</span>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-6">
                  {toolCategories.map((category, categoryIdx) => (
                    <div
                      key={category.name}
                      className={`toolbox-col ${category.wide ? 'sm:col-span-3' : 'sm:col-span-2'}`}
                      style={{ '--toolbox-delay': `${Math.min(categoryIdx, 5) * 28}ms` }}
                    >
                      <span className="mb-2.5 block border-t border-line pt-2.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                        {category.name}
                      </span>

                      <div className="flex flex-wrap gap-x-1 gap-y-1" role="list">
                        {category.items.map((tool) => (
                          <span
                            key={tool.name}
                            role="listitem"
                            tabIndex={tool.desc ? 0 : undefined}
                            className="group/tool relative inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-ink-muted outline-none transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-px hover:bg-surface-hover hover:text-ink-strong focus-visible:-translate-y-px focus-visible:bg-surface-hover focus-visible:text-ink-strong motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                          >
                            {tool.desc && (
                              <span
                                role="tooltip"
                                className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 origin-bottom-left translate-y-1 scale-[0.96] opacity-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/tool:translate-y-0 group-hover/tool:scale-100 group-hover/tool:opacity-100 group-focus-visible/tool:translate-y-0 group-focus-visible/tool:scale-100 group-focus-visible/tool:opacity-100 motion-reduce:transition-none motion-reduce:scale-100"
                              >
                                <span className="relative flex w-max max-w-[210px] flex-col rounded-lg border border-ink-on-inverted/10 bg-surface-inverted text-left shadow-[0_14px_32px_-16px_var(--shadow-cast)]">
                                  <span className="whitespace-normal px-2.5 pb-1.5 pt-2 text-[11.5px] font-medium leading-snug tracking-tight text-ink-on-inverted">
                                    {tool.desc}
                                  </span>
                                  <span className="border-t border-dashed border-ink-on-inverted/10 px-2.5 py-1.5 text-[9.5px] font-semibold uppercase leading-none tracking-[0.14em] text-ink-on-inverted/55">
                                    {category.name}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className="absolute left-3 top-full -mt-[4px] h-[7px] w-[7px] rotate-45 rounded-[1px] border-b border-r border-ink-on-inverted/10 bg-surface-inverted"
                                  />
                                </span>
                              </span>
                            )}
                            <img
                              {...imageProps(tool.icon)}
                              alt=""
                              aria-hidden="true"
                              width="13"
                              height="13"
                              loading="lazy"
                              decoding="async"
                              className="h-[13px] w-[13px] object-contain opacity-70 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover/tool:scale-110 group-hover/tool:opacity-100 motion-reduce:transition-none motion-reduce:group-hover/tool:scale-100"
                            />
                            <span>{tool.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </details>
        </section>

        <section id="education" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] text-ink-strong tracking-tight mb-8 font-watom">
            {t('home.education')}
          </h2>

          {}
          <div className="flex flex-col">
            {educationEntries.map((entry, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-1 sm:gap-6 py-4 border-b border-line last:border-b-0 text-left"
              >
                <div className="text-[12px] font-mono text-ink-subtle sm:pt-px">
                  {entry.period}
                </div>

                <div>
                  <h3 className="text-[14px] font-medium text-ink-strong">
                    {entry.degree}
                    <span className="text-ink-subtle font-normal"> · </span>
                    <span className="font-normal text-ink-muted">{entry.org}</span>
                  </h3>

                  <p className="text-ink-muted text-[12.5px] leading-relaxed font-light mt-1 max-w-xl">
                    {entry.description}
                  </p>

                  {entry.subjects?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      {entry.subjects.map((subject) => (
                        <span
                          key={subject}
                          className="px-2.5 py-1 rounded-md border border-line bg-surface-raised/60 text-[11.5px] text-ink-muted"
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {}
            <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
              <div className="text-[12px] font-watom text-ink-subtle sm:pt-px">
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
          <h2 className="text-[20px] text-ink-strong tracking-tight mb-8 font-vergilia">
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

       <div className="relative h-[360px] sm:h-[400px] w-full overflow-hidden mt-8">
      <AnimatedFooter
        headingLines={[]}

        theme={theme}

        leftText="BL"
        rightText="XR"
        textFont='"Yang Bagus"'

      >
        <div className="w-full  font-normal not-italic pt-4 border-t border-dashed border-[var(--hairline-strong)] flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-4 text-[12px] text-ink-muted">
          <span className="flex items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-ink-strong transition-colors duration-200">GitHub</a>
            <span aria-hidden="true" className="text-ink-faint">·</span>
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
