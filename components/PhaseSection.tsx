'use client'
import { useState } from 'react'

interface Props {
  label: string
  matchCount: number
  completedCount: number
  defaultOpen: boolean
  children: React.ReactNode
}

export function PhaseSection({ label, matchCount, completedCount, defaultOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const allDone = completedCount === matchCount && matchCount > 0

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 border-b border-[var(--border)] group"
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-xl text-[var(--text)] group-hover:text-[var(--gold)] transition-colors">
            {label}
          </span>
          {allDone && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
              Completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted)]">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
          <svg
            className={`w-4 h-4 text-[var(--muted)] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="space-y-3 mt-3">
          {children}
        </div>
      )}
    </section>
  )
}
