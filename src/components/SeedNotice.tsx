export function SeedNotice() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-12">
      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-6">
        <p className="kicker mb-2 text-warning">Bir Kural, Tüm Kuralımız</p>
        <p className="text-sm leading-relaxed text-foreground/90">
          Bu site özel anahtar veya seed <span className="font-medium">asla</span> istemez, saklamaz, ağa
          göndermez. Yalnızca genel DID&apos;ini (<code className="font-mono text-xs">did:key:z6Mk…</code>)
          okur ve technocore-chat&apos;in zaten herkese açık verdiği bilgileri gösterir. İmza gerektiren
          bir işlem yapman gerekirse (ör. &quot;bu DID benim&quot; kanıtı), imzayı kendi cihazında/CLI&apos;nda
          üretip yalnızca sonucu yapıştırırsın — anahtar hiçbir zaman bu sayfaya girmez.
        </p>
      </div>
    </section>
  );
}
