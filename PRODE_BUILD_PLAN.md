# Prode World Cup 2026 — Build Plan

A friends prediction pool for the 2026 World Cup. Players predict scores per match; admins
enter results and control locking; players compete on a **global ranking** and inside
**private groups**. Scoring matches prodegame.fun exactly.

Hand this to Claude Code and build it in the order under **Build sequence**.

---

## 1. Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS, on Vercel.
- **Backend / DB / Auth:** Supabase (Postgres + Auth + RLS).
- **Auth:** Supabase **magic link (email) + Google OAuth** (built-in provider; create a Google
  Cloud OAuth client, paste id/secret into Supabase Auth, call `signInWithOAuth`).
- **Supabase client:** `@supabase/ssr` (server + browser clients, middleware session refresh).
- **No paid sports API** — admins enter ~104 results by hand. **No realtime** — refresh is fine.

---

## 2. Roles

- **Admin:** can be **multiple people**. Enters real scores + who advanced, locks/unlocks
  predictions (per match and per knockout phase), finalizes results, sets the champion answer
  and bonus points, manages fixtures and phase deadlines, and **grants/revokes admin** to
  other users. `profiles.is_admin = true`.
- **Player:** signs up, enters/edits their own predictions until that match/phase is locked,
  picks a champion, creates/joins groups, views global + group rankings.

Players cannot enter real results or escalate themselves to admin (DB-enforced).

---

## 3. Scoring rules (prodegame-exact — LOCKED)

### Group stage (per match)
| Outcome | Points |
|---|---|
| Exact scoreline | **10** |
| Correct winner **and** correct goal difference (not exact) | **7** |
| Correct winner **or** correctly called a draw, wrong margin | **5** |
| Wrong winner | **0** |

A non-exact **draw scores 5** (no margin to nail). The 7 tier needs a real winner + exact GD.

### Knockout stage (per match)
Same **10/7/5/0** scale on the **regular-time** scoreline, plus a "who advances" pick:
- **Floor of 3 for the right advancer:** correct advancer ⇒ at least 3, even if the scoreline
  gave 0. Knockout base = `max(scale, 3)` when advancer right, else `scale`.
- **+3 penalty bonus:** if you **predicted a draw** *and* your chosen team won the shootout.

Excluded (prodegame enterprise-only): the `×1.25` and `×4` multipliers — not built.

### Worked examples (test cases)
Group, actual **2-1**: 2-1→10 · 3-2→7 · 1-0→7 · 4-1→5 · 0-0→0 · 1-2→0
Group, actual **1-1**: 1-1→10 · 0-0→**5** · 2-2→**5** · 1-0→0
Knockout, regular time **1-1, HOME wins on pens** (HOME advances):
- 1-1, adv HOME → exact 10 + bonus 3 = **13**
- 0-0, adv HOME → 5, `max(5,3)=5`, +3 = **8**
- 0-0, adv AWAY → 5, no bonus = **5**
- 2-1, adv HOME → 0, `max(0,3)=3`, no bonus = **3**
- 2-1, adv AWAY → **0**

(Scoring logic verified against all of the above.)

---

## 4. Data model

### `profiles`
`id` (uuid PK → auth.users), `display_name`, `is_admin bool default false`, `created_at`.

### `matches`
`id`, `stage` (`group`,`round_of_32`,`round_of_16`,`quarter`,`semi`,`third_place`,`final`),
`match_no`, `home_team`/`away_team`, `home_code`/`away_code` (ISO flag codes), `kickoff_at`,
`home_score`/`away_score` (regular-time result, admin only), `penalty_winner` (`home`/`away`,
who won a drawn knockout), `is_knockout`, `predictions_locked` (admin force-lock this match),
`force_open` (admin override to keep open past date/kickoff), `result_final` (counts on
leaderboard), `created_at`.

