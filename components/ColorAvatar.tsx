const COLORS = ['#f5c542', '#34d399', '#4c8dff', '#f87171', '#a78bfa', '#fb923c', '#38bdf8']

export function ColorAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = COLORS[name.charCodeAt(0) % COLORS.length]
  const initial = name.charAt(0).toUpperCase()
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color + '33', border: `2px solid ${color}` }}
      className="rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
    >
      <span style={{ color }}>{initial}</span>
    </div>
  )
}
