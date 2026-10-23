import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../icon'
import { paletteOf, sectionNumber, LIMITS } from '../../lib/presentations'
import { slideImageUrl, cachedImageUrl } from '../../lib/presentations-api'
import '../../presentations.css'

function caretOffset(el) {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !el.contains(selection.anchorNode)) return null
  const range = selection.getRangeAt(0)
  const before = range.cloneRange()
  before.selectNodeContents(el)
  before.setEnd(range.endContainer, range.endOffset)
  return { at: before.toString().length, collapsed: range.collapsed }
}

function placeCaret(el, at) {
  el.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let left = at
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (left <= node.length) {
      range.setStart(node, left)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      return
    }
    left -= node.length
  }
  range.selectNodeContents(el)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

const flat = (value) => value.replace(/[\r\n]+/g, ' ')

function Editable({ value, onChange, placeholder, max, className = '', label, onKeyDown, nodeRef }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.textContent !== value) el.textContent = value
  }, [value])

  return (
    <div
      ref={(el) => {
        ref.current = el
        if (nodeRef) nodeRef(el)
      }}
      role="textbox"
      aria-label={label}
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      data-empty={value ? undefined : ''}
      onInput={(event) => {
        const el = event.currentTarget
        let next = flat(el.textContent || '')
        if (next.length > max) {
          next = next.slice(0, max)
          el.textContent = next
          placeCaret(el, next.length)
        }
        onChange(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !onKeyDown) event.preventDefault()
        onKeyDown?.(event)
        event.stopPropagation()
      }}
      onPaste={(event) => {
        event.preventDefault()
        document.execCommand('insertText', false, flat(event.clipboardData.getData('text/plain')))
      }}
      className={`sl-edit ${className}`}
    />
  )
}

function Text({ edit, value, onChange, placeholder, max, className = '', label, as: Tag = 'p' }) {
  if (edit) return <Editable value={value} onChange={onChange} placeholder={placeholder} max={max} className={className} label={label} />
  if (!value) return null
  return <Tag className={`sl-text ${className}`}>{value}</Tag>
}

function Points({ edit, points, onChange, className = '', placeholder = 'Add a point' }) {
  const nodes = useRef([])
  const focusNext = useRef(null)
  const items = points.length ? points : ['']

  useLayoutEffect(() => {
    const want = focusNext.current
    if (!want) return
    focusNext.current = null
    const el = nodes.current[want.index]
    if (el) placeCaret(el, want.at)
  })

  if (!edit) {
    const shown = points.filter((point) => point.trim())
    if (!shown.length) return null
    return (
      <ul className={`sl-points ${className}`}>
        {shown.map((point, i) => (
          <li key={i} className="sl-point">
            <span aria-hidden="true" className="sl-dot" />
            <span className="sl-point-text">{point}</span>
          </li>
        ))}
      </ul>
    )
  }

  const keyFor = (index) => (event) => {
    const el = nodes.current[index]
    const caret = el ? caretOffset(el) : null
    if (!caret) return
    const value = items[index]
    if (event.key === 'Enter') {
      event.preventDefault()
      if (items.length >= LIMITS.points) return
      const next = [...items]
      next.splice(index, 1, value.slice(0, caret.at), value.slice(caret.at))
      focusNext.current = { index: index + 1, at: 0 }
      onChange(next)
    } else if (event.key === 'Backspace' && caret.collapsed && caret.at === 0 && index > 0) {
      event.preventDefault()
      const next = [...items]
      const joinAt = next[index - 1].length
      next.splice(index - 1, 2, (next[index - 1] + value).slice(0, LIMITS.point))
      focusNext.current = { index: index - 1, at: joinAt }
      onChange(next)
    } else if (event.key === 'Delete' && caret.collapsed && caret.at === value.length && index < items.length - 1) {
      event.preventDefault()
      const next = [...items]
      next.splice(index, 2, (value + next[index + 1]).slice(0, LIMITS.point))
      focusNext.current = { index, at: value.length }
      onChange(next)
    } else if (event.key === 'ArrowUp' && caret.at === 0 && index > 0) {
      event.preventDefault()
      placeCaret(nodes.current[index - 1], items[index - 1].length)
    } else if (event.key === 'ArrowDown' && caret.at === value.length && index < items.length - 1) {
      event.preventDefault()
      placeCaret(nodes.current[index + 1], 0)
    }
  }

  return (
    <ul className={`sl-points ${className}`}>
      {items.map((point, i) => (
        <li key={i} className="sl-point">
          <span aria-hidden="true" className="sl-dot" />
          <Editable
            nodeRef={(el) => { nodes.current[i] = el }}
            value={point}
            max={LIMITS.point}
            label={`Point ${i + 1}`}
            placeholder={i === 0 ? placeholder : ''}
            onChange={(text) => onChange(items.map((held, at) => (at === i ? text : held)))}
            onKeyDown={keyFor(i)}
            className="sl-point-text"
          />
        </li>
      ))}
    </ul>
  )
}