### `predictions`
`id`, `user_id`, `match_id`, `pred_home`/`pred_away`, `pred_advancer` (`home`/`away`; required
knockout, null group), `created_at`/`updated_at`, **UNIQUE(user_id, match_id)**.

### `phase_deadlines`
`stage` (PK), `lock_at` (timestamptz — predictions for every match in that stage close then).
Seeded from the real 2026 dates (each phase closes at its start). Admins can edit.

### `tournament_bonuses` (champion pick engine — flexible, 0 pts now)
`id`, `key` (`champion`, later `top_scorer`…), `label`, `points int default 0`,
`correct_answer text null`, `locked bool default false`, `lock_at timestamptz null`
(auto-lock date), `is_active bool default true`.

### `bonus_predictions`
`id`, `user_id`, `bonus_id`, `answer` (team picked), timestamps, **UNIQUE(user_id, bonus_id)**.

### `groups`  +  `group_members`
`groups`: `id`, `name`, `region` (subtitle), `avatar_url`, `invite_code` (unique, human-typable
label — both the share-link slug and the code players type to join), `created_by`,
`max_players int default 50`, `created_at`.
`group_members`: `(group_id, user_id)` PK, `joined_at`.

Predictions are **global per user** (one set), so a player's points are identical everywhere —
the global ranking shows all users; a group ranking is the same points filtered to that group's
members. That mirrors prodegame.

---

## 5. Supabase SQL

