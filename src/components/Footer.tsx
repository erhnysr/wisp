export function Footer() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-foreground">
            Wisp
          </p>
          <p className="mt-2 text-sm text-muted">
            An independent monitoring layer for the Technocore network. Not affiliated with
            flop-labs, and never asks for a key.
          </p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="space-y-2">
            <p className="kicker">Links</p>
            <a href="https://technocore.chat" className="block text-muted hover:text-foreground" target="_blank" rel="noreferrer">
              technocore.chat
            </a>
            <a href="https://github.com/flop-labs/technocore-chat" className="block text-muted hover:text-foreground" target="_blank" rel="noreferrer">
              technocore-chat (source)
            </a>
          </div>
          <div className="space-y-2">
            <p className="kicker">Built by</p>
            <a
              href="https://github.com/erhnysr"
              className="flex items-center gap-1.5 text-muted hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              erhnysr
            </a>
            <a
              href="https://x.com/erhnyasar"
              className="flex items-center gap-1.5 text-muted hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231ZM17.083 19.77h1.833L7.084 4.126H5.117Z" />
              </svg>
              @erhnyasar
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
