import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// ─── Team name → flag code mapping (mirrors lib/teamCodes.ts) ────────────────

const TEAM_CODES: Record<string, string> = {
  "Algeria": "dz", "Argentina": "ar", "Australia": "au", "Austria": "at",
  "Belgium": "be", "Bosnia and Herzegovina": "ba", "Brazil": "br",
  "Canada": "ca", "Cape Verde": "cv", "Colombia": "co", "Croatia": "hr",
  "Curaçao": "cw", "Czech Republic": "cz", "DR Congo": "cd",
  "Ecuador": "ec", "Egypt": "eg", "England": "gb-eng",
  "France": "fr", "Germany": "de", "Ghana": "gh", "Haiti": "ht",
  "Iran": "ir", "Iraq": "iq", "Ivory Coast": "ci", "Japan": "jp",
  "Jordan": "jo", "Mexico": "mx", "Morocco": "ma", "Netherlands": "nl",
  "New Zealand": "nz", "Norway": "no", "Panama": "pa", "Paraguay": "py",
  "Portugal": "pt", "Qatar": "qa", "Saudi Arabia": "sa", "Scotland": "gb-sct",
  "Senegal": "sn", "South Africa": "za", "South Korea": "kr", "Spain": "es",
  "Sweden": "se", "Switzerland": "ch", "Tunisia": "tn", "Turkey": "tr",
  "United States": "us", "Uruguay": "uy", "Uzbekistan": "uz",
};

function isPlaceholderName(name: string): boolean {
  return !(name in TEAM_CODES);
}

// ─── Team name normalisation ──────────────────────────────────────────────────

const OVERRIDES: Record<string, string> = {
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  republicofkorea: "southkorea",
  korearepublic: "southkorea",
  democraticrepublicofthecongo: "drcongo",
  drcongo: "drcongo",
  congod: "drcongo",
  switzerlandu23: "switzerland",
  sui: "switzerland",
  alg: "algeria",
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

// Try multiple ESPN endpoint patterns for WC 2026; return all soccer events on
// that date. The slug-based endpoints are tried first; the generic soccer
// scoreboard (which returns ALL competitions) is the final fallback.
async function fetchESPNEvents(dateKey: string): Promise<any[]> {
  const slugUrls = [
    // Competition-specific (fastest, fewest results)
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateKey}&limit=50`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world2026/scoreboard?dates=${dateKey}&limit=50`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.worldcup/scoreboard?dates=${dateKey}&limit=50`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD/scoreboard?dates=${dateKey}&limit=50`,
    // Generic soccer scoreboard – returns everything, so we filter by team name
    `https://site.api.espn.com/apis/site/v2/sports/soccer/scoreboard?dates=${dateKey}&limit=100`,
  ];

  for (const url of slugUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "prode-international/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events: any[] = data.events ?? [];
      if (events.length > 0) {
        console.log(`ESPN: ${events.length} events from ${url}`);
        return events;
      }
    } catch (e) {
      console.warn(`ESPN fetch failed (${url}): ${e}`);
      continue;
    }
  }
  console.warn(`ESPN: no events found for ${dateKey} across all slugs`);
  return [];
}

type MatchResult = { homeScore: number; awayScore: number; penaltyWinner: "home" | "away" | null };
type MatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  is_knockout: boolean;
  result_final: boolean;
};