```sql
create extension if not exists pgcrypto;

-- ---------- core tables ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  match_no int,
  home_team text not null, away_team text not null,
  home_code text, away_code text,
  kickoff_at timestamptz not null,
  home_score int, away_score int,
  penalty_winner text check (penalty_winner in ('home','away')),
  is_knockout boolean not null default false,
  predictions_locked boolean not null default false,
  force_open boolean not null default false,
  result_final boolean not null default false,
  created_at timestamptz not null default now()
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  pred_home int not null check (pred_home >= 0),
  pred_away int not null check (pred_away >= 0),
  pred_advancer text check (pred_advancer in ('home','away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table phase_deadlines (
  stage text primary key,
  lock_at timestamptz not null
);
-- Real 2026 dates: each knockout phase closes at its start. SET EXACT first-kickoff
-- times/timezone in the admin UI; these are placeholders at 16:00 UTC.
insert into phase_deadlines (stage, lock_at) values
  ('round_of_32','2026-06-28T16:00:00Z'),
  ('round_of_16','2026-07-04T16:00:00Z'),
  ('quarter',    '2026-07-09T16:00:00Z'),
  ('semi',       '2026-07-14T16:00:00Z'),
  ('third_place','2026-07-18T16:00:00Z'),
  ('final',      '2026-07-19T16:00:00Z');

create table tournament_bonuses (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, label text not null,
  points int not null default 0,
  correct_answer text,
  locked boolean not null default false,   -- admin force-lock override
  lock_at timestamptz,                       -- auto-lock date (null = no auto-lock)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- champion auto-locks at the first knockout kickoff (Jun 28, 2026); admin can override.
insert into tournament_bonuses (key, label, points, lock_at)
  values ('champion','Campeón del Mundial',0,'2026-06-28T16:00:00Z');

create table bonus_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bonus_id uuid not null references tournament_bonuses(id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bonus_id)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  avatar_url text,
  invite_code text unique not null,
  created_by uuid references profiles(id),
  max_players int not null default 50,
  created_at timestamptz not null default now()
);
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id  uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ---------- helpers ----------
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- is a match still open for predictions? (force_open > lock > kickoff > phase deadline)
create or replace function match_open(p_match_id uuid)
returns boolean language sql stable security definer as $$
  select case
    when m.force_open then true
    when m.predictions_locked then false
    when m.kickoff_at <= now() then false
    else coalesce((select now() < pd.lock_at
                   from phase_deadlines pd where pd.stage = m.stage), true)
  end
  from matches m where m.id = p_match_id
$$;

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',
                           split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- block non-admins from changing is_admin (even on their own row)
create or replace function guard_is_admin()
returns trigger language plpgsql security definer as $$
begin
  if (new.is_admin is distinct from old.is_admin) and not is_admin() then
    raise exception 'Not allowed to change admin status';
  end if;
  return new;
end $$;
create trigger profiles_guard_is_admin
  before update on profiles for each row execute function guard_is_admin();

-- create a group (auto-generates a typable invite_code, adds creator as member)
create or replace function create_group(p_name text, p_region text default null)
returns groups language plpgsql security definer as $$
declare g groups; base text; code text; n int := 0;
begin
  base := trim(both '-' from upper(regexp_replace(p_name,'[^a-zA-Z0-9]+','-','g')));
  if base = '' then base := 'GROUP'; end if;
  code := base;
  while exists (select 1 from groups where invite_code = code) loop
    n := n + 1; code := base || '-' || n;
  end loop;
  insert into groups (name, region, invite_code, created_by)
    values (p_name, p_region, code, auth.uid()) returning * into g;
  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end $$;

-- join a group by typing its code/label (case-insensitive); also used by the share link
create or replace function join_group(p_code text)
returns groups language plpgsql security definer as $$
declare g groups; cnt int;
begin
  select * into g from groups where upper(invite_code) = upper(trim(p_code));
  if not found then raise exception 'Group not found'; end if;
  select count(*) into cnt from group_members where group_id = g.id;
  if cnt >= g.max_players then raise exception 'Group is full'; end if;
  insert into group_members (group_id, user_id) values (g.id, auth.uid())
    on conflict do nothing;
  return g;
end $$;

-- ---------- scoring views ----------
create or replace view prediction_scores with (security_invoker = on) as
select p.id, p.user_id, p.match_id, p.pred_home, p.pred_away, p.pred_advancer,
       m.stage, m.is_knockout, m.home_score, m.away_score, m.penalty_winner, m.result_final,
  case
    when m.home_score is null or m.away_score is null then null
    when not m.is_knockout then calc.scale
    else (case when p.pred_advancer is not null and p.pred_advancer = calc.actual_advancer
               then greatest(calc.scale,3) else calc.scale end)
       + (case when calc.pd = 0 and calc.ad = 0
                    and p.pred_advancer is not null and p.pred_advancer = m.penalty_winner
               then 3 else 0 end)
  end as points
from predictions p
join matches m on m.id = p.match_id
cross join lateral (
  select (p.pred_home - p.pred_away) as pd, (m.home_score - m.away_score) as ad,
    case
      when p.pred_home = m.home_score and p.pred_away = m.away_score then 10
      when (m.home_score - m.away_score) = 0
        then case when (p.pred_home - p.pred_away) = 0 then 5 else 0 end
      else case when sign(p.pred_home-p.pred_away) = sign(m.home_score-m.away_score)
        then case when (p.pred_home-p.pred_away) = (m.home_score-m.away_score) then 7 else 5 end
        else 0 end
    end as scale,
    case when (m.home_score-m.away_score) > 0 then 'home'
         when (m.home_score-m.away_score) < 0 then 'away'
         else m.penalty_winner end as actual_advancer
) calc;

create or replace view bonus_scores with (security_invoker = on) as
select bp.user_id, bp.bonus_id,
  case when tb.correct_answer is not null and bp.answer = tb.correct_answer
       then tb.points else 0 end as points
from bonus_predictions bp join tournament_bonuses tb on tb.id = bp.bonus_id;

-- GLOBAL leaderboard (all users)
create or replace view leaderboard with (security_invoker = on) as
with match_pts as (
  select user_id, coalesce(sum(points),0) as pts,
         count(*) filter (where points = 10) as exact_hits
  from prediction_scores where result_final = true group by user_id),
bonus_pts as (
  select user_id, coalesce(sum(points),0) as pts from bonus_scores group by user_id)
select pr.id as user_id, pr.display_name,
  coalesce(mp.pts,0) + coalesce(bp.pts,0) as total_points,
  coalesce(mp.exact_hits,0) as exact_hits
from profiles pr
left join match_pts mp on mp.user_id = pr.id
left join bonus_pts bp on bp.user_id = pr.id
order by total_points desc, exact_hits desc;

-- PER-GROUP leaderboard (members only)
create or replace function group_leaderboard(p_group uuid)
returns table(user_id uuid, display_name text, total_points int, exact_hits int)
language sql stable security definer as $$
  select l.user_id, l.display_name, l.total_points, l.exact_hits
  from leaderboard l
  join group_members gm on gm.user_id = l.user_id
  where gm.group_id = p_group
    and (is_admin() or exists (select 1 from group_members me
         where me.group_id = p_group and me.user_id = auth.uid()))
  order by l.total_points desc, l.exact_hits desc
$$;

-- ---------- RLS ----------
alter table profiles           enable row level security;
alter table matches            enable row level security;
alter table predictions        enable row level security;
alter table phase_deadlines    enable row level security;
alter table tournament_bonuses enable row level security;
alter table bonus_predictions  enable row level security;
alter table groups             enable row level security;
alter table group_members      enable row level security;

-- profiles
create policy "read profiles" on profiles for select using (auth.role()='authenticated');
create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin update any profile" on profiles
  for update using (is_admin()) with check (true);   -- grant/revoke admin (guard trigger applies)

-- matches: everyone reads; admins write
create policy "read matches" on matches for select using (auth.role()='authenticated');
create policy "admin write matches" on matches for all using (is_admin()) with check (is_admin());

-- phase deadlines: everyone reads; admins write
create policy "read deadlines" on phase_deadlines for select using (auth.role()='authenticated');
create policy "admin write deadlines" on phase_deadlines for all using (is_admin()) with check (is_admin());

-- predictions: read own always; others once the match is no longer open; write own while open
create policy "read own or revealed predictions" on predictions
  for select using (user_id = auth.uid() or not match_open(predictions.match_id));
create policy "insert own predictions while open" on predictions
  for insert with check (user_id = auth.uid() and match_open(match_id));
create policy "update own predictions while open" on predictions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and match_open(match_id));

-- bonuses
create policy "read bonuses" on tournament_bonuses for select using (auth.role()='authenticated');
create policy "admin write bonuses" on tournament_bonuses for all using (is_admin()) with check (is_admin());
create policy "read own or revealed bonus picks" on bonus_predictions
  for select using (user_id = auth.uid()
    or exists (select 1 from tournament_bonuses tb
               where tb.id = bonus_predictions.bonus_id
                 and (tb.locked = true or (tb.lock_at is not null and now() >= tb.lock_at))));
create policy "insert own bonus while open" on bonus_predictions
  for insert with check (user_id = auth.uid()
    and exists (select 1 from tournament_bonuses tb where tb.id = bonus_id
               and tb.locked = false and (tb.lock_at is null or now() < tb.lock_at)));
create policy "update own bonus while open" on bonus_predictions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from tournament_bonuses tb where tb.id = bonus_id
               and tb.locked = false and (tb.lock_at is null or now() < tb.lock_at)));

-- groups (creation/join go through the security-definer RPCs above)
create policy "members read group" on groups
  for select using (is_admin() or exists (
    select 1 from group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid()));
create policy "create own group" on groups
  for insert with check (created_by = auth.uid());
create policy "creator or admin update group" on groups
  for update using (created_by = auth.uid() or is_admin());

create policy "members read membership" on group_members
  for select using (is_admin() or exists (
    select 1 from group_members me where me.group_id = group_members.group_id and me.user_id = auth.uid()));
create policy "join self" on group_members for insert with check (user_id = auth.uid());
create policy "leave self" on group_members for delete using (user_id = auth.uid() or is_admin());
```

