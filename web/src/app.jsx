import { useState, useEffect, useRef, useLayoutEffect, lazy, Suspense } from 'react'

import ProjectsPageImpl from '#ssr-page/projects'
import LibraryPageImpl from '#ssr-page/library'
import BlogPageImpl from '#ssr-page/blog'
import ReviewsPageImpl from '#ssr-page/reviews'
import UsesPageImpl from '#ssr-page/uses'
import CvPageImpl from '#ssr-page/cv'
import SecurityPageImpl from '#ssr-page/security'
import IbPageImpl from '#ssr-page/ib'
import ListeningPageImpl from '#ssr-page/listening'
import ContactPageImpl from '#ssr-page/contact'
import PaymentPageImpl from '#ssr-page/payment'
import LinksPageImpl from '#ssr-page/links'
import VolunteerPageImpl from '#ssr-page/volunteer'
import GalleryPageImpl from '#ssr-page/gallery'
import TerminalPageImpl from '#ssr-page/terminal'
import LoginPageImpl from '#ssr-page/login'
import DashboardPageImpl from '#ssr-page/dashboard'
import PublicProfilePageImpl from '#ssr-page/public-profile'
import NotFoundPageImpl from '#ssr-page/not-found'
import ThemeToggle from './components/theme-toggle'
import CommandPaletteHost from './components/command-palette-host'
import NavMenu from './components/nav-menu'
import StudioFact from './components/studio-fact'
import ScrambleText from './components/scramble-text'
import LandingMemes from './components/landing-memes'
import LiveSelect from './components/live-select'
import { Facepile, CommentPin, Inspect, FrameLabel, CanvasLayer } from './components/figma'
import SiteFooter from './components/site-footer'
import StripeBand from './components/stripe-band'
import BottomBlur from './components/bottom-blur'
import { CommandButton } from './components/command-button'
import { trackPageVisit } from './lib/memes'
import { useTheme } from './lib/use-theme'
import { imageProps, SIZES } from './lib/images'
import { SKILL_CATEGORIES, themedIconFor } from './lib/skills'
import { useRoutePath, parseRoute, navigate, link, HOME_PATH, PROJECTS_PATH, LIBRARY_PATH, CV_PATH, CONTACT_PATH } from './lib/router'
import { jumpToSection } from './lib/palette'
import { Icon } from './components/icon'
import { Loading } from './components/skeleton'
import { applyHead } from './lib/seo'
import { recordHit } from './lib/api'
import { loadSupabase } from './lib/supabase'
import { rememberVisit } from './lib/recent'

const routePage = (Static, loader) => (import.meta.env.SSR ? Static : lazy(loader))

const ProjectsPage = routePage(ProjectsPageImpl, () => import('#client-page/projects'))
const LibraryPage = routePage(LibraryPageImpl, () => import('#client-page/library'))
const BlogPage = routePage(BlogPageImpl, () => import('#client-page/blog'))
const ReviewsPage = routePage(ReviewsPageImpl, () => import('#client-page/reviews'))
const UsesPage = routePage(UsesPageImpl, () => import('#client-page/uses'))
const CvPage = routePage(CvPageImpl, () => import('#client-page/cv'))
const SecurityPage = routePage(SecurityPageImpl, () => import('#client-page/security'))
const IbPage = routePage(IbPageImpl, () => import('#client-page/ib'))
const ListeningPage = routePage(ListeningPageImpl, () => import('#client-page/listening'))
const ContactPage = routePage(ContactPageImpl, () => import('#client-page/contact'))
const PaymentPage = routePage(PaymentPageImpl, () => import('#client-page/payment'))
const LinksPage = routePage(LinksPageImpl, () => import('#client-page/links'))
const TerminalPage = routePage(TerminalPageImpl, () => import('#client-page/terminal'))
const withSupabase = (loader) => () => Promise.all([loader(), loadSupabase()]).then(([page]) => page)
const LoginPage = routePage(LoginPageImpl, withSupabase(() => import('#client-page/login')))
const DashboardPage = routePage(DashboardPageImpl, withSupabase(() => import('#client-page/dashboard')))
const VolunteerPage = routePage(VolunteerPageImpl, withSupabase(() => import('#client-page/volunteer')))
const GalleryPage = routePage(GalleryPageImpl, withSupabase(() => import('#client-page/gallery')))
const PublicProfilePage = routePage(PublicProfilePageImpl, withSupabase(() => import('#client-page/public-profile')))
const NotFoundPage = routePage(NotFoundPageImpl, () => import('#client-page/not-found'))

const PageFallback = () => <Loading label="Loading the page" />

