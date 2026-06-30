import type { LeaderboardRow } from '@/lib/types'
import { TEAM_CODES } from '@/lib/teamCodes'
import { RankBadge } from './RankBadge'
import { ColorAvatar } from './ColorAvatar'
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  rows: LeaderboardRow[]
  currentUserId: string
  championMap: Record<string, string>
}

export function LeaderboardTable({ rows, currentUserId, championMap }: Props) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId
        const name = row.display_name ?? 'User'
        const champion = row.user_id ? championMap[row.user_id] : null
        const flagCode = champion ? TEAM_CODES[champion] : null
        return (
          <Link
            key={row.user_id ?? i}
            href={`/players/${row.user_id}`}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-75 active:scale-[0.98] active:opacity-80 ${
              isMe
                ? 'border-[var(--green)]/40 bg-[var(--green)]/5'
                : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/40'
            }`}
          >
            <RankBadge rank={i + 1} />
            <ColorAvatar name={name} />
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${isMe ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                {name}
                {isMe && <span className="ml-2 text-xs text-[var(--green)] opacity-70">you</span>}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {champion && (
                  <span className="flex items-center gap-1 text-xs text-[var(--gold)]">
                    {flagCode && (
                      <Image
                        src={`https://flagcdn.com/w20/${flagCode}.png`}
                        alt={champion}
                        width={16}
                        height={11}
                        className="rounded-sm"
                      />
                    )}
                    {champion}
                  </span>
                )}
                <span className="text-xs text-[var(--muted)]">
                  {row.exact_hits ?? 0} exact · {row.partial_hits ?? 0} partial
                </span>
              </div>
            </div>
            <span className={`font-bold tabular text-lg ${isMe ? 'text-[var(--green)]' : 'text-[var(--gold)]'}`}>
              {row.total_points ?? 0}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
