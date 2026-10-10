const TITLE_STYLE = 'color:#6366f1;font-family:system-ui,sans-serif;font-size:18px;font-weight:700'
const TEXT_STYLE = 'color:#888;font-family:system-ui,sans-serif;font-size:12px'
const COMMAND_STYLE = 'background:#6366f1;color:#fff;font-family:monospace;font-size:12px;padding:1px 5px;border-radius:3px'

function print() {
  if (import.meta.env.PROD) console.clear()
  console.log('%cblxr.net', TITLE_STYLE)
  console.log('%cThanks for stopping by. Poking around is welcome.', TEXT_STYLE)
  console.log(
    '%cType %cenable%c to turn on extras, or %csecrets%c to see what else is hidden.',
    TEXT_STYLE, COMMAND_STYLE, TEXT_STYLE, COMMAND_STYLE, TEXT_STYLE,
  )
}

export function consoleHello() {
  if (typeof window === 'undefined') return
  const run = () => print()
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
}
