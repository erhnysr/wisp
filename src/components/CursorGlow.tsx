"use client";

import { useEffect, useRef } from "react";

/**
 * A soft, purely decorative light that trails the pointer with a bit of
 * lag (lerp'd via requestAnimationFrame) instead of snapping to it — that
 * small delay is what makes it feel alive rather than mechanical. Fixed +
 * pointer-events-none so it never affects layout or interaction; skipped
 * entirely under prefers-reduced-motion.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = { x: window.innerWidth / 2, y: 140 };
    const current = { ...target };
    let raf = 0;

    function handleMove(e: PointerEvent) {
      target.x = e.clientX;
      target.y = e.clientY;
    }
    window.addEventListener("pointermove", handleMove);

    function tick() {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      ref.current?.style.setProperty("--x", `${current.x}px`);
      ref.current?.style.setProperty("--y", `${current.y}px`);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(480px circle at var(--x, 50%) var(--y, 140px), rgba(109,94,247,0.16), rgba(79,124,255,0.08) 40%, transparent 65%)",
      }}
    />
  );
}
