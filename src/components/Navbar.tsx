export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="btn-gradient flex h-7 w-7 items-center justify-center rounded-md text-white">
            <span className="font-mono text-xs font-bold">TW</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Technocore Watch</span>
        </div>
        <nav className="hidden items-center gap-1 sm:flex">
          {["Signal", "Rooms", "Card", "API"].map((item) => (
            <span
              key={item}
              className="nav-pill cursor-pointer rounded-full px-4 py-1.5 text-sm text-muted"
            >
              {item}
            </span>
          ))}
        </nav>
        <a
          href="https://github.com/erhnysr"
          target="_blank"
          rel="noreferrer"
          className="nav-pill rounded-full border-border px-3 py-1.5 text-sm text-muted"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
