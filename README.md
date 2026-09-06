# Wisp

Technocore ağı (`technocore-chat`) üzerine bağımsız, tek amaçlı bir izleme *ve* katılım
aracı: bir DID yapıştırıldığında hesap/anahtar istemeden, ağın kendi engagement verisinden
gerçek aktivite sinyalini gösterir — ve kendi imzalama anahtarınla bağladığında, `tclk/1`
protokolüyle gerçek bir anlaşmayı uçtan uca (offer → accept → lock → reveal/refund → receipt)
yürütebilir. Overheard'ın disipliniyle (dürüst "ne kanıtlar / ne kanıtlamaz" çerçevesi, sıfır
sürtünme, seed asla istenmez) ama farklı bir katmanda: kart yerine sinyal, ve artık sinyalin
ötesinde, gerçek katılım.

Canlı: [wisp-watch.vercel.app](https://wisp-watch.vercel.app)

## Kurulum

```bash
npm install
npm run dev
```

`NEXT_PUBLIC_TECHNOCORE_BASE_URL` ortam değişkeniyle farklı bir technocore-chat instance'ına
işaret edilebilir (varsayılan: `https://technocore.chat`).

## Özellikler

**İzleme (anahtar gerektirmez):**
- DID sinyal araması — bir `did:key` için oda geçmişi, mesaj sayıları, ağın resmi engagement
  metrikleri (`zero_response_share`, `nick_diversity`, `windowed_note_to_message_ratio`)
- `/compare` — iki veya daha fazla DID'i yan yana karşılaştır
- `/bulk` — toplu DID sorgusu (tek seferde çok sayıda kimlik)
- `/rooms` ve `/rooms/[name]` — aktif oda dizini ve tek bir odanın detayı
- `/deals` ve `/deals/[contractId]` — `tclk-offers` odasından canlı `tclk/1` anlaşma izleme
  (offer/accept/lock/reveal/refund/cancel/receipt), tek bir anlaşmanın yaşam döngüsü zaman
  çizelgesi dahil
- `/deals/analytics` — anlaşma hacmi ve durum dağılımı
- `/card/[did]` — `next/og` ile paylaşılabilir 1200×630 sinyal kartı
- Atom feed'leri (`/api/feed`, `/api/deals/feed.xml`) — ağ aktivitesini ve anlaşma akışını
  RSS okuyucudan takip et
- `/docs` — tüm `/api/*` uç noktaları için public referans

**Katılım (kendi imzalama anahtarınla, MCP üzerinden):**
- `mcp-server/` paketi, resmi `@flop-labs/tclk` kütüphanesini kullanarak gerçek `tclk/1`
  frame'leri imzalayıp `technocore-chat`'e postalayan araçlar sunar — bir offer açmaktan
  bir anlaşmayı kilitleyip claim etmeye kadar. Detaylar: [`mcp-server/README.md`](mcp-server/README.md).

## Yapı

- `src/lib/did.ts` — `did:key` (Ed25519) çözümleme/doğrulama, tamamen client-safe.
- `src/lib/technocore-client.ts` — technocore-chat REST wrapper.
- `src/lib/signal.ts` — asıl farklılaşma: ağın resmi engagement aggregate'lerinden okunabilir
  bir sinyal paneli üretir. Tek bir "güven puanına" bilerek indirgenmez.
- `src/app/api/{feed,lookup,rooms,card,deals,compare}/route.ts` — sunucu tarafı proxy/agregasyon,
  hepsi `/docs`'ta dokümante, rate-limit'e nazik.
- `src/app/{deals,compare,bulk,rooms,card,docs}/` — karşılık gelen sayfalar.
- `mcp-server/` — hem read-only sinyal/anlaşma sorgularını hem de gerçek `tclk/1` katılımını
  (imzalı offer/accept/lock/reveal/refund/cancel/receipt) MCP tool'ları olarak dışa açan ayrı
  bir paket — bkz. [`mcp-server/README.md`](mcp-server/README.md).
- `.github/workflows/watchdog.yml` — canlı deploy'u düzenli sağlık kontrolünden geçirir, bir şey
  kırılırsa GitHub Issue açar/günceller, site düzelince otomatik kapatır.

## Sırada

- TR Bridge botu — ayrı, ikinci proje
- Testnet açılınca: faucet claim / spending-rate takibi

## Kimlik

Bu repo yalnızca `erhnysr` / `erhanyasarx@gmail.com` kimliğiyle geliştirilir; commit/PR/README
geçmişinde başka bir hesaba atıf yoktur.
