'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Match, PhaseDeadline, TournamentBonus, Profile } from '@/lib/types'

type NewsItem = { id: string; image_url: string; caption: string | null; sort_order: number; created_at: string }

function PredRow({
  match, initial, saving, onSave,
}: {
  match: Match
  initial: { pred_home: number; pred_away: number; pred_advancer: string | null } | null
  saving: boolean
  onSave: (h: number, a: number, adv: string | null) => void
}) {
  const [home, setHome] = useState<string>(initial?.pred_home?.toString() ?? '')
  const [away, setAway] = useState<string>(initial?.pred_away?.toString() ?? '')
  const [adv, setAdv] = useState<string>(initial?.pred_advancer ?? '')

  function tryCommit(newHome = home, newAway = away, newAdv = adv) {
    const h = parseInt(newHome)
    const a = parseInt(newAway)
    if (isNaN(h) || isNaN(a)) return
    onSave(h, a, newAdv || null)
  }

  const isDraw = home !== '' && away !== '' && home === away
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 flex-wrap">
      <span className="text-sm text-[var(--text)] flex-1 min-w-0 truncate">
        {match.home_team} vs {match.away_team}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number" min={0} max={20} value={home} placeholder="H"
          onChange={e => setHome(e.target.value)}
          onBlur={() => tryCommit()}
          className="w-14 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-center text-sm tabular text-[var(--text)]"
        />
        <span className="text-[var(--muted)] text-xs">–</span>
        <input
          type="number" min={0} max={20} value={away} placeholder="A"
          onChange={e => setAway(e.target.value)}
          onBlur={() => tryCommit()}
          className="w-14 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-center text-sm tabular text-[var(--text)]"
        />
      </div>
      {match.is_knockout && isDraw && (
        <select
          value={adv}
          onChange={e => { setAdv(e.target.value); tryCommit(home, away, e.target.value) }}
          className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)]"
        >
          <option value="">Advancer?</option>
          <option value="home">{match.home_team}</option>
          <option value="away">{match.away_team}</option>
        </select>
      )}
      {saving
        ? <span className="text-xs text-[var(--muted)]">…</span>
        : initial && <span className="text-xs text-[var(--green)]">{initial.pred_home}–{initial.pred_away}{initial.pred_advancer ? ` (${initial.pred_advancer})` : ''}</span>
      }
    </div>
  )
}

interface Props {
  matches: Match[]
  deadlines: PhaseDeadline[]
  champion: TournamentBonus | null
  profiles: Profile[]
  newsItems: NewsItem[]
  currentUserId: string
}

type Tab = 'results' | 'locks' | 'deadlines' | 'champion' | 'news' | 'admins' | 'predictions'

const TABS: { key: Tab; label: string }[] = [
  { key: 'results', label: 'Results' },
  { key: 'locks', label: 'Locks' },
  { key: 'deadlines', label: 'Deadlines' },
  { key: 'champion', label: 'Champion' },
  { key: 'news', label: 'News' },
  { key: 'admins', label: 'Admins' },
  { key: 'predictions', label: 'Predictions' },
]

type PredMap = Record<string, { pred_home: number; pred_away: number; pred_advancer: string | null }>

const STAGE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']
const STAGE_LABELS: Record<string, string> = {
  group: 'Group Stage', round_of_32: 'Round of 32', round_of_16: 'Round of 16',
  quarter: 'Quarterfinals', semi: 'Semifinals', third_place: 'Third Place', final: 'Final',
}

