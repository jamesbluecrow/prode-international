'use client'

interface Props {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

export function ScoreInput({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        className="w-9 h-9 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors font-bold text-lg"
      >
        −
      </button>
      <span className="w-12 text-center tabular font-bold text-2xl text-[var(--text)]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="w-9 h-9 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors font-bold text-lg"
      >
        +
      </button>
    </div>
  )
}