const CommentLayerImpl = lazy(() => import('./components/comments'))
function CommentLayer() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <Suspense fallback={null}><CommentLayerImpl /></Suspense> : null
}

function SkillTile({ skill, featured }) {
  const Tile = skill.url ? 'a' : 'span'
  const tileProps = skill.url
    ? { href: skill.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${skill.name} — official site (opens in a new tab)` }
    : { role: 'img', 'aria-label': skill.name }
  const size = featured ? 44 : 26

  return (
    <Tile
      {...tileProps}
      title={skill.name}
      className={`skill-cell relative flex h-full flex-col items-center justify-center gap-2.5 outline-none transition-[background-color,opacity] duration-300 hover:bg-surface-hover/50 active:bg-surface-hover/50 focus-visible:bg-surface-hover/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/50 motion-reduce:transition-none sm:gap-0 ${featured ? 'py-9 sm:py-20' : 'py-6 sm:py-10'}`}
    >
      <img
        {...imageProps(skill.icon)}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={`skill-logo object-contain ${featured ? 'h-9 w-9 sm:h-11 sm:w-11' : 'h-6 w-6 sm:h-6.5 sm:w-6.5'}`}
      />
      <span aria-hidden="true" className="skill-name max-w-full truncate px-1 font-mono text-[10.5px] text-ink-subtle">
        {skill.name}
      </span>
    </Tile>
  )
}

function App() {

  const path = useRoutePath()
  const route = parseRoute(path)
  const currentView = route.name


  const { theme, preference: themePreference, toggleTheme, setPreference: setThemePreference } = useTheme()

  const homeScrollRef = useRef(0)

  const hasLeftHomeRef = useRef(false)
  const [skillsOpen, setSkillsOpen] = useState(false)

  const openProjects = () => {
    homeScrollRef.current = window.scrollY
    hasLeftHomeRef.current = true
    navigate(PROJECTS_PATH)
  }

  useLayoutEffect(() => {
    if (currentView !== 'home' || !hasLeftHomeRef.current) return
    window.scrollTo(0, homeScrollRef.current)
  }, [currentView, path])

  useEffect(() => {
    applyHead(path)
  }, [path])

  useEffect(() => {
    if (route.redirect) navigate(route.redirect, { replace: true })
  }, [route.redirect])

  useEffect(() => {
    recordHit(path)

    rememberVisit(path)
  }, [path])

  useEffect(() => trackPageVisit(currentView), [currentView])

  const isReturningHome = hasLeftHomeRef.current

  const palette = (
    <>
      <CommandPaletteHost theme={theme} onToggleTheme={toggleTheme} />
      <CommentLayer />
    </>
  )

  const listSentence = (items) => {
    const words = items.map((item) => item.toLowerCase())
    if (words.length < 2) return words.join('')
    return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
  }

  const educationEntries = [
    {
      period: `2025 – Present`,
      degree: 'International Baccalaureate Diploma Programme (IBDP)',
      org: 'Athens',
      description: 'A two year diploma with as much independent research and writing in it as actual coursework. My subjects lean heavily into computer science: how systems are put together underneath the frameworks, and why they were built that way. Most of what I build outside school started with something I picked up here.',
      subjects: [
        'Software Engineering',
        'Computer Systems',
        'Data Structures & Algorithms',
        'Databases',
        'Web / Software Development Concepts'
      ]
    }
  ]

  const themedIcon = themedIconFor(theme)

  const skillCategories = SKILL_CATEGORIES.map((category) => ({
    name: category.name,
    minor: category.minor,
    items: category.items.map((item) => ({ ...item, icon: themedIcon(item.icon) }))
  }))

  const stackSkills = skillCategories.filter((category) => !category.minor).flatMap((category) => category.items)
  const featuredSkills = stackSkills.filter((skill) => skill.featured)
  const otherSkills = stackSkills.filter((skill) => !skill.featured)

  const navItemClass = 'h-9 w-9 flex items-center justify-center hover:text-ink-strong focus-visible:text-ink-strong aria-expanded:text-ink-strong transition-colors duration-200'
  const navLinkClass = 'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30'

  const navDivider = 'mx-1 h-full border-l border-dashed border-line'

  const sectionLink = (id) => ({ href: `#${id}`, onClick: (event) => { event.preventDefault(); jumpToSection(id) } })
  const navLinks = [
    { id: 'projects', label: 'Projects', ...link(PROJECTS_PATH, openProjects) },
    { id: 'about', label: 'About', ...sectionLink('skills') },
    { id: 'contact', label: 'Contact', ...link(CONTACT_PATH) },
  ]

  if (currentView === 'loading') {
    return <Loading label="Loading" persist />
  }

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

  if (currentView === 'blog') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <BlogPage slug={route.slug} theme={theme} onToggleTheme={toggleTheme} />
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

  if (currentView === 'security') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <SecurityPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'ib') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <IbPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'listening') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <ListeningPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'contact') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <ContactPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'payment') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <PaymentPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'links') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <LinksPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'terminal') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <TerminalPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'volunteer') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <VolunteerPage theme={theme} onToggleTheme={toggleTheme} />
        </Suspense>
        {palette}
      </>
    )
  }

  if (currentView === 'gallery') {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <GalleryPage theme={theme} onToggleTheme={toggleTheme} />
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
    <div className={`min-h-screen bg-bg text-ink flex flex-col selection:bg-[#0d99ff]/30 selection:text-ink-strong relative overflow-x-clip antialiased font-sans ${isReturningHome ? '' : 'animate-view-in'}`}>

      <header
        id="main-header"
        className="w-full max-w-[960px] bg-bg backdrop-blur-none md:bg-bg/90 md:backdrop-blur-md text-ink h-[60px] fixed top-0 left-1/2 -translate-x-1/2 z-50 frame-bleed-b border-b border-l border-dashed border-r border-line transition-[border-color] duration-200"
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
            <Facepile name="Kostis" />

            <span aria-hidden="true" className={`${navDivider} hidden md:block`} />

            <div className="hidden md:flex items-center gap-0.5 mx-1">
              {navLinks.map(({ id, label, external, ...props }) => (
                <a key={id} {...props} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className={navLinkClass}>
                  {label}
                  {external && <Icon name="arrowUpRight" className="h-3 w-3 text-ink-faint" />}
                </a>
              ))}
            </div>

            <span aria-hidden="true" className={`${navDivider} hidden md:block`} />

            <CommandButton className="hidden md:inline-flex h-9 items-center gap-2 rounded-md px-2 outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30" />

            <span aria-hidden="true" className={`${navDivider} hidden md:block`} />

            <ThemeToggle theme={theme} onToggle={toggleTheme} className={navItemClass} />

            <span aria-hidden="true" className={navDivider} />

            <NavMenu itemClass={navItemClass} pages={navLinks} />
          </nav>
        </div>
      </header>

      {}
      <main className={`w-full max-w-[960px] mx-auto px-6 pt-24 pb-6 flex flex-col items-start border-l border-dashed border-r border-line min-h-screen bg-bg ${isReturningHome ? '' : 'animate-rise-in'}`}>

        <section id="intro" className="relative flex flex-col items-start text-left w-[calc(100%+3rem)] border-b border-dashed border-line -mx-6 px-6 pb-12">
          <FrameLabel className="left-6 -top-7">Intro</FrameLabel>

          <div className="mb-6 flex w-full items-start justify-between gap-4">
            {}
            <Inspect size="64 × 64">
              <img

                {...imageProps('/pfp.webp', SIZES.avatar)}
                alt="Blxr avatar"
                width="64"
                height="64"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                className="w-[64px] h-[64px] rounded-[18px] object-cover select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"
              />
            </Inspect>

            <a
              {...link(PROJECTS_PATH, openProjects)}
              data-component="Button / Secondary"
              className="project-cta group inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-surface pl-3 pr-2.5 text-[12.5px] font-medium text-ink-strong outline-none hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              <span>Go to projects</span>
              <span className="project-arrow inline-block" aria-hidden="true">→</span>
            </a>
          </div>

          {}
          <h1 className="hero-title font-bagus text-[36px] sm:text-[44px] font-normal tracking-[-0.02em] leading-none mb-3 animate-fade-in-up">
            <ScrambleText text="Blxr" alt="Kostis" />
          </h1>

          {}
          <p className="max-w-[54ch] text-[15px] text-ink-muted leading-[1.6] animate-fade-in-up delay-150">
            I'm Kostis. I build <LiveSelect name="Kostis">the whole thing</LiveSelect>: the backend, the interface on top of it, and the Linux box it ships to.
            Most of it so far has been security tooling and Detectors, plus client work through a studio I run.
          </p>

          {}
          <dl className="mt-6 flex flex-col gap-2.5 text-[13.5px] leading-[1.55] animate-fade-in-up delay-300">
            {[
              { key: 'now', label: 'Currently', value: 'Final year of the IB Diploma in Athens, so most of this gets built after school' },
              { key: 'stack', label: 'Mostly', value: 'I build modern web experiences with JavaScript, React, Next.js, Node.js, Express.js, Python, Tailwind, and Bootstrap.' },
              { key: 'studio', label: 'Studio', value: 'Not a house, but a home <3', live: true }
            ].map((fact) => (
              <div key={fact.key} className="grid grid-cols-[5.5rem_1fr] gap-x-4 items-baseline">
                <dt className="text-[12px] font-watom text-ink-subtle">{fact.label}</dt>
                <dd className="text-ink-secondary">
                  {fact.href ? (
                    <a
                      {...link(fact.href, fact.onClick)}
                      className="group/fact inline-flex items-baseline gap-1 transition-colors duration-200 hover:text-ink-strong"
                    >
                      <span className="underline decoration-line underline-offset-4 transition-colors duration-200 group-hover/fact:decoration-line-strong">
                        {fact.value}
                      </span>
                      <Icon name="arrowUpRight" className="h-3 w-3 self-center text-ink-faint" />
                    </a>
                  ) : fact.live ? (
                    <StudioFact text={fact.value} />
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {}
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 animate-fade-in-up delay-450">
            <a
              {...link(PROJECTS_PATH, openProjects)}
              data-component="Button / Primary"
              className="project-cta group inline-flex h-10 items-center gap-2 rounded-[10px] bg-surface-inverted pl-4 pr-3.5 text-[13px] font-medium text-ink-on-inverted outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              <span>See the work</span>
              <span className="project-arrow inline-block" aria-hidden="true">→</span>
            </a>
            <a
              {...link(CV_PATH)}
              className="group inline-flex items-center gap-1.5 text-[13px] text-ink-muted outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong"
            >
              <span>
                or read{' '}
                <span className="underline decoration-line-strong decoration-wavy decoration-1 underline-offset-[5px] transition-[text-decoration-color] duration-200 group-hover:decoration-ink-muted group-focus-visible:decoration-ink-muted">the CV</span>
              </span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5">→</span>
            </a>
          </div>
        </section>

        <StripeBand className="-mx-6 w-[calc(100%+3rem)]" />

        <section id="skills" className="relative scroll-mt-8 w-[calc(100%+3rem)] -mx-6 px-6 pt-12 text-left">
          <FrameLabel className="left-6 top-4">About</FrameLabel>

          <h2 className="text-[20px] text-ink-strong tracking-tight mb-8 font-bagus">
            Background
          </h2>

          <div id="education" className="scroll-mt-8 flex flex-col">
            {educationEntries.map((entry, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-1 sm:gap-6 pb-8 text-left"
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

                  <p className="text-ink-muted text-[13px] leading-relaxed mt-1.5 max-w-xl">
                    {entry.description}
                  </p>

                  {entry.subjects?.length > 0 && (
                    <p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-ink-subtle">
                      The CS side covers {listSentence(entry.subjects)}.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center gap-2">
            <h3 className="flex items-baseline gap-2 text-[14px] font-medium text-ink-strong select-none">
              Stack
              <span className="font-mono text-[11px] font-normal tabular-nums text-ink-faint">{String(stackSkills.length).padStart(2, '0')}</span>
            </h3>
            <CommentPin name="Client" initial="C" text="Can you build ours on this?" time="2m" className="-my-2 -translate-y-2.5" />
          </div>

          <div className="-mx-6 w-[calc(100%+3rem)] border-y border-dashed border-line">
            <div className="skills-grid overflow-hidden">
              <ul className="-mr-px grid grid-cols-3 border-b border-line/70" aria-label="Main stack">
                {featuredSkills.map((skill) => (
                  <li key={skill.name} className="border-r border-line/70">
                    <SkillTile skill={skill} featured />
                  </li>
                ))}
              </ul>

              <ul
                className={`-mr-px grid grid-cols-[repeat(var(--cols-mobile),minmax(0,1fr))] sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] -mb-px`}
                style={{ '--cols': otherSkills.length, '--cols-mobile': Math.min(otherSkills.length, 4) }}
                aria-label="Also working with"
              >
                {otherSkills.map((skill) => (
                  <li key={skill.name} className="border-b border-r border-line/70">
                    <SkillTile skill={skill} />
                  </li>
                ))}
              </ul>
            </div>

            <div id="skills-all" className="skills-all" data-open={skillsOpen ? '' : undefined}>
              <div inert={!skillsOpen}>
                <div className="flex flex-col gap-7 border-t border-dashed border-line px-6 pt-7 pb-12 sm:gap-8 sm:pt-9 sm:pb-14">
                  {skillCategories.map((category, idx) => (
                    <div key={category.name} className="grid grid-cols-1 gap-2 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
                      {!category.minor && (
                      <h4
                        className="skills-all-item font-mono text-[12px] text-ink-subtle select-none sm:pt-3.5"
                        style={{ '--delay': `${60 + idx * 60}ms` }}
                      >
                        {category.name}
                      </h4>
                      )}

                      {category.minor ? (
                      <ul
                        className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-dashed border-line pt-5 sm:col-start-2"
                        aria-label={category.name}
                      >
                        {category.items.map((skill, itemIdx) => {
                          const Item = skill.url ? 'a' : 'span'
                          return (
                            <li
                              key={skill.name}
                              className="skills-all-item"
                              style={{ '--delay': `${90 + idx * 60 + itemIdx * 35}ms` }}
                            >
                              <Item
                                {...(skill.url ? { href: skill.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                title={skill.desc}
                                className="tool-tile inline-flex items-center gap-1.5 rounded text-[12px] text-ink-subtle outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/50 motion-reduce:transition-none"
                              >
                                <img
                                  {...imageProps(skill.icon)}
                                  alt=""
                                  aria-hidden="true"
                                  width="14"
                                  height="14"
                                  loading="lazy"
                                  decoding="async"
                                  className="skill-logo h-3.5 w-3.5 object-contain"
                                />
                                {skill.name}
                              </Item>
                            </li>
                          )
                        })}
                      </ul>
                      ) : (
                      <ul className="-mx-2 grid grid-cols-1 md:grid-cols-2 md:gap-x-2">
                        {category.items.map((skill, itemIdx) => {
                          const Row = skill.url ? 'a' : 'span'
                          return (
                            <li
                              key={skill.name}
                              className="skills-all-item"
                              style={{ '--delay': `${90 + idx * 60 + itemIdx * 35}ms` }}
                            >
                              <Row
                                {...(skill.url ? { href: skill.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                className="group/item flex items-center gap-3 rounded-xl p-2 outline-none transition-colors duration-200 hover:bg-surface-hover active:bg-surface-hover focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/50 motion-reduce:transition-none"
                              >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-raised transition-colors duration-200 group-hover/item:border-line-strong motion-reduce:transition-none">
                                  <img
                                    {...imageProps(skill.icon)}
                                    alt=""
                                    aria-hidden="true"
                                    width="18"
                                    height="18"
                                    loading="lazy"
                                    decoding="async"
                                    className="h-4.5 w-4.5 object-contain"
                                  />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1 text-[13px] font-medium text-ink-strong">
                                    {skill.name}
                                    {skill.url && (
                                      <svg
                                        viewBox="0 0 16 16"
                                        aria-hidden="true"
                                        className="h-3 w-3 -translate-x-1 text-ink-subtle opacity-0 transition-[opacity,transform] duration-200 group-hover/item:translate-x-0 group-hover/item:opacity-100 group-focus-visible/item:translate-x-0 group-focus-visible/item:opacity-100 motion-reduce:transition-none"
                                      >
                                        <path d="M5.5 10.5 10.5 5.5M6 5.5h4.5V10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-subtle sm:truncate">{skill.desc}</span>
                                </span>
                              </Row>
                            </li>
                          )
                        })}
                      </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 -mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setSkillsOpen((open) => !open)}
              aria-expanded={skillsOpen}
              aria-controls="skills-all"
              className="skills-toggle inline-flex h-10 items-center gap-3 rounded-full border border-line bg-bg pl-1.5 pr-1.5 text-[12.5px] font-medium text-ink-muted shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)] outline-none transition-[color,border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink-strong focus-visible:border-line-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg aria-expanded:text-ink-strong motion-reduce:transition-none"
            >
              <span className="flex" aria-hidden="true">
                {featuredSkills.map((skill) => (
                  <span
                    key={skill.name}
                    className="skills-toggle-chip flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-raised"
                  >
                    <img
                      {...imageProps(skill.icon)}
                      alt=""
                      width="14"
                      height="14"
                      loading="lazy"
                      decoding="async"
                      className="skill-logo h-3.5 w-3.5 object-contain"
                    />
                  </span>
                ))}
              </span>
              <span className="skills-toggle-label">
                <span aria-hidden={skillsOpen}>View all skills</span>
                <span aria-hidden={!skillsOpen}>Show less</span>
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-ink-strong" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
                  <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path className="skills-toggle-plus" d="M8 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          </div>
        </section>

        <SiteFooter id="site-footer" showGrid stripe className="w-[calc(100%+3rem)] -mx-6 -mb-6 mt-16" />

      </main>

      <BottomBlur />

      <CanvasLayer />

      <LandingMemes />

      {palette}

    </div>
  )
}

export default App
