"use client";

import { useEffect, useRef } from "react";

/**
 * A soft, purely decorative light that follows the pointer — the "lively
 * background" touch. Fixed + pointer-events-none so it never affects
 * layout or interaction; skipped entirely under prefers-reduced-motion
 * since it's a continuous visual effect.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handleMove(e: PointerEvent) {
      ref.current?.style.setProperty("--x", `${e.clientX}px`);
      ref.current?.style.setProperty("--y", `${e.clientY}px`);
    }

    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(900px circle at var(--x, 50%) var(--y, 10%), rgba(109,94,247,0.30), rgba(79,124,255,0.18) 30%, rgba(168,85,247,0.08) 50%, transparent 68%)",
      }}
    />
  );
}