export function AdminClient({
  matches: initMatches,
  deadlines: initDeadlines,
  champion: initChampion,
  profiles: initProfiles,
  newsItems: initNews,
  currentUserId,
}: Props) {
  const [matches, setMatches] = useState(initMatches)
  const [deadlines, setDeadlines] = useState(initDeadlines)
  const [champion, setChampion] = useState(initChampion)
  const [profiles, setProfiles] = useState(initProfiles)
  const [newsItems, setNewsItems] = useState<NewsItem[]>(initNews)
  const [tab, setTab] = useState<Tab>('results')
  const [saving, setSaving] = useState<string | null>(null)
  const [predUserId, setPredUserId] = useState('')
  const [predMap, setPredMap] = useState<PredMap>({})
  const [predLoading, setPredLoading] = useState(false)
  const [predSaving, setPredSaving] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ updated: number; skipped: number; errors: string[] } | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function uploadNews(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { data: uploaded, error: upErr } = await supabase.storage.from('news').upload(path, file, { contentType: file.type })
    if (upErr || !uploaded) { setUploadError(upErr?.message ?? 'Upload failed'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('news').getPublicUrl(uploaded.path)
    const { data: inserted, error: insErr } = await supabase
      .from('news_items')
      .insert({ image_url: publicUrl, caption: caption.trim() || null, sort_order: newsItems.length })
      .select()
      .single()
    if (insErr || !inserted) { setUploadError(insErr?.message ?? 'Insert failed'); setUploading(false); return }
    setNewsItems(n => [inserted as NewsItem, ...n])
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
  }

  async function deleteNews(item: NewsItem) {
    setSaving(item.id)
    const storagePath = item.image_url.split('/news/')[1]
    if (storagePath) await supabase.storage.from('news').remove([storagePath])
    await supabase.from('news_items').delete().eq('id', item.id)
    setNewsItems(n => n.filter(x => x.id !== item.id))
    setSaving(null)
  }

  async function updateMatch(id: string, updates: Partial<Match>) {
    setSaving(id)
    await supabase.from('matches').update(updates).eq('id', id)
    setMatches(ms => ms.map(m => m.id === id ? { ...m, ...updates } : m))
    setSaving(null)
  }

  async function updateDeadline(stage: string, lock_at: string) {
    setSaving(stage)
    await supabase.from('phase_deadlines').update({ lock_at }).eq('stage', stage)
    setDeadlines(ds => ds.map(d => d.stage === stage ? { ...d, lock_at } : d))
    setSaving(null)
  }

  async function updateChampion(updates: Partial<TournamentBonus>) {
    if (!champion) return
    setSaving('champion')
    await supabase.from('tournament_bonuses').update(updates).eq('id', champion.id)
    setChampion(c => c ? { ...c, ...updates } : c)
    setSaving(null)
  }

  async function refreshResults() {
    setRefreshing(true)
    setRefreshResult(null)
    const res = await fetch('/api/admin/refresh-results', { method: 'POST' })
    const data = await res.json()
    setRefreshResult(data)
    if (data.updated > 0) {
      // Reload matches from DB so the results tab reflects the updates
      const { data: fresh } = await supabase.from('matches').select('*').order('kickoff_at')
      if (fresh) setMatches(fresh as Match[])
    }
    setRefreshing(false)
  }

  async function loadPredictions(userId: string) {
    if (!userId) { setPredMap({}); return }
    setPredLoading(true)
    const res = await fetch(`/api/admin/predictions?userId=${userId}`)
    const data = await res.json()
    const map: PredMap = {}
    for (const p of data.predictions ?? []) {
      map[p.match_id] = { pred_home: p.pred_home, pred_away: p.pred_away, pred_advancer: p.pred_advancer }
    }
    setPredMap(map)
    setPredLoading(false)
  }

  async function savePrediction(matchId: string, predHome: number, predAway: number, predAdvancer: string | null) {
    setPredSaving(matchId)
    await fetch('/api/admin/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: predUserId, matchId, predHome, predAway, predAdvancer }),
    })
    setPredMap(m => ({ ...m, [matchId]: { pred_home: predHome, pred_away: predAway, pred_advancer: predAdvancer } }))
    setPredSaving(null)
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    setSaving(userId)
    await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId)
    setProfiles(ps => ps.map(p => p.id === userId ? { ...p, is_admin: isAdmin } : p))
    setSaving(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--gold)] text-[var(--bg)]'
                : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'results' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={refreshResults}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--green)]/20 text-[var(--green)] border border-[var(--green)]/30 hover:bg-[var(--green)]/30 disabled:opacity-50 transition-colors"
            >
              {refreshing ? 'Fetching results…' : 'Refresh Results from Web'}
            </button>
            {refreshResult && (
              <span className="text-xs text-[var(--muted)]">
                {refreshResult.updated} updated · {refreshResult.skipped} skipped
                {refreshResult.errors.length > 0 && ` · ${refreshResult.errors.length} errors`}
              </span>
            )}
          </div>
          {refreshResult?.errors.length ? (
            <div className="bg-[var(--surface)] border border-[var(--red)]/30 rounded-xl p-3 space-y-1">
              {refreshResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-[var(--red)]">{e}</p>
              ))}
            </div>
          ) : null}
          {matches.map(m => (
            <div key={m.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <p className="font-medium text-sm mb-3 text-[var(--text)]">
                {m.home_team} vs {m.away_team}
                <span className="ml-2 text-xs text-[var(--muted)]">({m.stage})</span>
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={m.home_score ?? ''}
                    placeholder="Home"
                    className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-center text-sm tabular text-[var(--text)]"
                    onBlur={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) updateMatch(m.id, { home_score: v })
                    }}
                  />
                  <span className="text-[var(--muted)]">–</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={m.away_score ?? ''}
                    placeholder="Away"
                    className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-center text-sm tabular text-[var(--text)]"
                    onBlur={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) updateMatch(m.id, { away_score: v })
                    }}
                  />
                </div>
                {m.is_knockout && (
                  <select
                    defaultValue={m.penalty_winner ?? ''}
                    onChange={e =>
                      updateMatch(m.id, {
                        penalty_winner: (e.target.value as 'home' | 'away') || null,
                      })
                    }
                    className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)]"
                  >
                    <option value="">No penalties</option>
                    <option value="home">Pen: {m.home_team}</option>
                    <option value="away">Pen: {m.away_team}</option>
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={m.result_final}
                    onChange={e => updateMatch(m.id, { result_final: e.target.checked })}
                    className="accent-[var(--gold)]"
                  />
                  Final
                </label>
                {saving === m.id && (
                  <span className="text-xs text-[var(--muted)]">Saving…</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'locks' && (
        <div className="space-y-3">
          {matches.map(m => (
            <div
              key={m.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 flex-wrap"
            >
              <p className="font-medium text-sm flex-1 min-w-0 truncate text-[var(--text)]">
                {m.home_team} vs {m.away_team}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={m.predictions_locked}
                  onChange={e => updateMatch(m.id, { predictions_locked: e.target.checked })}
                  className="accent-[var(--red)]"
                />
                <span className="text-[var(--red)]">Lock</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={m.force_open}
                  onChange={e => updateMatch(m.id, { force_open: e.target.checked })}
                  className="accent-[var(--green)]"
                />
                <span className="text-[var(--green)]">Force open</span>
              </label>
              {saving === m.id && (
                <span className="text-xs text-[var(--muted)]">…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'deadlines' && (
        <div className="space-y-3">
          {deadlines.map(d => (
            <div
              key={d.stage}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4"
            >
              <p className="font-medium text-sm w-36 flex-shrink-0 text-[var(--text)]">
                {d.stage}
              </p>
              <input
                type="datetime-local"
                defaultValue={d.lock_at.slice(0, 16)}
                onBlur={e =>
                  updateDeadline(d.stage, new Date(e.target.value).toISOString())
                }
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)]"
              />
              {saving === d.stage && (
                <span className="text-xs text-[var(--muted)]">…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'champion' && champion && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-[var(--muted)] mb-1">Correct answer</p>
              <input
                type="text"
                defaultValue={champion.correct_answer ?? ''}
                placeholder="Champion team…"
                onBlur={e =>
                  updateChampion({ correct_answer: e.target.value || null })
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Points</p>
              <input
                type="number"
                min={0}
                defaultValue={champion.points}
                onBlur={e =>
                  updateChampion({ points: parseInt(e.target.value) || 0 })
                }
                className="w-24 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm tabular text-center text-[var(--text)]"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={champion.locked}
              onChange={e => updateChampion({ locked: e.target.checked })}
              className="accent-[var(--red)]"
            />
            Lock champion prediction
          </label>
          {saving === 'champion' && (
            <span className="text-xs text-[var(--muted)]">Saving…</span>
          )}
        </div>
      )}

      {tab === 'news' && (
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-[var(--text)]">Upload image</p>
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)]"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={uploadNews}
              disabled={uploading}
              className="text-sm text-[var(--muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[var(--gold)] file:text-[var(--bg)] disabled:opacity-50"
            />
            {uploading && <p className="text-xs text-[var(--muted)]">Uploading…</p>}
            {uploadError && <p className="text-xs text-[var(--red)]">{uploadError}</p>}
          </div>
          <div className="space-y-3">
            {newsItems.length === 0 && (
              <p className="text-sm text-[var(--muted)] text-center py-4">No images yet.</p>
            )}
            {newsItems.map(item => (
              <div key={item.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                <img src={item.image_url} alt={item.caption ?? ''} className="w-full h-auto max-h-48 object-cover" />
                <div className="px-4 py-2 flex items-center gap-3">
                  <p className="flex-1 text-xs text-[var(--muted)] truncate">{item.caption ?? '—'}</p>
                  <button
                    onClick={() => deleteNews(item)}
                    disabled={saving === item.id}
                    className="text-xs text-[var(--red)] hover:underline disabled:opacity-50"
                  >
                    {saving === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'predictions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={predUserId}
              onChange={e => { setPredUserId(e.target.value); loadPredictions(e.target.value) }}
              className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="">— Select a player —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            {predLoading && <span className="text-xs text-[var(--muted)]">Loading…</span>}
          </div>

          {predUserId && !predLoading && STAGE_ORDER.filter(s => matches.some(m => m.stage === s)).map(stage => (
            <div key={stage} className="space-y-2">
              <h3 className="text-xs uppercase tracking-widest text-[var(--muted)] font-medium pt-2">
                {STAGE_LABELS[stage] ?? stage}
              </h3>
              {matches.filter(m => m.stage === stage).map(m => (
                <PredRow
                  key={`${m.id}-${predUserId}`}
                  match={m}
                  initial={predMap[m.id] ?? null}
                  saving={predSaving === m.id}
                  onSave={(h, a, adv) => savePrediction(m.id, h, a, adv)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'admins' && (
        <div className="space-y-2">
          {profiles.map(p => (
            <div
              key={p.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[var(--text)]">{p.display_name}</p>
              </div>
              {p.id === currentUserId ? (
                <span className="text-xs text-[var(--gold)] px-2 py-1 border border-[var(--gold)]/30 rounded">
                  You
                </span>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.is_admin}
                    onChange={e => toggleAdmin(p.id, e.target.checked)}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[var(--muted)]">Admin</span>
                </label>
              )}
              {saving === p.id && (
                <span className="text-xs text-[var(--muted)]">…</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
