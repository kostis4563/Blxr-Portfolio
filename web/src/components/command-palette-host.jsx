import { Component, lazy, Suspense, useEffect, useState } from 'react'
import { usePaletteOpen, togglePalette } from '../lib/palette'

const CommandPalette = lazy(() => import('./command-palette.jsx'))

class PaletteBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function CommandPaletteHost({ theme, onToggleTheme }) {
  const open = usePaletteOpen()

  const [wanted, setWanted] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'k' && e.key !== 'K') return
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      e.preventDefault()
      togglePalette()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) setWanted(true)
  }, [open])

  if (!wanted) return null

  return (
    <PaletteBoundary>
      <Suspense fallback={null}>
        <CommandPalette theme={theme} onToggleTheme={onToggleTheme} />
      </Suspense>
    </PaletteBoundary>
  )
}
