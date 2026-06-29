interface Props {
  label: string
  value: string | number
  sub?: string
}

export function StatTile({ label, value, sub }: Props) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-[var(--muted)] uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold tabular text-[var(--text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}
