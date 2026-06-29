import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// ─── Team name normalisation ──────────────────────────────────────────────────

const OVERRIDES: Record<string, string> = {
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  republicofkorea: "southkorea",
  korearepublic: "southkorea",
  democraticrepublicofthecongo: "drcongo",
};

function normalizeTeamName(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return OVERRIDES[ascii] ?? ascii;
}

// ─── ESPN helpers ─────────────────────────────────────────────────────────────

function parseESPNPenaltyWinnerName(notes: Array<{ text: string }>): string | null {
  for (const note of notes) {
    const lower = note.text.toLowerCase();
    if (!lower.includes("penalt") && !lower.includes("shootout")) continue;
    const m = note.text.match(/^(.+?)\s+won\b/i);
    if (m) return m[1];
  }
  return null;
}

function toDateKey(isoString: string): string {
  const d = new Date(isoString);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

const ESPN_SLUGS = ["fifa.world", "fifa.worldcup", "fifa.world2026"];

type MatchResult = { homeScore: number; awayScore: number; penaltyWinner: "home" | "away" | null };
type MatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  is_knockout: boolean;
  result_final: boolean;
};

async function fetchFromESPN(match: MatchRow): Promise<MatchResult | null> {
  const dateKey = toDateKey(match.kickoff_at);
  const homeNorm = normalizeTeamName(match.home_team);
  const awayNorm = normalizeTeamName(match.away_team);

  for (const slug of ESPN_SLUGS) {
    let events: unknown[] = [];
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateKey}&limit=50`;
      const res = await fetch(url, { headers: { "User-Agent": "prode-international/1.0" } });
      if (!res.ok) continue;
      const data = await res.json();
      events = data.events ?? [];
    } catch {
      continue;
    }

    if (events.length === 0) continue;

    for (const event of events as any[]) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const homeComp = comp.competitors?.find((c: any) => c.homeAway === "home");
      const awayComp = comp.competitors?.find((c: any) => c.homeAway === "away");
      if (!homeComp || !awayComp) continue;

      if (
        normalizeTeamName(homeComp.team.displayName) !== homeNorm ||
        normalizeTeamName(awayComp.team.displayName) !== awayNorm
      ) continue;

      if (!event.status?.type?.completed) return null;

      let penaltyWinner: "home" | "away" | null = null;

      if (match.is_knockout) {
        const statusName: string = event.status?.type?.name ?? "";
        const shortDetail: string = event.status?.type?.shortDetail ?? "";
        const isPen = statusName.includes("PEN") || statusName.includes("PENALTIES") ||
          shortDetail.toLowerCase().includes("pen");

        if (isPen) {
          // Method 1: parse team name from notes text
          const winnerName = parseESPNPenaltyWinnerName(comp.notes ?? []);
          if (winnerName) {
            const winnerNorm = normalizeTeamName(winnerName);
            if (winnerNorm === homeNorm) penaltyWinner = "home";
            else if (winnerNorm === awayNorm) penaltyWinner = "away";
          }
          // Method 2: compare shootout scores on competitors
          if (!penaltyWinner) {
            const homePen = homeComp.shootoutScore ?? homeComp.penaltyScore;
            const awayPen = awayComp.shootoutScore ?? awayComp.penaltyScore;
            if (homePen != null && awayPen != null) {
              penaltyWinner = parseInt(homePen) > parseInt(awayPen) ? "home" : "away";
            }
          }
        }
      }

      return {
        homeScore: parseInt(homeComp.score, 10),
        awayScore: parseInt(awayComp.score, 10),
        penaltyWinner,
      };
    }
  }

  return null;
}

// ─── football-data.org fallback ───────────────────────────────────────────────

async function fetchFromFDO(match: MatchRow): Promise<MatchResult | null> {
  const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
  if (!apiKey) return null;

  const dateStr = new Date(match.kickoff_at).toISOString().slice(0, 10);
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateStr}&dateTo=${dateStr}&status=FINISHED`;

  const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}`);

  const data = await res.json();
  const homeNorm = normalizeTeamName(match.home_team);
  const awayNorm = normalizeTeamName(match.away_team);

  for (const m of (data.matches ?? []) as any[]) {
    if (m.status !== "FINISHED") continue;
    if (
      normalizeTeamName(m.homeTeam.name) !== homeNorm ||
      normalizeTeamName(m.awayTeam.name) !== awayNorm
    ) continue;

    let penaltyWinner: "home" | "away" | null = null;
    if (match.is_knockout) {
      const penalties = m.score.penalties as { home: number; away: number } | null;
      if (penalties) {
        penaltyWinner = penalties.home > penalties.away ? "home" : "away";
      }
    }

    return {
      homeScore: m.score.fullTime.home as number,
      awayScore: m.score.fullTime.away as number,
      penaltyWinner,
    };
  }

  return null;
}

async function fetchMatchResult(match: MatchRow): Promise<MatchResult | null> {
  try {
    const r = await fetchFromESPN(match);
    if (r) return r;
  } catch (e) {
    console.warn(`ESPN failed for ${match.home_team} vs ${match.away_team}: ${e}`);
  }
  try {
    const r = await fetchFromFDO(match);
    if (r) return r;
  } catch (e) {
    console.warn(`FDO failed for ${match.home_team} vs ${match.away_team}: ${e}`);
  }
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    let matchId: string | null = null;
    try {
      const body = await req.json();
      matchId = body.matchId ?? null;
    } catch { /* empty body = process all pending */ }

    const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    let query = ctx.supabaseAdmin
      .from("matches")
      .select("id, home_team, away_team, kickoff_at, is_knockout, result_final")
      .eq("result_final", false)
      .lte("kickoff_at", cutoff);

    if (matchId) {
      query = query.eq("id", matchId) as typeof query;
    }

    const { data: pending, error } = await query;

    if (error) {
      console.error("Query failed:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return Response.json({ updated: 0, skipped: 0, errors: [] });
    }

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const match of pending as MatchRow[]) {
      const result = await fetchMatchResult(match);

      if (!result) {
        skipped++;
        errors.push(`No result yet: ${match.home_team} vs ${match.away_team}`);
        continue;
      }

      const { error: updateError } = await ctx.supabaseAdmin
        .from("matches")
        .update({
          home_score: result.homeScore,
          away_score: result.awayScore,
          result_final: true,
          predictions_locked: true,
          ...(result.penaltyWinner !== null ? { penalty_winner: result.penaltyWinner } : {}),
        })
        .eq("id", match.id)
        .eq("result_final", false);

      if (updateError) {
        errors.push(`Update failed for ${match.home_team} vs ${match.away_team}: ${updateError.message}`);
        skipped++;
      } else {
        console.log(`Updated: ${match.home_team} ${result.homeScore}-${result.awayScore} ${match.away_team}${result.penaltyWinner ? ` (pen: ${result.penaltyWinner})` : ""}`);
        updated++;
      }
    }

    return Response.json({ updated, skipped, errors });
  }),
};
