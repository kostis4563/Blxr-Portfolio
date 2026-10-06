const metas = import.meta.glob('../content/blog/*.md', { query: '?meta', import: 'default', eager: true })

const showDrafts = !import.meta.env.PROD

export const postsList = Object.values(metas)
  .filter((post) => showDrafts || !post.draft)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))

export const findPost = (slug) => postsList.find((post) => post.slug === slug) ?? null

export function adjacentPosts(slug) {
  const i = postsList.findIndex((post) => post.slug === slug)
  if (i === -1) return { newer: null, older: null }
  return { newer: postsList[i - 1] ?? null, older: postsList[i + 1] ?? null }
}

export const blogTags =[...new Set(postsList.flatMap((post) => post.tags))].sort()

export const BLOG_UPDATED = postsList.reduce((latest, post) => {
  const at = post.updated || post.date
  return !latest || at > latest ? at : latest
}, null)

const DATE_LONG = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const DATE_SHORT = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' })

const asDate = (iso) => new Date(`${iso}T00:00:00Z`)
export const formatPostDate = (iso) => DATE_LONG.format(asDate(iso))
export const formatPostDay = (iso) => DATE_SHORT.format(asDate(iso))
export const postYear = (iso) => iso.slice(0, 4)

export function postsByYear(posts) {
  const groups = []
  for (const post of posts) {
    const year = postYear(post.date)
    if (groups.at(-1)?.year !== year) groups.push({ year, posts: [] })
    groups.at(-1).posts.push(post)
  }
  return groups
}

export function matchesPost(post, query, tag) {
  if (tag && !post.tags.includes(tag)) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    post.title.toLowerCase().includes(q) ||
    post.description.toLowerCase().includes(q) ||
    post.tags.some((t) => t.includes(q))
  )
}
