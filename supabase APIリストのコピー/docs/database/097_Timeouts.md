---
タイトル: Timeouts
URL: https://supabase.com/docs/guides/database/postgres/timeouts
カテゴリ: database
更新日: 2026-08-02
タグ: database, postgres, timeouts
---

# Timeouts

**URL:** https://supabase.com/docs/guides/database/postgres/timeouts
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, postgres, timeouts

## 目次

- [Change Postgres timeout#](#change-postgres-timeout)
  - [Session level#](#session-level)
  - [Function level#](#function-level)
  - [Role level#](#role-level)
  - [Global level#](#global-level)
- [Identifying timeouts#](#identifying-timeouts)
  - [Using the Logs Explorer#](#using-the-logs-explorer)
  - [Using the Query Performance page#](#using-the-query-performance-page)
  - [Understanding roles in logs#](#understanding-roles-in-logs)

## 概要

Extend database timeouts to execute longer transactions

---

Dashboard and [Client](</docs/guides/api/rest/client-libs>) queries have a max-configurable timeout of 60 seconds. For longer transactions, use [Supavisor or direct connections](</docs/guides/database/connecting-to-postgres#quick-summary>).

## Change Postgres timeout#

You can change the Postgres timeout at the:

  1. Session level
  2. Function level
  3. Global level
  4. Role level


### Session level#

Session level settings persist only for the duration of the connection.

Set the session timeout by running:
[code] 
    1
    
    set statement_timeout = '10min';
[/code]

Because it applies to sessions only, it can only be used with connections through Supavisor in session mode (port 5432) or a direct connection. It cannot be used in the Dashboard, with the Supabase Client API, nor with Supavisor in Transaction mode (port 6543).

This is most often used for single, long running, administrative tasks, such as creating an HSNW index. Once the setting is implemented, you can view it by executing:
[code] 
    1
    
    SHOW statement_timeout;
[/code]

See the full guide on [changing session timeouts](<https://github.com/orgs/supabase/discussions/21133>).

### Function level#

This works with the Database REST API when called from the Supabase client libraries:
[code] 
    1
    
    create or replace function myfunc()
    
    2
    
    returns void as $$
    
    3
    
     select pg_sleep(3); -- simulating some long-running process
    
    4
    
    $$
    
    5
    
    language sql
    
    6
    
    set statement_timeout TO '4s'; -- set custom timeout
[/code]

This is mostly for recurring functions that need a special exemption for runtimes.

### Role level#

This sets the timeout for a specific role.

The default role timeouts are:

  * `anon`: 3s
  * `authenticated`: 8s
  * `service_role`: none (defaults to the `authenticator` role's 8s timeout if unset)
  * `postgres`: none (capped by default global timeout to be 2min)


Run the following query to change a role's timeout:
[code] 
    1
    
    alter role example_role set statement_timeout = '10min'; -- could also use seconds '10s'
[/code]

If you are changing the timeout for the Supabase Client API calls, you will need to reload PostgREST to reflect the timeout changes by running the following script:
[code]
    1
    
    NOTIFY pgrst, 'reload config';
[/code]

Unlike global settings, the result cannot be checked with `SHOW statement_timeout`. Instead, run:
[code] 
    1
    
    select
    
    2
    
      rolname,
    
    3
    
      rolconfig
    
    4
    
    from pg_roles
    
    5
    
    where
    
    6
    
      rolname in (
    
    7
    
        'anon',
    
    8
    
        'authenticated',
    
    9
    
        'postgres',
    
    10
    
        'service_role'
    
    11
    
        -- ,<ANY CUSTOM ROLES>
    
    12
    
      );
[/code]

### Global level#

This changes the statement timeout for all roles and sessions without an explicit timeout already set.
[code] 
    1
    
    alter database postgres set statement_timeout TO '4s';
[/code]

Check if your changes took effect:
[code] 
    1
    
    show statement_timeout;
[/code]

Although not necessary, if you are uncertain if a timeout has been applied, you can run a quick test:
[code] 
    1
    
    create or replace function myfunc()
    
    2
    
    returns void as $$
    
    3
    
      select pg_sleep(601); -- simulating some long-running process
    
    4
    
    $$
    
    5
    
    language sql;
[/code]

## Identifying timeouts#

The Supabase Dashboard contains tools to help you identify timed-out and long-running queries.

### Using the Logs Explorer#

Go to the [Logs Explorer](</dashboard/project/_/logs/explorer>), and run the following query to identify timed-out events (`statement timeout`) and queries that successfully run for longer than 10 seconds (`duration`).
[code] 
    1
    
    select
    
    2
    
      cast(postgres_logs.timestamp as datetime) as timestamp,
    
    3
    
      event_message,
    
    4
    
      parsed.error_severity,
    
    5
    
      parsed.user_name,
    
    6
    
      parsed.query,
    
    7
    
      parsed.detail,
    
    8
    
      parsed.hint,
    
    9
    
      parsed.sql_state_code,
    
    10
    
      parsed.backend_type
    
    11
    
    from
    
    12
    
      postgres_logs
    
    13
    
      cross join unnest(metadata) as metadata
    
    14
    
      cross join unnest(metadata.parsed) as parsed
    
    15
    
    where
    
    16
    
      regexp_contains(event_message, 'duration|statement timeout')
    
    17
    
      -- (OPTIONAL) MODIFY OR REMOVE
    
    18
    
      and parsed.user_name = 'authenticator' -- <--------CHANGE
    
    19
    
    order by timestamp desc
    
    20
    
    limit 100;
[/code]

### Using the Query Performance page#

Go to the [Query Performance page](</dashboard/project/_/advisors/query-performance?preset=slowest_execution>) and filter by relevant role and query speeds. This only identifies slow-running but successful queries. Unlike the Log Explorer, it does not show you timed-out queries.

### Understanding roles in logs#

Each API server uses a designated user for connecting to the database:

Role| API/Tool  
---|---  
`supabase_admin`| Used by Realtime and for project configuration  
`authenticator`| PostgREST  
`supabase_auth_admin`| Auth  
`supabase_storage_admin`| Storage  
`supabase_replication_admin`| Synchronizes Read Replicas  
`postgres`| Supabase Dashboard and External Tools (e.g., Prisma, SQLAlchemy, PSQL...)  
Custom roles| External Tools (e.g., Prisma, SQLAlchemy, PSQL...)  
  
Filter by the `parsed.user_name` field to only retrieve logs made by specific users:
[code] 
    1
    
    -- find events based on role/server
    
    2
    
    ... query
    
    3
    
    where
    
    4
    
      -- find events from the relevant role
    
    5
    
      parsed.user_name = '<ROLE>'
[/code]