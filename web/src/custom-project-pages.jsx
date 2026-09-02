import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n } from './lib/i18n'
import { imageProps } from './lib/images'
import { link, PROJECTS_PATH } from './lib/router'

function Header({ theme, onToggleTheme, width = 'max-w-[1120px]', dark = false, surface = 'bg-bg' }) {
  const { t } = useI18n()
  return (
    <>
      <div aria-hidden="true" className={`fixed inset-x-0 top-0 h-4 z-30 ${dark ? 'bg-[#09090b]' : surface}`} />
      <header className={`w-full ${width} ${dark ? 'bg-[#09090b]/95 border-white/10 text-white' : `${surface} border-line text-ink`} backdrop-blur-xl h-[52px] fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed top-4 flex items-center px-6`}>
        <div className="w-full flex items-center justify-between">
          <a {...link(PROJECTS_PATH)} className={`inline-flex items-center gap-2 text-[13px] font-medium transition-colors cursor-pointer ${dark ? 'text-white/55 hover:text-white' : 'text-ink-muted hover:text-ink-strong'}`}><span>←</span><span>{t('proj.archiveTitle')}</span></a>
          <div className="flex items-center gap-4"><CommandButton className={dark ? 'text-white/55 hover:text-white' : 'text-ink-muted hover:text-ink-strong'} /><ThemeToggle theme={theme} onToggle={onToggleTheme} className={dark ? 'text-white/55 hover:text-white' : 'text-ink-muted hover:text-ink-strong'} /></div>
        </div>
      </header>
    </>
  )
}

export function AsyncPage({ project, theme, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden font-sans animate-view-in">
      <Header theme={theme} onToggleTheme={onToggleTheme} dark />
      <main className="max-w-[1120px] mx-auto pt-28 pb-20 border-x border-dashed border-white/10 min-h-screen">
        <section className="px-6 sm:px-10 lg:px-14">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Closed project / 2026</div>
          <div className="mt-8 grid lg:grid-cols-[1.25fr_.75fr] gap-10 items-end">
            <div><h1 className="text-[clamp(64px,11vw,128px)] leading-[.78] font-bold tracking-[-.075em]">async<span className="text-red-500">.</span></h1><p className="mt-8 max-w-[640px] text-[18px] sm:text-[22px] leading-relaxed text-white/55">From machine evidence to a verdict your staff can understand.</p></div>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-px bg-white/10 border border-white/10">
              {project.metrics.map((metric) => <div key={metric.label} className="bg-[#0d0d10] p-4"><p className="text-[9px] uppercase tracking-wider text-white/35">{metric.label}</p><p className="mt-1 text-sm font-semibold">{metric.value}</p></div>)}
            </div>
          </div>
        </section>
        <section className="mt-12 px-3 sm:px-6"><div className="relative rounded-xl border border-red-500/20 bg-[#101014] p-2 sm:p-3 shadow-[0_30px_100px_rgba(239,68,68,.12)]"><div className="h-7 px-2 flex items-center justify-between text-[9px] font-mono text-white/30"><span>ASYNC / CONTROL</span><span className="text-emerald-400">SYSTEM ONLINE</span></div><img {...imageProps(project.image, '(min-width:1120px) 1060px,96vw')} alt={project.imageAlt} width="1200" height="675" className="w-full rounded-md border border-white/10" /></div></section>
        <section className="mt-20 px-6 sm:px-10 lg:px-14 grid md:grid-cols-[.8fr_1.2fr] gap-12"><div><p className="font-mono text-[10px] tracking-[.16em] text-red-400 uppercase">01 / System</p><h2 className="mt-4 text-3xl font-semibold tracking-tight">Evidence, structured.</h2></div><p className="text-[16px] leading-[1.8] text-white/55">{project.fullDescription}</p></section>
        <section className="mt-20 border-y border-white/10"><div className="grid md:grid-cols-2">{project.features.map((feature, i) => <div key={feature} className={`p-6 sm:p-8 border-white/10 ${i % 2 ? 'md:border-l' : ''} ${i > 1 ? 'border-t' : i === 1 ? 'border-t md:border-t-0' : ''}`}><span className="font-mono text-[10px] text-red-400">0{i + 1}</span><p className="mt-5 text-[14px] leading-relaxed text-white/65">{feature}</p></div>)}</div></section>
        <section className="mt-20 px-6 sm:px-10 lg:px-14"><div className="flex items-end justify-between gap-6 mb-5"><div><p className="font-mono text-[10px] tracking-[.16em] text-red-400 uppercase">Showcase</p><h2 className="mt-3 text-2xl font-semibold">See the platform in action.</h2></div><span className="hidden sm:inline text-[10px] font-mono uppercase tracking-wider text-white/30">Archived presentation</span></div><div className="aspect-video rounded-xl overflow-hidden border border-white/10 bg-black"><iframe src="https://www.youtube-nocookie.com/embed/X0A3AmD4fZY?rel=0" title="async platform showcase" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="w-full h-full border-0" /></div></section>
        <section className="mx-6 sm:mx-10 lg:mx-14 mt-20 flex flex-col sm:flex-row justify-between gap-6 items-start sm:items-center"><div className="flex flex-wrap gap-2">{project.tags.map(tag => <span key={tag} className="border border-white/10 rounded-full px-3 py-1 text-[11px] text-white/45">{tag}</span>)}</div><a href={project.url} target="_blank" rel="noreferrer" className="rounded-full bg-red-500 px-5 py-2.5 text-[13px] font-semibold">Watch showcase ↗</a></section>
      </main>
    </div>
  )
}

