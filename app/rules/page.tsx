export default function RulesPage() {
  return (
    <div className="py-6 space-y-8 max-w-lg">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">SCORING</span>{' '}
        <span className="text-[var(--gold)]">RULES</span>
      </h1>

      {/* Group Stage */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-[var(--text)] pb-2 border-b border-[var(--border)]">
          Group Stage
        </h2>
        <div className="space-y-2">
          {[
            { pts: 10, label: 'Exact scoreline', color: 'text-[var(--gold)]', example: 'You: 2–1 · Result: 2–1' },
            { pts: 7,  label: 'Correct winner + correct goal difference', color: 'text-[var(--green)]', example: 'You: 3–2 · Result: 2–1 (both win by 1)' },
            { pts: 5,  label: 'Correct winner or correctly called a draw', color: 'text-[var(--blue)]', example: 'You: 2–0 · Result: 1–0 · or · You: 0–0 · Result: 1–1' },
            { pts: 0,  label: 'Wrong result', color: 'text-[var(--muted)]', example: 'You: 2–1 · Result: 1–2' },
          ].map(({ pts, label, color, example }) => (
            <div key={pts} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-start gap-4">
              <span className={`font-display text-2xl tabular-nums flex-shrink-0 w-8 text-right ${color}`}>
                {pts}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{label}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{example}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] px-1">
          A non-exact draw (e.g. you predict 0–0, result is 1–1) scores <strong className="text-[var(--blue)]">5</strong> — there is no margin to nail on a draw.
        </p>
      </section>

      {/* Knockout Stage */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-[var(--text)] pb-2 border-b border-[var(--border)]">
          Knockout Stage
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Same <span className="text-[var(--gold)]">10</span>/<span className="text-[var(--green)]">7</span>/<span className="text-[var(--blue)]">5</span>/0 scale on the regular-time scoreline, plus two extras:
        </p>
        <div className="space-y-2">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-start gap-4">
            <span className="font-display text-2xl tabular-nums flex-shrink-0 w-8 text-right text-[var(--green)]">+3</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text)]">Floor of 3 for correct advancer</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                If you pick the right team to advance, your points are at least 3 — even if the scoreline gave 0.
              </p>
            </div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-start gap-4">
            <span className="font-display text-2xl tabular-nums flex-shrink-0 w-8 text-right text-[var(--green)]">+3</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text)]">Penalty shootout bonus</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                If you predicted a draw <em>and</em> the team you picked to advance won the shootout, you earn +3 extra.
              </p>
            </div>
          </div>
        </div>

        {/* Worked examples */}
        <div className="bg-[var(--surface-2)] rounded-xl p-4 space-y-2">
          <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-3">Examples — Regular time 1–1, Home wins on penalties</p>
          {[
            { pred: '1–1, adv Home', pts: 13, note: 'Exact (10) + pen bonus (3)' },
            { pred: '0–0, adv Home', pts: 8,  note: 'Draw (5) → floor 5 + pen bonus (3)' },
            { pred: '0–0, adv Away', pts: 5,  note: 'Draw (5) → floor 5, no pen bonus' },
            { pred: '2–1, adv Home', pts: 3,  note: 'Wrong score (0) → floor 3, no bonus' },
            { pred: '2–1, adv Away', pts: 0,  note: 'Wrong score (0), wrong advancer' },
          ].map(({ pred, pts, note }) => (
            <div key={pred} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-[var(--muted)]">{pred}</span>
              <span className="text-xs text-[var(--muted)] flex-1 text-right">{note}</span>
              <span className={`font-bold tabular-nums w-8 text-right flex-shrink-0 ${pts >= 10 ? 'text-[var(--gold)]' : pts >= 7 ? 'text-[var(--green)]' : pts >= 5 ? 'text-[var(--blue)]' : pts >= 3 ? 'text-[var(--green)]' : 'text-[var(--muted)]'}`}>
                {pts}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Champion bonus */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-[var(--text)] pb-2 border-b border-[var(--border)]">
          Champion Pick
        </h2>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-start gap-4">
          <span className="font-display text-2xl tabular-nums flex-shrink-0 w-8 text-right text-[var(--gold)]">30</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)]">Correct World Cup champion</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Pick the team that lifts the trophy. Locked once saved — cannot be changed.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
