const bodies = import.meta.glob('../content/blog/*.md', { import: 'default', eager: true })

export const loadPostBody = (slug) => bodies[`../content/blog/${slug}.md`] ?? null
