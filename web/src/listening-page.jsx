import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, USES_PATH, CONTACT_PATH } from './lib/router'
import { imageProps, imageUrl } from './lib/images'
import { relativeTime, absoluteTime } from './lib/reviews'
import {
  fetchSpotifyNow,
  fetchSpotifyRecent,
  fetchSpotifyTop,
  LISTENING_INTRO,
  LISTENING_RANGES,
  NOW_POLL_MS,
  RECENT_POLL_MS,
  formatDuration,
  hoursAndMinutes,
  sampleNow,
  progressAt,
  trackEnded,
  nowStatus,
  listeningStats,
  topSummary,
  playsOn,
  albumsOf,
  coverColor,
  fallbackColor,
} from './lib/listening'

const NEUTRAL = '#3a3a3f'
const SHOW_TRACKS = 5
const SHOW_RECENT = 10
const CARD_MIN = 176
const SPOTIFY_LOGO =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z'
const PLAY = 'M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z'
const PAUSE = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z'
const NOTE = 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'
const HOME = 'M12.5 3.25a1 1 0 0 0-1 0l-8 4.6a1 1 0 0 0-.5.87V20a1 1 0 0 0 1 1h5.5v-6.5h5V21H20a1 1 0 0 0 1-1V8.72a1 1 0 0 0-.5-.87z'
const PREV = 'M6 5h2v14H6zM20 5.9v12.2a.6.6 0 0 1-.93.5L9.9 12.5a.6.6 0 0 1 0-1l9.17-6.1a.6.6 0 0 1 .93.5z'
const NEXT = 'M16 5h2v14h-2zM4 5.9v12.2a.6.6 0 0 0 .93.5l9.17-6.1a.6.6 0 0 0 0-1L4.93 5.4a.6.6 0 0 0-.93.5z'
const SHUFFLE = 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5'
const REPEAT = 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3'
const CHECK = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.7 7.7-5.5 5.5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.8 4.8-4.8a1 1 0 0 1 1.4 1.4z'
const SPEAKER = 'M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14'
const CLOCK = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2'
const DOWN = 'M6 9l6 6 6-6'
const UP = 'M6 15l6-6 6 6'
const PANEL = 'M4 4h16v16H4zM14 4v16'

const EASE = 'cubic-bezier(.3,0,0,1)'

const DARK = `--shell:#000;--panel:#121212;--raise:#1f1f1f;--raise-2:#2a2a2a;--hover:rgba(255,255,255,.1);--line:rgba(255,255,255,.1);--text:#fff;--sub:#b3b3b3;--faint:#7c7c7c;--green:#1ed760;--green-text:#1ed760;--chip:rgba(255,255,255,.07);--chip-hover:rgba(255,255,255,.12);--skel:#242424;--track:#4d4d4d;--shadow:rgba(0,0,0,.5)`
const LIGHT = `--shell:#e7e7e3;--panel:#fff;--raise:#f2f2ef;--raise-2:#e6e6e2;--hover:rgba(0,0,0,.055);--line:rgba(0,0,0,.09);--text:#121212;--sub:#5e5e5e;--faint:#8f8f8f;--green:#1ed760;--green-text:#0d7a34;--chip:rgba(0,0,0,.06);--chip-hover:rgba(0,0,0,.1);--skel:#ececea;--track:#cfcfcb;--shadow:rgba(0,0,0,.18)`

