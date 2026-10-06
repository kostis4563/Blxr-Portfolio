import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Field, INPUT, LABEL, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, Segmented, Toggle, Modal } from './components/settings-ui'
import { Note, Empty, Tag, CARD } from './components/boards/ui'
import { navigate, dashboardPath, blogPath, link } from './lib/router'
import { formatPostDate } from './lib/blog'
import { parseFrontmatter, readMeta, renderMarkdown, serializePost, postSlugFor, SLUG_RE, DATE_RE } from './lib/blog-markdown'
import { listPosts, savePost, deletePost, deployState, prepareImage, errorText, BlogAdminError } from './lib/blog-admin'

const today = () => new Date().toISOString().slice(0, 10)
const DRAFT_KEY = (slug) => `blxr:blog:draft:${slug || 'new'}`
const POLL_MS = 8000
const POLL_FOR_MS = 20 * 60_000

function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
function writeStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
  }
}

function metaOf(post) {
  try {
    return readMeta(post.slug, post.source, `${post.slug}.md`).meta
  } catch (err) {
    return { slug: post.slug, title: post.slug, date: '', draft: false, broken: err.message }
  }
}

const sortPosts = (posts) => [...posts].sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || '') || a.meta.title.localeCompare(b.meta.title))
const withMeta = (post) => ({ ...post, meta: metaOf(post) })

