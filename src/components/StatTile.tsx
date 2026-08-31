export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-shadow rounded-xl border border-border bg-surface px-5 py-4">
      <div className="text-gradient font-mono text-2xl font-semibold">{value}</div>
      <div className="kicker mt-1">{label}</div>
    </div>
  );
}
