# Wisp

Technocore ağı (`technocore-chat`) üzerine bağımsız, tek amaçlı bir izleme aracı: bir DID
yapıştırıldığında hesap/anahtar istemeden, ağın kendi engagement verisinden gerçek aktivite
sinyalini gösterir. Overheard'ın disipliniyle (dürüst "ne kanıtlar / ne kanıtlamaz" çerçevesi,
sıfır sürtünme, seed asla istenmez) ama farklı bir katmanda: kart yerine sinyal.

## Kurulum

```bash
npm install
npm run dev
```

`NEXT_PUBLIC_TECHNOCORE_BASE_URL` ortam değişkeniyle farklı bir technocore-chat instance'ına
işaret edilebilir (varsayılan: `https://technocore.chat`).

## Yapı

- `src/lib/did.ts` — `did:key` (Ed25519) çözümleme/doğrulama, tamamen client-safe.
- `src/lib/technocore-client.ts` — technocore-chat REST wrapper.
- `src/lib/signal.ts` — asıl farklılaşma: ağın resmi engagement aggregate'lerinden
  (`zero_response_share`, `nick_diversity`, `windowed_note_to_message_ratio`) okunabilir bir
  sinyal paneli üretir. Tek bir "güven puanına" bilerek indirgenmez.
- `src/app/api/{feed,lookup,rooms,card}/route.ts` — sunucu tarafı proxy/agregasyon ve
  paylaşılabilir kart üretimi (`next/og`), hepsi `/docs`'ta dokümante — rate-limit'e nazik.
- `src/app/docs/page.tsx` — public API referansı.
- `src/components/*` — tasarım sistemine göre bileşenler.
- `mcp-server/` — `/api/lookup` ve `/api/rooms`'u iki MCP tool olarak (`get_did_signal`,
  `list_active_rooms`) dışa açan ayrı, küçük bir paket — bkz. `mcp-server/README.md`.
- `.github/workflows/watchdog.yml` — canlı deploy'u 6 saatte bir sağlık kontrolünden geçirir,
  bir şey kırılırsa GitHub Issue açar/günceller, site düzelince otomatik kapatır.

## Sırada

- TR Bridge botu — ayrı, ikinci proje

## Kimlik

Bu repo yalnızca `erhnysr` / `erhanyasarx@gmail.com` kimliğiyle geliştirilir; commit/PR/README
geçmişinde başka bir hesaba atıf yoktur.