export default function DashboardBlog({ hash }) {
  const sub = decodeURIComponent(hash.replace(/^#/, '').split('/')[1] || '')
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deploy, setDeploy] = useState(null)

  const load = useCallback(async (signal) => {
    setLoading(true)
    try {
      const data = await listPosts({ signal })
      setPosts(sortPosts(data.items.map(withMeta)))
      setError(null)
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const onSaved = useCallback((item, commit, verb) => {
    setPosts((list) => sortPosts([...(list || []).filter((p) => p.slug !== item.slug), withMeta(item)]))
    setDeploy({ sha: commit.sha, commitUrl: commit.url, label: `${verb} “${metaOf(item).title}”`, state: 'queued', runUrl: null, at: Date.now() })
  }, [])

  const onDeleted = useCallback((slug, commit) => {
    setPosts((list) => (list || []).filter((p) => p.slug !== slug))
    setDeploy({ sha: commit.sha, commitUrl: commit.url, label: `Deleted ${slug}`, state: 'queued', runUrl: null, at: Date.now() })
    navigate(dashboardPath('blog'), { replace: true })
  }, [])

  useDeployPolling(deploy, setDeploy)

  if (error && !posts) {
    return (
      <div className="flex flex-col gap-3">
        <Note tone="error">{errorText(error)}</Note>
        <div>
          <button type="button" className={BTN_SECONDARY} onClick={() => load()}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    )
  }
  if (!posts) return <ListSkeleton />

  if (sub) {
    const post = sub === 'new' ? null : posts.find((p) => p.slug === sub)
    if (sub !== 'new' && !post) {
      return (
        <Empty
          icon="file"
          title="No post with that URL"
          body={`There is no ${sub}.md in the repo. It may have been renamed or deleted.`}
          action={<a {...link(dashboardPath('blog'))} className={BTN_SECONDARY}>All posts</a>}
        />
      )
    }
    return (
      <>
        {deploy && <DeployBar deploy={deploy} onClose={() => setDeploy(null)} />}
        <PostEditor key={sub} post={post} posts={posts} onSaved={onSaved} onDeleted={onDeleted} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {deploy && <DeployBar deploy={deploy} onClose={() => setDeploy(null)} />}
      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}
      <PostList posts={posts} loading={loading} onReload={() => load()} />
    </div>
  )
}

function useDeployPolling(deploy, setDeploy) {
  const sha = deploy?.sha
  const done = !deploy || ['live', 'failed', 'unknown'].includes(deploy.state)
  useEffect(() => {
    if (!sha || done) return
    let stop = false
    let timer = 0
    const ctrl = new AbortController()
    const tick = async () => {
      try {
        const next = await deployState(sha, { signal: ctrl.signal })
        if (stop) return
        setDeploy((d) => (d?.sha === sha ? { ...d, state: next.state, runUrl: next.url || d.runUrl } : d))
        if (['live', 'failed', 'unknown'].includes(next.state)) return
      } catch (err) {
        if (stop || err?.name === 'AbortError') return
      }
      setDeploy((d) => (d?.sha === sha && Date.now() - d.at > POLL_FOR_MS ? { ...d, state: 'unknown' } : d))
      timer = setTimeout(tick, POLL_MS)
    }
    timer = setTimeout(tick, 2500)
    return () => {
      stop = true
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [sha, done, setDeploy])
}

const DEPLOY_COPY = {
  queued: ['Queued', 'clock'],
  building: ['Deploying', 'refresh'],
  live: ['Live', 'check'],
  failed: ['Deploy failed', 'alert'],
  unknown: ['Committed', 'info'],
}

function DeployBar({ deploy, onClose }) {
  const [text, icon] = DEPLOY_COPY[deploy.state] || DEPLOY_COPY.unknown
  const busy = deploy.state === 'queued' || deploy.state === 'building'
  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-[12.5px] animate-rise-in ${
        deploy.state === 'failed' ? 'border-red-500/30 bg-red-500/[0.06] text-red-500' : 'border-line bg-surface-raised/50 text-ink-muted'
      }`}
    >
      <Icon name={icon} className={`h-4 w-4 shrink-0 ${busy && deploy.state === 'building' ? 'animate-spin [animation-duration:2s]' : ''} ${deploy.state === 'live' ? 'text-emerald-500' : ''}`} />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink-strong">{deploy.label}</span> · {text}
      </span>
      <span className="flex items-center gap-3">
        {deploy.runUrl && <a href={deploy.runUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-ink-strong hover:underline">Run</a>}
        <a href={deploy.commitUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-ink-strong hover:underline">Commit</a>
        <button type="button" aria-label="Dismiss" onClick={onClose} className="cursor-pointer opacity-70 hover:opacity-100">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className={`${CARD} divide-y divide-line`} aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <span className="h-3 w-16 rounded bg-surface-hover" />
          <span className="h-3 flex-1 rounded bg-surface-hover" />
        </div>
      ))}
    </div>
  )
}

function PostList({ posts, loading, onReload }) {
  const newButton = (
    <a {...link(dashboardPath('blog/new'))} className={BTN_PRIMARY}>
      <Icon name="plus" className="h-3.5 w-3.5" /> New post
    </a>
  )
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          {posts.length} post{posts.length === 1 ? '' : 's'}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN_GHOST} onClick={onReload} disabled={loading} aria-label="Reload from GitHub">
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {newButton}
        </div>
      </div>

      {posts.length === 0 ? (
        <Empty icon="pencil" title="No posts yet" action={newButton} />
      ) : (
        <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
          {posts.map(({ slug, meta }) => (
            <li key={slug} className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover/60">
              <span className="w-[92px] shrink-0 font-mono text-[11.5px] tabular-nums text-ink-subtle">{meta.date || '—'}</span>
              <div className="min-w-0 flex-1">
                <a {...link(dashboardPath(`blog/${slug}`))} className="block truncate text-[13.5px] font-medium text-ink-strong outline-none after:absolute after:inset-0 focus-visible:underline">
                  {meta.title}
                </a>
                <p className="truncate font-mono text-[11.5px] text-ink-faint">/blog/{slug}</p>
              </div>
              {meta.broken && <Tag tone="red" title={meta.broken}>Broken</Tag>}
              {meta.draft && <Tag>Draft</Tag>}
              {!meta.draft && !meta.broken && (
                <a href={blogPath(slug)} target="_blank" rel="noreferrer" className="relative z-10 hidden text-[12px] text-ink-subtle hover:text-ink-strong sm:inline" aria-label={`Open ${meta.title} on the site`}>
                  View ↗
                </a>
              )}
              <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function formFrom(post) {
  if (!post) return { form: { title: '', slug: '', date: today(), updated: '', description: '', tags: '', cover: '', draft: false }, body: '', problem: null }
  try {
    const { data, body } = parseFrontmatter(post.source, `${post.slug}.md`)
    const tags = Array.isArray(data.tags) ? data.tags : data.tags ? String(data.tags).split(',') : []
    return {
      form: {
        title: String(data.title ?? ''),
        slug: post.slug,
        date: String(data.date ?? today()),
        updated: data.updated ? String(data.updated) : '',
        description: data.description ? String(data.description) : '',
        tags: tags.map((t) => t.trim()).filter(Boolean).join(', '),
        cover: data.cover ? String(data.cover) : '',
        draft: data.draft === true,
      },
      body: body.replace(/^\n+/, ''),
      problem: null,
    }
  } catch (err) {
    return { form: { title: post.slug, slug: post.slug, date: today(), updated: '', description: '', tags: '', cover: '', draft: false }, body: post.source, problem: err.message }
  }
}

const sourceOf = (form, body) =>
  serializePost({ ...form, tags: form.tags.split(',').map((t) => t.trim()), title: form.title.trim() }, body)

function problemsOf(form, body, { isNew, taken }) {
  const out = {}
  if (!form.title.trim()) out.title = 'Give the post a title.'
  if (isNew) {
    if (!form.slug) out.slug = 'Pick a URL.'
    else if (!SLUG_RE.test(form.slug)) out.slug = 'Lowercase letters, numbers and single dashes only.'
    else if (taken.has(form.slug)) out.slug = 'Another post already uses this URL.'
  }
  if (!DATE_RE.test(form.date)) out.date = 'Pick a date.'
  if (form.updated && !DATE_RE.test(form.updated)) out.updated = 'Pick a date or leave it empty.'
  if (form.cover && !form.cover.startsWith('/')) out.cover = 'Use a path that starts with /, e.g. /blog/cover.webp.'
  if (!body.trim()) out.body = 'Write something first.'
  if (!Object.keys(out).length) {
    try {
      readMeta(form.slug || 'x', sourceOf(form, body), 'post')
    } catch (err) {
      out.body = err.message.replace(/^post: /, '')
    }
  }
  return out
}

function PostEditor({ post, posts, onSaved, onDeleted }) {
  const isNew = !post
  const initial = useMemo(() => formFrom(post), [post])
  const storeKey = DRAFT_KEY(post?.slug)
  const restored = useMemo(() => {
    const saved = readStored(storeKey)
    if (!saved?.form || typeof saved.body !== 'string') return null
    if ((saved.base || null) !== (post?.sha || null)) return null
    if (sourceOf(saved.form, saved.body) === sourceOf(initial.form, initial.body)) return null
    return saved
  }, [storeKey, post?.sha, initial])

  const [form, setForm] = useState(() => (restored ? { ...initial.form, ...restored.form } : initial.form))
  const [body, setBody] = useState(() => (restored ? restored.body : initial.body))
  const [slugTouched, setSlugTouched] = useState(!isNew || Boolean(restored?.slugTouched))
  const [images, setImages] = useState([])
  const [view, setView] = useState('write')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [base, setBase] = useState(post?.sha || null)
  const textarea = useRef(null)

  const taken = useMemo(() => new Set(posts.map((p) => p.slug)), [posts])
  const source = sourceOf(form, body)
  const savedSource = post ? sourceOf(initial.form, initial.body) : null
  const dirty = isNew ? Boolean(form.title.trim() || body.trim()) : source !== savedSource || images.length > 0
  const problems = problemsOf(form, body, { isNew, taken })
  const valid = Object.keys(problems).length === 0

  useEffect(() => {
    if (!dirty) return writeStored(storeKey, null)
    const t = setTimeout(() => writeStored(storeKey, { form, body, slugTouched, base: post?.sha || null, at: Date.now() }), 400)
    return () => clearTimeout(t)
  }, [dirty, form, body, slugTouched, storeKey, post?.sha])

  useEffect(() => {
    if (!dirty) return
    const onUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const imagesRef = useRef(images)
  imagesRef.current = images
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)), [])

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setTitle = (title) =>
    setForm((f) => ({ ...f, title, slug: isNew && !slugTouched ? postSlugFor(title) : f.slug }))

  const insertAtCursor = useCallback((text) => {
    const el = textarea.current
    setBody((current) => {
      if (!el) return `${current}${current.endsWith('\n') || !current ? '' : '\n\n'}${text}`
      const start = el.selectionStart ?? current.length
      const end = el.selectionEnd ?? start
      const before = current.slice(0, start)
      const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
      const next = `${before}${pad}${text}\n${current.slice(end)}`
      requestAnimationFrame(() => {
        const at = before.length + pad.length + text.length + 1
        el.focus()
        el.setSelectionRange(at, at)
      })
      return next
    })
  }, [])

  const addImages = useCallback(async (files, { asCover = false } = {}) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setError(null)
    for (const file of list) {
      try {
        const img = await prepareImage(file, form.slug || postSlugFor(form.title) || undefined)
        setImages((all) => [...all, img])
        if (asCover) setForm((f) => ({ ...f, cover: img.path }))
        else insertAtCursor(`![${file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')}](${img.path})`)
      } catch (err) {
        setError(err instanceof BlogAdminError ? err : new BlogAdminError('failed'))
      }
    }
  }, [form.slug, form.title, insertAtCursor])

  const save = async () => {
    setShowErrors(true)
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const used = images.filter((img) => source.includes(img.path))
      const { item, commit } = await savePost(form.slug, { source, sha: base, images: used.map(({ name, type, data }) => ({ name, type, data })) })
      writeStored(storeKey, null)
      writeStored(DRAFT_KEY(form.slug), null)
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
      setImages([])
      setBase(item.sha)
      onSaved(item, commit, isNew ? (form.draft ? 'Saved draft' : 'Published') : 'Saved')
      if (isNew) navigate(dashboardPath(`blog/${item.slug}`), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const { commit } = await deletePost(post.slug, base)
      writeStored(storeKey, null)
      setConfirmDelete(false)
      onDeleted(post.slug, commit)
    } catch (err) {
      setError(err)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const shown = (key) => (showErrors ? problems[key] : undefined)
  const action = isNew ? (form.draft ? 'Save draft' : 'Publish') : 'Save'
  const liveUrl = !isNew && !initial.form.draft ? blogPath(post.slug) : null

  return (
    <div className="flex flex-col gap-5 animate-rise-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <a {...link(dashboardPath('blog'))} className={BTN_GHOST} aria-label="All posts">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Posts
          </a>
          <span className="truncate text-[13px] text-ink-muted">{isNew ? 'New post' : form.title || post.slug}</span>
          {dirty && !busy && <span className="text-[11.5px] text-ink-faint">· unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noreferrer" className={BTN_GHOST}>
              View ↗
            </a>
          )}
          {!isNew && (
            <button type="button" className={BTN_GHOST} onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete post">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy || (!isNew && !dirty)} title="⌘S">
            {busy ? 'Saving…' : action}
          </button>
        </div>
      </div>

      {initial.problem && <Note tone="error">{initial.problem}</Note>}
      {error && <Note tone="error" onDismiss={() => setError(null)}>{errorText(error)}</Note>}

      <div className={`${CARD} grid gap-4 p-4 sm:grid-cols-2 *:min-w-0`}>
        <Field label="Title" htmlFor="post-title" error={shown('title')} className="sm:col-span-2">
          <input id="post-title" className={`${INPUT} h-10 text-[15px] font-medium`} value={form.title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this post about?" aria-invalid={Boolean(shown('title'))} autoFocus={isNew} maxLength={140} />
        </Field>

        <Field label="URL" htmlFor="post-slug" error={shown('slug')}>
          <div className="flex items-center">
            <span className="flex h-9 items-center rounded-l-lg border border-r-0 border-line bg-surface-raised px-2.5 font-mono text-[12px] text-ink-faint">/blog/</span>
            <input
              id="post-slug"
              className={`${INPUT} rounded-l-none font-mono text-[12.5px]`}
              value={form.slug}
              readOnly={!isNew}
              onChange={(e) => {
                setSlugTouched(true)
                set('slug')(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              }}
              placeholder="my-post"
              aria-invalid={Boolean(shown('slug'))}
              maxLength={80}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3 *:min-w-0 [&_input]:min-w-0">
          <Field label="Date" htmlFor="post-date" error={shown('date')}>
            <input id="post-date" type="date" className={INPUT} value={form.date} onChange={(e) => set('date')(e.target.value)} aria-invalid={Boolean(shown('date'))} />
          </Field>
          <Field label="Updated" htmlFor="post-updated" error={shown('updated')} hint={!isNew && !form.updated ? <button type="button" className="cursor-pointer hover:text-ink-strong" onClick={() => set('updated')(today())}>Today</button> : null}>
            <input id="post-updated" type="date" className={INPUT} value={form.updated} onChange={(e) => set('updated')(e.target.value)} aria-invalid={Boolean(shown('updated'))} />
          </Field>
        </div>

        <Field label="Description" htmlFor="post-description" className="sm:col-span-2">
          <input id="post-description" className={INPUT} value={form.description} onChange={(e) => set('description')(e.target.value)} maxLength={200} />
        </Field>

        <Field label="Tags" htmlFor="post-tags">
          <input id="post-tags" className={INPUT} value={form.tags} onChange={(e) => set('tags')(e.target.value)} placeholder="go, security" />
        </Field>

        <Field label="Cover image" htmlFor="post-cover" error={shown('cover')}>
          <div className="flex gap-2">
            <input id="post-cover" className={`${INPUT} font-mono text-[12.5px]`} value={form.cover} onChange={(e) => set('cover')(e.target.value)} placeholder="/blog/cover.webp" aria-invalid={Boolean(shown('cover'))} />
            <ImagePicker label="Upload cover" onPick={(files) => addImages(files, { asCover: true })} iconOnly />
          </div>
        </Field>

        <div className="flex items-center justify-between gap-4 sm:col-span-2">
          <p className="text-[13px] font-medium text-ink-strong">Draft</p>
          <Toggle checked={form.draft} onChange={set('draft')} label="Draft" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            label="Editor view"
            value={view}
            onChange={setView}
            options={[
              { value: 'write', label: 'Write', icon: 'pencil' },
              { value: 'preview', label: 'Preview', icon: 'eye' },
              { value: 'split', label: 'Split', icon: 'panelLeft' },
            ]}
          />
          <ImagePicker label="Image" onPick={(files) => addImages(files)} />
        </div>
        {shown('body') && <p role="alert" className="text-[12px] text-red-500">{shown('body')}</p>}
        <div className={`grid gap-4 ${view === 'split' ? 'lg:grid-cols-2' : ''}`}>
          {view !== 'preview' && (
            <textarea
              ref={textarea}
              aria-label="Post body (markdown)"
              className="min-h-[60vh] w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-ink-strong placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={(e) => {
                const files = [...(e.clipboardData?.files || [])]
                if (files.some((f) => f.type.startsWith('image/'))) {
                  e.preventDefault()
                  addImages(files)
                }
              }}
              onDragOver={(e) => {
                if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault()
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.files.length) return
                e.preventDefault()
                addImages(e.dataTransfer.files)
              }}
              placeholder="Start writing…"
              spellCheck
            />
          )}
          {view !== 'write' && <Preview form={form} body={body} images={images} />}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        tone="danger"
        title="Delete this post?"
        onClose={() => setConfirmDelete(false)}
        busy={busy}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_DANGER} onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete post'}</button>
          </>
        }
      />
    </div>
  )
}

function ImagePicker({ label, onPick, iconOnly = false }) {
  const input = useRef(null)
  return (
    <>
      <button type="button" className={BTN_SECONDARY} onClick={() => input.current?.click()} aria-label={label} title={label}>
        <Icon name="image" className="h-3.5 w-3.5" />
        {!iconOnly && label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple={!iconOnly}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}

function Preview({ form, body, images }) {
  const deferredBody = useDeferredValue(body)
  const html = useMemo(() => {
    let out = renderMarkdown(deferredBody).html
    for (const img of images) out = out.split(`src="${img.path}"`).join(`src="${img.previewUrl}"`)
    return out
  }, [deferredBody, images])
  const cover = form.cover && (images.find((img) => img.path === form.cover)?.previewUrl || form.cover)
  const tags = form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)

  return (
    <article
      className={`${CARD} min-h-[60vh] px-5 py-6 sm:px-8`}
      onClick={(e) => {
        const a = e.target.closest('a')
        if (a && !a.target) e.preventDefault()
      }}
    >
      <p className={`${LABEL} normal-case tracking-normal`}>
        {DATE_RE.test(form.date) ? formatPostDate(form.date) : 'No date'}
        {form.draft && ' · Draft'}
      </p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-ink-strong">{form.title || 'Untitled'}</h1>
      {tags.length > 0 && <p className="mt-2 text-[12.5px] text-ink-subtle">{tags.map((t) => `#${t}`).join('  ')}</p>}
      {cover && <img src={cover} alt="" className="mt-6 w-full rounded-[10px] border border-line" />}
      {deferredBody.trim() ? (
        <div className="blog-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="mt-6 text-[13px] text-ink-faint">Nothing to preview yet.</p>
      )}
    </article>
  )
}
