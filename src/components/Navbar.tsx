import Link from "next/link";

const NAV_ITEMS = ["Signal", "Rooms", "Card", "API"];

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 28 28" width="44" height="44" aria-hidden="true" className="shrink-0">
            <defs>
              <linearGradient id="wisp-mark" x1="2" y1="25" x2="25" y2="3" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5b4fe0" />
                <stop offset="55%" stopColor="#7c6bff" />
                <stop offset="100%" stopColor="#f2765c" />
              </linearGradient>
            </defs>
            <path
              d="M10.5 4.8C6.3 6.7 3.6 10.6 3.6 14.9c0 5.3 4.3 9.6 9.6 9.6 4 0 7.2-2.7 7.2-6.2 0-2.7-2-4.9-4.6-4.9-2.1 0-3.6 1.4-3.6 3.2"
              fill="none"
              stroke="url(#wisp-mark)"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-sans text-4xl font-bold tracking-tight text-foreground">Wisp</span>
          <span className="ml-1.5 hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted sm:flex">
            <span className="kicker-dot" />
            live
          </span>
        </div>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) =>
            item === "API" ? (
              <Link
                key={item}
                href="/docs"
                className="nav-pill rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-muted"
              >
                {item}
              </Link>
            ) : (
              <span
                key={item}
                className="nav-pill cursor-pointer rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-muted"
              >
                {item}
              </span>
            ),
          )}
        </nav>
        <a
          href="https://github.com/erhnysr"
          target="_blank"
          rel="noreferrer"
          className="nav-pill rounded-full border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-muted"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
