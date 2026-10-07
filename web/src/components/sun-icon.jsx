import { useEffect, useId, useRef } from 'react'

const CORE = 'M12 6c3.31 0 6 2.69 6 6c0 3.31 -2.69 6 -6 6c-3.31 0 -6 -2.69 -6 -6c0 -3.31 2.69 -6 6 -6Z'
const MOON_DISC = 'M12 2c5.52 0 10 4.48 10 10c0 5.52 -4.48 10 -10 10c-5.52 0 -10 -4.48 -10 -10c0 -5.52 4.48 -10 10 -10Z'
const BITE_FROM = 'M18 -4c5.52 0 10 4.48 10 10c0 5.52 -4.48 10 -10 10c-5.52 0 -10 -4.48 -10 -10c0 -5.52 4.48 -10 10 -10Z'
const BITE_TO = 'M22 -4c3.31 0 6 2.69 6 6c0 3.31 -2.69 6 -6 6c-3.31 0 -6 -2.69 -6 -6c0 -3.31 2.69 -6 6 -6Z'

const RAYS = [
  {
    begin: '0.4s',
    from: 'M12 19v1M19 12h1M12 5v-1M5 12h-1',
    to: 'M12 21v1M21 12h1M12 3v-1M3 12h-1',
  },
  {
    begin: '0.6s',
    from: 'M17 17l0.5 0.5M17 7l0.5 -0.5M7 7l-0.5 -0.5M7 17l-0.5 0.5',
    to: 'M18.5 18.5l0.5 0.5M18.5 5.5l0.5 -0.5M5.5 5.5l-0.5 -0.5M5.5 18.5l-0.5 0.5',
  },
]

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function SunIcon({ className, intro = false }) {
  const maskId = `sun-${useId()}`
  const svgRef = useRef(null)
  const playIntro = intro && !prefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion()) svgRef.current?.pauseAnimations?.()
  }, [])

  const spin = <animateTransform attributeName="transform" dur="30s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12" />

  if (!playIntro) {
    return (
      <svg ref={svgRef} aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path fill="currentColor" d={CORE} />
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          {RAYS.map((ray) => (
            <path key={ray.begin} d={ray.to}>
              {spin}
            </path>
          ))}
        </g>
      </svg>
    )
  }

  return (
    <svg ref={svgRef} aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <defs>
        <mask id={maskId}>
          <path fill="#fff" d={CORE}>
            <animate fill="freeze" attributeName="d" dur="0.4s" values={`${MOON_DISC};${CORE}`} />
          </path>
          <path d={BITE_TO}>
            <animate fill="freeze" attributeName="d" dur="0.4s" values={`${BITE_FROM};${BITE_TO}`} />
            <set fill="freeze" attributeName="opacity" begin="0.4s" to="0" />
          </path>
        </mask>
      </defs>
      <path fill="currentColor" d="M0 0h24v24H0z" mask={`url(#${maskId})`} />
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        {RAYS.map((ray) => (
          <path key={ray.begin} d={ray.to} opacity="0">
            {spin}
            <set fill="freeze" attributeName="opacity" begin={ray.begin} to="1" />
            <animate fill="freeze" attributeName="d" begin={ray.begin} dur="0.2s" values={`${ray.from};${ray.to}`} />
          </path>
        ))}
      </g>
    </svg>
  )
}