async function fetchFromESPN(match: MatchRow, events: any[]): Promise<MatchResult | null> {
  const homeNorm = normalizeTeamName(match.home_team);
  const awayNorm = normalizeTeamName(match.away_team);

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const homeComp = comp.competitors?.find((c: any) => c.homeAway === "home");
    const awayComp = comp.competitors?.find((c: any) => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    const espnHome = normalizeTeamName(homeComp.team?.displayName ?? homeComp.team?.name ?? "");
    const espnAway = normalizeTeamName(awayComp.team?.displayName ?? awayComp.team?.name ?? "");

    // Also try abbreviations (ESPN sometimes uses 3-letter codes)
    const espnHomeAbbr = normalizeTeamName(homeComp.team?.abbreviation ?? "");
    const espnAwayAbbr = normalizeTeamName(awayComp.team?.abbreviation ?? "");

    const homeMatch = espnHome === homeNorm || espnHomeAbbr === homeNorm;
    const awayMatch = espnAway === awayNorm || espnAwayAbbr === awayNorm;

    if (!homeMatch || !awayMatch) continue;

    if (!event.status?.type?.completed) {
      console.log(`ESPN: found ${match.home_team} vs ${match.away_team} but not completed yet`);
      return null;
    }

    let penaltyWinner: "home" | "away" | null = null;
    if (match.is_knockout) {
      const statusName: string = event.status?.type?.name ?? "";
      const shortDetail: string = event.status?.type?.shortDetail ?? "";
      const isPen = statusName.includes("PEN") || statusName.includes("PENALTIES") ||
        shortDetail.toLowerCase().includes("pen");

      if (isPen) {
        const winnerName = parseESPNPenaltyWinnerName(comp.notes ?? []);
        if (winnerName) {
          const winnerNorm = normalizeTeamName(winnerName);
          if (winnerNorm === homeNorm) penaltyWinner = "home";
          else if (winnerNorm === awayNorm) penaltyWinner = "away";
        }
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

  return null;
}

// ─── football-data.org fallback ───────────────────────────────────────────────

async function fetchFromFDO(match: MatchRow): Promise<MatchResult | null> {
  const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
  if (!apiKey) return null;

  const dateStr = new Date(match.kickoff_at).toISOString().slice(0, 10);
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateStr}&dateTo=${dateStr}&status=FINISHED`;

  try {
    const res = await fetch(url, {
      headers: { "X-Auth-Token": apiKey },
      signal: AbortSignal.timeout(8000),
    });
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
  } catch (e) {
    console.warn(`FDO failed for ${match.home_team} vs ${match.away_team}: ${e}`);
  }

  return null;
}

// ─── Bracket sync: update placeholder team names from ESPN ───────────────────
// Runs after every result update AND on a standalone schedule. Finds DB rows
// with placeholder home/away names and patches them with real ESPN team data.

async function syncBracketFromESPN(supabase: any): Promise<{ synced: number; errors: string[] }> {
  const { data: upcoming } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_at")
    .eq("result_final", false);

  if (!upcoming || upcoming.length === 0) return { synced: 0, errors: [] };

  const placeholderMatches = upcoming.filter(
    (m: any) => isPlaceholderName(m.home_team) || isPlaceholderName(m.away_team)
  );

  if (placeholderMatches.length === 0) return { synced: 0, errors: [] };

  // Group by date to minimise ESPN API calls
  const byDate = new Map<string, any[]>();
  for (const m of placeholderMatches) {
    const key = toDateKey(m.kickoff_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  let synced = 0;
  const errors: string[] = [];

  for (const [dateKey, matches] of byDate) {
    const events = await fetchESPNEvents(dateKey);
    if (events.length === 0) continue;

    for (const dbMatch of matches) {
      const kickoffMs = new Date(dbMatch.kickoff_at).getTime();

      // Match ESPN event by kickoff time ±45min (wider window for schedule shifts)
      const espnEvent = events.find((e: any) => {
        const diff = Math.abs(new Date(e.date).getTime() - kickoffMs);
        return diff < 45 * 60 * 1000;
      });

      if (!espnEvent) continue;

      const comp = espnEvent.competitions?.[0];
      if (!comp) continue;
      const homeComp = comp.competitors?.find((c: any) => c.homeAway === "home");
      const awayComp = comp.competitors?.find((c: any) => c.homeAway === "away");
      if (!homeComp || !awayComp) continue;

      const newHome: string = homeComp.team?.displayName ?? homeComp.team?.name ?? "";
      const newAway: string = awayComp.team?.displayName ?? awayComp.team?.name ?? "";

      if (!newHome || !newAway) continue;

      // Skip if ESPN still has placeholder-style text
      const looksLikePlaceholder = (n: string) =>
        /winner|loser|round of|r\d+\s*w/i.test(n);
      if (looksLikePlaceholder(newHome) || looksLikePlaceholder(newAway)) continue;

      // Skip if there's no change
      const homeChanged = newHome !== dbMatch.home_team && !isPlaceholderName(newHome);
      const awayChanged = newAway !== dbMatch.away_team && !isPlaceholderName(newAway);
      if (!homeChanged && !awayChanged) continue;

      const update: Record<string, string | null> = {};
      if (homeChanged) {
        update.home_team = newHome;
        update.home_code = TEAM_CODES[newHome] ?? null;
      }
      if (awayChanged) {
        update.away_team = newAway;
        update.away_code = TEAM_CODES[newAway] ?? null;
      }

      const { error } = await supabase
        .from("matches")
        .update(update)
        .eq("id", dbMatch.id);

      if (error) {
        errors.push(`Bracket sync failed for ${dbMatch.id}: ${error.message}`);
      } else {
        console.log(`Bracket: ${dbMatch.home_team} vs ${dbMatch.away_team} → ${newHome} vs ${newAway}`);
        synced++;
      }
    }
  }

  return { synced, errors };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    let matchId: string | null = null;
    let bracketOnly = false;
    try {
      const body = await req.json();
      matchId = body.matchId ?? null;
      bracketOnly = body.bracketOnly === true;
    } catch { /* empty body = process all pending */ }

    // Bracket-only mode: just sync team names, skip result fetching
    if (bracketOnly) {
      const bracket = await syncBracketFromESPN(ctx.supabaseAdmin);
      return Response.json({ bracketSynced: bracket.synced, bracketErrors: bracket.errors });
    }

    const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    const espnCache = new Map<string, any[]>();

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

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const match of (pending ?? []) as MatchRow[]) {
      const dateKey = toDateKey(match.kickoff_at);

      if (!espnCache.has(dateKey)) {
        const events = await fetchESPNEvents(dateKey);
        espnCache.set(dateKey, events);
      }

      const espnEvents = espnCache.get(dateKey)!;

      let result: MatchResult | null = null;
      if (espnEvents.length > 0) {
        result = await fetchFromESPN(match, espnEvents);
      }
      if (!result) {
        result = await fetchFromFDO(match);
      }

      if (!result) {
        skipped++;
        errors.push(`No result: ${match.home_team} vs ${match.away_team}`);
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

    // Always sync bracket after processing results
    const bracket = await syncBracketFromESPN(ctx.supabaseAdmin);
    if (bracket.synced > 0) {
      console.log(`Bracket: ${bracket.synced} match(es) updated`);
    }

    return Response.json({
      updated,
      skipped,
      errors,
      bracketSynced: bracket.synced,
      bracketErrors: bracket.errors,
    });
  }),
};