export function useSlideImage(path) {
  const [state, setState] = useState(() => ({ path, url: cachedImageUrl(path) }))
  useEffect(() => {
    let live = true
    const held = cachedImageUrl(path)
    setState({ path, url: held })
    if (path && !held) slideImageUrl(path).then((url) => live && setState({ path, url }))
    return () => { live = false }
  }, [path])
  return state.path === path ? state.url : null
}

function SlideImage({ image }) {
  const url = useSlideImage(image?.path)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => setLoaded(false), [url])
  if (!url) return <span aria-hidden="true" className="sl-blank" />
  return (
    <img
      src={url}
      alt={image.alt || ''}
      draggable={false}
      decoding="async"
      onLoad={() => setLoaded(true)}
      data-fit={image.fit}
      data-loaded={loaded ? '' : undefined}
      className="sl-img"
    />
  )
}

function ImageSlot({ image, edit, media }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)

  if (!edit) {
    return <div className="sl-media">{image ? <SlideImage image={image} /> : <span aria-hidden="true" className="sl-blank" />}</div>
  }

  const pick = () => input.current?.click()

  return (
    <div
      className="sl-media"
      onDragOver={(event) => {
        if (![...(event.dataTransfer?.types || [])].includes('Files')) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        const file = [...(event.dataTransfer?.files || [])].find((entry) => entry.type.startsWith('image/'))
        if (file) media?.onFile(file)
      }}
    >
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) media?.onFile(file)
        }}
      />
      {image ? (
        <>
          <SlideImage image={image} />
          <div className="sl-tools">
            <button type="button" onClick={pick} className="sl-tool">
              <Icon name="image" className="h-3.5 w-3.5" /> Replace
            </button>
            <button type="button" onClick={() => media?.onRemove()} aria-label="Remove image" className="sl-tool">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={pick} className="sl-drop">
          <Icon name="image" strokeWidth={1.5} className="" />
          <span>Add an image</span>
          <small>Click or drop a file</small>
        </button>
      )}
      {(over || media?.uploading) && <div className="sl-veil">{media?.uploading ? 'Uploading…' : 'Drop to use this image'}</div>}
    </div>
  )
}