export function PadooFoodPage({ project, theme, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-[#e9e9e6] text-[#302b28] overflow-x-hidden font-sans animate-view-in">
      <Header theme={theme} onToggleTheme={onToggleTheme} surface="bg-[#e9e9e6]/95" />
      <main className="max-w-[1040px] mx-auto pt-28 pb-20 border-x border-dashed border-[#cececa] min-h-screen">
        <section className="px-6 sm:px-12 grid md:grid-cols-[1.15fr_.85fr] gap-10 items-center">
          <div><span className="inline-flex rounded-full bg-[#ef9a5b]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[#b65f25]">Restaurant companion · iOS + Android</span><h1 className="mt-7 text-[clamp(48px,8vw,88px)] leading-[.9] font-bold tracking-[-.065em]">Padoo<span className="text-[#e78542]">Food</span></h1><p className="mt-7 max-w-lg text-[18px] leading-relaxed text-[#765c50]">One warm, focused place for restaurants to manage menus, orders and delivery settings.</p><div className="mt-8 flex gap-3">{['React Native', 'Expo', 'TypeScript'].map(x => <span key={x} className="text-[11px] font-medium text-[#967365]">{x}</span>)}</div></div>
          <div className="relative flex justify-center py-8"><div className="absolute inset-8 rounded-full bg-[#ef9a5b]/25 blur-3xl" /><div className="relative w-[250px] rounded-[38px] border-[8px] border-[#2d211c] bg-[#2d211c] p-1 shadow-2xl shadow-[#8e4b22]/25"><img {...imageProps(project.image, '250px')} alt={project.imageAlt} className="w-full rounded-[27px]" /></div></div>
        </section>
        <section className="mt-20 bg-[#e78542] text-white px-6 sm:px-12 py-14 grid md:grid-cols-[.75fr_1.25fr] gap-10"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/60">The product</p><h2 className="mt-5 text-3xl font-semibold tracking-tight">Built from the store side.</h2></div><p className="text-[16px] leading-[1.8] text-white/80">{project.fullDescription}</p></section>
        <section className="px-6 sm:px-12 mt-20"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#b65f25]">Product details</p><div className="mt-6 grid sm:grid-cols-3 gap-4">{project.metrics.map(m => <div key={m.label} className="rounded-2xl bg-[#f3f3f0] border border-[#d2d2ce] p-5"><p className="text-[10px] uppercase tracking-wider text-[#817773]">{m.label}</p><p className="mt-2 text-lg font-semibold">{m.value}</p></div>)}</div></section>
        <section className="px-6 sm:px-12 mt-16 grid md:grid-cols-2 gap-x-12 border-t border-[#e9d8ca]">{project.features.map((f,i) => <div key={f} className="py-5 border-b border-[#e9d8ca] flex gap-4"><span className="text-xs font-mono text-[#e78542]">0{i+1}</span><p className="text-[14px] leading-relaxed text-[#765c50]">{f}</p></div>)}</section>
        <a {...link(PROJECTS_PATH)} className="mt-14 ml-6 sm:ml-12 inline-flex gap-2 text-[13px] font-semibold text-[#967365]">← Projects</a>
      </main>
    </div>
  )
}

export function AmitistaPage({ project, theme, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-bg text-ink overflow-x-hidden font-sans animate-view-in">
      <Header theme={theme} onToggleTheme={onToggleTheme} />
      <main className="max-w-[1180px] mx-auto pt-28 pb-20 border-x border-dashed border-line min-h-screen">
        <section className="px-6 sm:px-10 lg:px-16 text-center"><img {...imageProps(project.logo, '96px')} alt="Amitista Studio mark" className="w-20 h-20 mx-auto object-contain" /><p className="mt-8 text-[10px] uppercase tracking-[.2em] text-violet-500 font-semibold">Independent development studio · Greece</p><h1 className="mt-5 text-[clamp(46px,8vw,94px)] leading-[.92] font-semibold tracking-[-.06em] text-ink-strong">Ideas, designed<br />and built to last.</h1><p className="mt-7 mx-auto max-w-2xl text-[17px] sm:text-[20px] leading-relaxed text-ink-muted">Websites, applications, interfaces and game servers — shaped directly with the people who build them.</p><a href={project.url} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-full bg-violet-600 text-white px-5 py-2.5 text-[13px] font-semibold">Visit the studio ↗</a></section>
        <section className="mt-16 px-3 sm:px-6"><div className="rounded-2xl overflow-hidden border border-line bg-[#221633]"><img {...imageProps(project.image, '(min-width:1180px) 1120px,96vw')} alt={project.imageAlt} className="w-full h-auto" /></div></section>
        <section className="mt-20 px-6 sm:px-10 lg:px-16 grid md:grid-cols-[.7fr_1.3fr] gap-12"><div><p className="text-[10px] uppercase tracking-[.18em] text-violet-500 font-semibold">The studio</p><p className="mt-5 text-2xl font-semibold tracking-tight text-ink-strong">Small by design.<br />Direct by default.</p></div><p className="text-[16px] sm:text-[18px] leading-[1.8] text-ink-secondary">{project.fullDescription}</p></section>
        <section className="mt-20 border-y border-line"><div className="px-6 sm:px-10 lg:px-16 py-8"><p className="text-[10px] uppercase tracking-[.18em] text-ink-subtle font-semibold">Capabilities</p></div><div className="grid md:grid-cols-3 border-t border-line">{project.features.slice(0,3).map((f,i) => <article key={f} className={`p-7 sm:p-9 ${i ? 'border-t md:border-t-0 md:border-l' : ''} border-line`}><span className="text-3xl font-light text-violet-500">0{i+1}</span><p className="mt-10 text-[14px] leading-relaxed text-ink-secondary">{f}</p></article>)}</div></section>
        <section className="mt-20 px-6 sm:px-10 lg:px-16"><div className="rounded-2xl bg-violet-600 text-white p-8 sm:p-12 flex flex-col sm:flex-row justify-between sm:items-end gap-8"><div><p className="text-[10px] uppercase tracking-[.18em] text-white/60">Process</p><h2 className="mt-4 text-[32px] sm:text-[44px] leading-tight font-semibold tracking-[-.04em]">Brief. Design.<br />Build. Support.</h2></div><p className="max-w-sm text-[14px] leading-relaxed text-white/70">Scope and price are agreed before development begins. Clients speak directly with the developers doing the work.</p></div></section>
        <a {...link(PROJECTS_PATH)} className="mt-14 ml-6 sm:ml-10 lg:ml-16 inline-flex gap-2 text-[13px] font-semibold text-ink-muted">← Projects</a>
      </main>
    </div>
  )
}
