---
タイトル: Securing your API
URL: https://supabase.com/docs/guides/api/securing-your-api
カテゴリ: api
更新日: 2026-08-02
タグ: api, securing, securing-your-api, your
---

# Securing your API

**URL:** https://supabase.com/docs/guides/api/securing-your-api
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, securing, securing-your-api, your

## 目次

- [Understand Data API security#](#understand-data-api-security)
  - [Grants and RLS#](#grants-and-rls)
  - [Default privileges#](#default-privileges)
  - [Dedicated API schemas#](#dedicated-api-schemas)
  - [Pre-request checks#](#pre-request-checks)
  - [Request information#](#request-information)
  - [Error responses#](#error-responses)
- [Configure Data API security#](#configure-data-api-security)
  - [Grant access explicitly#](#grant-access-explicitly)
  - [Revoke default privileges#](#revoke-default-privileges)
  - [Disable the Data API#](#disable-the-data-api)
  - [Enable RLS policies#](#enable-rls-policies)
  - [Configure a pre-request function#](#configure-a-pre-request-function)
  - [Pre-request examples#](#pre-request-examples)

## 概要

Secure your Data API with explicit grants and Postgres Row Level Security.

---

This guide explains how to secure the Data API with Postgres grants, Row Level Security, dedicated schemas, and request checks.

Use the guide in two parts:

  * Understand Data API security explains how the controls work and when to use them.
  * Configure Data API security groups the procedures for applying those controls.


Read the first section when you need to choose a security approach. Go directly to the second section when you know which controls you need to configure.

## Understand Data API security#

This section provides the context for the procedures later in the guide.

### Grants and RLS#

The Data API works with two layers of Postgres access control:

  1. **Grants** determine which Postgres roles can reach a table, view, or function over the Data API. These roles include `anon`, `authenticated`, and `service_role`.
  2. **Row Level Security (RLS) policies** determine which rows those roles can read or modify.


Grants control whether a role can access an object. RLS controls which rows the role can access. Use both controls for every exposed object.

To apply these controls, see Grant access explicitly and Enable RLS policies.

### Default privileges#

On existing projects, tables created in `public` receive `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges for `anon`, `authenticated`, and `service_role` by default. Functions receive `EXECUTE`. These grants make new objects reachable through the Data API, even when you don't intend to expose them.

Supabase is changing the platform default to revoke these automatic grants so that exposure becomes opt-in. See [the platform defaults discussion](<https://github.com/orgs/supabase/discussions/45329>) in the Supabase GitHub discussions.

The default privileges are part of the standard Supabase permission model and don't bypass RLS. The internal `supabase_admin` role grants them to `anon`, `authenticated`, and `service_role`, but it can't authenticate through the Data API. See [`pg_default_acl`](<https://www.postgresql.org/docs/current/catalog-pg-default-acl.html>) in the Postgres documentation and [`supabase_admin`](</docs/guides/database/postgres/roles#supabaseadmin>) in the Supabase documentation.

To prevent automatic grants on new objects, see Revoke default privileges.

### Dedicated API schemas#

A dedicated schema adds another boundary around your Data API. Objects in a schema such as `api` define the API surface. Internal tables and helper functions remain in schemas that aren't exposed.

You can control access with grants in any schema. A dedicated schema makes the exposed surface easier to identify and audit. See [Using Custom Schemas](</docs/guides/api/using-custom-schemas>) for setup steps.

### Pre-request checks#

RLS policies don't cover every API security requirement. Add pre-request checks for requirements such as:

  * Enforcing per-IP or per-user rate limits.
  * Checking custom or additional API keys before allowing further access.
  * Rejecting requests after exceeding a quota or requiring payment.
  * Disallowing direct access to certain tables, views, or functions in exposed schemas.


A Postgres pre-request function reads request information and performs these checks before serving a response. For example, the function can count requests or verify an API key.

To add a check, see Configure a pre-request function.

The `pgrst.db_pre_request` configuration only works with the **Data API** (PostgREST). It does not work with Realtime, Storage, or other Supabase products.

If you're using `db_pre_request` to call a function (like `set_information()`) that sets up context or performs checks on every request, and you need similar behavior for other Supabase products, you must call the function directly in your Row Level Security (RLS) policies instead.

**Example:**

If you have a `db_pre_request` function that calls `set_information()` that returns `true` to set up context or perform checks, and you have an RLS policy like:
[code]
    1
    
    create policy "Individuals can view their own todos."
    
    2
    
    on todos for select
    
    3
    
    using ( (select auth.uid()) = user_id );
[/code]

To achieve the same behavior with other Supabase products, you need to call the function directly in your RLS policy:
[code]
    1
    
    create policy "Individuals can view their own todos."
    
    2
    
    on todos for select
    
    3
    
    using ( set_information() AND (select auth.uid()) = user_id );
[/code]

This ensures the function is called when evaluating RLS policies for all products, not only Data API requests.

**Performance consideration:**

Be aware that calling functions directly in RLS policies can impact database performance, as the function is evaluated for each row when the policy is checked. Consider optimizing your function or using caching strategies if performance becomes an issue.

### Request information#

Use the Postgres `current_setting()` function to access request information:
[code] 
    1
    
    -- Get all headers sent in the request
    
    2
    
    select current_setting('request.headers', true)::json;
    
    3
    
    4
    
    -- Get one header with a JSON arrow operator
    
    5
    
    select current_setting('request.headers', true)::json->>'user-agent';
    
    6
    
    7
    
    -- Get cookies
    
    8
    
    select current_setting('request.cookies', true)::json;
[/code]

`current_setting()`| Example| Description  
---|---|---  
`request.method`| `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`| Request's method  
`request.path`| `table`| Table's path  
`request.path`| `view`| View's path  
`request.path`| `rpc/function`| Function's path  
`request.headers`| `{ "User-Agent": "...", ... }`| JSON object of the request's headers  
`request.cookies`| `{ "cookieA": "...", "cookieB": "..." }`| JSON object of the request's cookies  
`request.jwt`| `{ "sub": "a7194ea3-...", ... }`| JSON object of the JWT payload  
  
To access the client's IP address, look up the `X-Forwarded-For` header in the `request.headers` setting:
[code] 
    1
    
    select split_part(
    
    2
    
      current_setting('request.headers', true)::json->>'x-forwarded-for',
    
    3
    
      ',', 1); -- takes the client IP before the first comma
[/code]

See [Pre-request](<https://postgrest.org/en/stable/references/transactions.html#pre-request>) in the PostgREST documentation and [X-Forwarded-For](<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For>) in the MDN documentation.

For complete implementations that use this request information, see Pre-request examples.

### Error responses#

A pre-request function can raise an exception to stop a request. This example returns an HTTP 402 Payment Required response with a `hint` and an `X-Powered-By` header:
[code] 
    1
    
    raise sqlstate 'PGRST' using
    
    2
    
      message = json_build_object(
    
    3
    
        'code',    '123',
    
    4
    
        'message', 'Payment Required',
    
    5
    
        'details', 'Quota exceeded',
    
    6
    
        'hint',    'Upgrade your plan')::text,
    
    7
    
      detail = json_build_object(
    
    8
    
        'status',  402,
    
    9
    
        'headers', json_build_object(
    
    10
    
          'X-Powered-By', 'Nerd Rage'))::text;
[/code]

The exception produces this HTTP response:
[code] 
    1
    
    HTTP/1.1 402 Payment Required
    
    2
    
    Content-Type: application/json; charset=utf-8
    
    3
    
    X-Powered-By: Nerd Rage
    
    4
    
    5
    
    {
    
    6
    
      "message": "Payment Required",
    
    7
    
      "details": "Quota exceeded",
    
    8
    
      "hint": "Upgrade your plan",
    
    9
    
      "code": "123"
    
    10
    
    }
[/code]

Use JSON functions and operators to build dynamic responses from exceptions. Include the `status_text` key in the `detail` clause when you use a custom HTTP status code such as 419. See [JSON Functions and Operators](<https://www.postgresql.org/docs/current/functions-json.html>) in the Postgres documentation.

For PostgREST 11 or earlier, use the legacy syntax for raising errors. [Check your PostgREST version](</dashboard/project/_/settings/infrastructure>) in the Dashboard. See [Raise errors with HTTP status codes](<https://postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes>) in the PostgREST documentation.

## Configure Data API security#

This section groups the procedures for configuring each security control. Apply the procedures that match your architecture.

### Grant access explicitly#

A table isn't reachable through the Data API unless you have granted a role privileges on it. Grant the minimum privileges each role needs. For example:
[code] 
    1
    
    -- Read-only access for anonymous clients
    
    2
    
    grant select on table public.your_table to anon;
    
    3
    
    4
    
    -- Full access for signed-in users; RLS still applies
    
    5
    
    grant select, insert, update, delete on table public.your_table to authenticated;
    
    6
    
    7
    
    -- Full access for server-side code using the service role
    
    8
    
    grant select, insert, update, delete on table public.your_table to service_role;
    
    9
    
    10
    
    -- For functions, grant EXECUTE to the roles that should call them
    
    11
    
    grant execute on function public.your_function() to anon, authenticated;
[/code]

If a required grant is missing, PostgREST returns a `42501` error with a hint that names the exact `GRANT` statement you need:
[code] 
    1
    
    {
    
    2
    
      "code": "42501",
    
    3
    
      "message": "permission denied for table your_table",
    
    4
    
      "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.your_table TO anon;"
    
    5
    
    }
[/code]

See [Database API 42501 errors](</docs/guides/troubleshooting/database-api-42501-errors>) for the full troubleshooting flow.

**Migration:** Bundle grants with your RLS setup in the same migration. The `grant` command controls role access. The `enable row level security` command and policies control row access.

### Revoke default privileges#

Revoke automatic grants when you want new objects in `public` to remain inaccessible until you grant access:

  1. Open the [SQL Editor](</dashboard/project/_/sql/new>).

  2. Run the following statements:
[code] 1
         
         alter default privileges for role postgres in schema public
         
         2
         
           revoke select, insert, update, delete on tables from anon, authenticated, service_role;
         
         3
         
         4
         
         alter default privileges for role postgres in schema public
         
         5
         
           revoke execute on functions from anon, authenticated, service_role;
         
         6
         
         7
         
         alter default privileges for role postgres in schema public
         
         8
         
           revoke usage, select on sequences from anon, authenticated, service_role;
         
         9
         
         10
         
         alter default privileges for role postgres in schema public
         
         11
         
           revoke execute on functions from public;
[/code]


New tables, functions, and sequences now require explicit grants before Data API roles can access them.

### Disable the Data API#

If your app never uses Supabase client libraries, REST, or GraphQL data endpoints, turn the Data API off:

  1. Open the [Data API integration overview](</dashboard/project/_/integrations/data_api/overview>) in the Dashboard.
  2. Turn **Enable Data API** off.


With the Data API disabled, none of the auto-generated REST endpoints respond, regardless of grants or RLS.

### Enable RLS policies#

Tables and views exposed through the Data API without RLS can be accessed by any role with matching grants. Enable RLS or add equivalent controls to prevent unauthorized access. RLS doesn't apply to functions, so grant `EXECUTE` only to the roles that need to call them. Review every `SECURITY DEFINER` function carefully.

Enable RLS on every table and view exposed through the Data API. You can then write policies that grant users access to specific rows based on their authentication token.

Tables created through the Supabase Dashboard have RLS enabled by default. Enable RLS explicitly for tables created in the SQL Editor or through another tool:

DashboardSQL

  1. Go to the [Database > Policies](</dashboard/project/_/database/policies>) page in the Dashboard.
  2. Select **Enable RLS** to enable Row Level Security.


With RLS enabled, create policies that control which data users can access and update. See [Row Level Security](</docs/guides/database/postgres/row-level-security>).

### Configure a pre-request function#

Create and register a Postgres function to run checks before each Data API request:

Before adding the check logic, review Request information and Error responses.

  1. Create a pre-request function:
[code] 1
         
         create function public.check_request()
         
         2
         
           returns void
         
         3
         
           language plpgsql
         
         4
         
           security definer
         
         5
         
           as $$
         
         6
         
         begin
         
         7
         
           -- your logic here
         
         8
         
         end;
         
         9
         
         $$;
[/code]

  2. Register the function to run on every Data API request:
[code] 1
         
         alter role authenticator
         
         2
         
           set pgrst.db_pre_request = 'public.check_request';
[/code]

  3. Reload the PostgREST configuration:
[code] 1
         
         notify pgrst, 'reload config';
[/code]


The function now runs before every Data API request. Add the checks that match your security requirements.

### Pre-request examples#

Use these examples after you configure the pre-request function. Each example replaces the placeholder logic with a complete request check.

Rate limit per IPUse additional API keys

You can only rate-limit `POST`, `PUT`, `PATCH`, and `DELETE` requests. `GET` and `HEAD` requests run in read-only mode. They can be served by [Read Replicas](</docs/guides/platform/read-replicas>), which don't support writing to the database.

**Outcome:**

  * The `private.rate_limits` table records the IP address and timestamp of each write request.
  * The function rejects requests with an HTTP 420 response when an IP address makes more than 100 write requests in 5 minutes.


**Create the table:**
[code]
     1
    
    create table private.rate_limits (
    
    2
    
      ip inet,
    
    3
    
      request_at timestamp
    
    4
    
    );
    
    5
    
    6
    
    -- add an index so that lookups are fast
    
    7
    
    create index rate_limits_ip_request_at_idx on private.rate_limits (ip, request_at desc);
[/code]

The `private` schema prevents Data API access to the rate-limit records.

**Create the request check:** Create the `public.check_request` function:
[code]
    1
    
    create function public.check_request()
    
    2
    
      returns void
    
    3
    
      language plpgsql
    
    4
    
      security definer
    
    5
    
      as $$
    
    6
    
    declare
    
    7
    
      req_method text := current_setting('request.method', true);
    
    8
    
      req_ip inet := split_part(
    
    9
    
        current_setting('request.headers', true)::json->>'x-forwarded-for',
    
    10
    
        ',', 1)::inet;
    
    11
    
      count_in_five_mins integer;
    
    12
    
    begin
    
    13
    
      if req_method = 'GET' or req_method = 'HEAD' or req_method is null then
    
    14
    
        -- rate limiting can't be done on GET and HEAD requests
    
    15
    
        return;
    
    16
    
      end if;
    
    17
    
    18
    
      select
    
    19
    
        count(*) into count_in_five_mins
    
    20
    
      from private.rate_limits
    
    21
    
      where
    
    22
    
        ip = req_ip and request_at between now() - interval '5 minutes' and now();
    
    23
    
    24
    
      if count_in_five_mins > 100 then
    
    25
    
        raise sqlstate 'PGRST' using
    
    26
    
          message = json_build_object(
    
    27
    
            'message', 'Rate limit exceeded, try again after a while')::text,
    
    28
    
          detail = json_build_object(
    
    29
    
            'status',  420,
    
    30
    
            'status_text', 'Enhance Your Calm')::text;
    
    31
    
      end if;
    
    32
    
    33
    
      insert into private.rate_limits (ip, request_at) values (req_ip, now());
    
    34
    
    end;
    
    35
    
      $$;
[/code]

**Register the request check:** Configure the `public.check_request()` function to run on every Data API request:
[code]
    1
    
    alter role authenticator
    
    2
    
      set pgrst.db_pre_request = 'public.check_request';
    
    3
    
    4
    
    notify pgrst, 'reload config';
[/code]

**Clean up old records:** Set up a [`pg_cron`](</docs/guides/database/extensions/pg_cron>) job to delete old entries from `private.rate_limits`.