export default function Slide({ slide, theme, slides = [], index = 0, part, numbers = false, edit = false, onChange, media, className = '' }) {
  const palette = paletteOf(theme, slide.tone)
  const set = (key) => (value) => onChange?.({ [key]: value })
  const props = (key, max, placeholder, label) => ({ edit, value: slide[key], onChange: set(key), max, placeholder, label })
  const points = (key, className) => <Points edit={edit} points={slide[key]} onChange={set(key)} className={className} />
  const showNumber = numbers && index > 0 && slide.layout !== 'image'

  let body = null
  if (slide.layout === 'title') {
    body = (
      <div className="sl-cover">
        <span aria-hidden="true" className="sl-bar" />
        <Text {...props('title', LIMITS.heading, 'Presentation title', 'Title')} as="h2" className="sl-display sl-cover-title" />
        <Text {...props('subtitle', LIMITS.subtitle, 'A subtitle, a date, your name', 'Subtitle')} className="sl-muted sl-cover-sub" />
      </div>
    )
  } else if (slide.layout === 'section') {
    const number = part ?? sectionNumber(slides.length ? slides : [slide], slides.length ? index : 0)
    body = (
      <div className="sl-section">
        <span aria-hidden="true" className="sl-ghost">{number}</span>
        <span className="sl-kicker">PART {number}</span>
        <Text {...props('title', LIMITS.heading, 'Section title', 'Title')} as="h2" className="sl-display sl-section-title" />
        <Text {...props('subtitle', LIMITS.subtitle, 'What this part covers', 'Subtitle')} className="sl-muted sl-section-sub" />
      </div>
    )
  } else if (slide.layout === 'bullets') {
    body = (
      <div className="sl-stack">
        <Text {...props('title', LIMITS.heading, 'Slide heading', 'Heading')} as="h2" className="sl-display sl-heading" />
        <span aria-hidden="true" className="sl-rule" />
        {points('points', 'sl-bullets')}
      </div>
    )
  } else if (slide.layout === 'columns') {
    const column = (headKey, pointsKey, label) => (
      <div className="sl-col">
        <Text {...props(headKey, LIMITS.head, 'Column heading', label)} className="sl-col-head" />
        {points(pointsKey, 'sl-col-points')}
      </div>
    )
    body = (
      <div className="sl-stack">
        <Text {...props('title', LIMITS.heading, 'Slide heading', 'Heading')} as="h2" className="sl-display sl-heading" />
        <div className="sl-cols">
          {column('head', 'points', 'Left heading')}
          {column('head2', 'points2', 'Right heading')}
        </div>
      </div>
    )
  } else if (slide.layout === 'split') {
    body = (
      <div className="sl-split">
        <div className="sl-split-text">
          <Text {...props('title', LIMITS.heading, 'Slide heading', 'Heading')} as="h2" className="sl-display sl-heading" />
          {points('points', 'sl-split-points')}
        </div>
        <ImageSlot image={slide.image} edit={edit} media={media} />
      </div>
    )
  } else if (slide.layout === 'image') {
    body = (
      <div className="sl-full">
        <ImageSlot image={slide.image} edit={edit} media={media} />
        {(edit || slide.title || slide.subtitle) && (
          <div className="sl-caption" data-over={slide.image ? '' : undefined}>
            <div className="sl-caption-inner">
              <Text {...props('title', LIMITS.heading, 'Caption', 'Caption')} as="h2" className="sl-display sl-heading" />
              <Text {...props('subtitle', LIMITS.subtitle, 'Credit or a line of context', 'Credit')} className="sl-muted sl-caption-sub" />
            </div>
          </div>
        )}
      </div>
    )
  } else if (slide.layout === 'quote') {
    body = (
      <div className="sl-quote">
        <span aria-hidden="true" className="sl-mark">“</span>
        <Text {...props('quote', LIMITS.quote, 'Type the quote', 'Quote')} as="blockquote" className="sl-quote-text" />
        <div className="sl-who">
          {(edit || slide.subtitle) && <span aria-hidden="true" className="sl-who-line" />}
          <Text {...props('subtitle', LIMITS.subtitle, 'Who said it', 'Who said it')} />
        </div>
      </div>
    )
  } else if (slide.layout === 'stat') {
    body = (
      <div className="sl-stat">
        <Text {...props('stat', LIMITS.stat, '42%', 'Number')} className="sl-display sl-big" />
        <Text {...props('title', LIMITS.heading, 'What the number is', 'What it is')} as="h2" className="sl-display sl-stat-title" />
        <Text {...props('subtitle', LIMITS.subtitle, 'Where it comes from', 'Source')} className="sl-muted sl-stat-sub" />
      </div>
    )
  }

  return (
    <div
      className={`sl ${className}`}
      data-font={palette.font}
      data-align={slide.align}
      style={{ '--s-base': palette.base, '--s-ink': palette.ink, '--s-accent': palette.accent, background: palette.paint, color: palette.ink }}
    >
      <div className="sl-body">{body}</div>
      {showNumber && <span aria-hidden="true" className="sl-num">{String(index + 1).padStart(2, '0')}</span>}
    </div>
  )
}
