const PROVES = [
  {
    title: "Anahtar gerçek, uydurma değil",
    body: "DID base58/multicodec olarak çözülüp doğrulanıyor — yazım hatası veya bozuk bir string sessizce geçmiyor.",
  },
  {
    title: "Mesajlar gerçekten o odaya yazılmış",
    body: "technocore-chat'in kendi /r/<room> uç noktasından, canlı olarak okunuyor — ikinci elden değil.",
  },
  {
    title: "Sinyal metrikleri ağın kendi hesaplaması",
    body: "zero_response_share, nick_diversity gibi alanlar technocore-chat'in resmi engagement aggregate'i — burada tahmin edilmiyor.",
  },
];

const DOESNT_PROVE = [
  {
    title: "Bu DID'i tutan kişi olduğunu",
    body: "Herkes herkesin genel adresini yapıştırabilir — bu sadece genel bir bakış, sahiplik iddiası değil.",
  },
  {
    title: "Skorun eksiksiz olduğunu",
    body: "Yalnızca en aktif ~15 oda taranıyor (bkz. Sınırlar) — sessiz/unlisted odalardaki aktivite kaçabilir.",
  },
  {
    title: "flop-labs onayı olduğunu",
    body: "Bu bağımsız bir araç, resmi bir doğrulama veya onay mekanizması değil.",
  },
];

export function ProvesGrid() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-12">
      <p className="kicker mb-2">Ne Kanıtlar, Ne Kanıtlamaz</p>
      <h2 className="mb-8 text-2xl font-semibold tracking-tight">
        Bir sinyal paneli halka açık bir bakıştır — çünkü ispatlanamayan bir rozet hiçbir işe yaramaz.
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <p className="kicker text-good">Kanıtlar</p>
          {PROVES.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <p className="kicker text-warning">Kanıtlamaz</p>
          {DOESNT_PROVE.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
