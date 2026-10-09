import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, USES_PATH, CONTACT_PATH } from './lib/router'
import { relativeTime, absoluteTime } from './lib/reviews'
import {
  fetchSpotifyNow,
  fetchSpotifyRecent,
  fetchSpotifyTop,
  LISTENING_INTRO,
  LISTENING_RANGES,
  NOW_POLL_MS,
  RECENT_POLL_MS,
  TOP_TRACKS,
  formatDuration,
  sampleNow,
  progressAt,
  trackEnded,
  nowStatus,
  clockTime,
  groupByDay,
  listeningStats,
  onRepeat,
  playsOn,
  hourly,
  albumsOf,
  artistCounts,
  coverColor,
  fallbackColor,
} from './lib/listening'

const NEUTRAL = '#2a2a2e'
const TIMELINE = 10
const ARTISTS = 10
const SPOTIFY_LOGO =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z'
const PLAY = 'M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z'
const NOTE = 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'
const BACK = 'M15.7 4.3a1 1 0 0 1 0 1.4L9.4 12l6.3 6.3a1 1 0 0 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0z'
const ARROW = 'M7 17 17 7M9 7h8v8'
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const EASE = 'cubic-bezier(.16,1,.3,1)'

const CSS = `
@property --accent{syntax:'<color>';inherits:true;initial-value:${NEUTRAL}}
.sp{--bg:#0e0e10;--surface:#17171a;--surface-2:#1e1e22;--hover:rgba(255,255,255,.055);--line:rgba(255,255,255,.07);--text:#f4f4f5;--sub:#a1a1aa;--faint:#63636b;--green:#1ed760;--green-ink:#0b2915;--skel:#202024;min-height:100dvh;background:var(--bg);color:var(--text);transition:--accent 1.2s ease;-webkit-font-smoothing:antialiased;overflow-x:clip}
:root[data-theme='light'] .sp{--bg:#f6f6f4;--surface:#ffffff;--surface-2:#efefec;--hover:rgba(20,20,24,.045);--line:rgba(20,20,24,.08);--text:#18181b;--sub:#5f5f66;--faint:#9a9aa2;--green:#14a84a;--skel:#e8e8e4}
:where(.sp) a{color:inherit;text-decoration:none}
:where(.sp) button{cursor:pointer}
.sp :focus-visible{outline:2px solid var(--green);outline-offset:3px;border-radius:8px}
.sp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sp-u:hover{text-decoration:underline;text-underline-offset:3px}
.sp-trunc{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sp-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.sp-eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub)}
.sp-wrap{max-width:1180px;margin:0 auto;padding:0 16px}
@media(min-width:768px){.sp-wrap{padding:0 32px}}
.sp-in{animation:sp-rise .8s ${EASE} backwards;animation-delay:calc(var(--i,0) * 70ms)}
@keyframes sp-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes sp-fade{from{opacity:0}to{opacity:1}}
.sp-bar{position:sticky;top:0;z-index:40;height:64px;transition:background-color .35s,box-shadow .35s}
.sp-bar[data-solid='true']{background:color-mix(in srgb,var(--bg) 80%,transparent);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 1px 0 var(--line)}
.sp-bar .sp-wrap{height:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px}
.sp-ghost{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px 0 10px;border-radius:999px;font-size:13px;font-weight:600;color:var(--sub);box-shadow:inset 0 0 0 1px var(--line);transition:color .2s,background-color .2s,transform .2s;justify-self:start}
.sp-ghost:hover{color:var(--text);background:var(--hover)}
.sp-ghost:active{transform:scale(.97)}
.sp-mini{display:flex;align-items:center;gap:10px;min-width:0;max-width:360px;opacity:0;transform:translateY(8px);transition:opacity .4s ${EASE},transform .4s ${EASE};pointer-events:none}
.sp-bar[data-solid='true'] .sp-mini{opacity:1;transform:none;pointer-events:auto}
.sp-mini img{width:28px;height:28px;border-radius:6px;object-fit:cover}
.sp-mini span{font-size:13px;font-weight:600}
.sp-tools{display:flex;align-items:center;gap:6px;justify-self:end}
.sp-tool{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;min-width:36px;padding:0 10px;border-radius:999px;color:var(--sub);box-shadow:inset 0 0 0 1px var(--line);transition:color .2s,background-color .2s}
.sp-tool:hover{color:var(--text);background:var(--hover)}
.sp-hero{position:relative;isolation:isolate;overflow:hidden;border-radius:28px;color:#fafafa;background:color-mix(in srgb,var(--accent) 38%,#0b0b0d);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),0 30px 80px -40px color-mix(in srgb,var(--accent) 70%,#000);transition:box-shadow 1.2s}
.sp-hero-bg{position:absolute;inset:-25%;z-index:-3;background-size:cover;background-position:center;filter:blur(64px) saturate(1.5);opacity:.6;animation:sp-fade 1.2s ease both}
.sp-hero::before{content:'';position:absolute;inset:0;z-index:-2;background:radial-gradient(110% 80% at 80% 35%,rgba(11,11,13,0) 0,rgba(11,11,13,.55) 70%),linear-gradient(180deg,rgba(11,11,13,.05) 0,rgba(11,11,13,.7) 100%)}
.sp-hero::after{content:'';position:absolute;inset:0;z-index:-1;background-image:${GRAIN};opacity:.09;mix-blend-mode:overlay;pointer-events:none}
.sp-hero-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:28px;padding:24px}
@media(min-width:880px){.sp-hero-grid{grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);align-items:center;gap:40px;padding:56px;min-height:500px}}
.sp-hero-text{min-width:0;display:flex;flex-direction:column;order:2}
@media(min-width:880px){.sp-hero-text{order:1}}
.sp-status{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;height:30px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.08);font-size:12.5px;font-weight:600;color:rgba(255,255,255,.85);backdrop-filter:blur(8px)}
.sp-dot{position:relative;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45)}
.sp-dot[data-on='true']{background:var(--green)}
.sp-dot[data-on='true']::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:var(--green);opacity:.4;animation:sp-ping 1.8s ${EASE} infinite}
@keyframes sp-ping{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.8);opacity:0}}
.sp-title{font-size:clamp(40px,6.2vw,84px);font-weight:800;letter-spacing:-.05em;line-height:.98;margin:22px 0 16px;padding-bottom:.06em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;text-wrap:balance}
.sp-title-sm{font-size:clamp(30px,4.2vw,52px)}
.sp-by{font-size:17px;font-weight:600;color:#fff}
.sp-album{font-size:14px;color:rgba(255,255,255,.6);margin-top:4px}
.sp-progress{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;margin-top:32px;font-size:11.5px;color:rgba(255,255,255,.6)}
.sp-track{position:relative;height:4px;border-radius:4px;background:rgba(255,255,255,.16);overflow:hidden}
.sp-fill{position:absolute;inset:0;transform-origin:left;border-radius:4px;background:#fff;transition:transform 1s linear,background-color .2s}
.sp-progress:hover .sp-fill{background:var(--green)}
.sp-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:24px}
.sp-play{width:60px;height:60px;border-radius:50%;background:var(--green);color:#0b0b0d;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 12px 30px -10px color-mix(in srgb,var(--green) 70%,#000),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .35s ${EASE}}
.sp-play:hover{transform:scale(1.07)}
.sp-play:active{transform:scale(.96)}
.sp-play[aria-disabled='true']{opacity:.45;pointer-events:none}
.sp-glass{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 18px 0 14px;border-radius:999px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),inset 0 1px 0 rgba(255,255,255,.1);font-size:13.5px;font-weight:600;color:#fff;transition:background-color .2s,transform .2s}
.sp-glass:hover{background:rgba(255,255,255,.14)}
.sp-glass:active{transform:scale(.97)}
.sp-stage{position:relative;order:1;justify-self:start;width:min(70vw,300px);margin-right:22%}
@media(min-width:880px){.sp-stage{order:2;justify-self:center;width:min(28vw,340px);margin-right:18%}}
.sp-disc{position:absolute;inset:3%;border-radius:50%;transform:translateX(18%);transition:transform 1.1s ${EASE};box-shadow:0 20px 50px -20px rgba(0,0,0,.8)}
.sp-stage[data-playing='true'] .sp-disc{transform:translateX(42%)}
.sp-vinyl{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.08) 0 1%,transparent 1.2%),radial-gradient(circle,transparent 0 30%,rgba(255,255,255,.04) 30.5% 31%,transparent 31.5%),repeating-radial-gradient(circle,#101012 0 2px,#18181b 2px 3px),#121214;animation:sp-spin 3.2s linear infinite;animation-play-state:paused}
.sp-vinyl::after{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,transparent 0 40deg,rgba(255,255,255,.07) 60deg,transparent 80deg 220deg,rgba(255,255,255,.05) 240deg,transparent 260deg)}
.sp-stage[data-playing='true'] .sp-vinyl{animation-play-state:running}
.sp-label{position:absolute;inset:34%;border-radius:50%;background-size:cover;background-position:center;box-shadow:0 0 0 3px #0f0f11}
.sp-label::after{content:'';position:absolute;inset:44%;border-radius:50%;background:#0e0e10}
@keyframes sp-spin{to{transform:rotate(360deg)}}
.sp-cover{position:relative;display:block;width:100%;aspect-ratio:1;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.06);box-shadow:0 30px 60px -20px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,255,255,.08);animation:sp-float 7s ease-in-out infinite;color:rgba(255,255,255,.5)}
.sp-cover img{width:100%;height:100%;object-fit:cover;display:block}
.sp-cover .sp-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
@keyframes sp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.sp-rail{position:relative;overflow:hidden;margin-top:20px;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.sp-rail-track{display:flex;gap:10px;width:max-content;animation:sp-marquee var(--dur,80s) linear infinite}
.sp-rail:hover .sp-rail-track{animation-play-state:paused}
.sp-rail a{display:block;width:72px;height:72px;border-radius:12px;overflow:hidden;flex-shrink:0;box-shadow:inset 0 0 0 1px var(--line);transition:transform .4s ${EASE},opacity .3s}
.sp-rail a:hover{transform:translateY(-4px) scale(1.04)}
.sp-rail img{width:100%;height:100%;object-fit:cover;display:block}
@keyframes sp-marquee{to{transform:translateX(-50%)}}
.sp-sec{padding-top:72px}
.sp-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px 24px;margin-bottom:24px}
.sp-h2{font-size:clamp(26px,3vw,34px);font-weight:800;letter-spacing:-.035em;line-height:1.05;margin:8px 0 0}
.sp-seg{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:4px;border-radius:999px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line)}
.sp-seg-pill{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px) / 3);border-radius:999px;background:var(--text);transform:translateX(calc(var(--idx) * 100%));transition:transform .5s ${EASE}}
.sp-seg button{position:relative;height:34px;padding:0 16px;font-size:13px;font-weight:600;color:var(--sub);transition:color .3s;white-space:nowrap}
.sp-seg button[aria-pressed='true']{color:var(--bg)}
.sp-bento{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@media(min-width:900px){.sp-bento{grid-template-columns:repeat(12,minmax(0,1fr))}.sp-t-artist{grid-column:span 7;grid-row:span 2}.sp-t-song,.sp-t-minutes,.sp-t-repeat{grid-column:span 5}.sp-t-clock{grid-column:span 7}}
.sp-tile{position:relative;isolation:isolate;overflow:hidden;border-radius:24px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);padding:24px;min-height:200px;display:flex;flex-direction:column;justify-content:space-between;gap:20px;transition:transform .6s ${EASE},box-shadow .3s}
a.sp-tile:hover{transform:translateY(-3px)}
a.sp-tile:active{transform:scale(.99)}
.sp-tile-media{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover;transition:transform 1.4s ${EASE}}
a.sp-tile:hover .sp-tile-media{transform:scale(1.05)}
.sp-dark{color:#fafafa;background:#141416}
.sp-dark .sp-eyebrow{color:rgba(255,255,255,.7)}
.sp-dark::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(11,11,13,.6) 0,rgba(11,11,13,0) 26%,rgba(11,11,13,0) 45%,rgba(11,11,13,.86) 100%)}
.sp-dark .sp-name{color:#fff}
.sp-dark .sp-artists{color:rgba(255,255,255,.72)}
.sp-t-artist{min-height:420px;padding:28px}
.sp-t-artist .sp-tile-media{object-position:50% 18%}
.sp-t-repeat .sp-song-bg{opacity:.45}
.sp-artist-name{font-size:clamp(44px,6vw,84px);font-weight:800;letter-spacing:-.055em;line-height:.92;overflow-wrap:anywhere;text-wrap:balance}
.sp-stack{display:flex;align-items:center;margin-top:18px}
.sp-stack img,.sp-stack .sp-ph{width:30px;height:30px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(11,11,13,.9);margin-left:-8px;background:#222}
.sp-stack img:first-child{margin-left:0}
.sp-stack span{margin-left:10px;font-size:12.5px;color:rgba(255,255,255,.75)}
.sp-t-song{flex-direction:row;align-items:center;justify-content:flex-start;gap:18px}
.sp-song-bg{position:absolute;inset:-30%;z-index:-2;background-size:cover;background-position:center;filter:blur(40px) saturate(1.4);opacity:.55}
.sp-t-song::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(11,11,13,.35),rgba(11,11,13,.75))}
.sp-song-art{width:112px;height:112px;flex-shrink:0;border-radius:12px;object-fit:cover;box-shadow:0 18px 40px -16px rgba(0,0,0,.8);transform:rotate(-3deg);transition:transform .6s ${EASE}}
a.sp-tile:hover .sp-song-art{transform:rotate(0) scale(1.03)}
.sp-big{font-size:clamp(22px,2.4vw,30px);font-weight:800;letter-spacing:-.035em;line-height:1.05;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.sp-num{font-size:clamp(64px,7vw,96px);font-weight:800;letter-spacing:-.06em;line-height:.85}
.sp-num small{font-size:.32em;letter-spacing:-.02em;font-weight:700;color:var(--sub);margin-left:6px}
.sp-pair{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);padding-top:16px}
.sp-pair div+div{border-left:1px solid var(--line);padding-left:16px}
.sp-pair b{display:block;font-size:22px;font-weight:800;letter-spacing:-.03em}
.sp-pair span{font-size:12.5px;color:var(--sub)}
.sp-bars{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));align-items:end;gap:3px;height:108px}
.sp-bars i{display:block;border-radius:3px 3px 1px 1px;background:var(--surface-2);min-height:3px;transform-origin:bottom;animation:sp-grow .9s ${EASE} both;animation-delay:calc(var(--i) * 18ms)}
.sp-bars i[data-peak='true']{background:var(--green)}
.sp-bars i[data-on='true']:not([data-peak='true']){background:color-mix(in srgb,var(--text) 22%,var(--surface))}
@keyframes sp-grow{from{transform:scaleY(0)}to{transform:none}}
.sp-axis{display:flex;justify-content:space-between;margin-top:8px;font-size:10.5px;color:var(--faint)}
.sp-repeat{display:flex;align-items:center;gap:16px}
.sp-repeat img,.sp-repeat .sp-ph{width:72px;height:72px;border-radius:12px;object-fit:cover;flex-shrink:0;background:var(--surface-2);display:flex;align-items:center;justify-content:center;color:var(--faint)}
.sp-times{color:var(--green)}
.sp-split{display:grid;grid-template-columns:minmax(0,1fr);gap:56px}
@media(min-width:960px){.sp-split{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:56px}}
.sp-list{display:flex;flex-direction:column}
.sp-row{display:grid;grid-template-columns:28px 48px minmax(0,1fr) auto;align-items:center;gap:14px;padding:8px 10px;margin:0 -10px;border-radius:14px;transition:background-color .2s}
.sp-row:hover{background:var(--hover)}
.sp-rank{font-size:13px;color:var(--faint);text-align:right;position:relative;height:20px;display:flex;align-items:center;justify-content:flex-end}
.sp-rank svg{position:absolute;right:0;opacity:0;color:var(--green);transition:opacity .2s}
.sp-row:hover .sp-rank span{opacity:0}
.sp-row:hover .sp-rank svg{opacity:1}
.sp-thumb{width:48px;height:48px;border-radius:10px;object-fit:cover;background:var(--surface-2);display:flex;align-items:center;justify-content:center;color:var(--faint)}
.sp-round{border-radius:50%}
.sp-name{font-size:15px;font-weight:600;color:var(--text)}
.sp-artists{font-size:13px;color:var(--sub);margin-top:2px}
.sp-e{display:inline-flex;align-items:center;justify-content:center;height:15px;min-width:15px;padding:0 3px;margin-right:6px;border-radius:3px;background:var(--surface-2);color:var(--sub);font-size:9px;font-weight:800;vertical-align:1px;box-shadow:inset 0 0 0 1px var(--line)}
.sp-end{font-size:12px;color:var(--sub);text-align:right}
.sp-go{color:var(--faint);opacity:0;transform:translate(-4px,4px);transition:opacity .25s,transform .35s ${EASE}}
.sp-row:hover .sp-go{opacity:1;transform:none;color:var(--text)}
.sp-subhead{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px}
.sp-subhead h3{font-size:18px;font-weight:700;letter-spacing:-.02em}
.sp-more{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;margin-top:16px;border-radius:999px;font-size:13px;font-weight:600;color:var(--text);box-shadow:inset 0 0 0 1px var(--line);transition:background-color .2s,transform .2s}
.sp-more:hover{background:var(--hover)}
.sp-more:active{transform:scale(.97)}
.sp-day{display:flex;align-items:center;gap:12px;margin:22px 0 6px}
.sp-day:first-child{margin-top:0}
.sp-day::after{content:'';flex:1;height:1px;background:var(--line)}
.sp-tl{grid-template-columns:52px 44px minmax(0,1fr) auto}
.sp-tl .sp-thumb{width:44px;height:44px}
.sp-when{font-size:12px;color:var(--sub)}
.sp-ago{display:none}
@media(min-width:640px){.sp-ago{display:block}}
.sp-side{align-self:start;padding:24px;border-radius:24px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line)}
@media(min-width:960px){.sp-side{position:sticky;top:88px}}
.sp-side h3{font-size:18px;font-weight:700;letter-spacing:-.02em;margin:8px 0 20px}
.sp-tally{display:flex;flex-direction:column;gap:16px}
.sp-tally li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:baseline;font-size:14px}
.sp-tally b{font-size:12px;font-weight:600;color:var(--sub)}
.sp-tally-bar{grid-column:1/-1;height:6px;border-radius:6px;background:var(--surface-2);overflow:hidden}
.sp-tally-bar i{display:block;height:100%;border-radius:6px;background:color-mix(in srgb,var(--text) 32%,var(--surface));transform-origin:left;animation:sp-growx 1s ${EASE} backwards;animation-delay:calc(var(--i) * 60ms)}
.sp-tally li:first-child .sp-tally-bar i{background:var(--green)}
@keyframes sp-growx{from{transform:scaleX(0)}}
.sp-skel{background:var(--skel);border-radius:10px;animation:sp-pulse 1.6s ease-in-out infinite}
@keyframes sp-pulse{50%{opacity:.5}}
.sp-msg{font-size:14px;color:var(--sub);padding:12px 0}
.sp-msg button{font-weight:700;color:var(--text);margin-left:8px;text-decoration:underline;text-underline-offset:3px}
.sp-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-top:96px;padding:28px 0 64px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)}
.sp-foot-brand{display:flex;align-items:center;gap:10px}
.sp-foot-brand svg{color:var(--green)}
.sp-foot-links{display:flex;gap:20px;font-weight:600}
.sp-foot-links a:hover{color:var(--text)}
`

