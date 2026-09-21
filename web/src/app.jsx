import { useState, useEffect, useRef, useLayoutEffect, lazy, Suspense } from 'react'

const AUTOPLAY_MS = 6000
import GitHubContributions from './components/github-contribution'
import Testimonials from './components/testimonials'
import ContactSection from './components/contact-section'
import ProjectsPageImpl from '#ssr-page/projects'
import LibraryPageImpl from '#ssr-page/library'
import ReviewsPageImpl from '#ssr-page/reviews'
import NowPageImpl from '#ssr-page/now'
import UsesPageImpl from '#ssr-page/uses'
import CvPageImpl from '#ssr-page/cv'
import LoginPageImpl from '#ssr-page/login'
import DashboardPageImpl from '#ssr-page/dashboard'
import PublicProfilePageImpl from '#ssr-page/public-profile'
import NotFoundPageImpl from '#ssr-page/not-found'
import ThemeToggle from './components/theme-toggle'
import CommandPaletteHost from './components/command-palette-host'
import NavMenu from './components/nav-menu'
import { useTheme } from './lib/use-theme'
import { useI18n } from './lib/i18n'
import { projectsList, SHORT_KEY, METRIC_KEY, METRIC_VALUE_KEY } from './lib/projects'
import { imageProps, SIZES } from './lib/images'
import { SKILL_CATEGORIES, TOOL_CATEGORIES, CERTIFICATIONS, themedIconFor, skillUsage } from './lib/skills'
import { useRoutePath, parseRoute, navigate, link, projectPath, HOME_PATH, PROJECTS_PATH, LIBRARY_PATH, CV_PATH } from './lib/router'
import { jumpToSection } from './lib/palette'
import { CV_ROLE } from './lib/cv'
import { Icon } from './components/icon'
import { applyHead } from './lib/seo'
import { recordHit } from './lib/api'
import { rememberVisit } from './lib/recent'

const routePage = (Static, loader) => (import.meta.env.SSR ? Static : lazy(loader))

const ProjectsPage = routePage(ProjectsPageImpl, () => import('#client-page/projects'))
const LibraryPage = routePage(LibraryPageImpl, () => import('#client-page/library'))
const ReviewsPage = routePage(ReviewsPageImpl, () => import('#client-page/reviews'))
const NowPage = routePage(NowPageImpl, () => import('#client-page/now'))
const UsesPage = routePage(UsesPageImpl, () => import('#client-page/uses'))
const CvPage = routePage(CvPageImpl, () => import('#client-page/cv'))
const LoginPage = routePage(LoginPageImpl, () => import('#client-page/login'))
const DashboardPage = routePage(DashboardPageImpl, () => import('#client-page/dashboard'))
const PublicProfilePage = routePage(PublicProfilePageImpl, () => import('#client-page/public-profile'))
const NotFoundPage = routePage(NotFoundPageImpl, () => import('#client-page/not-found'))

const PageFallback = () => (
  <div
    className="flex min-h-screen items-center justify-center bg-bg text-ink"
    role="status"
    aria-busy="true"
  >
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-subtle" />
  </div>
)
import {
  GITHUB_USERNAME,
  GITHUB_JOINED,
  GITHUB_ACTIVE_SINCE,
  GITHUB_URL,
  CONTACT_EMAIL,
} from './lib/profile'

