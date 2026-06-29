export function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? 'bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]/40'
      : rank === 2
      ? 'bg-[var(--muted)]/20 text-[var(--muted)] border-[var(--muted)]/40'
      : rank === 3
      ? 'bg-[#cd7f32]/20 text-[#cd7f32] border-[#cd7f32]/40'
      : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]'
  return (
    <div
      className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold tabular ${style}`}
    >
      {rank}
    </div>
  )
}
