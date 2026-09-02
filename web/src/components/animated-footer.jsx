"use client";

import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
const cn = (...classes) => classes.filter(Boolean).join(" ");

let gsapPromise = null;
const loadGsap = () => (gsapPromise ??= import("gsap").then((m) => m.default ?? m.gsap));

const setCharsY = (chars, yPercent) => {
  const transform = yPercent === 0 ? "" : `translateY(${yPercent}%)`;
  for (const char of chars) char.style.transform = transform;
};

const DEFAULT_ASCII_CHARS = "........:::=+xX#0369";

const HIGHLIGHT_LIFETIME = 300;
const CLUSTER_SIZE = 10;

const HIGHLIGHT_SETTLE = 100;
const PARALLAX_EASE = 0.05;

function buildHandCells(image, columns, asciiChars) {
  const rows = Math.max(
    1,
    Math.round(columns / (image.naturalWidth / image.naturalHeight || 1)),
  );

  const sampler = document.createElement("canvas");
  sampler.width = columns;
  sampler.height = rows;
  const sampleCtx = sampler.getContext("2d");
  const cells = new Map();
  if (!sampleCtx) return { rows, cells };

  sampleCtx.drawImage(image, 0, 0, columns, rows);
  const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;

  const brightnessAt = (offset) =>
    (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;

  const corners = [
    0,
    columns - 1,
    (rows - 1) * columns,
    (rows - 1) * columns + (columns - 1),
  ];
  const bgBrightness =
    corners.reduce((sum, cellIndex) => sum + brightnessAt(cellIndex * 4), 0) / corners.length;
  const CONTRAST_THRESHOLD = 0.08;

  const ditherNoise = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const offset = (row * columns + col) * 4;
      const contrast = Math.abs(brightnessAt(offset) - bgBrightness);
      if (contrast < CONTRAST_THRESHOLD) continue;

      const intensity = Math.min(1, contrast / 0.6);
      const keepProbability = Math.pow(intensity, 2.2) * 0.55;
      if (ditherNoise(col, row) > keepProbability) continue;

      const charIndex = Math.min(
        asciiChars.length - 1,
        Math.floor(Math.pow(intensity, 2.5) * asciiChars.length),
      );

      cells.set(`${col},${row}`, {
        col,
        row,
        char: asciiChars[charIndex],
        intensity,
        highlightEndTime: 0,
      });
    }
  }

  return { rows, cells };
}

function highlightCluster(cells, startCell) {
  const now = Date.now();
  startCell.highlightEndTime = now + HIGHLIGHT_LIFETIME;

  const steps = Math.floor(Math.random() * CLUSTER_SIZE) + 1;
  const litCells = [startCell];
  let current = startCell;

  for (let step = 0; step < steps; step++) {
    const neighbours = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbour = cells.get(`${current.col + dx},${current.row + dy}`);
        if (neighbour && !litCells.includes(neighbour)) neighbours.push(neighbour);
      }
    }
    if (neighbours.length === 0) break;

    const next = neighbours[Math.floor(Math.random() * neighbours.length)];
    next.highlightEndTime = now + HIGHLIGHT_LIFETIME + step * 10;
    litCells.push(next);
    current = next;
  }
}

