-- Run this in the Supabase SQL Editor after deploying the Edge Function.
-- It stores the service role key in Vault and sets up a pg_cron job
-- that calls the update-match-results Edge Function every 30 minutes.

-- Step 1: Enable required extensions (safe to run even if already enabled)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Step 2: Store the service role key in Vault (only needed once)
-- If you need to update the key later, delete the old secret first:
--   delete from vault.secrets where name = 'service_role_key';
-- Replace <YOUR_SERVICE_ROLE_KEY> with the value from Supabase dashboard →
-- Settings → API → service_role key (starts with sb_secret_...)
select vault.create_secret(
  '<YOUR_SERVICE_ROLE_KEY>',
  'service_role_key',
  'Service role key for internal Edge Function calls'
);

-- Step 3: Schedule the Edge Function every 30 minutes
-- The job checks for matches that finished 90+ minutes ago and have no result yet.
-- When all matches have results, every run is a no-op in milliseconds.
select cron.schedule(
  'update-match-results',   -- job name (unique)
  '*/30 * * * *',           -- every 30 minutes
  $$
  select
    net.http_post(
      url := 'https://dltgbifqdwnynimhiguf.supabase.co/functions/v1/update-match-results',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the job was created:
-- select * from cron.job;

-- To check recent job run history:
-- select * from cron.job_run_details order by start_time desc limit 10;

-- To remove the job later (e.g. after the tournament):
-- select cron.unschedule('update-match-results');
