/**
 * "Signal" scoring — the differentiator versus a plain identity-card tool.
 *
 * Deliberately NOT a single 0-100 "trust score". technocore-chat already
 * exposes honest, windowed engagement aggregates (see /llms.txt); we reuse
 * those rather than re-deriving noisy heuristics, and we surface each
 * metric next to a plain-language "what this does / doesn't tell you"
 * note — the same discipline Overheard applies to its own card.
 */

import type { EngagementAggregate, RoomMessage } from "./technocore-client";

export interface SignalMetric {
  key: "zero_response_share" | "nick_diversity" | "note_to_message_ratio";
  label: string;
  /** 0..1, or null when the room's window was empty. */
  value: number | null;
  proves: string;
  doesntProve: string;
}

export interface RoomActivity {
  room: string;
  messageCount: number;
  didMessageCount: number;
}

export interface SignalSummary {
  did: string;
  roomsSeenIn: RoomActivity[];
  totalMessages: number;
  signedMessages: number;
  metrics: SignalMetric[];
}

/** Turns a room's raw engagement aggregate into display-ready metrics. */
export function toSignalMetrics(engagement?: EngagementAggregate): SignalMetric[] {
  return [
    {
      key: "zero_response_share",
      label: "Yanıtsız kalan mesaj oranı",
      value: engagement?.zero_response_share ?? null,
      proves:
        "Bu odada mesajların ne kadarına farklı bir nick'ten yanıt gelmiş — düşükse gerçek bir sohbet var demektir.",
      doesntProve:
        "Bu DID'in kendisinin yanıt aldığını değil, bulunduğu odanın genel canlılığını gösterir.",
    },
    {
      key: "nick_diversity",
      label: "İsim çeşitliliği",
      value: engagement?.nick_diversity ?? null,
      proves:
        "Odada kaç farklı katılımcı olduğunu — tek bir botun kendi kendine konuşmadığını gösterir.",
      doesntProve:
        "Farklı nick'lerin farklı gerçek kişiler/ajanlar olduğunu kanıtlamaz; aynı sahip birden çok DID çalıştırabilir.",
    },
    {
      key: "note_to_message_ratio",
      label: "Not / mesaj oranı",
      value: engagement?.windowed_note_to_message_ratio ?? null,
      proves:
        "Katılımcıların sadece sohbet etmediğini, kalıcı not/durum da yazdığını — technocore-chat'in kendi tanımıyla \"ajanlar burada gerçekten yaşıyor\" sinyalini gösterir.",
      doesntProve:
        "Notların içeriğinin doğru veya özgün olduğunu göstermez, yalnızca yazma sıklığını gösterir.",
    },
  ];
}

/**
 * Given the raw messages fetched from a handful of rooms, summarizes a
 * single DID's footprint. Callers should pass already-fetched room data
 * (see /api/lookup) — this function does no network I/O itself so it stays
 * trivially unit-testable.
 */
export function summarizeDidActivity(
  did: string,
  roomsWithMessages: Array<{ room: string; messages: RoomMessage[]; engagement: EngagementAggregate }>,
): SignalSummary {
  const roomsSeenIn: RoomActivity[] = [];
  let totalMessages = 0;
  let signedMessages = 0;
  let combinedEngagement: EngagementAggregate | undefined;

  for (const { room, messages, engagement } of roomsWithMessages) {
    const didMessages = messages.filter((m) => m.did === did);
    if (didMessages.length === 0) continue;

    roomsSeenIn.push({
      room,
      messageCount: messages.length,
      didMessageCount: didMessages.length,
    });
    totalMessages += messages.length;
    signedMessages += didMessages.filter((m) => Boolean(m.did)).length;

    // Use the engagement aggregate from whichever room the DID is most
    // active in — it's the most representative single sample.
    if (!combinedEngagement || didMessages.length > 0) {
      combinedEngagement = engagement ?? combinedEngagement;
    }
  }

  return {
    did,
    roomsSeenIn,
    totalMessages,
    signedMessages,
    metrics: toSignalMetrics(combinedEngagement),
  };
}
