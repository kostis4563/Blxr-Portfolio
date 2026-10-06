import { currentSession } from './supabase'

export class BlogAdminError extends Error {
  constructor(code, { status = 0, fields = [] } = {}) {
    super(code)
    this.code = code
    this.status = status
    this.fields = fields
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  const token = currentSession()?.access_token
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  let res
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new BlogAdminError('offline')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new BlogAdminError(typeof data?.error === 'string' ? data.error : res.status === 413 ? 'too_large' : 'failed', {
      status: res.status,
      fields: Array.isArray(data?.fields) ? data.fields : [],
    })
  }
  return data
}

export const listPosts = ({ signal } = {}) => request('/api/blog/posts', { signal })

export const savePost = (slug, { source, sha = null, images = [] }) =>
  request(`/api/blog/posts/${slug}`, { method: 'PUT', body: { source, sha, ...(images.length ? { images } : {}) } })

export const deletePost = (slug, sha) => request(`/api/blog/posts/${slug}?sha=${sha}`, { method: 'DELETE' })

export const deployState = (sha, { signal } = {}) => request(`/api/blog/deploy?sha=${sha}`, { signal })

export const ERROR_TEXT = {
  offline: 'Could not reach the server. Check your connection and try again.',
  unauthorized: 'The server did not accept this session as the owner. Sign out and back in.',
  needs_mfa: 'The server only accepts owner sessions that passed two-factor. Sign out, sign back in and enter your code.',
  blog_disabled: 'Blog publishing is off on the server: BLOG_REPO is not set in its env file.',
  blog_unauthorized: 'GitHub rejected the server’s token. Replace BLOG_GITHUB_TOKEN (or GITHUB_TOKEN) and redeploy.',
  blog_forbidden: 'The server’s GitHub token cannot write to the repo. Give BLOG_GITHUB_TOKEN “Contents: read and write” on it.',
  rate_limited: 'GitHub is rate limiting the server. Wait a minute and try again.',
  github_failed: 'GitHub did not answer properly. Try again in a moment.',
  exists: 'A post with this URL already exists. Pick another URL.',
  conflict: 'This post changed on GitHub since you opened it. Reload the list to get the latest version — your text is kept in this browser.',
  not_found: 'This post no longer exists on GitHub.',
  invalid: 'The server refused the post.',
  image_too_large: 'One of the images is over 5 MB.',
  image_type: 'Use a PNG, JPEG, WebP, GIF or AVIF image.',
  too_large: 'This save is too big. Use fewer or smaller images.',
  failed: 'Something went wrong. Try again.',
}

export const errorText = (err) => {
  const base = ERROR_TEXT[err?.code] || ERROR_TEXT.failed
  return err?.code === 'invalid' && err.fields?.length ? `${base} Check: ${err.fields.join(', ')}.` : base
}

const MAX_EDGE = 2000
const REENCODE_OVER = 400 * 1024

export async function prepareImage(file, baseName) {
  const base = (baseName || file.name.replace(/\.[^.]+$/, ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image'
  const suffix = Math.random().toString(16).slice(2, 8)
  let blob = file
  let type = file.type
  if ((type === 'image/png' || type === 'image/jpeg') && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
      if (scale < 1 || file.size > REENCODE_OVER) {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const webp = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86))
        if (webp && webp.type === 'image/webp' && webp.size < file.size) {
          blob = webp
          type = 'image/webp'
        }
      }
      bitmap.close?.()
    } catch {
    }
  }
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[type]
  if (!ext) throw new BlogAdminError('image_type')
  if (blob.size > 5 * 1024 * 1024) throw new BlogAdminError('image_too_large')
  const name = `${base}-${suffix}.${ext}`
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  return { name, type, data, path: `/blog/${name}`, previewUrl: URL.createObjectURL(blob), size: blob.size }
}
