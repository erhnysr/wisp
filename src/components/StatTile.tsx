export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <div className="font-mono text-2xl font-semibold text-accent">{value}</div>
      <div className="kicker mt-1">{label}</div>
    </div>
  );
}
