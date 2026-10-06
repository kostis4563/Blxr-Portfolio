import { readFile } from 'node:fs/promises'
import { createHighlighter, bundledLanguages } from 'shiki'
import { readMeta, renderMarkdown, codeLangs } from './src/lib/blog-markdown.js'

export { parseFrontmatter } from './src/lib/blog-markdown.js'

const POST_RE = /[\\/](?:src[\\/]content|tests[\\/]fixtures)[\\/]blog[\\/]([^\\/]+)\.md(\?meta)?$/
const THEMES = { light: 'github-light', dark: 'github-dark' }

let highlighter = null
const getHighlighter = () =>
  (highlighter ??= createHighlighter({ themes: Object.values(THEMES), langs: [] }))

async function renderBody(body, file) {
  const shiki = await getHighlighter()
  const langs = codeLangs(body).filter((lang) => lang in bundledLanguages)
  await Promise.all(langs.map((lang) => shiki.loadLanguage(lang)))

  const highlight = (text, lang) =>
    shiki.codeToHtml(text, {
      lang: lang && shiki.getLoadedLanguages().includes(lang) ? lang : 'text',
      themes: THEMES,
      defaultColor: false,
    })
  const out = renderMarkdown(body, { highlight })
  if (!out.html.trim()) console.warn(`blog: ${file} has no body`)
  return out
}

export default function blogPlugin() {
  let production = false
  return {
    name: 'blxr-blog',
    enforce: 'pre',
    configResolved(config) {
      production = config.isProduction
    },
    async load(id) {
      const match = POST_RE.exec(id)
      if (!match) return null
      const [, slug, metaOnly] = match
      const file = id.replace(/\?.*$/, '')
      this.addWatchFile?.(file)
      const source = await readFile(file, 'utf8')
      const name = `content/blog/${slug}.md`
      const { meta, body } = readMeta(slug, source, name)

      const hidden = production && meta.draft
      const out = metaOnly ? (hidden ? { slug, draft: true } : meta) : hidden ? null : await renderBody(body, name)
      return { code: `export default ${JSON.stringify(out)}`, map: null }
    },
  }
}
