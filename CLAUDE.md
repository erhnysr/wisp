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

Faz 0 + Faz 1 + Faz 2 (MVP) tamamlandı:
- `did:key` decode/validate, gerçek bir keypair'le round-trip test edildi
- technocore-chat REST wrapper (`/rooms`, `/r/<room>`, `/kv`)
- Sinyal motoru + `/api/lookup`, `/api/feed`
- Tam sayfa: hero + DID arama + canlı aktivite akışı + "proves/doesn't prove" + seed uyarısı
- Build/lint/typecheck temiz. **Not:** bu proje bir ağ-erişimi kısıtlı ortamda geliştirildi,
  technocore-chat'e canlı bağlantı hiç doğrulanamadı — ilk `npm run dev` çalıştırmasında
  gerçek API response şekillerini (`/rooms?format=json`, `/r/<room>?format=json`) doğrula,
  `technocore-client.ts`'teki alan isimleri (`RoomSummary`, `RoomMessage`) uyuşmazsa güncelle.

## Sırada (bkz. proje brief dosyaları)

- Faz 3: `/card/[did]` + `@vercel/og` kart üretimi
- Faz 4: public API dokümantasyonu + MCP server wrapper
- Faz 5: GitHub Actions otomasyonu (pr-watchdog deseni)
- Ayrı proje: TR Bridge botu

## Kurallar

- Özel anahtar/seed asla istenmez/saklanmaz.
- Sinyal metrikleri tek sayıya indirgenmez.
- Tek koyu tema, amber (`#e8a23d`) ana vurgu — Overheard'ın cyan'ından bilinçli olarak ayrışır.
- DID/hash/oda isimleri her zaman monospace.
