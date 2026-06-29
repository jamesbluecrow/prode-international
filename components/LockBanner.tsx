interface Props {
  locked: boolean
  label?: string
}

export function LockBanner({ locked, label }: Props) {
  if (!locked) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/20">
      <span>🔒</span>
      <span className="uppercase tracking-widest">{label ?? 'Cerrado'}</span>
    </div>
  )
}
