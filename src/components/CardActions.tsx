"use client";

import { useState } from "react";

export function CardActions({ did, imageUrl }: { did: string; imageUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/card/${encodeURIComponent(did)}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — no-op, the URL is already visible in
      // the browser's address bar.
    }
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/card/${encodeURIComponent(did)}` : "";
  const tweetText = encodeURIComponent("My Technocore signal card — no key, no account, just public data:");
  const tweetHref = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={imageUrl}
        download={`technocore-watch-${did.replace("did:key:", "")}.png`}
        className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-accent/40"
      >
        Download
      </a>
      <button
        onClick={handleCopyLink}
        className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-accent/40"
      >
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
      <a
        href={tweetHref}
        target="_blank"
        rel="noreferrer"
        className="btn-gradient rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Post to X
      </a>
    </div>
  );
}
