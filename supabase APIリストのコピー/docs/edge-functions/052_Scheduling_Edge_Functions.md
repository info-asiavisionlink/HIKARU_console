---
タイトル: Scheduling Edge Functions
URL: https://supabase.com/docs/guides/functions/schedule-functions
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge, edge-functions, functions, schedule-functions, scheduling
---

# Scheduling Edge Functions

**URL:** https://supabase.com/docs/guides/functions/schedule-functions
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge, edge-functions, functions, schedule-functions, scheduling

## 目次

- [Examples#](#examples)
  - [Invoke an Edge Function every minute#](#invoke-an-edge-function-every-minute)
- [Resources#](#resources)

## 概要

Schedule Edge Functions with pg_cron.

---

The hosted Supabase Platform supports the [`pg_cron` extension](</docs/guides/database/extensions/pg_cron>), a recurring job scheduler in Postgres.

In combination with the [`pg_net` extension](</docs/guides/database/extensions/pg_net>), this allows us to invoke Edge Functions periodically on a set schedule.

To access the auth token securely for your Edge Function call, we recommend storing them in [Supabase Vault](</docs/guides/database/vault>).

## Examples#

### Invoke an Edge Function every minute#

Store `project_url` and `publishable_key` in Supabase Vault:
[code] 
    1
    
    select vault.create_secret('https://project-ref.supabase.co', 'project_url');
    
    2
    
    select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_KEY', 'publishable_key');
[/code]

Make a POST request to a Supabase Edge Function every minute:
[code] 
    1
    
    select
    
    2
    
      cron.schedule(
    
    3
    
        'invoke-function-every-minute',
    
    4
    
        '* * * * *', -- every minute
    
    5
    
        $$
    
    6
    
        select
    
    7
    
          net.http_post(
    
    8
    
              url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/function-name',
    
    9
    
              headers:=jsonb_build_object(
    
    10
    
                'Content-type', 'application/json',
    
    11
    
                'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
    
    12
    
              ),
    
    13
    
              body:=concat('{"time": "', now(), '"}')::jsonb
    
    14
    
          ) as request_id;
    
    15
    
        $$
    
    16
    
      );
[/code]

## Resources#

  * [`pg_net` extension](</docs/guides/database/extensions/pg_net>)
  * [`pg_cron` extension](</docs/guides/database/extensions/pg_cron>)