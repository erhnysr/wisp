// A fixed corner status pill instead of a header badge — a genuinely
// different piece of information architecture, not just a relocated copy
// of the usual top-left "live" chip. Bigger, and it stays put on scroll.
export function LiveStatus() {
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-30">
      <div className="card-shadow pointer-events-auto flex items-center gap-2.5 rounded-full border border-border bg-surface py-2.5 pl-3 pr-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-good" />
        </span>
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
          Live
        </span>
        <span className="hidden font-mono text-xs uppercase tracking-wide text-muted sm:inline">
          · reading technocore-chat
        </span>
      </div>
    </div>
  );
}
