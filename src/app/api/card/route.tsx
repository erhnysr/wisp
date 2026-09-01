import { ImageResponse } from "next/og";
import { parseDid } from "@/lib/did";
import { scanDidActivity } from "@/lib/lookup";
import type { SignalMetric } from "@/lib/signal";

const SIZE = { width: 1200, height: 630 };

const COLORS = {
  bg: "#ffffff",
  border: "#e4e7f2",
  foreground: "#12142b",
  muted: "#6b7089",
  accent: "#5b4fe0",
  accent2: "#7c6bff",
  accentWarm: "#f2765c",
  accentSoft: "rgba(91, 79, 224, 0.08)",
};

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: COLORS.bg,
        position: "relative",
        fontFamily: "sans-serif",
        padding: "56px 64px",
      }}
    >
      {/* decorative gradient corner, mirrors the site's hero blobs */}
      <div
        style={{
          position: "absolute",
          top: -160,
          left: -160,
          width: 480,
          height: 480,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${COLORS.accent} 0%, rgba(255,255,255,0) 70%)`,
          opacity: 0.25,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -180,
          right: -140,
          width: 420,
          height: 420,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${COLORS.accentWarm} 0%, rgba(255,255,255,0) 70%)`,
          opacity: 0.18,
          display: "flex",
        }}
      />
      {children}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Frame>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `linear-gradient(100deg, ${COLORS.accent2}, ${COLORS.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          W
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontFamily: "monospace",
            color: COLORS.foreground,
            display: "flex",
          }}
        >
          Wisp
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          color: COLORS.muted,
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        {message}
      </div>
    </Frame>
  );
}

function MetricTile({ metric }: { metric: SignalMetric }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: "20px 22px",
        background: "#fafbff",
      }}
    >
      <div style={{ fontSize: 16, color: COLORS.muted, display: "flex" }}>{metric.label}</div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          marginTop: 6,
          background: `linear-gradient(100deg, ${COLORS.accent2}, ${COLORS.accent})`,
          backgroundClip: "text",
          color: "transparent",
          display: "flex",
        }}
      >
        {formatMetric(metric.value)}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const didParam = searchParams.get("did") ?? "";

  const parsed = parseDid(didParam);
  if (!parsed.ok) {
    return new ImageResponse(<ErrorCard message={parsed.error} />, SIZE);
  }

  let roomsSeenIn = 0;
  let metrics: SignalMetric[] = [];
  try {
    const { summary } = await scanDidActivity(parsed.value.did);
    roomsSeenIn = summary.roomsSeenIn.length;
    metrics = summary.metrics;
  } catch {
    // Network hiccup while rendering the card — we still render the DID
    // itself rather than failing the whole image.
  }

  return new ImageResponse(
    (
      <Frame>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(100deg, ${COLORS.accent2}, ${COLORS.accent})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              W
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily: "monospace",
                color: COLORS.foreground,
                display: "flex",
              }}
            >
              Wisp
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "6px 16px",
              borderRadius: 9999,
              background: COLORS.accentSoft,
              color: COLORS.accent,
              fontSize: 14,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontFamily: "monospace",
            }}
          >
            {roomsSeenIn > 0 ? `seen in ${roomsSeenIn} room${roomsSeenIn === 1 ? "" : "s"}` : "no recent activity found"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <div
            style={{
              fontSize: 15,
              color: COLORS.muted,
              fontFamily: "monospace",
              letterSpacing: 1,
              display: "flex",
            }}
          >
            IDENTITY
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: COLORS.foreground,
              fontFamily: "monospace",
              marginTop: 4,
              display: "flex",
            }}
          >
            {parsed.value.short}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
          {metrics.map((m) => (
            <MetricTile key={m.key} metric={m} />
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            color: COLORS.muted,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          <div style={{ display: "flex" }}>
            independent · reads technocore-chat&apos;s own public data · never asks for a key
          </div>
        </div>
      </Frame>
    ),
    SIZE,
  );
}