export function AnimatedFooter({
  headingLines = ["VengeanceUI"],
  leftImage = "/animated-footer/hand-left.webp",
  rightImage = "/animated-footer/hand-right.webp",
  background,
  textColor,
  charColor,
  hoverColor,
  hoverCharColor,
  theme = "dark",
  asciiChars = DEFAULT_ASCII_CHARS,
  columns = 150,
  cellSize = 20,
  fontSize = 12,
  parallaxStrength = 20,
  hoverRadius = 8,
  revealOnScroll = true,
  revealed,
  className,
  headingClassName,
  charClassName,
  children,
}) {
  const rootRef = useRef(null);
  const leftWrapRef = useRef(null);
  const rightWrapRef = useRef(null);
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);

  const animateInRef = useRef(() => {});
  const animateOutRef = useRef(() => {});

  const isDark = theme !== "light";

  const cc = charColor ?? (isDark ? "#ffffff" : "#1c1917");
  const hc = hoverColor ?? (isDark ? "#ffffff" : "#1c1917");
  const hcc = hoverCharColor ?? (isDark ? "#ffffff" : "#fafaf9");

  const useIntensityColor = charColor == null;

  const liveRef = useRef({ charColor: cc, hoverColor: hc, hoverCharColor: hcc, parallaxStrength, hoverRadius, useIntensityColor, isDark });

  const repaintRef = useRef(0);
  useEffect(() => {
    liveRef.current = { charColor: cc, hoverColor: hc, hoverCharColor: hcc, parallaxStrength, hoverRadius, useIntensityColor, isDark };
    repaintRef.current += 1;
  }, [cc, hc, hcc, parallaxStrength, hoverRadius, useIntensityColor, isDark]);

  const sig = useMemo(
    () =>
      JSON.stringify({
        leftImage,
        rightImage,
        columns,
        cellSize,
        fontSize,
        asciiChars,
        revealOnScroll,
        headingLines,
      }),
    [leftImage, rightImage, columns, cellSize, fontSize, asciiChars, revealOnScroll, headingLines],
  );

  useEffect(() => {
    const root = rootRef.current;
    const leftWrap = leftWrapRef.current;
    const rightWrap = rightWrapRef.current;
    if (!root || !leftWrap || !rightWrap) return;

    const hands = [];
    const wrappers = [leftWrap, rightWrap];

    const setupHand = (
      image,
      canvas,
      direction,
    ) => {
      const { rows, cells } = buildHandCells(image, columns, asciiChars);
      if (cells.size === 0) return;

      const dpr = 1;
      canvas.width = columns * cellSize * dpr;
      canvas.height = rows * cellSize * dpr;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      const metrics = ctx.measureText("X");
      const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const baselineOffset = cellSize / 2 + glyphHeight / 2 - metrics.actualBoundingBoxDescent;

      hands.push({
        canvas,
        ctx,
        cells,
        cellList: [...cells.values()],
        rows,
        columns,
        cellSize,
        baselineOffset,
        direction,

        needsDraw: true,
        litUntil: 0,
      });
    };

    const loadHand = (src, canvas, direction) => {
      if (!src) return;
      const image = new Image();
      let initialized = false;
      const init = () => {
        if (initialized) return;
        initialized = true;
        setupHand(image, canvas, direction);
      };
      image.onload = init;
      image.src = src;
      if (image.complete && image.naturalWidth) init();
    };

    let built = false;
    const buildScene = () => {
      if (built) return;
      built = true;
      loadHand(leftImage, leftCanvasRef.current, 1);
      loadHand(rightImage, rightCanvasRef.current, -1);
    };

    const renderHand = (hand, now) => {
      const { ctx, cellList, cellSize: cs, baselineOffset, columns: cols, rows } = hand;
      const { charColor: cc, hoverColor: hc, hoverCharColor: hcc, useIntensityColor, isDark } = liveRef.current;
      ctx.clearRect(0, 0, cols * cs, rows * cs);

      for (const cell of cellList) {
        const x = cell.col * cs;
        const y = cell.row * cs;
        const isHighlighted = cell.highlightEndTime > now;

        if (isHighlighted) {
          ctx.fillStyle = hc;
          ctx.fillRect(x, y, cs, cs);
        }
        if (isHighlighted) {
          ctx.fillStyle = hcc;
        } else if (useIntensityColor) {

          const shade = Math.pow(cell.intensity, 0.55) * 105;
          const grey = Math.round(isDark ? 150 + shade : 105 - shade);
          ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
        } else {
          ctx.fillStyle = cc;
        }
        ctx.fillText(cell.char, x + cs / 2, y + baselineOffset);
      }
    };

    const pointer = { x: 0, y: 0 };
    const drift = { x: 0, y: 0 };

    const curtain = { offset: revealOnScroll ? 125 : 0 };

    const hoverHand = (hand, clientX, clientY) => {
      const rect = hand.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const mouseCol = ((clientX - rect.left) / rect.width) * hand.columns;
      const mouseRow = ((clientY - rect.top) / rect.height) * hand.rows;

      const radius = liveRef.current.hoverRadius;
      if (
        mouseCol < -radius ||
        mouseCol > hand.columns + radius ||
        mouseRow < -radius ||
        mouseRow > hand.rows + radius
      ) {
        return;
      }

      const baseCol = Math.round(mouseCol);
      const baseRow = Math.round(mouseRow);
      const span = Math.ceil(radius);

      let closest = null;
      let closestDist = Infinity;
      for (let dy = -span; dy <= span; dy++) {
        for (let dx = -span; dx <= span; dx++) {
          const cell = hand.cells.get(`${baseCol + dx},${baseRow + dy}`);
          if (!cell) continue;
          const ox = mouseCol - cell.col;
          const oy = mouseRow - cell.row;
          const dist = Math.sqrt(ox * ox + oy * oy);
          if (dist < closestDist) {
            closestDist = dist;
            closest = cell;
          }
        }
      }

      if (closest && closestDist <= radius) {
        highlightCluster(hand.cells, closest);

        hand.litUntil =
          Date.now() + HIGHLIGHT_LIFETIME + CLUSTER_SIZE * 10 + HIGHLIGHT_SETTLE;
      }
    };

    let inView = true;

    let pendingPointer = null;

    const onMouseMove = (event) => {
      if (!inView) return;
      pendingPointer = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const consumePointer = () => {
      if (!pendingPointer) return;
      const { x: clientX, y: clientY } = pendingPointer;
      pendingPointer = null;

      const strength = liveRef.current.parallaxStrength;
      const rect = root.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      pointer.x = ((clientX - rect.left) / w - 0.5) * strength * 2;
      pointer.y = ((clientY - rect.top) / h - 0.5) * strength * 2;
      for (const hand of hands) hoverHand(hand, clientX, clientY);
    };

    let scrubReveal = false;
    let lastProgress = -1;

    const updateProgress = () => {
      const rect = root.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const start = viewportH;
      const end = viewportH * 0.6;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));

      if (progress === lastProgress) return;
      lastProgress = progress;

      curtain.offset = 125 * (1 - progress);
      setCharsY(chars, 125 * (1 - progress));
    };

    let rafId = 0;

    const lastTransform = ["", ""];
    let paintedRevision = repaintRef.current;

    const frame = () => {
      if (!inView) {
        rafId = 0;
        return;
      }

      const now = Date.now();
      consumePointer();
      if (scrubReveal)
        updateProgress();

      if (repaintRef.current !== paintedRevision) {
        paintedRevision = repaintRef.current;
        for (const hand of hands) hand.needsDraw = true;
      }

      for (const hand of hands) {
        if (!hand.needsDraw && now > hand.litUntil)
          continue;
        renderHand(hand, now);
        if (now > hand.litUntil) hand.needsDraw = false;
      }

      drift.x += (pointer.x - drift.x) * PARALLAX_EASE;
      drift.y += (pointer.y - drift.y) * PARALLAX_EASE;
      const strength = liveRef.current.parallaxStrength;
      const scale = 1 + (strength * 2) / 200;

      wrappers.forEach((wrapper, i) => {
        const dir = i === 0 ? 1 : -1;
        const revealX = i === 0 ? -curtain.offset : curtain.offset;
        const x = drift.x * dir || 0;
        const y = -drift.y || 0;
        const transform = `translateX(${revealX}%) translate(${x}px, ${y}px) scale(${scale})`;
        if (transform !== lastTransform[i]) {
          wrapper.style.transform = transform;
          lastTransform[i] = transform;
        }
      });

      rafId = requestAnimationFrame(frame);
    };

    const startLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(frame);
    };
    startLoop();

    const visibility = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) {
          for (const hand of hands)
            hand.needsDraw = true;
          startLoop();
        }
      },
      { root: null, rootMargin: "200px" },
    );
    visibility.observe(root);

    const preparer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        buildScene();
        preparer.disconnect();
      },
      { root: null, rootMargin: "800px" },
    );
    preparer.observe(root);

    const chars = Array.from(root.querySelectorAll("[data-af-char]"));

    const animateIn = async () => {
      const gsap = await loadGsap();
      gsap.to(curtain, { offset: 0, duration: 1, ease: "power3.out", overwrite: true });
      gsap.to(chars, {
        yPercent: 0,
        duration: 1,
        ease: "power3.out",
        stagger: { each: 0.04, from: "center" },
        overwrite: true,
      });
    };

    const animateOut = async () => {
      const gsap = await loadGsap();
      gsap.to(curtain, { offset: 125, duration: 0.4, ease: "power2.in", overwrite: true });
      gsap.to(chars, {
        yPercent: 125,
        duration: 0.4,
        ease: "power2.in",
        stagger: { each: 0.01, from: "center" },
        overwrite: true,
      });
    };

    animateInRef.current = animateIn;
    animateOutRef.current = animateOut;

    const maskAll = () => setCharsY(chars, 125);
    const showAll = () => setCharsY(chars, 0);

    if (revealed !== undefined) {

      curtain.offset = revealed ? 0 : 125;
      if (revealed) showAll();
      else maskAll();
    } else if (revealOnScroll) {

      maskAll();
      scrubReveal = true;
      updateProgress();
    } else {
      showAll();
    }

    return () => {
      cancelAnimationFrame(rafId);
      visibility.disconnect();
      preparer.disconnect();
      window.removeEventListener("mousemove", onMouseMove);

      if (gsapPromise) gsapPromise.then((gsap) => gsap.killTweensOf([curtain, ...chars]));
    };
  }, [sig]);

  useEffect(() => {
    if (revealed === undefined) return;
    if (revealed) animateInRef.current();
    else animateOutRef.current();
  }, [revealed]);

  const startsHidden = revealed !== undefined ? !revealed : revealOnScroll;
  const offEdge = startsHidden ? 125 : 0;

  return (
    <footer
      ref={rootRef}
      className={cn(
        "relative w-full h-full overflow-hidden",
        !background && "bg-transparent",
        !textColor && "text-ink-strong",
        className
      )}
      style={{ backgroundColor: background, color: textColor, containerType: "inline-size" }}
    >
      {}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between">
        <div
          ref={leftWrapRef}
          className="relative w-2/5 min-w-[200px] will-change-transform"
          style={{ transform: `translateX(-${offEdge}%)` }}
        >
          <canvas ref={leftCanvasRef} className="block h-auto w-full" />
        </div>
        <div
          ref={rightWrapRef}
          className="relative w-2/5 min-w-[200px] will-change-transform"
          style={{ transform: `translateX(${offEdge}%)` }}
        >
          <canvas ref={rightCanvasRef} className="block h-auto w-full" />
        </div>
      </div>

      {}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-8">
        <div className="flex items-end justify-center gap-4">
        {headingLines.map((word, wi) => (
          <h2
            key={`${word}-${wi}`}
            aria-label={word}
            className={cn(
              "overflow-hidden font-medium leading-none tracking-tight pb-[0.15em] -mb-[0.15em]",
              headingClassName,
            )}
            style={{ fontSize: "clamp(2rem, 13cqw, 11rem)" }}
          >
            {Array.from(word).map((ch, ci) => (

              <span
                key={ci}
                data-af-char
                aria-hidden="true"
                className={cn("inline-block", charClassName)}
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h2>
        ))}
        </div>
        {children}
      </div>
    </footer>
  );
}

export default AnimatedFooter;
