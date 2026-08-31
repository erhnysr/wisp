"use client";

import { useEffect, useRef } from "react";

/**
 * A small hand-drawn mascot — an inline SVG, no external asset. The nod to
 * Overheard's device illustration, but its own character: a rounded
 * "watcher" module whose eye actually follows the pointer — the one
 * playful detail Overheard doesn't have.
 */
export function WatcherMascot({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handleMove(e: PointerEvent) {
      const svg = svgRef.current;
      const pupil = pupilRef.current;
      if (!svg || !pupil) return;

      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;

      // Eye center sits at (50%, 45%) of the mascot's box, per the viewBox below.
      const eyeX = rect.left + rect.width * 0.5;
      const eyeY = rect.top + rect.height * 0.454;

      const dx = e.clientX - eyeX;
      const dy = e.clientY - eyeY;
      const dist = Math.hypot(dx, dy) || 1;

      // Small, capped offset — a glance, not a googly-eye swing.
      const maxOffset = 9;
      const eased = Math.min(1, dist / 300);
      const ox = (dx / dist) * maxOffset * eased;
      const oy = (dy / dist) * maxOffset * eased;

      pupil.setAttribute("transform", `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
    }

    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 240 260"
      className={className}
      role="img"
      aria-label="Technocore Watch mascot: a small rounded module whose eye follows your cursor"
    >
      <defs>
        <linearGradient id="wm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c6bff" />
          <stop offset="100%" stopColor="#5b4fe0" />
        </linearGradient>
        <radialGradient id="wm-eye" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#eae7ff" />
          <stop offset="100%" stopColor="#cbc3ff" />
        </radialGradient>
        <linearGradient id="wm-pupil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c6bff" />
          <stop offset="100%" stopColor="#5b4fe0" />
        </linearGradient>
        <linearGradient id="wm-antenna-tip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2765c" />
          <stop offset="100%" stopColor="#e0563c" />
        </linearGradient>
        <filter id="wm-shadow" x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#40349e" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* antenna — a small warm coral tip, the one deliberate spot of contrast color */}
      <line x1="120" y1="34" x2="120" y2="10" stroke="#b7b0ff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="120" cy="8" r="7" fill="url(#wm-antenna-tip)" />

      {/* body */}
      <g filter="url(#wm-shadow)">
        <rect x="36" y="34" width="168" height="168" rx="44" fill="url(#wm-body)" />
        <rect
          x="36"
          y="34"
          width="168"
          height="168"
          rx="44"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.18"
          strokeWidth="2"
        />
      </g>

      {/* little feet */}
      <rect x="72" y="206" width="26" height="16" rx="8" fill="#4a3fc4" />
      <rect x="142" y="206" width="26" height="16" rx="8" fill="#4a3fc4" />

      {/* side sensors */}
      <circle cx="46" cy="118" r="7" fill="#cbc3ff" />
      <circle cx="194" cy="118" r="7" fill="#cbc3ff" />

      {/* eye socket */}
      <circle cx="120" cy="118" r="52" fill="url(#wm-eye)" />
      <circle cx="120" cy="118" r="52" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="3" />

      {/* pupil + highlight — this group gets nudged by pointermove */}
      <g ref={pupilRef} style={{ transition: "transform 60ms linear" }}>
        <circle cx="120" cy="118" r="24" fill="url(#wm-pupil)" />
        <circle cx="112" cy="110" r="7" fill="#ffffff" fillOpacity="0.85" />
      </g>

      {/* scan arcs, suggesting "watching" */}
      <path
        d="M120 66 a52 52 0 0 1 45 26"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M120 170 a52 52 0 0 1 -45 -26"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