Make the first admin once:
```sql
update profiles set is_admin = true where id = 'YOUR_AUTH_USER_UUID';
```
After that, admins grant others from the admin UI (or `update profiles set is_admin=true where id=...`).

### Admin lock cheatsheet
- **Lock one match now:** `predictions_locked = true`.
- **Keep one match open past its date/kickoff:** `force_open = true`.
- **Change when a whole phase closes:** edit `phase_deadlines.lock_at` for that stage.
- Precedence: `force_open` > `predictions_locked` > kickoff time > phase deadline.

---

## 6. Next.js app structure

```
app/
  layout.tsx · globals.css
  login/page.tsx            // magic link + "Continue with Google"
  page.tsx                  // dashboard: next matches, pick status, your rank
  predict/page.tsx          // matches by stage, score inputs (+ advancer on knockout)
  champion/page.tsx         // pick the World Cup winner (bonus)
  ranking/page.tsx          // GLOBAL leaderboard
  groups/page.tsx           // your groups + create + join box (type code/name)
  groups/[id]/page.tsx      // group leaderboard + Share
  join/[code]/page.tsx      // share-link target -> calls join_group(code)
  match/[id]/page.tsx       // everyone's picks once revealed
  admin/page.tsx            // results, advancer, lock/force_open, phase deadlines,
                            //   champion answer/points, manage admins, fixtures
  auth/callback/route.ts
components/
  AppHeader · MatchCard · ScoreInput · AdvancerPicker · ChampionPicker
  GroupSection · StatTile · LeaderboardTable · LeaderboardRow · RankBadge · ColorAvatar
  LockBanner · ProgressBar · ShareButton · JoinGroupBox · CreateGroupForm
  ScopeToggle (Global | Group) · BracketView (later)
lib/ supabase/{server,client}.ts · scoring.ts · types.ts
middleware.ts  // session refresh; guard /admin via is_admin
```

