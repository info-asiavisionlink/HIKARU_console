---
タイトル: Build an API route in less than 2 minutes.
URL: https://supabase.com/docs/guides/api/quickstart
カテゴリ: api
更新日: 2026-08-02
タグ: api, build, less, minutes, quickstart, route, than
---

# Build an API route in less than 2 minutes.

**URL:** https://supabase.com/docs/guides/api/quickstart
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, build, less, minutes, quickstart, route, than

## 目次

- [Bonus#](#bonus)
  - [Browser#](#browser)
  - [Curl#](#curl)
  - [Client libraries#](#client-libraries)

## 概要

Create your first API route by creating a public `leaderboard` table.

---

This guide covers creating a REST route you can query using `cURL` or the browser by creating a database table called `leaderboard` to hold player scores. This creates a corresponding API route `/rest/v1/leaderboard` which can accept `GET`, `POST`, `PATCH`, and `DELETE` requests.

1

Set up a Supabase project with a 'leaderboard' table

[Create a new project](</dashboard/_>) in the Supabase Dashboard.

After your project is ready, create a table in your Supabase database. You can do this with either the [Table Editor](</dashboard/project/_/editor>) or the [SQL Editor](</dashboard/project/_/sql>).

SQLDashboard
[code]
    1
    
    -- Create a "leaderboard" table to store
    
    2
    
    -- player names and their scores.
    
    3
    
    create table leaderboard (
    
    4
    
      id serial primary key,
    
    5
    
      player text not null,
    
    6
    
      score integer not null default 0,
    
    7
    
      created_at timestamptz default now()
    
    8
    
    );
[/code]

2

Enable Data API access to Anon Role

Expose the `leaderboard` table through the Data API so it can be queried over HTTP. A leaderboard is meant to be public, so anonymous clients only need read access.

For more control over which tables and functions are exposed, read the [Grant access explicitly guide](</docs/guides/api/securing-your-api#grant-access-explicitly>).

SQLDashboard
[code]
    1
    
    -- Allow read-only access for anonymous clients
    
    2
    
    grant select on public.leaderboard to anon;
[/code]

3

Configure RLS

Enable Row Level Security (RLS) for this table and create the policies that control who can read and write rows. For a leaderboard, anyone should be able to read scores. Only authenticated users should be able to submit or update them.
[code]
    1
    
    -- Turn on RLS
    
    2
    
    alter table "leaderboard"
    
    3
    
    enable row level security;
    
    4
    
    5
    
    -- Anyone can read the leaderboard
    
    6
    
    create policy "Leaderboard is public"
    
    7
    
      on leaderboard
    
    8
    
      for select
    
    9
    
      to anon, authenticated
    
    10
    
      using (true);
    
    11
    
    12
    
    -- Authenticated users can submit and update scores
    
    13
    
    create policy "Authenticated users can submit scores"
    
    14
    
      on leaderboard
    
    15
    
      for insert
    
    16
    
      to authenticated
    
    17
    
      with check (true);
    
    18
    
    19
    
    create policy "Authenticated users can update scores"
    
    20
    
      on leaderboard
    
    21
    
      for update
    
    22
    
      to authenticated
    
    23
    
      using (true)
    
    24
    
      with check (true);
[/code]

4

Enable Data API access for authenticated and service roles

With RLS setup, grant write access to the `authenticated` and `service_role` roles.
[code]
    1
    
    -- Grant write access only after RLS and policies are in place
    
    2
    
    grant select, insert, update, delete on public.leaderboard to authenticated;
    
    3
    
    grant select, insert, update, delete on public.leaderboard to service_role;
[/code]

5

Insert some dummy data

Now add some scores to the table so the API has something to query.
[code]
    1
    
    insert into leaderboard (player, score)
    
    2
    
    values
    
    3
    
      ('alice', 4200),
    
    4
    
      ('bob', 3700),
    
    5
    
      ('carol', 5100),
    
    6
    
      ('dave', 2900);
[/code]

6

Fetch the data

You can find your API URL and Keys in the [**Settings > API Settings**](</dashboard/project/_/settings/api>) section of the Dashboard. Query the `leaderboard` table by appending `/rest/v1/leaderboard` to the API URL.

Copy this block of code, substitute `<PROJECT_REF>` and `<PUBLISHABLE_KEY>`, then run it from a terminal.
[code]
    1
    
    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/leaderboard?select=*&order=score.desc' \
    
    2
    
    -H "apikey: <PUBLISHABLE_KEY>"
[/code]

## Bonus#

There are several options for accessing your data:

### Browser#

You can query the route in your browser, by appending the `publishable` key as a query parameter:

`https://<PROJECT_REF>.supabase.co/rest/v1/leaderboard?apikey=<PUBLISHABLE_KEY>`

### Curl#
[code] 
    1
    
    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/leaderboard?select=*&order=score.desc' \
    
    2
    
      -H "apikey: <PUBLISHABLE_KEY>" \
[/code]

### Client libraries#

We provide a number of [Client Libraries](<https://github.com/supabase/supabase#client-libraries>).

JavaScriptDartPythonSwift
[code]
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('leaderboard')
    
    3
    
      .select()
    
    4
    
      .order('score', { ascending: false })
[/code]