function App() {

  const path = useRoutePath()
  const route = parseRoute(path)
  const currentView = route.name


  const { theme, preference: themePreference, toggleTheme, setPreference: setThemePreference } = useTheme()
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

  const certifications = CERTIFICATIONS.map((cert) => ({ ...cert, tier: t(cert.tierKey) }))

  const themedIcon = themedIconFor(theme)

  // A skill links to the work that used it — the library search when it shows up there, else the featured project(s).
  const skillProof = (name) => {
    const { featured, library } = skillUsage(name)
    if (library) return { href: `${LIBRARY_PATH}?q=${encodeURIComponent(name)}`, count: library }
    if (featured.length) return { href: featured.length === 1 ? projectPath(featured[0]) : PROJECTS_PATH, count: featured.length }
    return null
  }
  const skillCategories = SKILL_CATEGORIES.map((category) => ({
    name: t(category.nameKey),
    items: category.items.map((item) => ({ ...item, icon: themedIcon(item.icon), proof: skillProof(item.name) }))
  }))

  const toolCategories = TOOL_CATEGORIES.map((category) => ({
    name: t(category.nameKey),
    wide: category.wide,
    items: category.items.map((item) => ({ ...item, icon: themedIcon(item.icon) }))
  }))

  const toolboxPreview = ['Git', 'Figma', 'VS Code', 'macOS']
    .map((name) => toolCategories.flatMap((category) => category.items).find((item) => item.name === name))
    .filter(Boolean)
  const toolboxCount = toolCategories.reduce((total, category) => total + category.items.length, 0)

  const navItemClass = 'h-9 w-9 flex items-center justify-center hover:text-ink-strong focus-visible:text-ink-strong aria-expanded:text-ink-strong transition-colors duration-200'
  const navLinkClass = 'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30'

  const navDivider = 'mx-1 h-full border-l border-dashed border-line'

  // The primary nav. Text links from md up; below that the same list lives at the top of the ⋯ menu.
  const sectionLink = (id) => ({ href: `#${id}`, onClick: (event) => { event.preventDefault(); jumpToSection(id) } })
  const navLinks = [
    { id: 'projects', label: t('home.projects'), ...sectionLink('projects') },
    { id: 'about', label: t('nav.about'), ...sectionLink('skills') },
    { id: 'contact', label: t('home.contact'), ...sectionLink('contact') },
  ]

  if (currentView === 'notFound') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <NotFoundPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'projects') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <ProjectsPage
            onBack={() => navigate(HOME_PATH)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'library') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <LibraryPage
            openItemId={route.itemId}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'reviews') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <ReviewsPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'now') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <NowPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'uses') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <UsesPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'cv') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <CvPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'login') {
    return (
      <Suspense fallback={<PageFallback />}>
        <LoginPage theme={theme} onToggleTheme={toggleTheme} />
      </Suspense>
    )
  }

  if (currentView === 'profile') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <PublicProfilePage handle={route.handle} theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'dashboard') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <DashboardPage theme={theme} themePreference={themePreference} onToggleTheme={toggleTheme} onSetTheme={setThemePreference} />
        </Suspense>
        {palette}
      </>
    )
  }

  return (
    <div className={`min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-clip antialiased font-sans ${isReturningHome ? '' : 'animate-view-in'}`}>

      <header
        id="main-header"
        className="w-full max-w-[960px] bg-bg backdrop-blur-none md:bg-bg/90 md:backdrop-blur-md text-ink h-[60px] fixed top-0 left-1/2 -translate-x-1/2 z-50 border-b border-l border-dashed border-r border-line transition-[border-color] duration-200"
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
            <div className="hidden md:flex items-center gap-0.5 mr-1">
              {navLinks.map(({ id, label, external, ...props }) => (
                <a key={id} {...props} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className={navLinkClass}>
                  {label}
                  {external && <Icon name="arrowUpRight" className="h-3 w-3 text-ink-faint" />}
                </a>
              ))}
            </div>

            <span aria-hidden="true" className={`${navDivider} hidden md:block`} />

            <ThemeToggle theme={theme} onToggle={toggleTheme} className={navItemClass} />

            <span aria-hidden="true" className={navDivider} />

            <NavMenu itemClass={navItemClass} pages={navLinks} />
          </nav>
        </div>
      </header>

      {}
      <main className={`w-full max-w-[960px] mx-auto px-6 pt-24 pb-6 flex flex-col items-start border-l border-dashed border-r border-line min-h-screen bg-bg ${isReturningHome ? '' : 'animate-rise-in'}`}>

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
          <h1 className="hero-title font-bagus text-[36px] sm:text-[44px] font-normal tracking-[-0.02em] leading-none mb-3 animate-fade-in-up">
            Blxr
          </h1>

          {}
          <p className="max-w-[56ch] text-[15px] text-ink-muted leading-[1.6] animate-fade-in-up delay-150">
            {t(CV_ROLE.key, null, CV_ROLE.fallback)}
          </p>

          {}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink-subtle animate-fade-in-up delay-300">
            <Icon name="pin" className="h-3.5 w-3.5" />
            {t('hero.location')}
          </p>

          {}
          <div className="mt-7 flex items-center gap-2.5 animate-fade-in-up delay-450">
            <a
              {...link(PROJECTS_PATH, () => openProject(null))}
              className="project-cta group inline-flex h-10 items-center gap-2 rounded-full bg-surface-inverted pl-5 pr-4 text-[13px] font-medium text-ink-on-inverted outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              <span>{t('home.projects')}</span>
              <span className="project-arrow inline-block" aria-hidden="true">→</span>
            </a>
            <a
              {...link(CV_PATH)}
              className="inline-flex h-10 items-center rounded-full border border-line px-5 text-[13px] font-medium text-ink outline-none transition-colors duration-200 hover:border-line-strong hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              {t('cv.title')}
            </a>
          </div>

          <div className="w-full mt-8">
            <GitHubContributions
              username={GITHUB_USERNAME} since={GITHUB_JOINED}
              activeSince={GITHUB_ACTIVE_SINCE} minimal
            />
          </div>
        </section>

        <section id="projects" className="scroll-mt-8 w-full mt-14">

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
              data-paused={autoplayEnabled ? undefined : ''}
              style={{ '--reveal-delay': '90ms', '--autoplay': `${AUTOPLAY_MS}ms` }}
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
                            {...imageProps(project.image, '(min-width: 960px) 404px, (min-width: 640px) 45vw, calc(100vw - 48px)')}
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

        <section id="skills" className="scroll-mt-8 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] text-ink-strong tracking-tight mb-8 font-bagus">
            {t('home.skills')}
          </h2>

          <div className="flex flex-col gap-5 w-full text-[14px]">
            {skillCategories.map((category, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-2 sm:gap-6 w-full"
              >
                <span className="text-ink-subtle font-medium select-none">
                  {category.name}
                </span>

                <div className="flex flex-wrap gap-x-5 gap-y-3">
                  {category.items.map((skill) => {
                    const Chip = skill.proof ? 'a' : 'span'
                    const chipProps = skill.proof
                      ? { ...link(skill.proof.href), title: t('skills.usedIn', { n: skill.proof.count }), 'aria-label': `${skill.name} — ${t('skills.usedIn', { n: skill.proof.count })}` }
                      : {}
                    return (
                      <Chip
                        key={skill.name}
                        {...chipProps}
                        className={`group/chip inline-flex items-center gap-2 text-ink-muted text-[12.5px] font-medium outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong ${
                          skill.proof ? 'cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-4 focus-visible:ring-offset-bg' : 'cursor-default'
                        }`}
                      >
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
                      </Chip>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <details ref={toolboxRef} className="toolbox group/more relative z-30 mt-5 border-t border-dashed border-line pt-3.5">
            <summary className="-mx-2 grid min-h-10 w-[calc(100%+1rem)] grid-cols-1 items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 list-none cursor-pointer outline-none transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-line hover:bg-surface-hover/60 active:scale-[0.995] focus-visible:border-line-strong focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:grid-cols-[7.5rem_1fr] sm:gap-6 motion-reduce:transition-none motion-reduce:active:scale-100 [&::-webkit-details-marker]:hidden">
              <span className="text-ink-subtle font-medium select-none transition-colors duration-200 group-hover/more:text-ink-secondary group-open/more:text-ink-secondary">
                {t('home.toolbox')}
              </span>

              <span className="inline-flex min-w-0 items-center gap-2.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 group-hover/more:text-ink-strong group-open/more:text-ink-strong">
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

        <section id="education" className="scroll-mt-8 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
          <h2 className="text-[20px] text-ink-strong tracking-tight mb-8 font-bagus">
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

        <Testimonials />

        <ContactSection />

        <footer className="w-[calc(100%+3rem)] -mx-6 mt-16 flex flex-col gap-3 border-t border-dashed border-line px-6 py-6 text-[12px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium text-ink-strong">Blxr</span>
            <span aria-hidden="true" className="mx-2 text-ink-faint">·</span>
            {t('hero.location')}
          </p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="transition-colors duration-200 hover:text-ink-strong">GitHub</a>
            <a {...link(CV_PATH)} className="transition-colors duration-200 hover:text-ink-strong">{t('cv.title')}</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition-colors duration-200 hover:text-ink-strong">{t('contact.email.kicker')}</a>
          </nav>
        </footer>

      </main>

      {palette}

    </div>
  )
}

export default App