const CSS = `
@property --accent{syntax:'<color>';inherits:true;initial-value:${NEUTRAL}}
.sp{${DARK};--bar:76px;min-height:100dvh;background:var(--shell);color:var(--text);font-size:14px;transition:--accent 1.2s ease;-webkit-font-smoothing:antialiased;overflow-x:clip}
:root[data-theme='light'] .sp{${LIGHT}}
@media(min-width:900px){.sp{--bar:96px}}
:where(.sp) a{color:inherit;text-decoration:none}
:where(.sp) button{cursor:pointer;font:inherit;color:inherit;background:none;border:0;padding:0}
.sp :focus-visible{outline:2px solid var(--green);outline-offset:2px;border-radius:4px}
.sp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sp-u:hover{text-decoration:underline;text-underline-offset:2px}
.sp-trunc{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sp-tab{font-variant-numeric:tabular-nums}
.sp-ph{display:flex;align-items:center;justify-content:center;background:var(--raise-2);color:var(--faint)}
.sp-skel{background:var(--skel);border-radius:4px;animation:sp-pulse 1.6s ease-in-out infinite}
@keyframes sp-pulse{50%{opacity:.55}}
.sp-nav{position:sticky;top:0;z-index:50;height:64px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:0 16px;background:var(--shell)}
.sp-logo{display:inline-flex;width:44px;height:44px;justify-self:start;transition:transform .2s ${EASE}}
.sp-logo:hover{transform:scale(1.05)}
.sp-logo img{width:100%;height:100%;object-fit:contain}
.sp-nav-mid{display:flex;align-items:center;gap:8px}
.sp-nav-end{display:flex;align-items:center;gap:8px;justify-self:end}
.sp-circ{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex-shrink:0;border-radius:50%;background:var(--raise);color:var(--sub);transition:transform .2s ${EASE},color .2s,background-color .2s}
.sp-circ:hover{transform:scale(1.04);color:var(--text);background:var(--raise-2)}
.sp-circ-lg{width:48px;height:48px;color:var(--text)}
.sp-search{display:flex;align-items:center;gap:12px;height:48px;width:min(460px,36vw);padding:0 16px 0 14px;border-radius:999px;background:var(--raise);color:var(--sub);box-shadow:inset 0 0 0 1px transparent;transition:background-color .2s,box-shadow .2s,color .2s}
.sp-search:hover{background:var(--raise-2);box-shadow:inset 0 0 0 1px var(--line);color:var(--text)}
.sp-search::before{content:'Search the site';order:1;font-size:15px;white-space:nowrap}
.sp-search svg{width:22px!important;height:22px!important}
.sp-search kbd{order:2;margin-left:auto;color:var(--faint)}
@media(max-width:639px){.sp-search{width:40px;height:40px;padding:0;justify-content:center}.sp-search::before{content:none}.sp-search svg{width:18px!important;height:18px!important}.sp-circ-lg{width:40px;height:40px}}
.sp-white{display:none;align-items:center;height:32px;padding:0 16px;border-radius:999px;background:var(--text);color:var(--panel);font-size:14px;font-weight:700;white-space:nowrap;transition:transform .2s ${EASE}}
.sp-white:hover{transform:scale(1.04)}
@media(min-width:768px){.sp-white{display:inline-flex}}
.sp-shell{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding:0 8px calc(var(--bar) + 8px)}
@media(min-width:1200px){.sp-shell{grid-template-columns:minmax(0,1fr) 340px}}
@media(max-width:767px){.sp-shell{padding:0 0 calc(var(--bar) + 8px)}}
.sp-main{position:relative;min-width:0;min-height:calc(100dvh - 64px - var(--bar) - 8px);border-radius:8px;background:var(--panel);overflow:clip}
@media(max-width:767px){.sp-main{border-radius:0}}
.sp-stick{position:sticky;top:64px;z-index:30;height:64px;margin-bottom:-64px;display:flex;align-items:center;gap:12px;padding:0 24px;border-radius:8px 8px 0 0;background:color-mix(in srgb,var(--accent) 70%,#000);color:#fff;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}
.sp-stick[data-on='true']{opacity:1;visibility:visible}
.sp-stick b{font-size:24px;font-weight:800;letter-spacing:-.02em}
@media(max-width:767px){.sp-stick{border-radius:0;padding:0 16px}}
.sp-hero{display:flex;align-items:flex-end;gap:24px;min-height:300px;padding:84px 24px 24px;color:#fff;background:linear-gradient(transparent 0,rgba(0,0,0,.5) 100%),var(--accent)}
.sp-pfp{width:clamp(128px,17vw,232px);height:auto;aspect-ratio:1;flex-shrink:0;border-radius:50%;object-fit:cover;box-shadow:0 4px 60px rgba(0,0,0,.5)}
.sp-kicker{font-size:14px;font-weight:600}
.sp-h1{font-size:clamp(56px,8.4vw,104px);font-weight:800;letter-spacing:-.05em;line-height:1;margin:6px 0 14px;padding-bottom:.06em}
.sp-meta{display:flex;flex-wrap:wrap;align-items:center;row-gap:4px;font-size:14px;color:rgba(255,255,255,.72)}
.sp-meta b{color:#fff;font-weight:700}
.sp-meta>span+span::before{content:'•';margin:0 6px}
@media(max-width:639px){.sp-hero{flex-direction:column;align-items:flex-start;gap:16px;min-height:0;padding:40px 16px 20px}}
.sp-body{position:relative;isolation:isolate;padding:0 24px}
.sp-body::before{content:'';position:absolute;inset:0 0 auto;z-index:-1;height:240px;background:linear-gradient(color-mix(in srgb,var(--accent) 34%,var(--panel)),var(--panel));pointer-events:none}
@media(max-width:767px){.sp-body{padding:0 16px}}
.sp-actions{display:flex;align-items:center;gap:20px;padding:24px 0;min-width:0}
.sp-green{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;flex-shrink:0;border-radius:50%;background:var(--green);color:#000;box-shadow:0 8px 8px rgba(0,0,0,.3);transition:transform .2s ${EASE},background-color .2s}
.sp-green:hover{transform:scale(1.04);background:#3be477}
.sp-green:active{transform:scale(.96)}
.sp-green[aria-disabled='true']{opacity:.5;pointer-events:none}
.sp-stick .sp-green{width:48px;height:48px}
.sp-status{display:flex;align-items:center;gap:10px;min-width:0;font-size:14px;color:var(--sub)}
.sp-status b{color:var(--text);font-weight:700}
.sp-sec{margin-top:36px}
.sp-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:12px}
.sp-h2{font-size:24px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.sp-all{font-size:14px;font-weight:700;color:var(--sub);white-space:nowrap;padding-bottom:2px}
.sp-all:hover{color:var(--text);text-decoration:underline;text-underline-offset:2px}
.sp-hsub{margin-top:4px;font-size:14px;color:var(--sub)}
.sp-ranged{margin-top:12px}
.sp-rangebar{position:sticky;top:128px;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;margin:0 -24px;padding:12px 24px;transition:background-color .2s,box-shadow .2s}
.sp-rangebar[data-stuck='true']{background:var(--panel);box-shadow:0 1px 0 var(--line),0 8px 16px -12px var(--shadow)}
.sp-rangebar[data-stuck='true'] .sp-hsub{display:none}
@media(max-width:767px){.sp-rangebar{margin:0 -16px;padding:12px 16px}.sp-rangebar[data-stuck='true']>div:first-child{display:none}}
.sp-seg{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:var(--chip)}
.sp-chip{height:36px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:600;white-space:nowrap;color:var(--sub);transition:background-color .2s,color .2s,transform .2s ${EASE}}
.sp-chip:hover{color:var(--text);background:var(--chip-hover)}
.sp-chip:active{transform:scale(.97)}
.sp-chip[aria-pressed='true']{background:var(--text);color:var(--panel)}
@media(max-width:479px){.sp-seg{display:flex;width:100%}.sp-chip{flex:1;padding:0 8px}}
.sp-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:12px;margin-top:12px}
.sp-tile{display:flex;align-items:center;gap:14px;min-width:0;min-height:96px;padding:16px;border-radius:8px;background:var(--raise);transition:background-color .2s}
a.sp-tile:hover{background:var(--raise-2)}
.sp-tile>img,.sp-tile>.sp-ph{width:64px;height:64px;flex-shrink:0;border-radius:4px;object-fit:cover;box-shadow:0 4px 12px var(--shadow)}
.sp-tile[data-round]>img,.sp-tile[data-round]>.sp-ph{border-radius:50%}
.sp-tile-k{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.sp-tile-v{display:block;margin-top:4px;font-size:18px;font-weight:700;letter-spacing:-.01em;color:var(--text)}
.sp-tile-s{display:block;margin-top:2px;font-size:14px;color:var(--sub)}
.sp-tile-n{flex-shrink:0;width:64px;font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1;text-align:center;color:var(--green-text)}
.sp-tile .sp-genres{margin-top:8px}
.sp-grid{display:grid;grid-template-columns:repeat(var(--cols,5),minmax(0,1fr));margin:0 -12px}
.sp-card{display:flex;flex-direction:column;gap:4px;min-width:0;padding:12px;border-radius:8px;transition:background-color .3s}
.sp-card:hover{background:var(--hover)}
.sp-card-art{position:relative;display:block;width:100%;height:auto;aspect-ratio:1;flex-shrink:0;margin-bottom:8px}
.sp-card-art>img,.sp-card-art>.sp-ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:6px;box-shadow:0 8px 24px var(--shadow)}
.sp-card[data-round] .sp-card-art>img,.sp-card[data-round] .sp-card-art>.sp-ph{border-radius:50%}
.sp-card-play{position:absolute;right:8px;bottom:8px;display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:var(--green);color:#000;box-shadow:0 8px 8px rgba(0,0,0,.3);opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s ${EASE}}
.sp-card:hover .sp-card-play,.sp-card:focus-visible .sp-card-play{opacity:1;transform:none}
.sp-card-title{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--text)}
.sp-card-sub{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;color:var(--sub)}
.sp-tr{display:grid;grid-template-columns:var(--tcols);align-items:center;gap:16px;height:56px;padding:0 16px;border-radius:4px;color:var(--sub);transition:background-color .15s}
.sp-tr:hover{background:var(--hover)}
.sp-th{height:36px;margin-bottom:16px;border-radius:0;border-bottom:1px solid var(--line);font-size:14px}
.sp-th:hover{background:none}
.sp-tracks{--tcols:16px minmax(0,6fr) minmax(0,4fr) minmax(48px,1fr)}
.sp-recent{--tcols:16px minmax(0,5fr) minmax(0,3fr) minmax(0,2fr) minmax(48px,1fr)}
.sp-list{margin:0 -16px}
.sp-c-num{position:relative;display:flex;align-items:center;justify-content:flex-end;width:16px;height:16px;font-size:16px}
.sp-c-play{display:none;color:var(--text)}
.sp-tr:hover .sp-c-num>:not(.sp-c-play){display:none}
.sp-tr:hover .sp-c-play{display:flex}
.sp-c-title{display:flex;align-items:center;gap:12px;min-width:0}
.sp-c-title>img,.sp-c-title>.sp-ph{width:40px;height:40px;flex-shrink:0;border-radius:4px;object-fit:cover}
.sp-tname{font-size:16px;color:var(--text)}
.sp-tr[data-now='true'] .sp-tname{color:var(--green-text)}
.sp-tsub{font-size:14px;margin-top:1px}
.sp-tsub a:hover,.sp-c-album a:hover{color:var(--text)}
.sp-tr:hover .sp-tsub,.sp-tr:hover .sp-c-album{color:var(--text)}
.sp-c-dur{justify-self:end;font-variant-numeric:tabular-nums}
.sp-th .sp-c-dur{display:flex}
@media(max-width:767px){.sp-tracks,.sp-recent{--tcols:minmax(0,1fr) auto}.sp-th,.sp-c-num,.sp-c-album{display:none}.sp-recent .sp-c-dur{display:none}.sp-list{margin:0 -8px}.sp-tr{padding:0 8px;gap:12px}.sp-c-when{font-size:13px;white-space:nowrap}}
.sp-e{display:inline-flex;align-items:center;justify-content:center;height:16px;min-width:16px;padding:0 3px;margin-right:6px;border-radius:2px;background:var(--sub);color:var(--panel);font-size:9px;font-weight:700;vertical-align:1px}
.sp-eq{display:inline-flex;align-items:flex-end;gap:2px;width:14px;height:14px;flex-shrink:0}
.sp-eq i{flex:1;height:100%;border-radius:1px;background:var(--green-text);transform-origin:bottom;animation:sp-eq .8s ease-in-out infinite alternate}
.sp-eq i:nth-child(2){animation-duration:.6s;animation-delay:-.3s}
.sp-eq i:nth-child(3){animation-duration:.9s;animation-delay:-.55s}
.sp-eq i:nth-child(4){animation-duration:.7s;animation-delay:-.15s}
.sp-eq[data-white] i{background:#fff}
@keyframes sp-eq{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
.sp-msg{font-size:14px;color:var(--sub);padding:8px 0}
.sp-msg button{font-weight:700;color:var(--text);margin-left:8px;text-decoration:underline;text-underline-offset:3px}
.sp-more{margin-top:16px;font-size:14px;font-weight:700;color:var(--sub)}
.sp-more:hover{color:var(--text);text-decoration:underline;text-underline-offset:2px}
.sp-foot{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,220px));gap:32px;margin-top:64px;padding:40px 0 48px;border-top:1px solid var(--line)}
.sp-foot h3{font-size:16px;font-weight:700;margin-bottom:10px}
.sp-foot ul{display:flex;flex-direction:column;gap:8px;font-size:16px;color:var(--sub)}
.sp-foot ul a:hover{color:var(--text);text-decoration:underline;text-underline-offset:2px}
.sp-aside{display:none}
@media(min-width:1200px){.sp-aside{position:sticky;top:64px;align-self:start;display:block;height:calc(100dvh - 64px - var(--bar) - 8px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--raise-2) transparent;padding:0 16px 16px;border-radius:8px;background:var(--panel)}}
.sp-aside-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;height:64px;margin:0 -16px;padding:0 16px;background:var(--panel);font-size:16px;font-weight:700}
.sp-nowv{display:flex;flex-direction:column;gap:16px}
.sp-cover{display:flex;align-items:center;justify-content:center;width:100%;height:auto;aspect-ratio:1;border-radius:8px;object-fit:cover;background:var(--raise-2);color:var(--faint);box-shadow:0 8px 24px var(--shadow)}
.sp-now-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.sp-now-title{font-size:24px;font-weight:800;letter-spacing:-.025em;line-height:1.15;overflow-wrap:anywhere}
.sp-now-sub{font-size:16px;color:var(--sub);margin-top:4px}
.sp-now-sub a:hover{color:var(--text)}
.sp-check{display:inline-flex;flex-shrink:0;margin-top:5px;color:var(--green-text)}
.sp-box{display:block;border-radius:8px;background:var(--raise);overflow:hidden}
.sp-about{transition:background-color .2s}
a.sp-about:hover{background:var(--raise-2)}
.sp-about-media{position:relative;display:block;aspect-ratio:4/3}
.sp-about-media img{width:100%;height:100%;object-fit:cover;object-position:50% 22%}
.sp-about-media::after{content:'';position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.55),transparent 40%)}
.sp-about-tag{position:absolute;top:16px;left:16px;z-index:1;font-size:16px;font-weight:700;color:#fff}
.sp-about-plain{display:block;padding:16px 16px 0;font-size:16px;font-weight:700}
.sp-about-body{display:block;padding:16px}
.sp-about-name{display:block;font-size:16px;font-weight:700}
.sp-about-line{display:block;margin-top:4px;font-size:14px;color:var(--sub)}
.sp-genres{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.sp-genres span{padding:4px 10px;border-radius:999px;background:var(--chip);font-size:12px;font-weight:600}
.sp-queue{padding:16px}
.sp-queue h3{font-size:16px;font-weight:700;margin-bottom:8px}
.sp-qrow{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:center;gap:12px;margin:0 -8px;padding:8px;border-radius:6px;transition:background-color .15s}
.sp-qrow:hover{background:var(--hover)}
.sp-qrow img,.sp-qrow .sp-ph{width:48px;height:48px;border-radius:4px;object-fit:cover}
.sp-qname{font-size:15px;font-weight:600}
.sp-qsub{font-size:13px;color:var(--sub);margin-top:2px}
.sp-bar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;background:var(--shell);color:var(--text)}
@media(min-width:900px){.sp-bar{display:block}}
.sp-bar-in{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,4fr) minmax(0,3fr);align-items:center;gap:16px;height:72px;padding:0 16px}
.sp-bnow{display:flex;align-items:center;gap:14px;min-width:0}
.sp-bart{position:relative;display:block;width:56px;height:56px;flex-shrink:0;border-radius:4px;overflow:hidden}
.sp-bart img,.sp-bart .sp-ph{width:100%;height:100%;object-fit:cover}
.sp-bart-up{position:absolute;top:4px;right:4px;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s ${EASE}}
.sp-bart:hover .sp-bart-up,.sp-bart:focus-visible .sp-bart-up{opacity:1;transform:none}
.sp-bt{font-size:14px;font-weight:600;color:var(--text)}
.sp-bs{font-size:12px;color:var(--sub);margin-top:2px}
.sp-bs a:hover{color:var(--text)}
.sp-bmid{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:722px;width:100%;justify-self:center}
.sp-ctrls{display:flex;align-items:center;justify-content:center;gap:20px}
.sp-ctrl{display:inline-flex;color:var(--faint);opacity:.7}
.sp-pbtn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:50%;background:var(--text);color:var(--panel);transition:transform .2s ${EASE}}
.sp-pbtn:hover{transform:scale(1.06)}
.sp-pbtn:active{transform:scale(.95)}
.sp-pbtn[aria-disabled='true']{opacity:.4;pointer-events:none}
.sp-ctrls-big{justify-content:space-between;padding:0 4px}
.sp-ctrls-big .sp-pbtn{width:64px;height:64px}
.sp-ctrls-big .sp-ctrl{opacity:.6}
.sp-prog{display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center;gap:8px;font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums}
.sp-prog>span:first-child{text-align:right}
.sp-ptrack{position:relative;height:4px;border-radius:4px;background:var(--track)}
.sp-pfill{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--text);transition:width 1s linear,background-color .2s}
.sp-pfill::after{content:'';position:absolute;right:-6px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--text);box-shadow:0 2px 4px rgba(0,0,0,.5);opacity:0;transition:opacity .2s}
.sp-prog:hover .sp-pfill{background:var(--green)}
.sp-prog:hover .sp-pfill::after{opacity:1}
.sp-sheet .sp-prog{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'t t' 'a b';row-gap:8px}
.sp-sheet .sp-prog>span:first-child{grid-area:a;text-align:left}
.sp-sheet .sp-prog>span:last-child{grid-area:b}
.sp-sheet .sp-ptrack{grid-area:t}
.sp-bend{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.sp-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;color:var(--sub);transition:color .2s,transform .2s ${EASE}}
.sp-icon:hover{color:var(--text);transform:scale(1.06)}
.sp-vol{display:inline-flex;align-items:center;gap:8px;margin-left:4px;color:var(--sub)}
.sp-vol i{display:block;width:92px;height:4px;border-radius:4px;background:linear-gradient(90deg,var(--text) 72%,var(--track) 72%)}
.sp-strip{display:flex;align-items:center;justify-content:flex-end;gap:8px;height:24px;padding:0 24px;font-size:13px;font-weight:600;background:var(--green);color:#000;transition:background-color .4s,color .4s}
.sp-strip[data-on='false']{background:var(--raise);color:var(--sub)}
.sp-strip a:hover{text-decoration:underline;text-underline-offset:2px}
.sp-mini{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:60;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;height:56px;padding:0 8px;border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--accent) 86%,#000);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.35)}
@media(min-width:900px){.sp-mini{display:none}}
.sp-mini-open{display:flex;align-items:center;gap:10px;min-width:0;height:100%;text-align:left}
.sp-mini-open img,.sp-mini-open .sp-ph{width:40px;height:40px;flex-shrink:0;border-radius:4px;object-fit:cover}
.sp-mini-t{font-size:13px;font-weight:700}
.sp-mini-s{font-size:12px;color:rgba(255,255,255,.72);margin-top:1px}
.sp-mini-end{display:flex;align-items:center;gap:6px}
.sp-mini-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;color:#fff}
.sp-mini-line{position:absolute;left:8px;right:8px;bottom:0;height:2px;border-radius:2px;background:rgba(255,255,255,.25);overflow:hidden}
.sp-mini-line i{display:block;height:100%;background:#fff;transition:width 1s linear}
.sp-sheet{${DARK};position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;color:var(--text);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,#000) 0,#121212 72%);overflow-y:auto;overscroll-behavior:contain}
.sp-sheet[open]{animation:sp-up .5s ${EASE}}
.sp-sheet::backdrop{background:rgba(0,0,0,.6)}
@keyframes sp-up{from{transform:translateY(100%)}to{transform:none}}
html:has(.sp-sheet[open]){overflow:hidden}
.sp-sheet-in{display:flex;flex-direction:column;gap:24px;max-width:460px;margin:0 auto;padding:calc(12px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))}
.sp-sheet-top{display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center;text-align:center}
.sp-sheet-top small{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)}
.sp-sheet-top b{font-size:14px;font-weight:700}
.sp-sheet .sp-cover{box-shadow:0 16px 48px rgba(0,0,0,.55)}
.sp-sheet .sp-box{background:rgba(255,255,255,.08)}
.sp-sheet .sp-pbtn{background:#fff;color:#000}
@media(prefers-reduced-motion:reduce){.sp *,.sp *::before,.sp *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
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

function useStuck(top) {
  const ref = useRef(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setStuck(entry.boundingClientRect.top < top + 1 && !entry.isIntersecting), {
      rootMargin: `-${top + 1}px 0px 0px 0px`,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [top])
  return [ref, stuck]
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

function useColumns(min) {
  const ref = useRef(null)
  const [cols, setCols] = useState(5)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setCols(Math.max(2, Math.floor(entry.contentRect.width / min)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [min])
  return [ref, cols]
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

function Eq({ white }) {
  return (
    <span className="sp-eq" data-white={white || undefined} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

function heroState(now, recent, clock) {
  const status = nowStatus(now.data)
  const last = recent.data?.[0]
  if (now.loading) return { kind: 'loading' }
  if (now.error === 'spotify_disabled') return { kind: 'message', title: 'Not connected right now', body: 'The Spotify link is off for the moment.' }
  if (!now.data && now.error) return { kind: 'message', title: 'Could not reach Spotify', body: 'Trying again in a few seconds.' }
  if (status === 'podcast') return { kind: 'message', title: 'On a podcast', body: 'Podcast episodes stay private.' }
  if (status === 'idle' && !last) return { kind: 'message', title: 'Quiet right now', body: recent.loading ? 'Looking up the last song.' : 'Nothing played lately.' }
  if (status === 'idle') return { kind: 'track', status, track: last.track, label: `Last played ${relativeTime(last.playedAt, clock)}` }
  return { kind: 'track', status, track: now.data.track, label: status === 'playing' ? 'Listening on Spotify' : 'Paused on Spotify' }
}

function heroWord(hero) {
  if (hero.kind !== 'track' || hero.status === 'playing') return 'Now playing'
  if (hero.status === 'paused') return 'Paused'
  return 'Last played'
}

function progressOf(hero, now, clock) {
  const track = hero.kind === 'track' ? hero.track : null
  const duration = track?.durationMs || null
  const at = track && hero.status !== 'idle' ? progressAt(now.data, clock) : null
  const ratio = at !== null && duration ? Math.min(1, Math.max(0, at / duration)) : 0
  return { at, duration, ratio }
}

function GreenPlay({ track, size = 56 }) {
  return (
    <a
      href={track?.url || undefined}
      target="_blank"
      rel="noreferrer"
      className="sp-green"
      aria-label={track ? `Play ${track.title} on Spotify` : 'Nothing to play yet'}
      aria-disabled={!track?.url}
    >
      <Glyph d={PLAY} size={Math.round(size * 0.42)} />
    </a>
  )
}

function Progress({ hero, now, clock }) {
  const { at, duration, ratio } = progressOf(hero, now, clock)
  return (
    <div className="sp-prog">
      <span>{at !== null ? formatDuration(at) : '-:--'}</span>
      <div
        className="sp-ptrack"
        role="progressbar"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={duration ? Math.round(duration / 1000) : 0}
        aria-valuenow={at !== null ? Math.round(at / 1000) : 0}
        aria-valuetext={at !== null && duration ? `${formatDuration(at)} of ${formatDuration(duration)}` : 'Not playing'}
      >
        <div className="sp-pfill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span>{duration ? formatDuration(duration) : '-:--'}</span>
    </div>
  )
}

function Controls({ track, playing, big }) {
  const size = big ? 24 : 16
  return (
    <div className={big ? 'sp-ctrls sp-ctrls-big' : 'sp-ctrls'}>
      <span className="sp-ctrl" aria-hidden="true">
        <Glyph d={SHUFFLE} size={size} stroke />
      </span>
      <span className="sp-ctrl" aria-hidden="true">
        <Glyph d={PREV} size={size} />
      </span>
      <a
        href={track?.url || undefined}
        target="_blank"
        rel="noreferrer"
        className="sp-pbtn"
        aria-label={track ? `Open ${track.title} in Spotify` : 'Open Spotify'}
        aria-disabled={!track?.url}
      >
        <Glyph d={playing ? PAUSE : PLAY} size={big ? 28 : 16} />
      </a>
      <span className="sp-ctrl" aria-hidden="true">
        <Glyph d={NEXT} size={size} />
      </span>
      <span className="sp-ctrl" aria-hidden="true">
        <Glyph d={REPEAT} size={size} stroke />
      </span>
    </div>
  )
}

function Nav({ theme, onToggleTheme }) {
  return (
    <header className="sp-nav">
      <a {...link(HOME_PATH)} className="sp-logo" aria-label="Blxr home">
        <img {...imageProps('/blxr-logo.webp', '44px')} alt="" width="44" height="44" />
      </a>
      <div className="sp-nav-mid">
        <a {...link(HOME_PATH)} className="sp-circ sp-circ-lg" aria-label="Home" title="Home">
          <Glyph d={HOME} size={22} />
        </a>
        <CommandButton className="sp-search" />
      </div>
      <div className="sp-nav-end">
        <a {...link(CONTACT_PATH)} className="sp-white">
          Send me a song
        </a>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className="sp-circ" />
      </div>
    </header>
  )
}

function Hero({ recent, clock }) {
  const plays = recent.data || []
  const stats = listeningStats(plays)
  const today = playsOn(plays, clock)
  let meta
  if (recent.loading) meta = <div className="sp-skel" style={{ width: 260, height: 14, background: 'rgba(255,255,255,.18)' }} />
  else if (!plays.length) meta = <p className="sp-meta">{LISTENING_INTRO}</p>
  else
    meta = (
      <p className="sp-meta">
        <span>
          <b>{today}</b> {today === 1 ? 'play' : 'plays'} today
        </span>
        <span>
          <b>{stats.artists}</b> artists in my last {stats.plays} songs
        </span>
        <span>{hoursAndMinutes(stats.minutes)}</span>
      </p>
    )
  return (
    <div className="sp-hero">
      <img src={imageUrl('/pfp.webp', 520)} alt="" width="232" height="232" className="sp-pfp" />
      <div style={{ minWidth: 0 }}>
        <p className="sp-kicker">Profile</p>
        <h1 className="sp-h1">
          Blxr<span className="sp-sr">, what I&rsquo;m listening to</span>
        </h1>
        {meta}
      </div>
    </div>
  )
}

function Actions({ hero }) {
  const track = hero.kind === 'track' ? hero.track : null
  let status
  if (hero.kind === 'loading') status = <span>Checking what&rsquo;s on&hellip;</span>
  else if (hero.kind === 'message')
    status = (
      <span>
        {hero.title}. {hero.body}
      </span>
    )
  else if (hero.status === 'playing')
    status = (
      <>
        <Eq />
        <span className="sp-trunc">
          On right now: <b>{track.title}</b>
        </span>
      </>
    )
  else if (hero.status === 'paused')
    status = (
      <span className="sp-trunc">
        Paused on <b>{track.title}</b>
      </span>
    )
  else
    status = (
      <span className="sp-trunc">
        {hero.label}: <b>{track.title}</b>
      </span>
    )
  return (
    <div className="sp-actions">
      <GreenPlay track={track} />
      <p className="sp-status">{status}</p>
    </div>
  )
}

function Head({ id, title, sub, action }) {
  return (
    <div className="sp-head">
      <div style={{ minWidth: 0 }}>
        <h2 id={id} className="sp-h2">
          {title}
        </h2>
        {sub && <p className="sp-hsub">{sub}</p>}
      </div>
      {action}
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

function Card({ href, img, title, sub, round }) {
  return (
    <a href={href || undefined} target="_blank" rel="noreferrer" className="sp-card" data-round={round || undefined}>
      <span className="sp-card-art">
        <Img src={img} size={300} />
        <span className="sp-card-play" aria-hidden="true">
          <Glyph d={PLAY} size={22} />
        </span>
      </span>
      <span className="sp-card-title sp-trunc">{title}</span>
      <span className="sp-card-sub">{sub}</span>
    </a>
  )
}

function Shelf({ id, title, sub, items, loading, round, error, onRetry, emptyText, renderItem }) {
  const [ref, cols] = useColumns(CARD_MIN)
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, cols)
  let body
  if (loading)
    body = Array.from({ length: cols }, (_, i) => (
      <div key={i} className="sp-card" aria-hidden="true">
        <span className="sp-card-art sp-skel" style={{ borderRadius: round ? '50%' : 6 }} />
        <span className="sp-skel" style={{ width: '70%', height: 14 }} />
        <span className="sp-skel" style={{ width: '40%', height: 12, marginTop: 6 }} />
      </div>
    ))
  else body = shown.map(renderItem)
  return (
    <section className="sp-sec" aria-labelledby={id}>
      <Head
        id={id}
        title={title}
        sub={sub}
        action={
          !loading &&
          items.length > cols && (
            <button type="button" className="sp-all" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? 'Show less' : 'Show all'}
            </button>
          )
        }
      />
      <div ref={ref} className="sp-grid" style={{ '--cols': cols }}>
        {body}
      </div>
      {!loading && !items.length && (error ? <Unavailable error={error} onRetry={onRetry} /> : <p className="sp-msg">{emptyText}</p>)}
    </section>
  )
}

function RangeBar({ value, onChange, span }) {
  const [ref, stuck] = useStuck(128)
  return (
    <>
      <div ref={ref} aria-hidden="true" />
      <div className="sp-rangebar" data-stuck={stuck}>
        <div style={{ minWidth: 0 }}>
          <h2 id="listening-stats" className="sp-h2">
            My stats
          </h2>
          <p className="sp-hsub">What I&rsquo;ve had on most over the last {span}</p>
        </div>
        <div role="group" aria-label="Time range for my stats" className="sp-seg">
          {LISTENING_RANGES.map((range) => (
            <button key={range.id} type="button" className="sp-chip" aria-pressed={range.id === value} onClick={() => onChange(range.id)}>
              {range.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function Tile({ href, img, round, kicker, value, sub, children }) {
  const body = (
    <>
      {img !== undefined && <Img src={img} size={128} />}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="sp-tile-k">{kicker}</span>
        {value && <span className="sp-tile-v sp-trunc">{value}</span>}
        {sub && <span className="sp-tile-s sp-trunc">{sub}</span>}
        {children}
      </span>
    </>
  )
  if (!href)
    return (
      <div className="sp-tile" data-round={round || undefined}>
        {body}
      </div>
    )
  return (
    <a href={href} target="_blank" rel="noreferrer" className="sp-tile" data-round={round || undefined}>
      {body}
    </a>
  )
}

function Stats({ top }) {
  if (top.loading)
    return (
      <div className="sp-tiles" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sp-tile">
            <span className="sp-skel" style={{ width: 64, height: 64, flexShrink: 0, borderRadius: i ? 4 : '50%' }} />
            <span style={{ flex: 1 }}>
              <span className="sp-skel" style={{ display: 'block', width: '40%', height: 10 }} />
              <span className="sp-skel" style={{ display: 'block', width: '75%', height: 16, marginTop: 10 }} />
            </span>
          </div>
        ))}
      </div>
    )
  if (!top.data) return null
  const { artist, track, genres, album, artistCount, trackCount } = topSummary(top.data)
  if (!artist && !track) return null
  return (
    <section aria-labelledby="listening-stats" className="sp-tiles">
      {artist && <Tile href={artist.url} img={artist.thumb || artist.art} round kicker="Top artist" value={artist.name} sub={artist.genres?.[0] || 'Artist'} />}
      {track && <Tile href={track.url} img={track.thumb || track.art} kicker="Top song" value={track.title} sub={names(track)} />}
      {genres.length > 0 && (
        <Tile kicker="Top genres">
          <span className="sp-genres">
            {genres.map((genre) => (
              <span key={genre.name}>{genre.name}</span>
            ))}
          </span>
        </Tile>
      )}
      {album && <Tile href={album.url} img={album.art} kicker="Top album" value={album.name} sub={`${album.count} songs in my top ${trackCount}`} />}
      {trackCount > 0 && (
        <div className="sp-tile">
          <span className="sp-tile-n sp-tab">{artistCount}</span>
          <span style={{ minWidth: 0 }}>
            <span className="sp-tile-k">Variety</span>
            <span className="sp-tile-s">
              {artistCount === 1 ? 'artist' : 'different artists'} across my top {trackCount} songs
            </span>
          </span>
        </div>
      )}
    </section>
  )
}

function RowsSkeleton({ rows }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sp-tr" style={{ '--tcols': '40px minmax(0,1fr)' }}>
          <span className="sp-skel" style={{ width: 40, height: 40 }} />
          <span>
            <span className="sp-skel" style={{ display: 'block', width: `${56 - (i % 3) * 12}%`, height: 13 }} />
            <span className="sp-skel" style={{ display: 'block', width: '28%', height: 11, marginTop: 8 }} />
          </span>
        </div>
      ))}
    </div>
  )
}

function TitleCell({ track }) {
  return (
    <div className="sp-c-title">
      <Img src={track.thumb || track.art} size={64} />
      <div style={{ minWidth: 0 }}>
        <p className="sp-tname sp-trunc">
          <Out href={track.url}>{track.title}</Out>
        </p>
        <p className="sp-tsub sp-trunc">
          <Explicit track={track} />
          <Artists track={track} />
        </p>
      </div>
    </div>
  )
}

function NumCell({ index, track, now }) {
  return (
    <span className="sp-c-num sp-tab">
      {now ? <Eq /> : <span>{index + 1}</span>}
      <Out href={track.url} className="sp-c-play" label={`Play ${track.title} on Spotify`} tabIndex={-1}>
        <Glyph d={PLAY} size={14} />
      </Out>
    </span>
  )
}

function MoreButton({ total, limit, all, setAll }) {
  if (total <= limit) return null
  return (
    <button type="button" className="sp-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
      {all ? 'Show less' : `See all ${total}`}
    </button>
  )
}

function TopTracks({ top, playingId, sub }) {
  const [all, setAll] = useState(false)
  let body
  if (top.loading) body = <RowsSkeleton rows={SHOW_TRACKS} />
  else if (!top.data) body = <Unavailable error={top.error} onRetry={top.refresh} />
  else if (!top.data.tracks.length) body = <p className="sp-msg">Not enough listening in this range yet.</p>
  else {
    const tracks = top.data.tracks
    const shown = all ? tracks : tracks.slice(0, SHOW_TRACKS)
    body = (
      <div className="sp-list sp-tracks">
        <div className="sp-tr sp-th" aria-hidden="true">
          <span className="sp-c-num">#</span>
          <span>Title</span>
          <span className="sp-c-album">Album</span>
          <span className="sp-c-dur">
            <Glyph d={CLOCK} size={16} stroke />
          </span>
        </div>
        <ol>
          {shown.map((track, index) => {
            const now = Boolean(playingId) && track.id === playingId
            return (
              <li key={track.id || index} className="sp-tr" data-now={now}>
                <NumCell index={index} track={track} now={now} />
                <TitleCell track={track} />
                <span className="sp-c-album sp-trunc">
                  <Out href={track.album?.url}>{track.album?.name}</Out>
                </span>
                <span className="sp-c-dur">{track.durationMs ? formatDuration(track.durationMs) : ''}</span>
              </li>
            )
          })}
        </ol>
        <div style={{ padding: '0 16px' }}>
          <MoreButton total={tracks.length} limit={SHOW_TRACKS} all={all} setAll={setAll} />
        </div>
      </div>
    )
  }
  return (
    <section className="sp-sec" aria-labelledby="listening-top">
      <Head id="listening-top" title="Top tracks" sub={sub} />
      {body}
    </section>
  )
}

function RecentTable({ recent, clock }) {
  const [all, setAll] = useState(false)
  let body
  if (recent.loading) body = <RowsSkeleton rows={6} />
  else if (!recent.data) body = <Unavailable error={recent.error} onRetry={recent.refresh} />
  else if (!recent.data.length) body = <p className="sp-msg">Nothing played lately.</p>
  else {
    const shown = all ? recent.data : recent.data.slice(0, SHOW_RECENT)
    body = (
      <div className="sp-list sp-recent">
        <div className="sp-tr sp-th" aria-hidden="true">
          <span className="sp-c-num">#</span>
          <span>Title</span>
          <span className="sp-c-album">Album</span>
          <span className="sp-c-when">Played</span>
          <span className="sp-c-dur">
            <Glyph d={CLOCK} size={16} stroke />
          </span>
        </div>
        <ol>
          {shown.map((item, index) => (
            <li key={`${item.playedAt}-${item.track.id}`} className="sp-tr">
              <NumCell index={index} track={item.track} />
              <TitleCell track={item.track} />
              <span className="sp-c-album sp-trunc">
                <Out href={item.track.album?.url}>{item.track.album?.name}</Out>
              </span>
              <time className="sp-c-when sp-trunc" dateTime={item.playedAt} title={absoluteTime(item.playedAt)}>
                {relativeTime(item.playedAt, clock)}
              </time>
              <span className="sp-c-dur">{item.track.durationMs ? formatDuration(item.track.durationMs) : ''}</span>
            </li>
          ))}
        </ol>
        <div style={{ padding: '0 16px' }}>
          <MoreButton total={recent.data.length} limit={SHOW_RECENT} all={all} setAll={setAll} />
        </div>
      </div>
    )
  }
  return (
    <section className="sp-sec" aria-labelledby="listening-recent">
      <Head id="listening-recent" title="Recently played" />
      {body}
    </section>
  )
}

function About({ track, top, rangeLabel }) {
  const lead = track?.artists?.[0]
  if (!lead) return null
  const list = top.data?.artists || []
  const index = lead.url ? list.findIndex((a) => a.url === lead.url) : -1
  const artist = index >= 0 ? list[index] : null
  let line = `Not in my top ${list.length || 20} for the last ${rangeLabel}. Yet.`
  if (top.loading) line = 'Checking my top artists'
  else if (artist) line = `No. ${index + 1} in my top artists over the last ${rangeLabel}`
  return (
    <a href={lead.url || undefined} target="_blank" rel="noreferrer" className="sp-box sp-about">
      {artist?.art ? (
        <span className="sp-about-media">
          <img src={artist.art} alt="" width="640" height="480" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          <span className="sp-about-tag">About the artist</span>
        </span>
      ) : (
        <span className="sp-about-plain">About the artist</span>
      )}
      <span className="sp-about-body">
        <span className="sp-about-name">{lead.name}</span>
        <span className="sp-about-line">{line}</span>
        {artist?.genres?.length > 0 && (
          <span className="sp-genres">
            {artist.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </span>
        )}
      </span>
    </a>
  )
}

function Before({ track, recent, clock }) {
  const items = (recent.data || []).filter((item) => !track || item.track.id !== track.id).slice(0, 4)
  if (!items.length) return null
  return (
    <div className="sp-box sp-queue">
      <h3>{track ? 'Played before this' : 'Recently played'}</h3>
      <ol>
        {items.map((item) => (
          <li key={`${item.playedAt}-${item.track.id}`}>
            <a href={item.track.url || undefined} target="_blank" rel="noreferrer" className="sp-qrow">
              <Img src={item.track.thumb || item.track.art} size={64} />
              <span style={{ minWidth: 0 }}>
                <span className="sp-qname sp-trunc">{item.track.title}</span>
                <span className="sp-qsub sp-trunc">
                  {names(item.track)} · {relativeTime(item.playedAt, clock)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

function NowView({ hero, now, clock, rank, top, recent, rangeLabel, inSheet }) {
  const track = hero.kind === 'track' ? hero.track : null
  let cover
  let info
  if (hero.kind === 'loading') {
    cover = <div className="sp-cover sp-skel" />
    info = (
      <div style={{ flex: 1 }} aria-hidden="true">
        <div className="sp-skel" style={{ width: '70%', height: 20 }} />
        <div className="sp-skel" style={{ width: '45%', height: 14, marginTop: 10 }} />
      </div>
    )
  } else if (!track) {
    cover = (
      <span className="sp-cover" aria-hidden="true">
        <SpotifyMark size={64} />
      </span>
    )
    info = (
      <div style={{ minWidth: 0 }}>
        <p className="sp-now-title">{hero.title}</p>
        <p className="sp-now-sub">{hero.body}</p>
      </div>
    )
  } else {
    cover = (
      <a href={track.url || undefined} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">
        <Img src={track.art || track.thumb} className="sp-cover" size={640} />
      </a>
    )
    info = (
      <div style={{ minWidth: 0 }}>
        <p className="sp-now-title">
          <Out href={track.url}>{track.title}</Out>
        </p>
        <p className="sp-now-sub sp-trunc">
          <Explicit track={track} />
          <Artists track={track} />
        </p>
      </div>
    )
  }
  return (
    <div className="sp-nowv">
      {cover}
      <div className="sp-now-row">
        {info}
        {rank && (
          <span className="sp-check" title={`No. ${rank} in my top tracks`}>
            <Glyph d={CHECK} size={22} />
            <span className="sp-sr">No. {rank} in my top tracks</span>
          </span>
        )}
      </div>
      {inSheet && (
        <>
          <Progress hero={hero} now={now} clock={clock} />
          <Controls track={track} playing={hero.status === 'playing'} big />
        </>
      )}
      <About track={track} top={top} rangeLabel={rangeLabel} />
      <Before track={track} recent={recent} clock={clock} />
    </div>
  )
}

function Aside(props) {
  const { hero } = props
  const track = hero.kind === 'track' ? hero.track : null
  return (
    <aside className="sp-aside" aria-label="Now playing">
      <div className="sp-aside-head">
        <span className="sp-trunc">{heroWord(hero)}</span>
        <a href={track?.url || 'https://open.spotify.com'} target="_blank" rel="noreferrer" className="sp-icon" aria-label="Open in Spotify" title="Open in Spotify">
          <SpotifyMark size={18} />
        </a>
      </div>
      <NowView {...props} />
    </aside>
  )
}

function Sheet({ open, onClose, ...props }) {
  const ref = useRef(null)
  const { hero } = props
  const track = hero.kind === 'track' ? hero.track : null
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog ref={ref} className="sp-sheet" aria-label="Now playing" onClose={onClose}>
      {open && (
        <div className="sp-sheet-in">
          <div className="sp-sheet-top">
            <button type="button" className="sp-icon" onClick={onClose} aria-label="Close now playing" style={{ color: '#fff' }}>
              <Glyph d={DOWN} size={24} stroke />
            </button>
            <p>
              <small>{heroWord(hero)}</small>
              <b>Blxr&rsquo;s Spotify</b>
            </p>
            <a href={track?.url || 'https://open.spotify.com'} target="_blank" rel="noreferrer" className="sp-icon" aria-label="Open in Spotify" style={{ color: '#fff' }}>
              <SpotifyMark size={20} />
            </a>
          </div>
          <NowView {...props} inSheet />
        </div>
      )}
    </dialog>
  )
}

function Bar({ hero, now, clock, rank, onOpen }) {
  const track = hero.kind === 'track' ? hero.track : null
  const playing = hero.status === 'playing'
  const { ratio } = progressOf(hero, now, clock)
  const open = track?.url || 'https://open.spotify.com'
  let strip = hero.label
  if (hero.kind === 'loading') strip = 'Connecting to Spotify'
  else if (hero.kind === 'message') strip = hero.title
  else if (playing) strip = 'Listening on Blxr’s Spotify'

  let left
  if (hero.kind === 'loading') {
    left = (
      <div className="sp-bnow" aria-hidden="true">
        <span className="sp-bart sp-skel" />
        <span style={{ flex: 1 }}>
          <span className="sp-skel" style={{ display: 'block', width: '60%', height: 12 }} />
          <span className="sp-skel" style={{ display: 'block', width: '35%', height: 10, marginTop: 8 }} />
        </span>
      </div>
    )
  } else if (!track) {
    left = (
      <div className="sp-bnow">
        <span className="sp-bart sp-ph" aria-hidden="true">
          <SpotifyMark size={24} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="sp-bt sp-trunc">{hero.title}</span>
          <span className="sp-bs sp-trunc">{hero.body}</span>
        </span>
      </div>
    )
  } else {
    left = (
      <div className="sp-bnow">
        <button type="button" className="sp-bart" onClick={onOpen} aria-label="Expand now playing">
          <Img src={track.thumb || track.art} size={64} />
          <span className="sp-bart-up" aria-hidden="true">
            <Glyph d={UP} size={14} stroke />
          </span>
        </button>
        <span style={{ minWidth: 0 }}>
          <span className="sp-bt sp-trunc">
            <Out href={track.url}>{track.title}</Out>
          </span>
          <span className="sp-bs sp-trunc">
            <Artists track={track} />
          </span>
        </span>
        {rank && (
          <span className="sp-check" style={{ marginTop: 0 }} title={`No. ${rank} in my top tracks`}>
            <Glyph d={CHECK} size={16} />
            <span className="sp-sr">No. {rank} in my top tracks</span>
          </span>
        )}
      </div>
    )
  }

  let miniArt = (
    <span className="sp-ph" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>
      <SpotifyMark size={20} />
    </span>
  )
  if (hero.kind === 'loading') miniArt = <span className="sp-skel" style={{ width: 40, height: 40, background: 'rgba(255,255,255,.15)' }} />
  else if (track) miniArt = <Img src={track.thumb || track.art} size={64} />
  let miniTitle = hero.title
  let miniSub = hero.body || ''
  if (hero.kind === 'loading') miniTitle = 'Connecting to Spotify'
  else if (track) {
    miniTitle = track.title
    miniSub = playing ? names(track) : hero.label
  }

  return (
    <>
      <div className="sp-bar" role="region" aria-label="Player">
        <div className="sp-bar-in">
          {left}
          <div className="sp-bmid">
            <Controls track={track} playing={playing} />
            <Progress hero={hero} now={now} clock={clock} />
          </div>
          <div className="sp-bend">
            <button type="button" className="sp-icon" onClick={onOpen} aria-label="Open the now playing view" title="Now playing view">
              <Glyph d={PANEL} size={16} stroke />
            </button>
            <a href={open} target="_blank" rel="noreferrer" className="sp-icon" aria-label="Open in Spotify" title="Open in Spotify">
              <SpotifyMark size={16} />
            </a>
            <span className="sp-vol" aria-hidden="true">
              <Glyph d={SPEAKER} size={16} stroke />
              <i />
            </span>
          </div>
        </div>
        <div className="sp-strip" data-on={playing}>
          <Glyph d={SPEAKER} size={14} stroke />
          <a href={open} target="_blank" rel="noreferrer">
            {strip}
          </a>
        </div>
      </div>

      <div className="sp-mini" role="region" aria-label="Player">
        <button type="button" className="sp-mini-open" onClick={onOpen} aria-label={track ? `${track.title} by ${names(track)}. Expand now playing` : 'Expand now playing'}>
          {miniArt}
          <span style={{ minWidth: 0 }}>
            <span className="sp-mini-t sp-trunc">{miniTitle}</span>
            <span className="sp-mini-s sp-trunc">{miniSub}</span>
          </span>
        </button>
        <span className="sp-mini-end">
          {playing && <Eq white />}
          <a href={open} target="_blank" rel="noreferrer" className="sp-mini-btn" aria-label={track ? `Open ${track.title} in Spotify` : 'Open Spotify'}>
            <Glyph d={playing ? PAUSE : PLAY} size={24} />
          </a>
        </span>
        <span className="sp-mini-line" aria-hidden="true">
          <i style={{ width: `${ratio * 100}%` }} />
        </span>
      </div>
    </>
  )
}

function Footer() {
  return (
    <footer className="sp-foot">
      <div>
        <h3>Around here</h3>
        <ul>
          <li>
            <a {...link(HOME_PATH)}>Home</a>
          </li>
          <li>
            <a {...link(USES_PATH)}>What I use</a>
          </li>
        </ul>
      </div>
      <div>
        <h3>Say hi</h3>
        <ul>
          <li>
            <a {...link(CONTACT_PATH)}>Send me a song</a>
          </li>
        </ul>
      </div>
    </footer>
  )
}

export default function ListeningPage({ theme, onToggleTheme }) {
  const visible = usePageVisible()
  const scrolled = useScrolled(260)
  const [range, setRange] = useState(LISTENING_RANGES[0].id)
  const [sheet, setSheet] = useState(false)
  const now = useLive(loadNow, { key: 'now', every: NOW_POLL_MS, active: visible })
  const recent = useLive(loadRecent, { key: 'recent', every: RECENT_POLL_MS, active: visible })
  const top = useLive(loadTop, { key: range })
  const status = nowStatus(now.data)
  const clock = useClock(status === 'playing' && visible ? 1000 : 30_000)
  const hero = heroState(now, recent, clock)
  const heroTrack = hero.kind === 'track' ? hero.track : null
  const accent = useAccent(heroTrack)
  const heroRankIndex = heroTrack?.id ? (top.data?.tracks || []).findIndex((t) => t.id === heroTrack.id) : -1
  const heroRank = heroRankIndex >= 0 ? heroRankIndex + 1 : null
  const rangeLabel = LISTENING_RANGES.find((r) => r.id === range)?.span || ''
  const rangeSub = `Last ${rangeLabel}`
  const playingId = status === 'playing' ? now.data?.track?.id : null
  const albums = albumsOf(recent.data, 24)
  const artists = top.data?.artists || []

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

  const openSheet = useCallback(() => setSheet(true), [])
  const closeSheet = useCallback(() => setSheet(false), [])
  const nowProps = { hero, now, clock, rank: heroRank, top, recent, rangeLabel }
  const announce = heroTrack ? `${heroWord(hero)}: ${heroTrack.title} by ${names(heroTrack)}` : hero.title || ''

  return (
    <div className="sp" style={{ '--accent': accent }}>
      <style>{CSS}</style>
      <Nav theme={theme} onToggleTheme={onToggleTheme} />
      <p className="sp-sr" aria-live="polite">
        {announce}
      </p>

      <div className="sp-shell">
        <main className="sp-main">
          <div className="sp-stick" data-on={scrolled} aria-hidden={!scrolled}>
            <GreenPlay track={heroTrack} size={48} />
            <b>Blxr</b>
          </div>
          <Hero recent={recent} clock={clock} />
          <div className="sp-body">
            <Actions hero={hero} />

            <div className="sp-ranged">
              <RangeBar value={range} onChange={setRange} span={rangeLabel} />
              <Stats top={top} />

              <Shelf
                id="listening-artists"
                title="Top artists"
                sub={rangeSub}
                items={artists}
                loading={top.loading}
                round
                error={top.error}
                onRetry={top.refresh}
                emptyText="Not enough listening in this range yet."
                renderItem={(artist, index) => <Card key={artist.id || index} href={artist.url} img={artist.art || artist.thumb} title={artist.name} sub="Artist" round />}
              />

              <TopTracks top={top} playingId={playingId} sub={rangeSub} />
            </div>

            <Shelf
              id="listening-albums"
              title="Jump back in"
              items={albums}
              loading={recent.loading}
              error={recent.error}
              onRetry={recent.refresh}
              emptyText="Nothing played lately."
              renderItem={(track) => (
                <Card key={track.album?.url || track.id} href={track.album?.url || track.url} img={track.art || track.thumb} title={track.album?.name || track.title} sub={names(track)} />
              )}
            />

            <RecentTable recent={recent} clock={clock} />
            <Footer />
          </div>
        </main>
        <Aside {...nowProps} />
      </div>

      <Bar hero={hero} now={now} clock={clock} rank={heroRank} onOpen={openSheet} />
      <Sheet open={sheet} onClose={closeSheet} {...nowProps} />
    </div>
  )
}
