import type { LeaderboardRow } from '@/lib/types'
import { RankBadge } from './RankBadge'
import { ColorAvatar } from './ColorAvatar'

interface Props {
  rows: LeaderboardRow[]
  currentUserId: string
}

export function LeaderboardTable({ rows, currentUserId }: Props) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId
        const name = row.display_name ?? 'Usuario'
        return (
          <div
            key={row.user_id ?? i}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
              isMe
                ? 'border-[var(--green)]/40 bg-[var(--green)]/5'
                : 'border-[var(--border)] bg-[var(--surface)]'
            }`}
          >
            <RankBadge rank={i + 1} />
            <ColorAvatar name={name} />
            <div className="flex-1 min-w-0">
              <p
                className={`font-medium truncate ${isMe ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}
              >
                {name}
                {isMe && (
                  <span className="ml-2 text-xs text-[var(--green)] opacity-70">tú</span>
                )}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {row.exact_hits ?? 0} exactos
              </p>
            </div>
            <span
              className={`font-bold tabular text-lg ${
                isMe ? 'text-[var(--green)]' : 'text-[var(--gold)]'
              }`}
            >
              {row.total_points ?? 0}
            </span>
          </div>
        )
      })}
    </div>
  )
}
