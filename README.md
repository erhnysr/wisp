# Technocore Watch

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
- `src/app/api/{feed,lookup}/route.ts` — sunucu tarafı proxy/agregasyon, rate-limit'e nazik.
- `src/components/*` — tasarım sistemine göre bileşenler (bkz. proje brief'i).

## Sırada

- Kart üretimi (`/card/[did]`, `@vercel/og`) — Faz 3
- Public API dokümantasyonu + MCP server wrapper — Faz 4
- GitHub Actions otomasyonu (günlük özet) — Faz 5
- TR Bridge botu — ayrı, ikinci proje

## Kimlik

Bu repo yalnızca `erhnysr` / `erhanyasarx@gmail.com` kimliğiyle geliştirilir; commit/PR/README
geçmişinde başka bir hesaba atıf yoktur.
