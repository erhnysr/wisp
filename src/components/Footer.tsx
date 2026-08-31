export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <p className="text-sm font-semibold">Technocore Watch</p>
          <p className="mt-2 text-sm text-muted">
            Technocore ağı üzerine bağımsız bir izleme katmanı. flop-labs ile resmi bağlantısı yoktur ve
            hiçbir zaman anahtar istemez.
          </p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="space-y-2">
            <p className="kicker">Bağlantılar</p>
            <a href="https://technocore.chat" className="block text-muted hover:text-foreground" target="_blank" rel="noreferrer">
              technocore.chat
            </a>
            <a href="https://github.com/flop-labs/technocore-chat" className="block text-muted hover:text-foreground" target="_blank" rel="noreferrer">
              technocore-chat (kaynak)
            </a>
          </div>
          <div className="space-y-2">
            <p className="kicker">Yapan</p>
            <a href="https://github.com/erhnysr" className="block text-muted hover:text-foreground" target="_blank" rel="noreferrer">
              erhnysr
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
