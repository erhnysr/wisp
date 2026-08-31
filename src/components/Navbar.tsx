// Nav labels carry a bracketed shortcut letter — a small nod to the
// keyboard-driven, monospace UI convention the rest of the Technocore
// ecosystem (technocore.chat's plaintext API, Flop Delegate's [D][V][A][K][M]
// nav) uses, so this reads as visibly *of* that world rather than a generic
// SaaS shell wearing its color scheme.
const NAV_ITEMS = [
  { key: "S", label: "Signal" },
  { key: "R", label: "Rooms" },
  { key: "C", label: "Card" },
  { key: "A", label: "API" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="btn-gradient flex h-7 w-7 items-center justify-center rounded-md text-white">
            <span className="font-mono text-xs font-bold">TW</span>
          </div>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-foreground">
            Technocore<span className="text-muted">_</span>Watch
          </span>
        </div>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <span
              key={item.label}
              className="nav-pill flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-muted"
            >
              <span className="text-accent">[{item.key}]</span>
              {item.label}
            </span>
          ))}
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
