"use client";

import * as React from "react";
import { useI18n, LOCALE_TAGS } from "../lib/i18n";
import { fetchContributions, readCache } from "../lib/github";

const LEVEL_CLASSES = [
  "bg-[var(--gh-0)]",
  "bg-[var(--gh-1)]",
  "bg-[var(--gh-2)]",
  "bg-[var(--gh-3)]",
  "bg-[var(--gh-4)]",
];

const ROLLING = "last";

const MAX_CELL = 10;

const MIN_CELL = 3;
const MIN_GAP = 1;
const GAP_RATIO = 0.3;
const RAIL_GAP = 8;

const RAIL_MIN_ROW = 420;

const MONTH_LABEL_PX = 24;

const REVEAL_STEP_MS = 9;
const REVEAL_MAX_MS = 560;

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7];

const EDGE_FADE = 28;

const gapFor = (cell) => Math.max(2, Math.round(cell * GAP_RATIO));
const round2 = (n) => Math.round(n * 100) / 100;

const fitCell = (avail, columns) => {
  const idealGap = gapFor(MAX_CELL);
  if (columns * (MAX_CELL + idealGap) - idealGap <= avail) {
    return { cell: MAX_CELL, gap: idealGap };
  }

  let cell = avail / (columns * (1 + GAP_RATIO) - GAP_RATIO);
  let gap = cell * GAP_RATIO;

  if (gap < MIN_GAP) {
    gap = MIN_GAP;
    cell = (avail + gap) / columns - gap;
  }
  return { cell: Math.max(MIN_CELL, round2(cell)), gap: round2(gap) };
};

function useCoarsePointer() {
  const [coarse, setCoarse] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return coarse;
}

const parseDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatters = new Map();
const formatterFor = (locale, shape, options) => {
  const key = `${locale}|${shape}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, fmt);
  }
  return fmt;
};

const formatDay = (iso, locale = "en-US") =>
  formatterFor(locale, "day", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseDay(iso));

const formatMonthYear = (iso, locale = "en-US") =>
  formatterFor(locale, "monthYear", { month: "long", year: "numeric" }).format(parseDay(iso));

const formatWeekday = (iso, locale = "en-US") =>
  formatterFor(locale, "weekday", { weekday: "long" }).format(parseDay(iso));

const longestStreak = (days) => {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
};

const dayUrl = (username, date) =>
  `https://github.com/${encodeURIComponent(username)}?tab=overview&from=${date}&to=${date}`;

export default function GitHubContributions({ username, since, activeSince }) {
  const { t, lang } = useI18n();
  const locale = LOCALE_TAGS[lang] || "en-US";

  const WEEKDAYS = ["", t("gh.mon"), "", t("gh.wed"), "", t("gh.fri"), ""];

  const [year, setYear] = React.useState(ROLLING);
  const [statsOpen, setStatsOpen] = React.useState(false);
  const [state, setState] = React.useState({
    status: "loading",
    days: [],
    total: 0,
    offline: false,
  });

  const [hovered, setHovered] = React.useState(null);
  const [active, setActive] = React.useState(false);

  const [tappedIdx, setTappedIdx] = React.useState(null);
  const scrollerRef = React.useRef(null);
  const rowRef = React.useRef(null);
  const railRef = React.useRef(null);
  const gridRef = React.useRef(null);
  const cardRef = React.useRef(null);
  const tipRef = React.useRef(null);

  const [tipShift, setTipShift] = React.useState(0);

  const years = React.useMemo(() => {
    const first = Number(String(since || activeSince || "").slice(0, 4));
    const current = new Date().getFullYear();
    if (!first || first > current) return [String(current)];
    return Array.from({ length: current - first + 1 }, (_, i) => String(current - i));
  }, [activeSince, since]);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [nearViewport, setNearViewport] = React.useState(
    () => typeof IntersectionObserver === "undefined",
  );

  React.useEffect(() => {
    if (nearViewport) return;
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [nearViewport]);

  React.useLayoutEffect(() => {
    if (!username) return;

    const cached = readCache(username, year);
    setState(
      cached
        ? { status: "ready", days: cached.days, total: cached.total, offline: false }
        : { status: "loading", days: [], total: 0, offline: false },
    );
  }, [username, year]);

  React.useEffect(() => {
    if (!username || !nearViewport) return;
    const controller = new AbortController();

    fetchContributions(username, { year, signal: controller.signal })
      .then(({ days, total }) => {
        setState({ status: "ready", days, total, offline: false });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;

        setState((prev) =>
          prev.days.length
            ? { ...prev, offline: true }
            : { status: "error", days: [], total: 0, offline: false },
        );
      });

    return () => controller.abort();
  }, [username, year, nearViewport]);

  const { status, offline } = state;

  const days = state.days;
  const total = state.total;

  const cells = React.useMemo(() => {
    if (!days.length) return [];
    const lead = parseDay(days[0].date).getDay();
    return [...Array.from({ length: lead }, () => null), ...days];
  }, [days]);

  const columnsCount = Math.ceil(cells.length / 7) || 53;

  const [rowWidth, setRowWidth] = React.useState(null);

  React.useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setRowWidth(row.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const coarsePointer = useCoarsePointer();

  const showRail = rowWidth == null || rowWidth >= RAIL_MIN_ROW;

  const [railWidth, setRailWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      setRailWidth(0);
      return;
    }
    const measure = () => setRailWidth(rail.offsetWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    measure();
    return () => observer.disconnect();
  }, [showRail, lang]);

  const avail = rowWidth == null ? null : rowWidth - (showRail ? railWidth + RAIL_GAP : 0);

  const { cell: cellSize, gap: cellGap } = React.useMemo(
    () =>
      avail == null || avail <= 0
        ? { cell: MAX_CELL, gap: gapFor(MAX_CELL) }
        : fitCell(avail, columnsCount),
    [avail, columnsCount],
  );
  const step = cellSize + cellGap;

    const stats = React.useMemo(() => {
    if (!days.length) return null;
    const best = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
    const activeDays = days.filter((d) => d.count > 0).length;
    const sum = days.reduce((acc, d) => acc + d.count, 0);
    const perWeek = sum / (days.length / 7);

    const byWeekday = new Array(7).fill(0);
    const sampleFor = new Array(7).fill(null);
    for (const day of days) {
      const wd = parseDay(day.date).getDay();
      byWeekday[wd] += day.count;
      if (!sampleFor[wd]) sampleFor[wd] = day.date;
    }
    let busiestWd = 0;
    for (let i = 1; i < 7; i++) if (byWeekday[i] > byWeekday[busiestWd]) busiestWd = i;

    return {
      best,
      longest: longestStreak(days),
      activeDays,
      perWeek,

      busiest: byWeekday[busiestWd] > 0 ? sampleFor[busiestWd] : null,
    };
  }, [days]);

  const statItems = React.useMemo(() => {
    if (!stats) return [];
    const items = [
      {
        key: "total",

        label: year === ROLLING ? t("gh.inLastYear") : `${t("gh.contributions")} · ${year}`,
        value: total.toLocaleString(locale),
      },
    ];

    if (stats.best.count > 0) {
      items.push(
        {
          key: "best",
          label: t("gh.bestDay"),
          value: `${stats.best.count} · ${formatDay(stats.best.date, locale)}`,
        },
        {
          key: "streak",
          label: t("gh.longestStreak"),
          value: `${stats.longest} ${stats.longest === 1 ? t("gh.day") : t("gh.days")}`,
        },
        {
          key: "active",
          label: stats.activeDays === 1 ? t("gh.activeDay") : t("gh.activeDays"),
          value: String(stats.activeDays),
        },
      );

      if (stats.perWeek >= 0.05) {
        items.push({
          key: "perWeek",
          label: t("gh.perWeek"),
          value: stats.perWeek.toLocaleString(locale, { maximumFractionDigits: 1 }),
        });
      }
      if (stats.busiest) {
        items.push({
          key: "busiest",
          label: t("gh.busiest"),
          value: formatWeekday(stats.busiest, locale),
        });
      }
    }

    if (activeSince) {
      items.push({
        key: "first",
        label: t("gh.firstCommit"),
        value: formatDay(activeSince, locale),
      });
    }
    return items;
  }, [stats, total, year, activeSince, locale, t]);

  const monthLabels = React.useMemo(() => {
    const labels = [];
    let lastMonth = -1;

    const minColumns = Math.max(3, Math.ceil(26 / step));
    for (let col = 0; col < columnsCount; col++) {
      const cell = cells[col * 7];
      if (!cell) continue;
      const date = parseDay(cell.date);
      const month = date.getMonth();

      if (month !== lastMonth && (!labels.length || col - labels.at(-1).colIndex >= minColumns)) {
        labels.push({
          text: date.toLocaleString(locale, { month: "short" }),
          colIndex: col,

          atEnd: (columnsCount - col) * step < MONTH_LABEL_PX,
        });
        lastMonth = month;
      }
    }
    return labels;
  }, [cells, columnsCount, locale, step]);

    const [edges, setEdges] = React.useState({ start: false, end: false });

  const measureEdges = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const offset = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: offset > 2, end: max - offset > 2 });
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (status !== "ready" || !el) return;
    el.scrollLeft = el.scrollWidth;
    measureEdges();
  }, [status, year, columnsCount, measureEdges]);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measureEdges();
    const observer = new ResizeObserver(measureEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureEdges, cells.length]);

    const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const card = cardRef.current;

    if (!card || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!coarsePointer || tappedIdx == null) return;
    const dismiss = (e) => {
      if (gridRef.current?.contains(e.target)) return;
      setTappedIdx(null);
      setActive(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [coarsePointer, tappedIdx]);

  React.useEffect(() => setTappedIdx(null), [year]);

  React.useLayoutEffect(() => {
    const tip = tipRef.current;
    const card = cardRef.current;
    if (!hovered || !tip || !card) {
      setTipShift(0);
      return;
    }
    const w = tip.offsetWidth;
    const cw = card.clientWidth;
    const pad = 6;
    const left = hovered.x - (hovered.align / 100) * w;
    const right = left + w;
    let shift = 0;
    if (left < pad) shift = pad - left;
    else if (right > cw - pad) shift = cw - pad - right;
    setTipShift(shift);
  }, [hovered, locale]);

    const [focusIdx, setFocusIdx] = React.useState(null);

  const defaultIdx = React.useMemo(() => {
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i]?.count > 0) return i;
    }
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i]) return i;
    }
    return -1;
  }, [cells]);

  React.useEffect(() => setFocusIdx(null), [cells]);

  const tabIdx = focusIdx == null ? defaultIdx : focusIdx;

  const moveFocus = React.useCallback(
    (from, delta) => {

      for (let i = from + delta; i >= 0 && i < cells.length; i += delta) {
        const day = cells[i];
        if (!day) continue;
        setFocusIdx(i);
        gridRef.current?.querySelector(`[data-idx="${i}"]`)?.focus();
        return true;
      }
      return false;
    },
    [cells],
  );

  const onGridKeyDown = (e) => {
    const rtl = typeof document !== "undefined" && document.dir === "rtl";

    const week = rtl ? -7 : 7;
    const deltas = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -week,
      ArrowRight: week,
    };
    const from = tabIdx;
    if (from < 0) return;

    if (e.key in deltas) {
      if (moveFocus(from, deltas[e.key])) e.preventDefault();
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      const dir = e.key === "Home" ? 1 : -1;
      const edge = e.key === "Home" ? -1 : cells.length;
      if (moveFocus(edge, dir)) e.preventDefault();
    }
  };

  if (status === "error") return null;

  const skeleton = status === "loading";

  const grid = cells;
  const gridWidth = columnsCount * step - cellGap;

  const fadeStart = edges.start ? EDGE_FADE : 0;
  const fadeEnd = edges.end ? EDGE_FADE : 0;
  const edgeMask =
    fadeStart || fadeEnd
      ? `linear-gradient(to right, transparent 0, #000 ${fadeStart}px, #000 calc(100% - ${fadeEnd}px), transparent 100%)`
      : undefined;

  const windows = [ROLLING, ...years];

  return (
    <div ref={cardRef} className="relative w-full rounded-[14px] border border-line bg-surface-raised/40 p-4 sm:p-5 font-sans select-none">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="flex items-baseline gap-1.5 text-[13px] font-medium text-ink-strong tracking-tight">
          {t("gh.title")}

          {}
          {statItems.length > 0 && (
            <span
              className={`group/stats relative inline-flex self-center ${coarsePointer ? "-my-1.5" : ""}`}
            >
              <button
                type="button"
                aria-label={t("gh.stats")}

                aria-expanded={coarsePointer ? statsOpen : undefined}
                onClick={() => setStatsOpen((open) => !open)}
                className={`flex items-center justify-center rounded-[4px] outline-none focus-visible:ring-1 focus-visible:ring-ink-muted transition-colors duration-200 ${
                  coarsePointer ? "w-7 h-7 -mx-1" : "w-[15px] h-[15px]"
                } ${
                  statsOpen && coarsePointer
                    ? "text-ink-strong bg-surface-hover"
                    : "text-ink-faint hover:text-ink-strong focus-visible:text-ink-strong hover:bg-surface-hover"
                }`}
              >
                {}
                <svg
                  viewBox="0 0 12 12"
                  className={coarsePointer ? "w-[13px] h-[13px]" : "w-[11px] h-[11px]"}
                  aria-hidden="true"
                >
                  <rect x="1" y="7" width="2.4" height="4" rx="0.7" fill="currentColor" />
                  <rect x="4.8" y="4" width="2.4" height="7" rx="0.7" fill="currentColor" />
                  <rect x="8.6" y="1" width="2.4" height="10" rx="0.7" fill="currentColor" />
                </svg>
              </button>

              {}
              {!coarsePointer && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-full left-0 mt-2 z-30 min-w-[190px] px-2.5 py-2 rounded-md border border-line-strong bg-surface-inverted/95 backdrop-blur-sm shadow-lg shadow-[color:var(--shadow-cast)] text-[10.5px] font-normal tracking-tight text-ink-on-inverted opacity-0 -translate-y-1 group-hover/stats:opacity-100 group-hover/stats:translate-y-0 group-focus-within/stats:opacity-100 group-focus-within/stats:translate-y-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                >
                  {statItems.map((item) => (
                    <StatRow key={item.key} label={item.label} value={item.value} />
                  ))}
                </span>
              )}
            </span>
          )}
        </h3>

        <span className="group/since relative shrink-0">
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11.5px] text-ink-subtle hover:text-ink-strong focus-visible:text-ink-strong outline-none transition-colors duration-200"
          >
            @{username}
          </a>

          {since && (
            <span
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 mt-2 z-30 px-2 py-1 rounded-md border border-line-strong bg-surface-inverted/95 backdrop-blur-sm shadow-lg shadow-[color:var(--shadow-cast)] text-[10.5px] font-medium tracking-tight whitespace-nowrap text-ink-on-inverted opacity-0 -translate-y-1 group-hover/since:opacity-100 group-hover/since:translate-y-0 group-focus-within/since:opacity-100 group-focus-within/since:translate-y-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            >
              {t("gh.accountCreated")}{" "}
              <span className="text-ink-strong">{formatMonthYear(since, locale)}</span>
              {activeSince && (
                <>
                  <span className="text-ink-faint"> · </span>
                  {t("gh.firstCommit")}{" "}
                  <span className="text-ink-strong">{formatDay(activeSince, locale)}</span>
                </>
              )}
            </span>
          )}
        </span>
      </div>

      {}
      {}
      <div
        role="group"
        aria-label={t("gh.selectYear")}
        className="flex items-center gap-1 mb-4 -mx-1 px-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {windows.map((w) => {
          const selected = w === year;
          return (
            <button
              key={w}
              type="button"
              aria-pressed={selected}
              onClick={() => setYear(w)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10.5px] font-medium tracking-tight border transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-ink-muted ${
                selected
                  ? "border-line-strong bg-surface-hover text-ink-strong"
                  : "border-transparent text-ink-subtle hover:text-ink hover:bg-surface-hover/60"
              }`}
            >
              {w === ROLLING ? t("gh.lastYear") : w}
            </button>
          );
        })}
      </div>

      {}
      {coarsePointer && statsOpen && statItems.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-line bg-surface-hover/40 text-[11px] text-ink-secondary">
          {statItems.map((item) => (
            <StatRow key={item.key} label={item.label} value={item.value} />
          ))}
        </div>
      )}

      {}
      <div ref={rowRef} className="flex gap-2 w-full">
        {showRail && (
          <div ref={railRef} className="flex flex-col shrink-0">
            <div className="h-4 mb-1.5" />
            <div
              className="grid text-[9.5px] text-ink-faint leading-none"
              style={{ gridTemplateRows: `repeat(7, ${cellSize}px)`, gap: `${cellGap}px` }}
            >
              {WEEKDAYS.map((label, i) => (
                <span key={i} className="flex items-center pr-0.5">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          ref={scrollerRef}
          onScroll={measureEdges}
          style={{ maskImage: edgeMask, WebkitMaskImage: edgeMask }}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div ref={gridRef} className="relative shrink-0" style={{ width: gridWidth }}>
            <div className="relative h-4 mb-1.5 text-[9.5px] text-ink-faint font-medium">
              {monthLabels.map((label, idx) => (
                <span
                  key={idx}
                  className="absolute"
                  style={label.atEnd ? { right: 0 } : { left: label.colIndex * step }}
                >
                  {label.text}
                </span>
              ))}
            </div>

            <div
              role="group"
              aria-label={t("gh.title")}
              className={`grid grid-flow-col transition-opacity duration-200 ${
                offline ? "opacity-70" : "opacity-100"
              }`}
              style={{
                gridTemplateRows: `repeat(7, ${cellSize}px)`,
                gridTemplateColumns: `repeat(${columnsCount}, ${cellSize}px)`,
                gap: `${cellGap}px`,
              }}
              onMouseLeave={() => setActive(false)}
              onKeyDown={onGridKeyDown}
            >
              {}
              {skeleton
                ? mounted &&
                  SKELETON_ROWS.map((row) => (
                    <div
                      key={row}
                      style={{ gridRow: row, gridColumn: "1 / -1" }}
                      className="rounded-[2px] bg-surface-raised animate-pulse"
                    />
                  ))
                : grid.map((day, idx) => {
                const col = Math.floor(idx / 7);

                const revealStyle =
                  revealed && !skeleton
                    ? { animationDelay: `${Math.min(col * REVEAL_STEP_MS, REVEAL_MAX_MS)}ms` }
                    : undefined;
                const revealClass = revealed && !skeleton ? "gh-cell-in" : "";

                if (day === null) {
                  return (
                    <div
                      key={idx}
                      className={`rounded-[2px] bg-surface-raised ${skeleton ? "animate-pulse" : ""}`}
                    />
                  );
                }

                const show = (el) => {
                  const card = cardRef.current;
                  const gridEl = gridRef.current;
                  if (!card || !gridEl)
                    return;
                  const cardRect = card.getBoundingClientRect();
                  const gridRect = gridEl.getBoundingClientRect();
                  setHovered({
                    day,
                    x: gridRect.left - cardRect.left + el.offsetLeft + el.offsetWidth / 2,
                    y: gridRect.top - cardRect.top + el.offsetTop,
                    align: col < 4 ? 0 : col > columnsCount - 5 ? 100 : 50,
                  });
                  setActive(true);
                };

                const label = `${day.count} ${t("gh.contributions")} · ${formatDay(day.date, locale)}`;
                const cellClass = `relative block rounded-[2px] ring-inset ring-[var(--hairline)] ring-1 hover:z-20 hover:scale-[1.45] hover:ring-ink-strong hover:shadow-[0_1px_6px_var(--shadow-cast)] focus-visible:z-20 focus-visible:scale-[1.45] focus-visible:ring-ink-strong focus-visible:ring-2 outline-none transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:hover:scale-100 ${revealClass} ${LEVEL_CLASSES[day.level]}`;

                const shared = {
                  "data-idx": idx,
                  tabIndex: idx === tabIdx ? 0 : -1,
                  onMouseEnter: (e) => show(e.currentTarget),
                  onFocus: (e) => {
                    setFocusIdx(idx);
                    show(e.currentTarget);
                  },
                  onBlur: () => setActive(false),
                  onClick: (e) => {
                    if (!coarsePointer)
                      return;
                    if (tappedIdx !== idx) {
                      e.preventDefault();
                      setTappedIdx(idx);
                      show(e.currentTarget);
                    }
                  },
                  style: revealStyle,
                  className: cellClass,
                };

                return day.count > 0 ? (
                  <a
                    key={idx}
                    href={dayUrl(username, day.date)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${label} — ${t("gh.viewDay")}`}
                    {...shared}
                  />
                ) : (
                  <div key={idx} role="img" aria-label={label} {...shared} />
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {}
      {hovered && (
        <div
          ref={tipRef}
          role="tooltip"
          aria-hidden={!active}
          className={`pointer-events-none absolute z-30 px-2 py-1 rounded-md border border-line-strong bg-surface-inverted/95 backdrop-blur-sm shadow-lg shadow-[color:var(--shadow-cast)] text-[10.5px] font-medium tracking-tight whitespace-nowrap text-ink-on-inverted transition-[left,top,transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            active ? "opacity-100" : "opacity-0"
          }`}
          style={{
            left: hovered.x,
            top: hovered.y - 6,
            transform: `translate(-${hovered.align}%, -100%) translateX(${tipShift}px) translateY(${active ? 0 : 3}px)`,
          }}
        >
          <span className="text-ink-strong">
            {hovered.day.count === 0 ? t("gh.none") : hovered.day.count}
          </span>{" "}
          {hovered.day.count === 1 ? t("gh.contribution") : t("gh.contributions")}
          <span className="text-ink-subtle">
            {" "}
            · {formatDay(hovered.day.date, locale)}
          </span>
        </div>
      )}

      {}
      <div className="flex items-end justify-between gap-4 mt-4 pt-3.5 border-t border-dashed border-line text-[10.5px]">
        {skeleton ? (
          <span className="inline-block w-44 h-3 rounded bg-surface-raised animate-pulse align-middle" />
        ) : (
          <span className="min-w-0 text-ink-faint">
            {}
            {activeSince && (
              <span className="block">
                {t("gh.started")} {formatDay(activeSince, locale)}
              </span>
            )}
            {}
            {offline && <span className="block">{t("gh.cached")}</span>}
          </span>
        )}

        <span className="flex items-center gap-1 text-ink-faint shrink-0">
          <span className="hidden sm:inline mr-0.5">{t("gh.less")}</span>
          {LEVEL_CLASSES.map((cls, i) => (
            <span
              key={i}
              className={`w-[9px] h-[9px] rounded-[2px] ring-1 ring-inset ring-[var(--hairline)] ${cls}`}
            />
          ))}
          <span className="hidden sm:inline ml-0.5">{t("gh.more")}</span>
        </span>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <span className="flex items-baseline justify-between gap-4 py-[1px]">
      <span className="opacity-70">{String(label).replace(/[:：]\s*$/, "")}</span>
      <span className="text-ink-strong font-medium tabular-nums whitespace-nowrap">{value}</span>
    </span>
  );
}
