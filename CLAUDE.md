# CLAUDE.md — Technocore Watch

Kimlik: yalnızca `erhnysr` / `erhanyasarx@gmail.com`. `chalomdev` bu projede hiç geçmez. Commit
mesajlarında co-author/Claude atfı yok.

## Ne bu

Technocore ağı (`technocore-chat`, `technocore.chat`) üzerine bağımsız bir izleme aracı.
Overheard'ın (overheard-five.vercel.app) DID→kart konseptinden ilham alındı ama kopyalanmadı:
farklılaşma noktası, ağın kendi resmi engagement metriklerinden (`zero_response_share`,
`nick_diversity`, `windowed_note_to_message_ratio`) okunabilir bir "sinyal" paneli üretmek —
tek bir güven puanına indirgemeden, her metriğin "ne kanıtlar / ne kanıtlamaz"ıyla birlikte.

## Durum (son güncelleme: bu commit)

Faz 0–5 tamamlandı:
- `did:key` decode/validate, gerçek bir keypair'le round-trip test edildi
- technocore-chat REST wrapper (`/rooms`, `/r/<room>`, `/kv`)
- Sinyal motoru + `/api/lookup`, `/api/feed`, `/api/rooms`
- Tam sayfa: hero + DID arama + canlı aktivite akışı + "proves/doesn't prove" + seed uyarısı
- `/card/[did]` + `next/og` ile 1200×630 paylaşılabilir sinyal kartı (`/api/card`)
- `/docs` — public API referansı (tüm `/api/*` uç noktaları, örnek istek/yanıt, hata şekilleri)
- `mcp-server/` — `get_did_signal` ve `list_active_rooms` tool'larını sunan ayrı bir MCP paketi
- Tasarım: Stripe'tan ilham alan indigo (`#5b4fe0`/`#7c6bff`) + sıcak mercan (`#f2765c`) paleti,
  Technocore ekosisteminin monospace/uppercase yazı diline uyumlu; maskot hero'da sağda,
  viewport kenarından taşıp kırpılan bir tedavi ile — Overheard'ınkinden bilinçli olarak farklı.
- Canlı: GitHub `erhnysr/technocore-watch`, Vercel'e bağlı, `main`'e her push otomatik deploy.
- `.github/workflows/watchdog.yml` — pr-watchdog deseninin canlı siteye uygulanmış hali: 6
  saatte bir `/docs`, `/api/rooms`, `/api/card` kontrol edilir; kırılırsa tek bir GitHub Issue
  açılır/güncellenir, düzelince otomatik kapanır. `scripts/watchdog.mjs` kontrol mantığını taşır.
- Build/lint/typecheck temiz.

## Sırada (bkz. proje brief dosyaları)

- Ayrı proje: TR Bridge botu

## Kurallar

- Özel anahtar/seed asla istenmez/saklanmaz.
- Sinyal metrikleri tek sayıya indirgenmez.
- İndigo/mercan aksanlı açık tema — Overheard'ın cyan'ından bilinçli olarak ayrışır.
- DID/hash/oda isimleri her zaman monospace.
