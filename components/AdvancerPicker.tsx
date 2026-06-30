'use client'
import type { Side } from '@/lib/types'

interface Props {
  homeTeam: string
  awayTeam: string
  homeCode: string | null
  awayCode: string | null
  value: Side | null
  onChange: (v: Side) => void
  disabled?: boolean
}

export function AdvancerPicker({ homeTeam, awayTeam, homeCode, awayCode, value, onChange, disabled }: Props) {
  return (
    <div className="mt-3">
      <p className="text-xs text-[var(--muted)] text-center mb-2 uppercase tracking-widest">
        Who advances?
      </p>
      <div className="flex gap-2">
        {(['home', 'away'] as Side[]).map(side => {
          const team = side === 'home' ? homeTeam : awayTeam
          const code = side === 'home' ? homeCode : awayCode
          const selected = value === side
          return (
            <button
              key={side}
              type="button"
              onClick={() => !disabled && onChange(side)}
              disabled={disabled}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all duration-75 active:scale-[0.97] active:opacity-80 ${
                selected
                  ? 'border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
              } disabled:opacity-40`}
            >
              {code && (
                <img
                  src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                  alt={team}
                  className="w-5 h-4 object-cover rounded-sm"
                />
              )}
              <span className="text-sm font-medium truncate">{team}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