Behaviors:
- `/admin` guarded in middleware by `is_admin`. Admin page surfaces the lock cheatsheet controls.
- Predict page disables inputs using `match_open` state; RLS enforces server-side.
- Knockout matches require `AdvancerPicker`. Champion page disabled once that bonus is locked or past its `lock_at` date.
- Ranking page = global `leaderboard`; group page = `group_leaderboard(group_id)` via RPC.
- Create/join groups via `create_group` / `join_group` RPCs. Share link = `/join/<invite_code>`;
  the same code can be typed into `JoinGroupBox`.

---

## 7. Design system

Matched to the real prodegame app: near-black sporty dark theme, **gold = primary/brand**,
**green = "yours / active / confirmed"**, **red = locked/closed**. Mobile-first PWA.
Point-tier colours from their rules screen: **10 gold · 7 green · 5 blue · 0 grey · +3 green**.

```
--bg:#0a0e17  --surface:#11141d  --surface-2:#181c27  --border:#232838
--text:#f2f5fb  --muted:#7d8699
--gold:#f5c542  --gold-2:#e0a72e  --green:#34d399  --blue:#4c8dff  --red:#f87171
```

- **Display headings** (`FASE DE GRUPOS`, `ELIMINATORIAS`, `MI PRODE`, logo): heavy **condensed
  italic** (`Saira Condensed`/`Archivo Narrow` 700–800), uppercase, slight slant; two-tone word
  trick (one word grey, next gold/green). Body/labels: `Inter`, uppercase + `tracking-widest`
  for small labels; `tabular-nums` on all numbers.
- **Scoring legend card:** each tier as `[colored number square] [bold title] [grey example]`.
- **Stat tiles:** 3 dark tiles, icon + big number + caption.
- **Leaderboard row:** `[rank][colored initial square][name+flag] ... [points]`; gold #1,
  green "you", gold `CREADOR` pill on the creator. Reuse for global and group rankings.
