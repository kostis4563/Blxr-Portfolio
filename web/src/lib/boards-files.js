export const ART_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const FILE_TYPES = [...ART_TYPES, 'application/pdf']

export const FILE_MAX = 4 * 1024 * 1024
export const FILES_MAX = 10
export const THUMB_EDGE = 520

export const ART_KINDS = {
  logo: {
    label: 'Logo',
    width: 512,
    height: 512,
    cap: 160 * 1024,
    hint: 'Square reads best. It sits beside the board name and on the board tile.',
    frame: 'aspect-square w-24',
    ratio: 1,
  },
  banner: {
    label: 'Banner',
    width: 1920,
    height: 640,
    cap: 400 * 1024,
    hint: 'A wide strip across the top of the board and its tile.',
    frame: 'aspect-[3/1] w-full',
    ratio: 3,
  },
}

const ATTEMPTS = [
  { type: 'image/webp', quality: 0.9, scale: 1 },
  { type: 'image/webp', quality: 0.75, scale: 1 },
  { type: 'image/jpeg', quality: 0.82, scale: 1 },
  { type: 'image/webp', quality: 0.75, scale: 0.6 },
  { type: 'image/jpeg', quality: 0.7, scale: 0.6 },
]

const SHRINK = [
  { type: 'image/webp', quality: 0.9, scale: 1 },
  { type: 'image/webp', quality: 0.8, scale: 0.85 },
  { type: 'image/jpeg', quality: 0.82, scale: 0.85 },
  { type: 'image/webp', quality: 0.75, scale: 0.6 },
  { type: 'image/jpeg', quality: 0.7, scale: 0.45 },
]

export const isImage = (entry) => String(entry?.type ?? '').startsWith('image/')

export function readableSize(bytes) {
  if (!bytes) return ''
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export const extensionFor = (type) =>
  ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'application/pdf': 'pdf' })[type] || 'bin'

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`${file.name || 'That file'} could not be read.`))
    reader.readAsDataURL(file)
  })
}

export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That file is not the image it says it is.'))
    image.src = source
  })
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('This browser could not encode that image.'))), type, quality)
  })
}

function canvasFor(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const brush = canvas.getContext('2d')
  if (!brush) throw new Error('This browser cannot resize images.')
  brush.imageSmoothingEnabled = true
  brush.imageSmoothingQuality = 'high'
  return { canvas, brush }
}

async function paint(image, width, height, type, quality) {
  const { canvas, brush } = canvasFor(width, height)
  brush.drawImage(image, 0, 0, canvas.width, canvas.height)
  return toBlob(canvas, type, quality)
}

async function thumbnailOf(image) {
  try {
    const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1
    const scale = Math.min(1, THUMB_EDGE / longest)
    return await paint(image, image.naturalWidth * scale, image.naturalHeight * scale, 'image/webp', 0.72)
  } catch {
    return null
  }
}

async function thumbnail(source) {
  try {
    return await thumbnailOf(await loadImage(source))
  } catch {
    return null
  }
}

export async function readAttachment(file) {
  if (!file) throw new Error('Pick a file first.')
  if (!FILE_TYPES.includes(file.type)) {
    throw new Error(`${file.name || 'That file'} is not a kind that can be attached — PNG, JPEG, WebP, GIF or PDF.`)
  }

  if (file.size <= FILE_MAX) {
    const thumb = file.type === 'application/pdf' ? null : await thumbnail(await readFile(file))
    return { name: file.name, blob: file, bytes: file.size, type: file.type, resized: false, thumb }
  }

  if (file.type === 'application/pdf') {
    throw new Error(`${file.name} is ${readableSize(file.size)} — a PDF has to stay under ${readableSize(FILE_MAX)}.`)
  }
  if (file.type === 'image/gif') {
    throw new Error(`${file.name} is ${readableSize(file.size)} — an animated image has to stay under ${readableSize(FILE_MAX)}.`)
  }

  const source = await readFile(file)
  const image = await loadImage(source)
  for (const attempt of SHRINK) {
    const blob = await paint(image, image.naturalWidth * attempt.scale, image.naturalHeight * attempt.scale, attempt.type, attempt.quality)
    if (blob.size <= FILE_MAX) {
      return {
        name: file.name,
        blob,
        bytes: blob.size,
        type: blob.type || attempt.type,
        resized: true,
        thumb: await thumbnailOf(image),
      }
    }
  }

  throw new Error(`${file.name} stays too heavy after resizing — try a smaller one.`)
}

export async function openArt(file) {
  if (!file) throw new Error('Pick an image first.')
  if (!ART_TYPES.includes(file.type)) throw new Error('Use a PNG, JPEG, WebP or GIF image.')
  const source = await readFile(file)
  const image = await loadImage(source)
  return { source, image, type: file.type, size: file.size }
}

export async function cropArt(image, kind, box) {
  const spec = ART_KINDS[kind] ?? ART_KINDS.logo
  const width = Math.max(1, Math.min(spec.width, Math.round(box.width)))
  const height = Math.max(1, Math.round((width * spec.height) / spec.width))

  for (const attempt of ATTEMPTS) {
    const { canvas, brush } = canvasFor(width * attempt.scale, height * attempt.scale)
    brush.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height)
    const blob = await toBlob(canvas, attempt.type, attempt.quality)
    if (blob.size <= spec.cap) return { blob, bytes: blob.size, type: blob.type || attempt.type }
  }

  throw new Error('That image stays too heavy after cropping — try a smaller or simpler one.')
}

export async function readArt(file, kind) {
  const spec = ART_KINDS[kind] ?? ART_KINDS.logo
  if (!file) throw new Error('Pick an image first.')
  if (!ART_TYPES.includes(file.type)) throw new Error('Use a PNG, JPEG, WebP or GIF image.')

  if (file.type === 'image/gif') {
    if (file.size > spec.cap) {
      throw new Error(`That GIF is ${readableSize(file.size)} — an animated one has to stay under ${readableSize(spec.cap)}.`)
    }
    return { blob: file, bytes: file.size, type: file.type }
  }

  const image = await loadImage(await readFile(file))
  const fit = Math.min(1, spec.width / image.naturalWidth, spec.height / image.naturalHeight)

  for (const attempt of ATTEMPTS) {
    const scale = fit * attempt.scale
    const blob = await paint(image, image.naturalWidth * scale, image.naturalHeight * scale, attempt.type, attempt.quality)
    if (blob.size <= spec.cap) return { blob, bytes: blob.size, type: blob.type || attempt.type }
  }

  throw new Error('That image stays too heavy after resizing — try a smaller or simpler one.')
}
