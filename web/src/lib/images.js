import { IMAGES } from './image-manifest.js'

export function imageProps(src, sizes) {
  const entry = IMAGES[src]
  if (!entry) {

    return { src }
  }

  const stamped = `${src}?v=${entry.v}`
  if (!entry.widths.length) return { src: stamped }

  const stem = src.slice(0, src.lastIndexOf('.'))
  const url = (width) => `${stem}-${width}${entry.ext}?v=${entry.v}`

  return {

    src: url(entry.widths[entry.widths.length - 1]),
    srcSet: entry.widths.map((width) => `${url(width)} ${width}w`).join(', '),
    ...(sizes ? { sizes } : null),
  }
}

export function imageUrl(src, width) {
  const entry = IMAGES[src]
  if (!entry) return src
  const stamped = `${src}?v=${entry.v}`
  const pick = entry.widths.find((w) => w >= width)
  if (!pick) return stamped
  const stem = src.slice(0, src.lastIndexOf('.'))
  return `${stem}-${pick}${entry.ext}?v=${entry.v}`
}

export const SIZES = {
    contentColumn: '(min-width: 768px) 720px, calc(100vw - 48px)',
    archiveCover: '(min-width: 960px) 878px, (min-width: 640px) calc(100vw - 82px), calc(100vw - 50px)',
    archivePreview: '(min-width: 1024px) 320px, (min-width: 768px) 288px, calc(100vw - 50px)',
    archiveGallery: '(min-width: 960px) 361px, (min-width: 640px) calc(50vw - 119px), calc(100vw - 50px)',
    archiveGalleryWide: '(min-width: 960px) 734px, (min-width: 640px) calc(100vw - 226px), calc(100vw - 50px)',
    mark: '24px',
    avatar: '64px',
}
