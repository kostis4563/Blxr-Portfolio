import { Icon } from './components/icon'
import { link, backOr, HOME_PATH } from './lib/router'

export default function HelloPage() {
  return (
    <main className="fixed inset-0 grid place-items-center overflow-hidden bg-[#0b0d13] bg-[url('/hello-bg.webp')] bg-cover bg-center bg-no-repeat">
      <a
        {...link(HOME_PATH, () => backOr(HOME_PATH))}
        aria-label="Exit"
        className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-md text-[#767c8a] outline-none transition-colors duration-200 hover:text-[#b4bac8] focus-visible:text-[#b4bac8] focus-visible:ring-2 focus-visible:ring-[#767c8a]/50 motion-reduce:transition-none"
      >
        <Icon name="x" className="h-4.5 w-4.5" />
      </a>
      <h1 className="whitespace-nowrap font-pixel text-[min(max(4.967vw,7.471svh),12.98vw)] leading-[normal] text-[#767c8a] selection:bg-[#2f6fed] selection:text-white">
        hello world
      </h1>
    </main>
  )
}