const loadNow = (_, opts) => fetchSpotifyNow(opts).then((data) => sampleNow(data))
const loadRecent = (_, opts) => fetchSpotifyRecent(opts)
const topCache = new Map()
const loadTop = async (range, opts) => {
  const hit = topCache.get(range)
  if (hit) return hit
  const data = await fetchSpotifyTop(range, opts)
  topCache.set(range, data)
  return data
}

function usePageVisible() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

function useScrolled(offset) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [offset])
  return scrolled
}

function useClock(every) {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (!every) return
    setClock(Date.now())
    const id = setInterval(() => setClock(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return clock
}

function useLive(load, { key = '', every = 0, active = true } = {}) {
  const [state, setState] = useState({ key, data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    let timer = 0
    const run = async () => {
      try {
        const data = await load(key, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        setState({ key, data, error: null })
      } catch (err) {
        if (ctrl.signal.aborted) return
        const code = err?.code || 'failed'
        setState((prev) => ({ key, data: prev.key === key ? prev.data : null, error: code }))
        if (code === 'spotify_disabled') return
      }
      if (every) timer = setTimeout(run, every)
    }
    run()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [load, key, every, active, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current || (state.data === null && state.error === null),
    refresh,
  }
}

function useAccent(track) {
  const [accent, setAccent] = useState(NEUTRAL)
  const url = track?.thumb || track?.art
  const seed = track?.id || track?.title
  useEffect(() => {
    if (!seed) return
    let live = true
    coverColor(url).then((color) => {
      if (live) setAccent(color || fallbackColor(seed))
    })
    return () => {
      live = false
    }
  }, [url, seed])
  return accent
}

function Glyph({ d, size = 16, stroke = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : undefined}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

const SpotifyMark = ({ size = 20 }) => <Glyph d={SPOTIFY_LOGO} size={size} />

function Img({ src, className, size = 300, alt = '' }) {
  if (!src) {
    return (
      <span aria-hidden="true" className={`sp-ph ${className || ''}`}>
        <Glyph d={NOTE} size={18} stroke />
      </span>
    )
  }
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={className} />
}

function Out({ href, className = 'sp-u', children, label, tabIndex }) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={className} tabIndex={tabIndex}>
      {children}
    </a>
  )
}

function Artists({ track }) {
  const artists = track?.artists || []
  if (!artists.length) return <>Unknown artist</>
  return artists.map((artist, index) => (
    <span key={`${artist.name}-${index}`}>
      {index > 0 && ', '}
      <Out href={artist.url}>{artist.name}</Out>
    </span>
  ))
}

const names = (track) => (track?.artists || []).map((a) => a.name).join(', ')

function Explicit({ track }) {
  if (!track?.explicit) return null
  return (
    <span className="sp-e" title="Explicit">
      E
    </span>
  )
}

function heroState(now, recent, clock) {
  const status = nowStatus(now.data)
  const last = recent.data?.[0]
  if (now.loading) return { kind: 'loading' }
  if (now.error === 'spotify_disabled') return { kind: 'message', title: 'Not connected right now', body: 'The Spotify link is off for the moment. Check back later.' }
  if (!now.data && now.error) return { kind: 'message', title: 'Could not reach Spotify', body: 'Trying again in a few seconds.' }
  if (status === 'podcast') return { kind: 'message', title: 'Listening to a podcast', body: 'Podcast episodes stay private.' }
  if (status === 'idle' && !last) return { kind: 'message', title: 'Quiet right now', body: recent.loading ? 'Looking up the last song.' : 'Nothing played lately.' }
  if (status === 'idle') return { kind: 'track', status, track: last.track, label: `Last played ${relativeTime(last.playedAt, clock)}` }
  return { kind: 'track', status, track: now.data.track, label: status === 'playing' ? 'Now playing on Spotify' : 'Paused' }
}

function Stage({ track, playing }) {
  return (
    <div className="sp-stage" data-playing={playing}>
      <div className="sp-disc" aria-hidden="true">
        <div className="sp-vinyl">
          {track?.art && <div className="sp-label" style={{ backgroundImage: `url("${track.thumb || track.art}")` }} />}
        </div>
      </div>
      {track?.url ? (
        <a href={track.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true" className="sp-cover">
          <Img src={track.art} size={300} />
        </a>
      ) : (
        <div className="sp-cover">
          <Img src={track?.art} size={300} />
        </div>
      )}
    </div>
  )
}

function Progress({ now, clock }) {
  const at = progressAt(now, clock)
  const duration = now?.track?.durationMs
  if (at === null || !duration) return null
  const ratio = Math.min(1, Math.max(0, at / duration))
  return (
    <div className="sp-progress sp-mono">
      <span>{formatDuration(at)}</span>
      <div
        className="sp-track"
        role="progressbar"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(at / 1000)}
        aria-valuetext={`${formatDuration(at)} of ${formatDuration(duration)}`}
      >
        <div className="sp-fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <span>{formatDuration(duration)}</span>
    </div>
  )
}

function Hero({ hero, now, clock }) {
  const track = hero.kind === 'track' ? hero.track : null
  const playing = hero.status === 'playing'
  const bg = track?.art

  let text
  if (hero.kind === 'loading') {
    text = (
      <div className="sp-hero-text" aria-hidden="true">
        <div className="sp-skel" style={{ width: 170, height: 30, borderRadius: 999, background: 'rgba(255,255,255,.1)' }} />
        <div className="sp-skel" style={{ width: '82%', height: 72, margin: '22px 0 16px', background: 'rgba(255,255,255,.1)' }} />
        <div className="sp-skel" style={{ width: 200, height: 16, background: 'rgba(255,255,255,.1)' }} />
      </div>
    )
  } else if (hero.kind === 'message') {
    text = (
      <div className="sp-hero-text">
        <span className="sp-status">
          <span className="sp-dot" />
          Spotify
        </span>
        <h2 className="sp-title sp-title-sm">{hero.title}</h2>
        <p className="sp-album">{hero.body}</p>
      </div>
    )
  } else {
    text = (
      <div className="sp-hero-text" aria-live="polite">
        <span className="sp-status">
          <span className="sp-dot" data-on={playing} />
          {hero.label}
        </span>
        <h2 className="sp-title" title={track.title}>
          <Out href={track.url}>{track.title}</Out>
        </h2>
        <p className="sp-by">
          <Explicit track={track} />
          <Artists track={track} />
        </p>
        {track.album?.name && (
          <p className="sp-album">
            <Out href={track.album.url}>{track.album.name}</Out>
            {track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ''}
          </p>
        )}
        {hero.status !== 'idle' && <Progress now={now.data} clock={clock} />}
        <div className="sp-actions">
          <a href={track.url || undefined} target="_blank" rel="noreferrer" className="sp-play" aria-label={`Play ${track.title} on Spotify`} aria-disabled={!track.url}>
            <Glyph d={PLAY} size={26} />
          </a>
          <a href={track.url || 'https://open.spotify.com'} target="_blank" rel="noreferrer" className="sp-glass">
            <SpotifyMark size={18} />
            Open in Spotify
          </a>
        </div>
      </div>
    )
  }

  return (
    <section className="sp-hero sp-in" aria-label="Now playing">
      {bg && <div key={bg} className="sp-hero-bg" style={{ backgroundImage: `url("${bg}")` }} />}
      <div className="sp-hero-grid">
        {text}
        {hero.kind === 'loading' ? (
          <div className="sp-stage">
            <div className="sp-cover sp-skel" style={{ background: 'rgba(255,255,255,.08)', animation: 'sp-pulse 1.6s ease-in-out infinite' }} />
          </div>
        ) : (
          <Stage track={track} playing={playing} />
        )}
      </div>
    </section>
  )
}

function Rail({ recent }) {
  const albums = albumsOf(recent.data, 24)
  if (albums.length < 6) return null
  const loop = [...albums, ...albums]
  return (
    <div className="sp-rail sp-in" style={{ '--i': 2 }} role="group" aria-label="Albums in rotation">
      <div className="sp-rail-track" style={{ '--dur': `${albums.length * 3.2}s` }}>
        {loop.map((track, index) => (
          <a
            key={`${track.id}-${index}`}
            href={track.album?.url || track.url || undefined}
            target="_blank"
            rel="noreferrer"
            title={`${track.album?.name || track.title} · ${names(track)}`}
            aria-hidden={index >= albums.length}
            tabIndex={index >= albums.length ? -1 : undefined}
          >
            <img src={track.thumb || track.art} alt={index >= albums.length ? '' : `${track.album?.name || track.title} by ${names(track)}`} width="72" height="72" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </a>
        ))}
      </div>
    </div>
  )
}

function Head({ id, eyebrow, title, action }) {
  return (
    <div className="sp-head">
      <div>
        <p className="sp-eyebrow">{eyebrow}</p>
        <h2 id={id} className="sp-h2">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

function Segmented({ value, onChange }) {
  const idx = Math.max(0, LISTENING_RANGES.findIndex((r) => r.id === value))
  return (
    <div role="group" aria-label="Time range" className="sp-seg" style={{ '--idx': idx }}>
      <span className="sp-seg-pill" aria-hidden="true" />
      {LISTENING_RANGES.map((range) => (
        <button key={range.id} type="button" aria-pressed={range.id === value} onClick={() => onChange(range.id)}>
          {range.label}
        </button>
      ))}
    </div>
  )
}

function Unavailable({ error, onRetry }) {
  if (error === 'spotify_disabled') return <p className="sp-msg">Not connected right now.</p>
  return (
    <p className="sp-msg">
      Could not load this from Spotify.
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </p>
  )
}

function Tile({ className, href, label, children, i }) {
  const props = { className: `sp-tile sp-in ${className}`, style: { '--i': i } }
  if (!href) return <div {...props}>{children}</div>
  return (
    <a {...props} href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {children}
    </a>
  )
}

function Bento({ top, recent, rangeLabel, clock }) {
  if (top.loading || recent.loading) {
    return (
      <div className="sp-bento" aria-hidden="true">
        {['sp-t-artist', 'sp-t-song', 'sp-t-minutes', 'sp-t-clock', 'sp-t-repeat'].map((name) => (
          <div key={name} className={`sp-tile sp-skel ${name}`} style={{ boxShadow: 'none' }} />
        ))}
      </div>
    )
  }
  const artists = top.data?.artists || []
  const artist = artists[0]
  const song = top.data?.tracks?.[0]
  const plays = recent.data || []
  if (!artist && !song && !plays.length) return <Unavailable error={top.error || recent.error} onRetry={top.refresh} />

  const stats = listeningStats(plays)
  const [repeat] = onRepeat(plays, 2)
  const today = playsOn(plays, clock)
  const { counts, max, peak } = hourly(plays)

  return (
    <div className="sp-bento">
      {artist ? (
        <Tile className="sp-t-artist sp-dark" href={artist.url} label={`${artist.name} on Spotify`} i={0}>
          <Img src={artist.art || artist.thumb} className="sp-tile-media" size={640} />
          <p className="sp-eyebrow">No. 1 artist · {rangeLabel}</p>
          <div>
            <p className="sp-artist-name">{artist.name}</p>
            {artists.length > 1 && (
              <div className="sp-stack">
                {artists.slice(1, 5).map((a, index) => (
                  <Img key={a.id || index} src={a.thumb || a.art} size={64} />
                ))}
                <span>then {artists.slice(1, 3).map((a) => a.name).join(', ')}</span>
              </div>
            )}
          </div>
        </Tile>
      ) : (
        <Tile className="sp-t-artist" i={0}>
          <p className="sp-eyebrow">No. 1 artist</p>
          <p className="sp-msg">Not enough listening in this range yet.</p>
        </Tile>
      )}

      {song ? (
        <Tile className="sp-t-song sp-dark" href={song.url} label={`${song.title} on Spotify`} i={1}>
          {song.art && <div className="sp-song-bg" style={{ backgroundImage: `url("${song.art}")` }} />}
          <Img src={song.art} className="sp-song-art" size={300} />
          <div style={{ minWidth: 0 }}>
            <p className="sp-eyebrow">No. 1 song</p>
            <p className="sp-big">{song.title}</p>
            <p className="sp-trunc" style={{ fontSize: 13.5, marginTop: 6, color: 'rgba(255,255,255,.75)' }}>
              {names(song)}
            </p>
          </div>
        </Tile>
      ) : (
        <Tile className="sp-t-song" i={1}>
          <p className="sp-eyebrow">No. 1 song</p>
          <p className="sp-msg">Not enough listening yet.</p>
        </Tile>
      )}

      <Tile className="sp-t-minutes" i={2}>
        <p className="sp-eyebrow">Last {stats.plays} plays</p>
        <p className="sp-num">
          {stats.minutes.toLocaleString('en-US')}
          <small>min</small>
        </p>
        <div className="sp-pair">
          <div>
            <b>{stats.artists}</b>
            <span>artists</span>
          </div>
          <div>
            <b>{today}</b>
            <span>{today === 1 ? 'play today' : 'plays today'}</span>
          </div>
        </div>
      </Tile>

      <Tile className="sp-t-clock" i={3}>
        <div>
          <p className="sp-eyebrow">When I listen</p>
          <p className="sp-big">{peak === null ? 'No plays yet' : `Mostly around ${String(peak).padStart(2, '0')}:00`}</p>
        </div>
        <div>
          <div className="sp-bars" role="img" aria-label={peak === null ? 'No plays to chart' : `Plays by hour of day, busiest at ${peak}:00`}>
            {counts.map((count, hour) => (
              <i
                key={hour}
                data-on={count > 0}
                data-peak={hour === peak}
                title={`${String(hour).padStart(2, '0')}:00 · ${count} ${count === 1 ? 'play' : 'plays'}`}
                style={{ height: max ? `${Math.max(3, (count / max) * 100)}%` : '3px', '--i': hour }}
              />
            ))}
          </div>
          <div className="sp-axis sp-mono" aria-hidden="true">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
      </Tile>

      {repeat ? (
        <Tile className="sp-t-repeat sp-dark" href={repeat.track.url} label={`${repeat.track.title} on Spotify`} i={4}>
          {repeat.track.art && <div className="sp-song-bg" style={{ backgroundImage: `url("${repeat.track.art}")` }} />}
          <p className="sp-eyebrow">On repeat</p>
          <div className="sp-repeat">
            <Img src={repeat.track.thumb || repeat.track.art} size={160} />
            <div style={{ minWidth: 0 }}>
              <p className="sp-num sp-times" style={{ fontSize: 56 }}>
                ×{repeat.count}
              </p>
              <p className="sp-name sp-trunc" style={{ marginTop: 8 }}>
                {repeat.track.title}
              </p>
              <p className="sp-artists sp-trunc">{names(repeat.track)}</p>
            </div>
          </div>
        </Tile>
      ) : (
        <Tile className="sp-t-repeat" i={4}>
          <p className="sp-eyebrow">On repeat</p>
          <p className="sp-msg">No song played twice in the last {stats.plays} plays.</p>
        </Tile>
      )}
    </div>
  )
}

function RowsSkeleton({ rows, round }) {
  return (
    <div className="sp-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sp-row">
          <span />
          <div className="sp-skel" style={{ width: 48, height: 48, borderRadius: round ? '50%' : 10 }} />
          <div>
            <div className="sp-skel" style={{ width: `${68 - (i % 3) * 14}%`, height: 12 }} />
            <div className="sp-skel" style={{ width: '34%', height: 10, marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function TopTracks({ top }) {
  const [all, setAll] = useState(false)
  if (top.loading) return <RowsSkeleton rows={6} />
  if (!top.data) return <Unavailable error={top.error} onRetry={top.refresh} />
  const tracks = top.data.tracks
  if (!tracks.length) return <p className="sp-msg">Not enough listening in this range yet.</p>
  const shown = all ? tracks : tracks.slice(0, TOP_TRACKS)
  return (
    <div>
      <ol className="sp-list">
        {shown.map((track, index) => (
          <li key={track.id || index} className="sp-row sp-in" style={{ '--i': Math.min(index, 10) }}>
            <span className="sp-rank sp-mono">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <Out href={track.url} className="" label={`Play ${track.title} on Spotify`}>
                <Glyph d={PLAY} size={14} />
              </Out>
            </span>
            <Img src={track.thumb || track.art} className="sp-thumb" size={64} />
            <div style={{ minWidth: 0 }}>
              <p className="sp-name sp-trunc">
                <Out href={track.url}>{track.title}</Out>
              </p>
              <p className="sp-artists sp-trunc">
                <Explicit track={track} />
                <Artists track={track} />
              </p>
            </div>
            <span className="sp-end sp-mono">{track.durationMs ? formatDuration(track.durationMs) : ''}</span>
          </li>
        ))}
      </ol>
      {tracks.length > TOP_TRACKS && (
        <button type="button" className="sp-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show top 10' : `Show all ${tracks.length}`}
        </button>
      )}
    </div>
  )
}

function TopArtists({ top }) {
  if (top.loading) return <RowsSkeleton rows={6} round />
  if (!top.data) return <Unavailable error={top.error} onRetry={top.refresh} />
  const artists = top.data.artists.slice(0, ARTISTS)
  if (!artists.length) return <p className="sp-msg">Not enough listening in this range yet.</p>
  return (
    <ol className="sp-list">
      {artists.map((artist, index) => (
        <li key={artist.id || index} className="sp-in" style={{ '--i': Math.min(index, 10) }}>
          <a href={artist.url || undefined} target="_blank" rel="noreferrer" className="sp-row">
            <span className="sp-rank sp-mono">
              <span>{String(index + 1).padStart(2, '0')}</span>
            </span>
            <Img src={artist.thumb || artist.art} className="sp-thumb sp-round" size={160} />
            <span className="sp-name sp-trunc">{artist.name}</span>
            <span className="sp-go">
              <Glyph d={ARROW} size={16} stroke />
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

function Timeline({ recent, clock }) {
  const [all, setAll] = useState(false)
  if (recent.loading) return <RowsSkeleton rows={6} />
  if (!recent.data) return <Unavailable error={recent.error} onRetry={recent.refresh} />
  if (!recent.data.length) return <p className="sp-msg">Nothing played lately.</p>
  const shown = all ? recent.data : recent.data.slice(0, TIMELINE)
  return (
    <div>
      {groupByDay(shown, clock).map((group) => (
        <div key={group.key}>
          <p className="sp-day sp-eyebrow">{group.label}</p>
          <ol className="sp-list">
            {group.items.map((item) => (
              <li key={`${item.playedAt}-${item.track.id}`} className="sp-row sp-tl">
                <time className="sp-when sp-mono" dateTime={item.playedAt} title={absoluteTime(item.playedAt)}>
                  {clockTime(item.playedAt)}
                </time>
                <Img src={item.track.thumb || item.track.art} className="sp-thumb" size={64} />
                <div style={{ minWidth: 0 }}>
                  <p className="sp-name sp-trunc">
                    <Out href={item.track.url}>{item.track.title}</Out>
                  </p>
                  <p className="sp-artists sp-trunc">
                    <Explicit track={item.track} />
                    <Artists track={item.track} />
                  </p>
                </div>
                <span className="sp-end sp-ago">{relativeTime(item.playedAt, clock)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {recent.data.length > TIMELINE && (
        <button type="button" className="sp-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show less' : `Show all ${recent.data.length}`}
        </button>
      )}
    </div>
  )
}

function Tally({ recent }) {
  const counted = artistCounts(recent.data, 8)
  if (recent.loading || counted.length < 2) return null
  const max = counted[0].count
  return (
    <aside className="sp-side sp-in" style={{ '--i': 2 }} aria-labelledby="listening-tally">
      <p className="sp-eyebrow">Last {recent.data.length} plays</p>
      <h3 id="listening-tally">Played most, lately</h3>
      <ol className="sp-tally">
        {counted.map((artist, index) => (
          <li key={artist.url || artist.name}>
            <Out href={artist.url} className="sp-u sp-trunc">
              {artist.name}
            </Out>
            <b className="sp-mono">{artist.count}</b>
            <span className="sp-tally-bar" aria-hidden="true">
              <i style={{ width: `${(artist.count / max) * 100}%`, '--i': index }} />
            </span>
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default function ListeningPage({ theme, onToggleTheme }) {
  const visible = usePageVisible()
  const scrolled = useScrolled(420)
  const [range, setRange] = useState(LISTENING_RANGES[0].id)
  const now = useLive(loadNow, { key: 'now', every: NOW_POLL_MS, active: visible })
  const recent = useLive(loadRecent, { key: 'recent', every: RECENT_POLL_MS, active: visible })
  const top = useLive(loadTop, { key: range })
  const status = nowStatus(now.data)
  const clock = useClock(status === 'playing' && visible ? 1000 : 30_000)
  const hero = heroState(now, recent, clock)
  const heroTrack = hero.kind === 'track' ? hero.track : null
  const accent = useAccent(heroTrack)
  const rangeLabel = LISTENING_RANGES.find((r) => r.id === range)?.label || ''

  const trackId = now.data?.track?.id
  const refreshRecent = recent.refresh
  const seenTrack = useRef(trackId)
  useEffect(() => {
    if (!trackId || seenTrack.current === trackId) return
    if (seenTrack.current) refreshRecent()
    seenTrack.current = trackId
  }, [trackId, refreshRecent])

  const refreshNow = now.refresh
  const endedSample = useRef(0)
  useEffect(() => {
    if (!now.data || !trackEnded(now.data, clock) || endedSample.current === now.data.sampledAt) return
    endedSample.current = now.data.sampledAt
    refreshNow()
  }, [now.data, clock, refreshNow])

  return (
    <div className="sp" style={{ '--accent': accent }}>
      <style>{CSS}</style>
      <header className="sp-bar" data-solid={scrolled}>
        <div className="sp-wrap">
          <a {...link(HOME_PATH)} className="sp-ghost">
            <Glyph d={BACK} size={16} />
            Home
          </a>
          <div className="sp-mini" aria-hidden="true">
            {heroTrack?.thumb && <img src={heroTrack.thumb} alt="" width="28" height="28" referrerPolicy="no-referrer" />}
            <span className="sp-trunc">{heroTrack ? heroTrack.title : 'Listening'}</span>
          </div>
          <div className="sp-tools">
            <CommandButton className="sp-tool" />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="sp-tool" />
          </div>
        </div>
      </header>

      <main className="sp-wrap" style={{ paddingTop: 8 }}>
        <h1 className="sp-sr">Listening: what Blxr is playing on Spotify</h1>
        <Hero hero={hero} now={now} clock={clock} />
        <Rail recent={recent} />

        <section aria-labelledby="listening-lately" className="sp-sec">
          <Head id="listening-lately" eyebrow={`My Spotify · last ${rangeLabel}`} title="Lately, in numbers" action={<Segmented value={range} onChange={setRange} />} />
          <Bento top={top} recent={recent} rangeLabel={rangeLabel} clock={clock} />
        </section>

        <div className="sp-split sp-sec">
          <section aria-labelledby="listening-top">
            <Head id="listening-top" eyebrow={`Most played · ${rangeLabel}`} title="Top tracks" />
            <TopTracks top={top} />
          </section>
          <section aria-labelledby="listening-artists">
            <Head id="listening-artists" eyebrow={`Most played · ${rangeLabel}`} title="Top artists" />
            <TopArtists top={top} />
          </section>
        </div>

        <div className="sp-split sp-sec">
          <section aria-labelledby="listening-recent">
            <Head id="listening-recent" eyebrow="The last 50 songs" title="Recently played" />
            <Timeline recent={recent} clock={clock} />
          </section>
          <Tally recent={recent} />
        </div>

        <footer className="sp-foot">
          <div className="sp-foot-brand">
            <SpotifyMark size={22} />
            <span>{LISTENING_INTRO}</span>
          </div>
          <div className="sp-foot-links">
            <a {...link(USES_PATH)}>What I use</a>
            <a {...link(CONTACT_PATH)}>Send me a song</a>
          </div>
        </footer>
      </main>
    </div>
  )
}