- **Match card:** flags bleed to edges; centered green-bordered score boxes (the prediction);
  once played, a `RESULTADO x - y` line with a gold `+N pts` / muted `0 pts` pill.
- **Group/phase headers:** letter tile (`A`), `GRUPO 6/6`, outlined green `✓ LISTO` when done.
- **Lock banners:** green when confirmed, **red** when a phase is closed (`… cerrado 0/16`).
- **Bracket (later):** horizontal scroll, active phase gold, lock icons, `Por definir` slots.
- **Share:** full-width gold-gradient `Compartir`. **Footer:** gold logo + `2026` chip + a
  small `No somos una casa de apuestas` note.
- Flags via `flagcdn.com/<code>.svg`, bleeding to card edges.

---

## 8. Build sequence (for Claude Code)

1. **Scaffold** Next.js (TS/App Router/Tailwind) + `@supabase/ssr`; two clients + middleware.
2. **Supabase:** run §5 SQL; enable Email + Google; seed test matches (group + knockout);
   make yourself admin.
3. **Auth:** `/login` (magic link + Google) + `auth/callback`.
4. **Design tokens + core components:** header, `MatchCard`, `ScoreInput`, `AdvancerPicker`,
   `LockBanner`, scoring-legend card.
5. **Predict page:** matches by stage; load/save (upsert); advancer on knockout; respect
   `match_open`.
6. **Champion page:** `ChampionPicker` writing the `champion` bonus; disabled once locked or past `lock_at`.
7. **Global ranking page:** read `leaderboard`.
8. **Groups:** `groups` page (create + join box), `groups/[id]` (group_leaderboard + Share),
   `/join/[code]` share-link handler.
9. **Match detail:** reveal all picks (RLS).
10. **Admin:** scores + advancer; `predictions_locked` / `force_open`; `phase_deadlines`;
    champion `correct_answer`/`points`/`locked`; grant/revoke admin; fixtures.
11. **Polish:** countdowns, PWA manifest, deploy to Vercel.

---

## 9. Environment & deploy

`.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same in Vercel).
- Supabase Auth: set Site URL; add Vercel domain + `localhost:3000` to redirect URLs.
- Google OAuth: create a Cloud client, add Supabase's callback as an authorized redirect URI,
  paste id/secret into Supabase → Auth → Providers → Google.
- Types: `supabase gen types typescript --project-id <id> > lib/types.ts`.
- After the group stage, set the real per-phase `lock_at` times in the admin UI (or SQL).

---

## 10. Decisions & remaining scope

### Confirmed
- Scoring: prodegame-exact (draw=5, knockout floor 3, +3 only if a draw was predicted). ✓
- Auth: magic link **+ Google**. ✓
- Champion pick: selectable now, **0 points**, flip on later via the bonus row. ✓
- Rankings: **global + private groups**, predictions global per user. ✓
- Group join: by **share link** *and* by typing the **invite code/label** in the UI. ✓
- Locking: per-match kickoff auto-lock, **per-knockout-phase date deadline** (seeded from real
  2026 dates), with **two-way admin override** (`predictions_locked` to lock early, `force_open`
  to keep open). ✓
- **Multiple admins**, with self-escalation blocked at the DB level. ✓
- Champion pick **auto-locks at the first knockout kickoff (Jun 28, 2026)** via
  `tournament_bonuses.lock_at`; an admin can lock earlier (`locked = true`) or push the date. ✓
- **Any authenticated player can create groups** (and is auto-added as the creator/member);
  admins can also manage any group. ✓

### Later (not v1)
- **Full bracket prediction** (advance teams per round, pre-filled next phase): its own project;
  per-match scoring above still applies on top. `BracketView` is stubbed for it.
- Extra bonus questions (top scorer, etc.) — engine already supports them, just add rows + pickers.
- "Ver de a uno" one-match-at-a-time swipe flow (list view is enough for v1).
