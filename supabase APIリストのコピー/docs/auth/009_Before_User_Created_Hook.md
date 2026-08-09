---
タイトル: Before User Created Hook
URL: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-hooks, before, before-user-created-hook, created, hook, user
---

# Before User Created Hook

**URL:** https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-hooks, before, before-user-created-hook, created, hook, user

## 目次

- [Inputs#](#inputs)
- [Outputs#](#outputs)
  - [Allow the signup#](#allow-the-signup)
  - [Reject the signup with an error#](#reject-the-signup-with-an-error)
- [Examples#](#examples)

## 概要

Prevent unwanted signups by inspecting and rejecting user creation requests

---

This hook runs before a new user is created. It allows developers to inspect the incoming user object and optionally reject the request. Use this to enforce custom signup policies that Supabase Auth does not handle natively - such as blocking disposable email domains, restricting access by region or IP, or requiring that users belong to a specific email domain.

You can implement this hook using an HTTP endpoint or a Postgres function. If the hook returns an error object, the signup is denied and the user is not created. If the hook responds successfully (HTTP 200 or 204 with no error), the request proceeds as usual. This gives you full control over which users are allowed to register — and the flexibility to apply that logic server-side.

## Inputs#

Supabase Auth will send a payload containing these fields to your hook:

Field| Type| Description  
---|---|---  
`metadata`| `object`| Metadata about the request. Includes IP address, request ID, and hook type.  
`user`| `object`| The user record that is about to be created. Matches the shape of the `auth.users` table.  
  
Because the hook runs immediately before insertion into the database, this user will not be found in Postgres at the time the hook is called.

JSONJSON Schema
[code]
    1
    
    {
    
    2
    
      "metadata": {
    
    3
    
        "uuid": "8b34dcdd-9df1-4c10-850a-b3277c653040",
    
    4
    
        "time": "2025-04-29T13:13:24.755552-07:00",
    
    5
    
        "name": "before-user-created",
    
    6
    
        "ip_address": "127.0.0.1"
    
    7
    
      },
    
    8
    
      "user": {
    
    9
    
        "id": "ff7fc9ae-3b1b-4642-9241-64adb9848a03",
    
    10
    
        "aud": "authenticated",
    
    11
    
        "role": "",
    
    12
    
        "email": "valid.email@supabase.com",
    
    13
    
        "phone": "",
    
    14
    
        "app_metadata": {
    
    15
    
          "provider": "email",
    
    16
    
          "providers": ["email"]
    
    17
    
        },
    
    18
    
        "user_metadata": {},
    
    19
    
        "identities": [],
    
    20
    
        "created_at": "0001-01-01T00:00:00Z",
    
    21
    
        "updated_at": "0001-01-01T00:00:00Z",
    
    22
    
        "is_anonymous": false
    
    23
    
      }
    
    24
    
    }
[/code]

## Outputs#

Your hook must return a response that either allows or blocks the signup request.

Field| Type| Description  
---|---|---  
`error`| `object`| (Optional) Return this to reject the signup. Includes a code, message, and optional HTTP status code.  
  
Returning an empty object with a `200` or `204` status code allows the request to proceed. Returning a JSON response with an `error` object and a `4xx` status code blocks the request and propagates the error message to the client. See the [error handling documentation](</docs/guides/auth/auth-hooks#error-handling>) for more details.

### Allow the signup#
[code] 
    1
    
    {}
[/code]

or with a `204 No Content` response:
[code] 
    1
    
    HTTP/1.1 204 No Content
[/code]

### Reject the signup with an error#
[code] 
    1
    
    {
    
    2
    
      "error": {
    
    3
    
        "http_code": 400,
    
    4
    
        "message": "Only company emails are allowed to sign up."
    
    5
    
      }
    
    6
    
    }
[/code]

This response will block the user creation and return the error message to the client that attempted signup.

## Examples#

Each of the following examples shows how to use the `before-user-created` hook to control signup behavior. Each use case includes both an HTTP implementation (e.g. using an Edge Function) and a SQL implementation (Postgres function).

SQLHTTP

Allow by DomainBlock by OAuth ProviderAllow/Deny by IP or CIDR

Allow signups only from specific domains like supabase.com or example.test. Reject all others. This is useful for private/internal apps, enterprise gating, or invite-only beta access.

The `before-user-created` hook solves this by:

  * Detecting that a user is about to be created
  * Providing the email address in the `user.email` field


Run the following snippet in your project's [SQL Editor](</dashboard/project/_/sql/new>). This will create a `signup_email_domains` table with some sample data and a `hook_restrict_signup_by_email_domain` function to be called by the `before-user-created` auth hook.
[code]
    1
    
    -- Create ENUM type for domain rule classification
    
    2
    
    do $$ begin
    
    3
    
      create type signup_email_domain_type as enum ('allow', 'deny');
    
    4
    
    exception
    
    5
    
      when duplicate_object then null;
    
    6
    
    end $$;
    
    7
    
    8
    
    -- Create the signup_email_domains table
    
    9
    
    create table if not exists public.signup_email_domains (
    
    10
    
      id serial primary key,
    
    11
    
      domain text not null,
    
    12
    
      type signup_email_domain_type not null,
    
    13
    
      reason text default null,
    
    14
    
      created_at timestamptz not null default now(),
    
    15
    
      updated_at timestamptz not null default now()
    
    16
    
    );
    
    17
    
    18
    
    -- Create a trigger to maintain updated_at
    
    19
    
    create or replace function update_signup_email_domains_updated_at()
    
    20
    
    returns trigger as $$
    
    21
    
    begin
    
    22
    
      new.updated_at = now();
    
    23
    
      return new;
    
    24
    
    end;
    
    25
    
    $$ language plpgsql;
    
    26
    
    27
    
    drop trigger if exists trg_signup_email_domains_set_updated_at on public.signup_email_domains;
    
    28
    
    29
    
    create trigger trg_signup_email_domains_set_updated_at
    
    30
    
    before update on public.signup_email_domains
    
    31
    
    for each row
    
    32
    
    execute procedure update_signup_email_domains_updated_at();
    
    33
    
    34
    
    -- Seed example data
    
    35
    
    insert into public.signup_email_domains (domain, type, reason) values
    
    36
    
      ('supabase.com', 'allow', 'Internal signups'),
    
    37
    
      ('gmail.com', 'deny', 'Public email provider'),
    
    38
    
      ('yahoo.com', 'deny', 'Public email provider');
    
    39
    
    40
    
    -- Create the function
    
    41
    
    create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
    
    42
    
    returns jsonb
    
    43
    
    language plpgsql
    
    44
    
    as $$
    
    45
    
    declare
    
    46
    
      email text;
    
    47
    
      domain text;
    
    48
    
      is_allowed int;
    
    49
    
      is_denied int;
    
    50
    
    begin
    
    51
    
      email := event->'user'->>'email';
    
    52
    
      domain := split_part(email, '@', 2);
    
    53
    
    54
    
      -- Check for allow match
    
    55
    
      select count(*) into is_allowed
    
    56
    
      from public.signup_email_domains
    
    57
    
      where type = 'allow' and lower(domain) = lower($1);
    
    58
    
    59
    
      if is_allowed > 0 then
    
    60
    
        return '{}'::jsonb;
    
    61
    
      end if;
    
    62
    
    63
    
      -- Check for deny match
    
    64
    
      select count(*) into is_denied
    
    65
    
      from public.signup_email_domains
    
    66
    
      where type = 'deny' and lower(domain) = lower($1);
    
    67
    
    68
    
      if is_denied > 0 then
    
    69
    
        return jsonb_build_object(
    
    70
    
          'error', jsonb_build_object(
    
    71
    
            'message', 'Signups from this email domain are not allowed.',
    
    72
    
            'http_code', 403
    
    73
    
          )
    
    74
    
        );
    
    75
    
      end if;
    
    76
    
    77
    
      -- No match, allow by default
    
    78
    
      return '{}'::jsonb;
    
    79
    
    end;
    
    80
    
    $$;
    
    81
    
    82
    
    -- Permissions
    
    83
    
    grant execute
    
    84
    
      on function public.hook_restrict_signup_by_email_domain
    
    85
    
      to supabase_auth_admin;
    
    86
    
    87
    
    revoke execute
    
    88
    
      on function public.hook_restrict_signup_by_email_domain
    
    89
    
      from authenticated, anon, public;
[/code]