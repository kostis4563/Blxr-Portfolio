---
title: How to write a post on this blog
date: 2026-10-06
description: A cheat sheet for every bit of markdown the blog understands — copy this file, change the frontmatter, delete everything below it and start writing.
tags: [meta, markdown]
draft: true
---

This post is a **draft**, so it only shows up while running `npm run dev` — the production build leaves it out completely. Keep it around as a cheat sheet, or delete it once you know the ropes.

Every post is one markdown file in `web/src/content/blog/`. The file name becomes the URL, so `my-first-post.md` lives at `/blog/my-first-post`.

## The frontmatter

The block between the two `---` lines at the top of the file describes the post:

| Key | Needed | What it does |
| --- | --- | --- |
| `title` | yes | The headline |
| `date` | yes | Publish date, `YYYY-MM-DD` — posts are sorted by it |
| `description` | no | The summary under the title and in search results. Defaults to the first paragraph |
| `tags` | no | `[go, security]` — shows as filters on `/blog` |
| `cover` | no | An image under `web/public`, e.g. `/blog/my-post.webp`, shown above the post |
| `updated` | no | Shows an "Updated" date |
| `draft` | no | `true` keeps it out of the live site |

> [!TIP]
> Typos in frontmatter keys fail the build with a message saying which file and which key — so a broken post never ships quietly.

## Text

Write normally. *Italics*, **bold**, ~~strikethrough~~, `inline code` and [links](/projects) all work. Links to other pages on the site open instantly; [external links](https://github.com) open in a new tab and get a little arrow.

### Lists

- Bullet lists
- like this one
  - and nested ones

1. Numbered lists
2. count themselves

- [x] Task lists
- [ ] work too

## Code

Fenced code blocks are highlighted at build time, follow the light/dark theme and get a copy button. Put the language after the backticks, and optionally a file name:

```js title="server.mjs"
import { createServer } from 'node:http'

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('hello from blxr\n')
})

server.listen(8787)
```

```go
func main() {
	fmt.Println("go works too")
}
```

```bash
npm run dev
```

## Callouts

> [!NOTE]
> Start a quote with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`.

> [!WARNING]
> Each one gets its own colour.

A plain quote stays a quote:

> Simplicity is prerequisite for reliability.

## Images

Put the file in `web/public/blog/` and link it. An image on its own line becomes a figure, and the text in quotes becomes its caption.

![The blxr wordmark](/og.png "Captions come from the quoted title")

---

That's everything. Hover a heading (`##` or `###`) to get a `#` link straight to it.
