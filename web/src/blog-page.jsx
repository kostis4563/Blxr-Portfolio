import { Suspense, use, useEffect, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Bone } from './components/skeleton'
import { link, navigate, blogPath, BLOG_PATH, BLOG_FEED_PATH, HOME_PATH } from './lib/router'
import { postsList, findPost, adjacentPosts, blogTags, formatPostDate, formatPostDay, postsByYear, matchesPost } from './lib/blog'
import { imageProps, SIZES } from './lib/images'
import { loadPostBody } from '#blog-bodies'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

function usePostBody(slug) {
  const body = loadPostBody(slug)
  return body && typeof body.then === 'function' ? use(body) : body
}

const prefetch = (slug) => {
  if (typeof window !== 'undefined') loadPostBody(slug)
}

function Header({ post, theme, onToggleTheme }) {
  return (
    <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
      <div className="w-full flex items-center justify-between">
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

function BlogIndex() {
  const [tag, setTag] = useState(null)

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tag')
    if (fromUrl && blogTags.includes(fromUrl)) setTag(fromUrl)
  }, [])

  const pick = (next) => {
    setTag(next)
    window.history.replaceState(null, '', next ? `${BLOG_PATH}?tag=${encodeURIComponent(next)}` : BLOG_PATH)
  }

  const posts = postsList.filter((post) => matchesPost(post, '', tag))

  return (
    <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen animate-rise-in">
      <div className="w-full max-w-[620px] mb-12">
        <h1 className="text-[32px] sm:text-[36px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-3">Blog</h1>
        <p className="text-[15px] text-ink-muted leading-relaxed">Notes on what I build, break and learn.</p>
      </div>

      {postsList.length === 0 ? (
        <p className="text-[13.5px] text-ink-subtle">Nothing here yet.</p>
      ) : (
        <div className="w-full max-w-[640px]">
          {blogTags.length > 1 && (
            <div className="mb-8 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
              {[null, ...blogTags].map((t) => (
                <button
                  key={t ?? 'all'}
                  type="button"
                  onClick={() => pick(t)}
                  className={`cursor-pointer transition-colors duration-200 ${tag === t ? 'text-ink-strong' : 'text-ink-subtle hover:text-ink-secondary'}`}
                >
                  {t ? `#${t}` : 'All'}
                </button>
              ))}
            </div>
          )}

          {postsByYear(posts).map((group) => (
            <section key={group.year} className="mb-10">
              <h2 className={`${KICKER} mb-2`}>{group.year}</h2>
              <ol className="border-t border-line">
                {group.posts.map((post) => (
                  <li key={post.slug} className="border-b border-line">
                    <a
                      {...link(blogPath(post.slug))}
                      onPointerEnter={() => prefetch(post.slug)}
                      onFocus={() => prefetch(post.slug)}
                      className="group flex items-baseline gap-5 py-4"
                    >
                      <time dateTime={post.date} className="w-14 shrink-0 font-mono text-[11.5px] text-ink-subtle tabular-nums">
                        {formatPostDay(post.date)}
                      </time>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-ink-secondary group-hover:text-ink-strong transition-colors duration-200">
                          {post.title}
                          <Draft post={post} />
                        </span>
                        <span className="mt-1 block text-[13px] text-ink-subtle leading-relaxed line-clamp-1">{post.description}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <a href={BLOG_FEED_PATH} className="text-[12.5px] text-ink-subtle hover:text-ink-strong transition-colors duration-200">
            RSS
          </a>
        </div>
      )}
    </main>
  )
}

function PostBody({ post }) {
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
      e.preventDefault()
      const id = decodeURIComponent(href.slice(1))
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', href)
    } else if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault()
      navigate(href)
    }
  }

  if (!body) return null
  return <div className="blog-prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: body.html }} />
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

  return (
    <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen animate-rise-in">
      <article className="w-full max-w-[640px]">
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
          <PostBody post={post} />
        </Suspense>

        {post.updated && (
          <p className="mt-10 text-[12.5px] text-ink-subtle">
            Updated <time dateTime={post.updated}>{formatPostDate(post.updated)}</time>
          </p>
        )}
      </article>

      {(newer || older) && (
        <nav aria-label="More posts" className="mt-16 w-full max-w-[640px] border-t border-line pt-6 flex justify-between gap-6 text-[13px]">
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
  )
}

export default function BlogPage({ slug = null, theme, onToggleTheme }) {
  const post = slug ? findPost(slug) : null

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [slug])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <Header post={post} theme={theme} onToggleTheme={onToggleTheme} />
      {post ? <BlogPost key={post.slug} post={post} /> : <BlogIndex />}
    </div>
  )
}
