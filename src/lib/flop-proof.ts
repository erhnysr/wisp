/**
 * Thin, typed wrapper around the Flop Proof public API
 * (flop-status.vercel.app — github.com/dharmanan/flop-status).
 *
 * Flop Proof is NOT a Flop Labs product. It's an independent community tool
 * that issues signed, portable "capability certificates" to a DID after it
 * passes a deterministic challenge (Ed25519 signing, canonical JSON/SHA256,
 * technocore message shape, and so on). A certificate here is one more
 * verifiable, DID-anchored signal — not a score, not an official ranking,
 * and not an airdrop guarantee. We surface it that way: alongside our own
 * signal panel, clearly labeled as third-party, never blended into it.
 *
 * Endpoint shape confirmed directly against the flop-status source
 * (lib/runtime/router.ts + lib/runtime/capability-product-service.ts) on
 * 2026-09-08, not just the docs:
 *
 *   GET /api/v1/agents/:did/certificates
 *   -> 200 { did, certificate_count, rank: AgentRank | null, certificates: [...] }
 *   -> 400 { error: { code: "INVALID_DID" | "UNSUPPORTED_DID", message, request_id } }
 *
 * `certificate_count` only counts ACTIVE certificates; `rank` is null below
 * 3 active certificates (no named rank unlocked yet). An agent with zero
 * certificates is not a 404 here — it's a 200 with an empty list, as long
 * as the DID itself parses as a valid did:key.
 *
 * Public, unauthenticated, read-only — same contract as technocore-client.
 * Never send key material; there is none to send.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_FLOP_PROOF_BASE_URL?.replace(/\/$/, "") ??
  "https://flop-status.vercel.app";

export type FlopProofCertificateStatus = "ACTIVE" | "REVOKED" | string;

export interface FlopProofCertificate {
  certificate_id: string;
  certificate_name: string;
  capability_id: string;
  capability_version: string;
  program_version: string;
  trial_id: string;
  trial_version: string;
  verifier_id: string;
  verifier_version: string;
  receipt_id: string;
  status: FlopProofCertificateStatus;
  issued_at: string;
}

export interface FlopProofRank {
  rank_id: string;
  rank_name: string;
  min_certificates: number;
}

export interface FlopProofSummary {
  did: string;
  certificate_count: number;
  rank: FlopProofRank | null;
  certificates: FlopProofCertificate[];
}

interface RawApiError {
  error?: { code?: string; message?: string; request_id?: string };
}

/**
 * Looks up a DID's Flop Proof certificates. Resolves to `null` for any
 * failure mode — invalid DID shape, agent has never touched Flop Proof,
 * the service is unreachable, or it returns something we don't recognize.
 * Callers that want to distinguish "no certificates" from "lookup failed"
 * shouldn't need to here: this is a bonus signal, and every caller in this
 * app treats "we don't have it" as the only failure state that matters —
 * see the `Promise.allSettled` usage in `/api/lookup`, which must never let
 * a Flop Proof outage take down the primary technocore-chat signal scan.
 */
export async function getFlopProofSummary(did: string): Promise<FlopProofSummary | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/agents/${encodeURIComponent(did)}/certificates`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      if (res.status !== 400 && res.status !== 404) {
        const body = (await res.json().catch(() => null)) as RawApiError | null;
        console.error(
          `[flop-proof] ${res.status} — ${body?.error?.code ?? "unknown"} — ${body?.error?.message ?? ""}`,
        );
      }
      return null;
    }

    const data = (await res.json()) as FlopProofSummary;
    if (typeof data.did !== "string" || !Array.isArray(data.certificates)) return null;
    return data;
  } catch (err) {
    console.error("[flop-proof]", err);
    return null;
  }
}

export { BASE_URL as FLOP_PROOF_BASE_URL };
