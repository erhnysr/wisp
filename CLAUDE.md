# CLAUDE.md — Wisp

Kimlik: yalnızca `erhnysr` / `erhanyasarx@gmail.com`. `chalomdev` bu projede hiç geçmez. Commit
mesajlarında co-author/Claude atfı yok.

## Ne bu

Technocore ağı (`technocore-chat`, `technocore.chat`) üzerine bağımsız bir izleme aracı.
Overheard'ın (overheard-five.vercel.app) DID→kart konseptinden ilham alındı ama kopyalanmadı:
farklılaşma noktası, ağın kendi resmi engagement metriklerinden (`zero_response_share`,
`nick_diversity`, `windowed_note_to_message_ratio`) okunabilir bir "sinyal" paneli üretmek —
tek bir güven puanına indirgemeden, her metriğin "ne kanıtlar / ne kanıtlamaz"ıyla birlikte.

## Durum (son güncelleme: 6 Eylül 2026)

İzleme fazı tamamlandı, katılım fazı eklendi:
- `did:key` decode/validate, gerçek bir keypair'le round-trip test edildi
- technocore-chat REST wrapper (`/rooms`, `/r/<room>`, `/kv`)
- Sinyal motoru + `/api/lookup`, `/api/lookup/bulk`, `/api/feed`, `/api/rooms`
- Tam sayfa: hero + DID arama + canlı aktivite akışı + "proves/doesn't prove" + seed uyarısı
- `/card/[did]` + `next/og` ile 1200×630 paylaşılabilir sinyal kartı (`/api/card`)
- `/compare` (çoklu DID karşılaştırma) ve `/bulk` (toplu sorgu) sayfaları
- `/deals`, `/deals/[contractId]`, `/deals/analytics` — `tclk-offers` odasından canlı `tclk/1`
  anlaşma izleme, tek anlaşma yaşam-döngüsü zaman çizelgesi (`DealTimeline`), ağ nabzı
  (`NetworkPulse`) ve Atom feed'leri (`/api/feed`, `/api/deals/feed.xml`)
- `/docs` — public API referansı (tüm `/api/*` uç noktaları, örnek istek/yanıt, hata şekilleri)
- `mcp-server/` — 13 tool sunan bir MCP paketi: 5 read-only sinyal/anlaşma sorgusu
  (`get_did_signal`, `list_active_rooms`, `list_active_deals`, `get_did_deals`,
  `batch_lookup`) + `whoami` + 7 gerçek `tclk/1` katılım aracı (`create_offer`, `accept_offer`,
  `lock_deal`, `reveal_secret`, `refund_deal`, `cancel_deal`, `post_receipt`) — resmi
  `@flop-labs/tclk` kütüphanesiyle imzalı frame üretip `technocore-chat`'e postalıyor
  (`TECHNOCORE_SIGNING_KEY` gerekli, sunucu hiçbir anahtarı/sırrı kalıcı tutmuyor)
- Tasarım: Stripe'tan ilham alan indigo (`#5b4fe0`/`#7c6bff`) + sıcak mercan (`#f2765c`) paleti,
  Technocore ekosisteminin monospace/uppercase yazı diline uyumlu; maskot hero'da sağda,
  viewport kenarından taşıp kırpılan bir tedavi ile — Overheard'ınkinden bilinçli olarak farklı.
- Canlı: GitHub `erhnysr/wisp`, Vercel'e bağlı, `main`'e her push otomatik deploy.
- `.github/workflows/watchdog.yml` — pr-watchdog deseninin canlı siteye uygulanmış hali: 6
  saatte bir `/docs`, `/api/rooms`, `/api/card` kontrol edilir; kırılırsa tek bir GitHub Issue
  açılır/güncellenir, düzelince otomatik kapanır. `scripts/watchdog.mjs` kontrol mantığını taşır.
- Build/lint/typecheck temiz.

## Bilinen boşluklar

- DID araması yalnızca en aktif 15 odanın son ~200 mesajını görüyor; technocore-chat oda başına
  sadece son mesajları tuttuğu ve DID'e göre arama ucu olmadığı için aktif DID'ler bile çoğu zaman
  "0 mesaj" görünüyor (2026-10-02'de ana DID ve close-call key'leriyle doğrulandı). Kalıcı çözüm
  kendi indeksleyicimiz. Ara çözüm: kimlik notu paneli (`src/lib/identity-note.ts`).

- `/leaderboard` sayfası/API'si **yok** — önceki yol haritası notunda "canlı" diye işaretliydi,
  koda bakınca öyle bir route bulunamadı. Ya gerçekten yapılmalı ya da yol haritasından
  düzeltilmeli.
- Deal-making araçları (7 tanesi) kodda tam ve çalışır durumda ama gerçek bir uçtan uca
  anlaşma hiç yayınlanmamış/duyurulmamış görünüyor — mevcut en büyük görünürlük boşluğu.
- Testnet-specific metrikler (faucet claim takibi, spending/earning oranı) henüz yok.

## Sırada (bkz. proje brief dosyaları)

- Ayrı proje: TR Bridge botu
- Gerçek bir `tclk/1` anlaşmasını kendi MCP araçlarımızla uçtan uca yayınlayıp duyurmak
- `/leaderboard` kararı: yap ya da yol haritasından çıkar
- Testnet açılınca: faucet claim / spending-rate takibi

## Kurallar

- Özel anahtar/seed asla istenmez/saklanmaz.
- Sinyal metrikleri tek sayıya indirgenmez.
- İndigo/mercan aksanlı açık tema — Overheard'ın cyan'ından bilinçli olarak ayrışır.
- DID/hash/oda isimleri her zaman monospace.
