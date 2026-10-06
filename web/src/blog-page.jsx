import { Suspense, use, useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Bone } from './components/skeleton'
import { link, navigate, blogPath, BLOG_PATH, BLOG_FEED_PATH, HOME_PATH } from './lib/router'
import { postsList, findPost, adjacentPosts, blogTags, formatPostDate, formatPostDay, postsByYear, matchesPost } from './lib/blog'
import { imageProps, SIZES } from './lib/images'
import { isTyping } from './components/figma'
import { loadPostBody } from '#blog-bodies'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const READ_LINE = 0.35
const NO_TOC = []

function usePostBody(slug) {
  const body = loadPostBody(slug)
  return body && typeof body.then === 'function' ? use(body) : body
}

const prefetch = (slug) => {
  if (typeof window !== 'undefined') loadPostBody(slug)
}

function useOnScroll(fn, deps) {
  const latest = useRef(fn)
  latest.current = fn

  useEffect(() => {
    let raf = 0
    const run = () => {
      raf = 0
      latest.current()
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(run)
    }
    run()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, deps)
}

function readProgress(el) {
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  const span = rect.height - window.innerHeight
  return span <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / span))
}

const countWords = (text) => text.split(/\s+/).filter(Boolean).length

function scrollToHeading(e, id) {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(null, '', `#${id}`)
}

function Header({ post, theme, onToggleTheme }) {
  return (
    <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
      <div className="relative w-full flex items-center justify-between">
        <span aria-hidden="true" className="blog-crumb hidden md:block">
          ~/blog/{post && <span className="text-ink-muted">{post.slug}.md</span>}
        </span>
        <a
          {...link(post ? BLOG_PATH : HOME_PATH)}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
        >
          <span>←</span>
          <span>{post ? 'All posts' : 'Back to Home'}</span>
        </a>
        <div className="flex items-center gap-4">
          <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="text-ink-muted hover:text-ink-strong transition-colors duration-200" />
        </div>
      </div>
    </header>
  )
}

function Draft({ post }) {
  if (!post.draft) return null
  return <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-wider text-amber-400">draft</span>
}

