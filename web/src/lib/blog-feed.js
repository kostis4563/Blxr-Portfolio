import { loadPostBody } from '#blog-bodies'
import { postsList, BLOG_UPDATED } from './blog'
import { blogPath, BLOG_PATH, BLOG_FEED_PATH } from './router'
import { SITE_URL, SITE_NAME } from './seo'

const FEED_SIZE = 20

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

const absolute = (html) =>
  html
    .replace(/(\s(?:href|src))="\/(?!\/)/g, `$1="${SITE_URL}/`)
    .replace(/<a class="heading-anchor"[^>]*>#+<\/a>/g, '')
    .replace(/<button[^>]*data-copy[^>]*>[\s\S]*?<\/button>/g, '')

const rfc822 = (iso) => new Date(`${iso}T09:00:00Z`).toUTCString()

export function blogFeed() {
  const posts = postsList.filter((post) => !post.draft).slice(0, FEED_SIZE)
  const items = posts.map((post) => {
    const url = `${SITE_URL}${blogPath(post.slug)}`
    const body = loadPostBody(post.slug)
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${rfc822(post.date)}</pubDate>`,
      `      <description>${escapeXml(post.description)}</description>`,
      ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
      body ? `      <content:encoded>${cdata(absolute(body.html))}</content:encoded>` : '',
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${SITE_NAME} — Blog</title>`,
    `    <link>${SITE_URL}${BLOG_PATH}</link>`,
    `    <atom:link href="${SITE_URL}${BLOG_FEED_PATH}" rel="self" type="application/rss+xml" />`,
    '    <description>Notes on what Blxr builds, breaks and learns.</description>',
    '    <language>en</language>',
    BLOG_UPDATED ? `    <lastBuildDate>${rfc822(BLOG_UPDATED)}</lastBuildDate>` : '',
    ...items,
    '  </channel>',
    '</rss>',
  ]
    .filter(Boolean)
    .join('\n') + '\n'
}
