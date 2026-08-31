export function SeedNotice() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-14">
      <div className="rounded-2xl border border-warning/25 bg-warning-soft p-6">
        <p className="kicker mb-2 text-warning">One Rule, and It&apos;s the Whole Rule</p>
        <p className="text-sm leading-relaxed text-foreground/90">
          This site <span className="font-medium">never</span> asks for, stores, or transmits a
          private key or seed. It only reads your public DID (
          <code className="font-mono text-xs">did:key:z6Mk…</code>) and shows information
          technocore-chat already makes public. If you ever need to prove &quot;this DID is
          mine&quot;, you sign on your own device/CLI and paste only the result — a key never
          touches this page.
        </p>
      </div>
    </section>
  );
}
