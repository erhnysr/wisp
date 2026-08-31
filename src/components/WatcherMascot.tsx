/**
 * A small hand-drawn mascot — an inline SVG, no external asset. The nod to
 * Overheard's device illustration, but its own character: a rounded
 * "watcher" module with a single scanning eye, standing in for the
 * network-monitoring idea without borrowing their look.
 */
export function WatcherMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 260"
      className={className}
      role="img"
      aria-label="Technocore Watch mascot: a small rounded module with a scanning eye"
    >
      <defs>
        <linearGradient id="wm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c6bff" />
          <stop offset="100%" stopColor="#4f7cff" />
        </linearGradient>
        <radialGradient id="wm-eye" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e7e6ff" />
          <stop offset="100%" stopColor="#c9c4ff" />
        </radialGradient>
        <linearGradient id="wm-pupil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6d5ef7" />
          <stop offset="100%" stopColor="#4f7cff" />
        </linearGradient>
        <filter id="wm-shadow" x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#4f3fb0" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* antenna */}
      <line x1="120" y1="34" x2="120" y2="10" stroke="#b7b0ff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="120" cy="8" r="7" fill="url(#wm-pupil)" />

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
      <rect x="72" y="206" width="26" height="16" rx="8" fill="#5a4fd6" />
      <rect x="142" y="206" width="26" height="16" rx="8" fill="#5a4fd6" />

      {/* side sensors */}
      <circle cx="46" cy="118" r="7" fill="#c9c4ff" />
      <circle cx="194" cy="118" r="7" fill="#c9c4ff" />

      {/* eye */}
      <circle cx="120" cy="118" r="52" fill="url(#wm-eye)" />
      <circle cx="120" cy="118" r="52" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="3" />
      <circle cx="120" cy="118" r="24" fill="url(#wm-pupil)" />
      <circle cx="112" cy="110" r="7" fill="#ffffff" fillOpacity="0.85" />

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
