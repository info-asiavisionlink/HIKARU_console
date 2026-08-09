---
タイトル: Send SMS Hook
URL: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-hooks, hook, send, send-sms-hook
---

# Send SMS Hook

**URL:** https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-hooks, hook, send, send-sms-hook

## 目次

（目次なし）

## 概要

Use your own SMS service to send authentication messages.

---

The Send SMS Hook replaces Supabase's built-in SMS sending. You can use this hook to:

  * Use a regional SMS Provider
  * Use alternate messaging channels such as WhatsApp
  * Fall back to another provider if your primary one fails
  * Adjust the message body to include platform specific fields such as the [`AppHash`](<https://developers.google.com/identity/sms-retriever/overview>)


**Inputs**

Field| Type| Description  
---|---|---  
`user`| [`User`](</docs/guides/auth/users#the-user-object>)| The user attempting to sign in.  
`sms`| `object`| Metadata specific to the SMS sending process. Includes the OTP.  
  
JSONJSON Schema
[code]
    1
    
    {
    
    2
    
      "user": {
    
    3
    
        "id": "6481a5c1-3d37-4a56-9f6a-bee08c554965",
    
    4
    
        "aud": "authenticated",
    
    5
    
        "role": "authenticated",
    
    6
    
        "email": "",
    
    7
    
        "phone": "+1333363128",
    
    8
    
        "phone_confirmed_at": "2024-05-13T11:52:48.157306Z",
    
    9
    
        "confirmation_sent_at": "2024-05-14T12:31:52.824573Z",
    
    10
    
        "confirmed_at": "2024-05-13T11:52:48.157306Z",
    
    11
    
        "phone_change_sent_at": "2024-05-13T11:47:02.183064Z",
    
    12
    
        "last_sign_in_at": "2024-05-13T11:52:48.162518Z",
    
    13
    
        "app_metadata": {
    
    14
    
          "provider": "phone",
    
    15
    
          "providers": ["phone"]
    
    16
    
        },
    
    17
    
        "user_metadata": {},
    
    18
    
        "identities": [
    
    19
    
          {
    
    20
    
            "identity_id": "3be5e552-65aa-41d9-9db9-2a502f845459",
    
    21
    
            "id": "6481a5c1-3d37-4a56-9f6a-bee08c554965",
    
    22
    
            "user_id": "6481a5c1-3d37-4a56-9f6a-bee08c554965",
    
    23
    
            "identity_data": {
    
    24
    
              "email_verified": false,
    
    25
    
              "phone": "+1612341244428",
    
    26
    
              "phone_verified": true,
    
    27
    
              "sub": "6481a5c1-3d37-4a56-9f6a-bee08c554965"
    
    28
    
            },
    
    29
    
            "provider": "phone",
    
    30
    
            "last_sign_in_at": "2024-05-13T11:52:48.155562Z",
    
    31
    
            "created_at": "2024-05-13T11:52:48.155599Z",
    
    32
    
            "updated_at": "2024-05-13T11:52:48.159391Z"
    
    33
    
          }
    
    34
    
        ],
    
    35
    
        "created_at": "2024-05-13T11:45:33.7738Z",
    
    36
    
        "updated_at": "2024-05-14T12:31:52.82475Z",
    
    37
    
        "is_anonymous": false
    
    38
    
      },
    
    39
    
      "sms": {
    
    40
    
        "otp": "561166"
    
    41
    
      }
    
    42
    
    }
[/code]

**Outputs**

  * No outputs are required. An empty response with a status code of 200 is taken as a successful response.


SQLHTTP

Queue SMS Messages

Your company uses a worker to manage all messaging related jobs. For performance reasons, the messaging system sends messages in intervals via a job queue. Instead of sending a message immediately, messages are queued and sent in periodic intervals via `pg_cron`.

Create a table to store jobs
[code]
    1
    
    create table job_queue (
    
    2
    
      job_id uuid primary key default gen_random_uuid(),
    
    3
    
      job_data jsonb not null,
    
    4
    
      created_at timestamp default now(),
    
    5
    
      status text default 'pending',
    
    6
    
      priority int default 0,
    
    7
    
      retry_count int default 0,
    
    8
    
      max_retries int default 2,
    
    9
    
      scheduled_at timestamp default now()
    
    10
    
    );
[/code]

Create the hook:
[code]
    1
    
    create or replace function send_sms(event jsonb) returns void as $$
    
    2
    
    declare
    
    3
    
        job_data jsonb;
    
    4
    
        scheduled_time timestamp;
    
    5
    
        priority int;
    
    6
    
    begin
    
    7
    
        -- extract phone and otp from the event json
    
    8
    
        job_data := jsonb_build_object(
    
    9
    
            'phone', event->'user'->>'phone',
    
    10
    
            'otp', event->'sms'->>'otp'
    
    11
    
        );
    
    12
    
    13
    
        -- calculate the nearest 5-minute window for scheduled_time
    
    14
    
        scheduled_time := date_trunc('minute', now()) + interval '5 minute' * floor(extract('epoch' from (now() - date_trunc('minute', now())) / 60) / 5);
    
    15
    
    16
    
        -- assign priority dynamically (example logic: higher priority for earlier scheduled time)
    
    17
    
        priority := extract('epoch' from (scheduled_time - now()))::int;
    
    18
    
    19
    
        -- insert the job into the job_queue table
    
    20
    
        insert into job_queue (job_data, priority, scheduled_at, max_retries)
    
    21
    
        values (job_data, priority, scheduled_time, 2);
    
    22
    
    end;
    
    23
    
    $$ language plpgsql;
    
    24
    
    25
    
    grant all
    
    26
    
      on table public.job_queue
    
    27
    
      to supabase_auth_admin;
    
    28
    
    29
    
    revoke all
    
    30
    
      on table public.job_queue
    
    31
    
      from authenticated, anon;
[/code]

Create a function to periodically run and dequeue all jobs
[code]
    1
    
    create or replace function dequeue_and_run_jobs() returns void as $$
    
    2
    
    declare
    
    3
    
        job record;
    
    4
    
    begin
    
    5
    
        for job in
    
    6
    
            select * from job_queue
    
    7
    
            where status = 'pending'
    
    8
    
              and scheduled_at <= now()
    
    9
    
            order by priority desc, created_at
    
    10
    
            for update skip locked
    
    11
    
        loop
    
    12
    
            begin
    
    13
    
                -- add job processing logic here.
    
    14
    
                -- for demonstration, we'll just update the job status to 'completed'.
    
    15
    
                update job_queue
    
    16
    
                set status = 'completed'
    
    17
    
                where job_id = job.job_id;
    
    18
    
    19
    
            exception when others then
    
    20
    
                -- handle job failure and retry logic
    
    21
    
                if job.retry_count < job.max_retries then
    
    22
    
                    update job_queue
    
    23
    
                    set retry_count = retry_count + 1,
    
    24
    
                        scheduled_at = now() + interval '1 minute'  -- delay retry by 1 minute
    
    25
    
                    where job_id = job.job_id;
    
    26
    
                else
    
    27
    
                    update job_queue
    
    28
    
                    set status = 'failed'
    
    29
    
                    where job_id = job.job_id;
    
    30
    
                end if;
    
    31
    
            end;
    
    32
    
        end loop;
    
    33
    
    end;
    
    34
    
    $$ language plpgsql;
    
    35
    
    36
    
    grant execute
    
    37
    
      on function public.dequeue_and_run_jobs
    
    38
    
      to supabase_auth_admin;
    
    39
    
    40
    
    revoke execute
    
    41
    
      on function public.dequeue_and_run_jobs
    
    42
    
      from authenticated, anon;
[/code]

Configure `pg_cron` to run the job on an interval. You can use a tool like [crontab.guru](<https://crontab.guru/>) to check that your job is running on an appropriate schedule. Ensure that `pg_cron` is enabled under `Database > Extensions`
[code]
    1
    
    select
    
    2
    
      cron.schedule(
    
    3
    
        '* * * * *', -- this cron expression means every minute.
    
    4
    
        'select dequeue_and_run_jobs();'
    
    5
    
      );
[/code]