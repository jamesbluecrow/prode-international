-- ============================================================
-- Match result auto-update — one-time pg_cron jobs
-- ============================================================
-- Run this ONCE in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dltgbifqdwnynimhiguf/sql/new
--
-- What it does:
--   1. Enables pg_cron and pg_net extensions
--   2. Stores the service role key in Vault
--   3. Creates a helper procedure that fires the Edge Function
--      and then immediately deletes the job that called it
--   4. Creates schedule_all_match_jobs() which reads every
--      unplayed match and schedules exactly 5 one-time jobs:
--      at T+15, T+30, T+60, T+90, T+120 after expected match end
--   5. Calls schedule_all_match_jobs() to seed everything now
--
-- Each job fires exactly once and removes itself. When the
-- tournament ends there are zero jobs left.
-- ============================================================

-- Step 1: Enable extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Step 2: Store service role key in Vault (replace placeholder with real key)
-- Get it from: Supabase dashboard → Settings → API → service_role
-- If re-running, delete the old secret first:
--   delete from vault.secrets where name = 'service_role_key';
select vault.create_secret(
  '<YOUR_SERVICE_ROLE_KEY>',
  'service_role_key',
  'Service role key for match result Edge Function calls'
);

-- Step 3: Create the procedure that fires the HTTP call then deletes itself
create or replace procedure public.run_match_job(p_job_name text, p_match_id text)
language plpgsql
security definer
as $$
begin
  -- Call the Edge Function for this specific match
  perform net.http_post(
    url     := 'https://dltgbifqdwnynimhiguf.supabase.co/functions/v1/update-match-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := jsonb_build_object('matchId', p_match_id)
  );

  -- Self-delete: remove this one-time job so nothing lingers
  perform cron.unschedule(p_job_name);
end;
$$;

-- Step 4: Create the seeding function
create or replace function public.schedule_all_match_jobs()
returns table(match_id text, home_team text, away_team text, jobs_scheduled int)
language plpgsql
security definer
as $$
declare
  r           record;
  fire_at     timestamptz;
  cron_expr   text;
  job_name    text;
  offsets     int[] := array[15, 30, 60, 90, 120];
  offset_val  int;
  jobs_count  int;
begin
  -- Covers future matches and any currently in progress (kicked off < 3h ago)
  for r in
    select id, home_team, away_team, kickoff_at
    from matches
    where result_final = false
      and kickoff_at > now() - interval '3 hours'
    order by kickoff_at
  loop
    jobs_count := 0;

    foreach offset_val in array offsets
    loop
      -- Expected end = kickoff + 2 hours; job fires at end + offset
      fire_at := r.kickoff_at + interval '2 hours' + (offset_val || ' minutes')::interval;

      -- Skip fire times already in the past
      if fire_at <= now() then
        continue;
      end if;

      job_name := 'match-' || r.id || '-t' || offset_val;

      -- Remove any existing job with this name (safe to re-run)
      if exists (select 1 from cron.job where jobname = job_name) then
        perform cron.unschedule(job_name);
      end if;

      -- Cron expression fires at exactly this UTC minute: "MM HH DD MON *"
      cron_expr := to_char(fire_at at time zone 'UTC', 'MI HH24 DD MM') || ' *';

      perform cron.schedule(
        job_name,
        cron_expr,
        format('call public.run_match_job(%L, %L)', job_name, r.id::text)
      );

      jobs_count := jobs_count + 1;
    end loop;

    return query select r.id::text, r.home_team, r.away_team, jobs_count;
  end loop;
end;
$$;

-- Step 5: Seed all jobs now
select * from public.schedule_all_match_jobs();

-- ─── Useful queries ───────────────────────────────────────────────────────────

-- See all scheduled jobs:
-- select jobname, schedule, command from cron.job order by jobname;

-- See recent run history:
-- select jobname, start_time, status, return_message
-- from cron.job_run_details
-- order by start_time desc limit 20;

-- Manually remove all match jobs (e.g. to re-seed):
-- select cron.unschedule(jobname)
-- from cron.job
-- where jobname like 'match-%';
