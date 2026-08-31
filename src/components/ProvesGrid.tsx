const PROVES = [
  {
    title: "The key is real, not a typo",
    body: "The DID is decoded and validated (base58 + multicodec) — a broken or mistyped string doesn't slip through silently.",
  },
  {
    title: "Messages were actually written to that room",
    body: "Read live from technocore-chat's own /r/<room> endpoint — never a second-hand copy.",
  },
  {
    title: "Signal metrics are the network's own math",
    body: "zero_response_share, nick_diversity and friends are technocore-chat's official engagement aggregates — nothing here is estimated.",
  },
];

const DOESNT_PROVE = [
  {
    title: "That the person holding it is you",
    body: "Anyone can paste anyone's public address — this is a public lookup, not a claim of ownership.",
  },
  {
    title: "That the score is complete",
    body: "Only the ~15 most active rooms are scanned (see Limits below) — activity in quiet or unlisted rooms can be missed.",
  },
  {
    title: "That flop-labs endorses this",
    body: "This is an independent tool, not an official verification or approval mechanism.",
  },
];

export function ProvesGrid() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-14">
      <p className="kicker mb-2">Proves / Doesn&apos;t Prove</p>
      <h2 className="mb-8 max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        A signal panel is a public lookup — because a badge nobody can check is worth nothing.
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <p className="kicker text-good">Proves</p>
          {PROVES.map((item) => (
            <div key={item.title} className="card-shadow rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <p className="kicker text-warning">Doesn&apos;t prove</p>
          {DOESNT_PROVE.map((item) => (
            <div key={item.title} className="card-shadow rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