function Highlight({ text, query }) {
  const q = query.trim().toLowerCase()
  const at = q ? text.toLowerCase().indexOf(q) : -1
  if (at === -1) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="blog-match">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

function Tagline({ text }) {
  const line = `// ${text}`
  return (
    <p className="text-[12.5px] sm:text-[13px] font-mono text-ink-muted">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="blog-type" style={{ '--n': line.length }}>
        <span className="text-ink-faint">// </span>
        {text}
      </span>
    </p>
  )
}

function BlogIndex() {
  const [tag, setTag] = useState(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)
  const listRef = useRef(null)
  const activeRef = useRef(null)
  activeRef.current = active

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tag')
    if (fromUrl && blogTags.includes(fromUrl)) setTag(fromUrl)
  }, [])

  const pick = (next) => {
    setTag(next)
    setActive(null)
    window.history.replaceState(null, '', next ? `${BLOG_PATH}?tag=${encodeURIComponent(next)}` : BLOG_PATH)
  }

  const posts = postsList.filter((post) => matchesPost(post, query, tag))
  const current = active !== null && active < posts.length ? active : null

  const rows = () => [...(listRef.current?.querySelectorAll('a[data-row]') ?? [])]
  const jump = (i) => rows()[i]?.focus()

  useEffect(() => {
    let lastG = 0
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const count = rows().length
      if (!count) return
      const at = activeRef.current
      let next = null
      if (e.key === 'j') next = at === null ? 0 : Math.min(count - 1, at + 1)
      else if (e.key === 'k') next = at === null ? count - 1 : Math.max(0, at - 1)
      else if (e.key === 'G') next = count - 1
      else if (e.key === 'g') {
        if (e.timeStamp - lastG < 450) next = 0
        lastG = e.timeStamp
      }
      if (next === null) return
      e.preventDefault()
      jump(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSearchKey = (e) => {
    if (e.key === 'Enter' && posts.length) {
      e.preventDefault()
      navigate(blogPath(posts[current ?? 0].slug))
    } else if (e.key === 'ArrowDown' && posts.length) {
      e.preventDefault()
      jump(0)
    } else if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }

  const select = (i, slug) => {
    setActive(i)
    prefetch(slug)
  }

  let n = 0

  return (
    <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen animate-rise-in">
      <div className="w-full max-w-[600px]">
        <header className="mb-12">
          <h1 className="relative text-[32px] sm:text-[36px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-3">
            <span aria-hidden="true" className="blog-hash hidden md:block">#</span>
            Blog
          </h1>
          <Tagline text="Notes on what I build, break and learn." />
        </header>

        {postsList.length === 0 ? (
          <p className="font-mono text-[12.5px] text-ink-subtle">Nothing here yet.</p>
        ) : (
          <>
            <div className="mb-10">
              <label className="blog-grep">
                <span aria-hidden="true">$ grep</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(null)
                  }}
                  onKeyDown={onSearchKey}
                  placeholder="search"
                  aria-label="Search posts"
                  spellCheck={false}
                  autoComplete="off"
                />
                <span aria-hidden="true" className="tabular-nums">
                  {posts.length}/{postsList.length}
                </span>
              </label>
              {blogTags.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                  {[null, ...blogTags].map((t) => (
                    <button
                      key={t ?? 'all'}
                      type="button"
                      onClick={() => pick(t)}
                      aria-pressed={tag === t}
                      className={`cursor-pointer transition-colors duration-200 ${tag === t ? 'text-ink-strong' : 'text-ink-subtle hover:text-ink-secondary'}`}
                    >
                      {t ? `#${t}` : 'All'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div ref={listRef}>
              {postsByYear(posts).map((group) => (
                <section key={group.year} className="mb-10">
                  <h2 className={`${KICKER} mb-3 flex items-center gap-3`}>
                    {group.year}
                    <span aria-hidden="true" className="h-px flex-1 bg-line" />
                  </h2>
                  <ol className="flex flex-col gap-1">
                    {group.posts.map((post) => {
                      const i = n++
                      return (
                        <li key={post.slug}>
                          <a
                            {...link(blogPath(post.slug))}
                            data-row=""
                            data-active={current === i ? '' : undefined}
                            onPointerEnter={() => select(i, post.slug)}
                            onFocus={() => select(i, post.slug)}
                            className="blog-row"
                          >
                            <time dateTime={post.date} className="w-14 shrink-0 font-mono text-[11.5px] text-ink-faint tabular-nums">
                              {formatPostDay(post.date)}
                            </time>
                            <span className="min-w-0 flex-1">
                              <span className="blog-row-title block text-[15px] font-medium text-ink-secondary transition-colors duration-200">
                                <Highlight text={post.title} query={query} />
                                <Draft post={post} />
                              </span>
                              <span className="mt-1.5 block text-[13.5px] text-ink-subtle leading-relaxed">{post.description}</span>
                            </span>
                          </a>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
            </div>

            {posts.length === 0 && (
              <p className="mb-10 font-mono text-[12.5px] text-ink-subtle">
                no match for “{query.trim() || `#${tag}`}”
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    pick(null)
                  }}
                  className="ml-3 cursor-pointer text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink-strong"
                >
                  clear
                </button>
              </p>
            )}

            <a href={BLOG_FEED_PATH} className="font-mono text-[11.5px] text-ink-faint hover:text-ink-strong transition-colors duration-200">
              rss ↗
            </a>
          </>
        )}
      </div>
    </main>
  )
}

function PostBody({ post, focus }) {
  const body = usePostBody(post.slug)

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [])

  const onClick = (e) => {
    const copy = e.target.closest('[data-copy]')
    if (copy) {
      const code = copy.closest('figure')?.querySelector('pre')?.innerText ?? ''
      if (!navigator.clipboard) return
      navigator.clipboard.writeText(code).then(
        () => {
          copy.textContent = 'Copied'
          setTimeout(() => {
            copy.textContent = 'Copy'
          }, 1500)
        },
        () => {},
      )
      return
    }

    const anchor = e.target.closest('a[href]')
    if (!anchor || anchor.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    const href = anchor.getAttribute('href')
    if (href.startsWith('#')) {
      scrollToHeading(e, decodeURIComponent(href.slice(1)))
    } else if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault()
      navigate(href)
    }
  }

  if (!body) return null
  return (
    <div
      className="blog-prose"
      data-focus={focus ? '' : undefined}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: body.html }}
    />
  )
}

function Outline({ slug }) {
  const toc = usePostBody(slug)?.toc ?? NO_TOC
  const [active, setActive] = useState(null)

  useOnScroll(() => {
    let current = null
    for (const item of toc) {
      const el = document.getElementById(item.id)
      if (!el || el.getBoundingClientRect().top > window.innerHeight * READ_LINE) break
      current = item.id
    }
    setActive(current)
  }, [toc])

  if (toc.length < 2) return null
  return (
    <nav aria-label="Outline" className="blog-outline">
      <p className={`${KICKER} mb-3`}>Outline</p>
      <ol>
        {toc.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-depth={item.depth}
              aria-current={active === item.id ? 'location' : undefined}
              onClick={(e) => scrollToHeading(e, item.id)}
            >
              <span aria-hidden="true">{'#'.repeat(item.depth)}</span>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function StatusBar({ post, target, focus, onFocus }) {
  const [percent, setPercent] = useState(0)
  const [selected, setSelected] = useState(0)

  useOnScroll(() => setPercent(Math.round(readProgress(target.current) * 100)), [target])

  useEffect(() => {
    const onSelect = () => {
      const selection = document.getSelection()
      const inside = selection && !selection.isCollapsed && target.current?.contains(selection.anchorNode)
      setSelected(inside ? countWords(selection.toString()) : 0)
    }
    document.addEventListener('selectionchange', onSelect)
    return () => document.removeEventListener('selectionchange', onSelect)
  }, [target])

  return (
    <div className="blog-status">
      <span>{selected ? `${selected} of ${post.words.toLocaleString('en-US')} words` : `${post.words.toLocaleString('en-US')} words`}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{percent}%</span>
      <span aria-hidden="true">·</span>
      <button type="button" aria-pressed={focus} onClick={onFocus} title="Focus mode (F)">
        Focus
        <kbd>F</kbd>
      </button>
    </div>
  )
}

function useFocusMode(target) {
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setFocus((on) => !on)
      } else if (e.key === 'Escape') {
        setFocus(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useOnScroll(() => {
    const prose = focus && target.current?.querySelector('.blog-prose')
    if (!prose) return
    const line = window.innerHeight * READ_LINE
    let current = prose.firstElementChild
    for (const child of prose.children) {
      if (child.getBoundingClientRect().top > line) break
      current = child
    }
    for (const child of prose.children) child.toggleAttribute('data-current', child === current)
  }, [focus, target])

  return [focus, () => setFocus((on) => !on)]
}

function BodySkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading the post">
      {[100, 94, 86, 100, 70].map((w, i) => (
        <Bone key={i} className="h-4 rounded" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function BlogPost({ post }) {
  const { newer, older } = adjacentPosts(post.slug)
  const articleRef = useRef(null)
  const [focus, toggleFocus] = useFocusMode(articleRef)

  return (
    <>
      <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen animate-rise-in">
        <div className="w-full flex items-start gap-14">
          <article ref={articleRef} className="w-full max-w-[640px] min-w-0">
            <header className="mb-10">
              <p className={`${KICKER} mb-4`}>
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                <span aria-hidden="true"> · </span>
                {post.minutes} min read
              </p>
              <h1 className="text-[28px] sm:text-[32px] font-bold text-ink-strong tracking-[-0.03em] leading-tight">
                {post.title}
                <Draft post={post} />
              </h1>
              {post.tags.length > 0 && (
                <p className="mt-3 flex flex-wrap gap-x-3 text-[12.5px] text-ink-subtle">
                  {post.tags.map((t) => (
                    <a key={t} {...link(`${BLOG_PATH}?tag=${encodeURIComponent(t)}`)} className="hover:text-ink-strong transition-colors duration-200">
                      #{t}
                    </a>
                  ))}
                </p>
              )}
            </header>

            {post.cover && (
              <img
                {...imageProps(post.cover, SIZES.contentColumn)}
                alt=""
                fetchPriority="high"
                decoding="async"
                className="mb-10 w-full rounded-xl border border-line"
              />
            )}

            <Suspense fallback={<BodySkeleton />}>
              <PostBody post={post} focus={focus} />
            </Suspense>

            <footer className="mt-12 flex items-center gap-3 font-mono text-[11px] text-ink-faint">
              <span aria-hidden="true" className="tracking-[0.18em]">EOF</span>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
              {post.updated && (
                <span>
                  Updated <time dateTime={post.updated}>{formatPostDate(post.updated)}</time>
                </span>
              )}
            </footer>
          </article>

          <aside className="hidden lg:block w-48 shrink-0 sticky top-24">
            <Suspense fallback={null}>
              <Outline slug={post.slug} />
            </Suspense>
          </aside>
        </div>

        {(newer || older) && (
          <nav aria-label="More posts" className="mt-10 w-full max-w-[640px] flex justify-between gap-6 text-[13px]">
            {older ? (
              <a {...link(blogPath(older.slug))} onPointerEnter={() => prefetch(older.slug)} className="min-w-0 text-ink-muted hover:text-ink-strong transition-colors duration-200">
                ← {older.title}
              </a>
            ) : <span />}
            {newer && (
              <a {...link(blogPath(newer.slug))} onPointerEnter={() => prefetch(newer.slug)} className="min-w-0 text-right text-ink-muted hover:text-ink-strong transition-colors duration-200">
                {newer.title} →
              </a>
            )}
          </nav>
        )}
      </main>
      <StatusBar post={post} target={articleRef} focus={focus} onFocus={toggleFocus} />
    </>
  )
}

export default function BlogPage({ slug = null, theme, onToggleTheme }) {
  const post = slug ? findPost(slug) : null

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [slug])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-clip antialiased font-sans animate-view-in">
      <Header post={post} theme={theme} onToggleTheme={onToggleTheme} />
      {post ? <BlogPost key={post.slug} post={post} /> : <BlogIndex />}
    </div>
  )
}
