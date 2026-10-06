const loaders = import.meta.glob('../content/blog/*.md', { import: 'default' })

const cache = new Map()

export function loadPostBody(slug) {
  if (!cache.has(slug)) {
    const load = loaders[`../content/blog/${slug}.md`]
    cache.set(slug, load ? load() : null)
  }
  return cache.get(slug)
}
