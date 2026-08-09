---
タイトル: pg_net: Async Networking
URL: https://supabase.com/docs/guides/database/extensions/pg_net
カテゴリ: database
更新日: 2026-08-02
タグ: async, database, extensions, networking, pg_net
---

# pg_net: Async Networking

**URL:** https://supabase.com/docs/guides/database/extensions/pg_net
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** async, database, extensions, networking, pg_net

## 目次

- [Enable the extension#](#enable-the-extension)
- [http_get#](#httpget)
  - [Signature#](#get-signature)
  - [Usage#](#get-usage)
- [http_post#](#httppost)
  - [Signature#](#post-signature)
  - [Usage#](#post-usage)
- [http_delete#](#httpdelete)
  - [Signature#](#post-signature)
  - [Usage#](#delete-usage)
- [Analyzing responses#](#analyzing-responses)
- [Debugging requests#](#debugging-requests)
  - [Inspecting request data#](#inspecting-request-data)
  - [Inspecting failed requests#](#inspecting-failed-requests)
- [Configuration#](#configuration)
  - [Get current settings#](#get-current-settings)
  - [Alter settings#](#alter-settings)
- [Examples#](#examples)
  - [Invoke a Supabase Edge Function#](#invoke-a-supabase-edge-function)
  - [Call an endpoint every minute withpg_cron#](#call-an-endpoint-every-minute-with-pgcron)
  - [Execute pg_net in a trigger#](#execute-pgnet-in-a-trigger)
  - [Send multiple table rows in one request#](#send-multiple-table-rows-in-one-request)
- [Limitations#](#limitations)
- [Resources#](#resources)

## 概要

pg_net: an async networking extension for Postgres.

---

The pg_net API is in beta. Functions signatures may change.

[pg_net](<https://github.com/supabase/pg_net/>) enables Postgres to make asynchronous HTTP/HTTPS requests in SQL. It differs from the [`http`](</docs/guides/database/extensions/http>) extension in that it is asynchronous by default. This makes it useful in blocking functions (like triggers).

It eliminates the need for servers to continuously poll for database changes and instead allows the database to proactively notify external resources about significant events.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "pg_net" and enable the extension.


## `http_get`#

Creates an HTTP GET request returning the request's ID. HTTP requests are not started until the transaction is committed.

### Signature #

This is a Postgres [SECURITY DEFINER](</docs/guides/database/postgres/row-level-security#use-security-definer-functions>) function.
[code] 
    1
    
    net.http_get(
    
    2
    
        -- url for the request
    
    3
    
        url text,
    
    4
    
        -- key/value pairs to be url encoded and appended to the `url`
    
    5
    
        params jsonb default '{}'::jsonb,
    
    6
    
        -- key/values to be included in request headers
    
    7
    
        headers jsonb default '{}'::jsonb,
    
    8
    
        -- the maximum number of milliseconds the request may take before being canceled
    
    9
    
        timeout_milliseconds int default 2000
    
    10
    
    )
    
    11
    
        -- request_id reference
    
    12
    
        returns bigint
    
    13
    
    14
    
        strict
    
    15
    
        volatile
    
    16
    
        parallel safe
    
    17
    
        language plpgsql
[/code]

### Usage #
[code] 
    1
    
    select
    
    2
    
        net.http_get('https://news.ycombinator.com')
    
    3
    
        as request_id;
    
    4
    
    request_id
    
    5
    
    ----------
    
    6
    
             1
    
    7
    
    (1 row)
[/code]

## `http_post`#

Creates an HTTP POST request with a JSON body, returning the request's ID. HTTP requests are not started until the transaction is committed.

The body's character set encoding matches the database's `server_encoding` setting.

### Signature #

This is a Postgres [SECURITY DEFINER](</docs/guides/database/postgres/row-level-security#use-security-definer-functions>) function
[code] 
    1
    
    net.http_post(
    
    2
    
        -- url for the request
    
    3
    
        url text,
    
    4
    
        -- body of the POST request
    
    5
    
        body jsonb default '{}'::jsonb,
    
    6
    
        -- key/value pairs to be url encoded and appended to the `url`
    
    7
    
        params jsonb default '{}'::jsonb,
    
    8
    
        -- key/values to be included in request headers
    
    9
    
        headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
    
    10
    
        -- the maximum number of milliseconds the request may take before being canceled
    
    11
    
        timeout_milliseconds int default 2000
    
    12
    
    )
    
    13
    
        -- request_id reference
    
    14
    
        returns bigint
    
    15
    
    16
    
        volatile
    
    17
    
        parallel safe
    
    18
    
        language plpgsql
[/code]

### Usage #
[code] 
    1
    
    select
    
    2
    
        net.http_post(
    
    3
    
            url:='https://httpbin.org/post',
    
    4
    
            body:='{"hello": "world"}'::jsonb
    
    5
    
        ) as request_id;
    
    6
    
    request_id
    
    7
    
    ----------
    
    8
    
             1
    
    9
    
    (1 row)
[/code]

## `http_delete`#

Creates an HTTP DELETE request, returning the request's ID. HTTP requests are not started until the transaction is committed.

### Signature #

This is a Postgres [SECURITY DEFINER](</docs/guides/database/postgres/row-level-security#use-security-definer-functions>) function
[code] 
    1
    
    net.http_delete(
    
    2
    
        -- url for the request
    
    3
    
        url text,
    
    4
    
        -- key/value pairs to be url encoded and appended to the `url`
    
    5
    
        params jsonb default '{}'::jsonb,
    
    6
    
        -- key/values to be included in request headers
    
    7
    
        headers jsonb default '{}'::jsonb,
    
    8
    
        -- the maximum number of milliseconds the request may take before being canceled
    
    9
    
        timeout_milliseconds int default 2000
    
    10
    
    )
    
    11
    
        -- request_id reference
    
    12
    
        returns bigint
    
    13
    
    14
    
        strict
    
    15
    
        volatile
    
    16
    
        parallel safe
    
    17
    
        language plpgsql
    
    18
    
        security definer
[/code]

### Usage #
[code] 
    1
    
    select
    
    2
    
        net.http_delete(
    
    3
    
            'https://dummy.restapiexample.com/api/v1/delete/2'
    
    4
    
        ) as request_id;
    
    5
    
    ----------
    
    6
    
             1
    
    7
    
    (1 row)
[/code]

## Analyzing responses#

Waiting requests are stored in the `net.http_request_queue` table. Upon execution, they are deleted.
[code] 
    1
    
    CREATE UNLOGGED TABLE
    
    2
    
        net.http_request_queue (
    
    3
    
            id bigint NOT NULL DEFAULT nextval('net.http_request_queue_id_seq'::regclass),
    
    4
    
            method text NOT NULL,
    
    5
    
            url text NOT NULL,
    
    6
    
            headers jsonb NOT NULL,
    
    7
    
            body bytea NULL,
    
    8
    
            timeout_milliseconds integer NOT NULL
    
    9
    
        )
[/code]

Once a response is returned, by default, it is stored for 6 hours in the `net._http_response` table.
[code] 
    1
    
    CREATE UNLOGGED TABLE
    
    2
    
        net._http_response (
    
    3
    
            id bigint NULL,
    
    4
    
            status_code integer NULL,
    
    5
    
            content_type text NULL,
    
    6
    
            headers jsonb NULL,
    
    7
    
            content text NULL,
    
    8
    
            timed_out boolean NULL,
    
    9
    
            error_msg text NULL,
    
    10
    
            created timestamp with time zone NOT NULL DEFAULT now()
    
    11
    
        )
[/code]

The responses can be observed with the following query:
[code] 
    1
    
    select * from net._http_response;
[/code]

The data can also be observed in the `net` schema with the [Supabase Dashboard's SQL Editor](</dashboard/project/_/editor>)

## Debugging requests#

### Inspecting request data#

The [Postman Echo API](<https://documenter.getpostman.com/view/5025623/SWTG5aqV>) returns a response with the same body and content as the request. It can be used to inspect the data being sent.

Sending a post request to the echo API
[code] 
    1
    
    select
    
    2
    
        net.http_post(
    
    3
    
            url := 'https://postman-echo.com/post',
    
    4
    
            body := '{"key1": "value", "key2": 5}'::jsonb
    
    5
    
        ) as request_id;
[/code]

Inspecting the echo API response content to ensure it contains the right body
[code] 
    1
    
    select
    
    2
    
        "content"
    
    3
    
    from net._http_response
    
    4
    
    where id = <request_id>
    
    5
    
    -- returns information about the request
    
    6
    
    -- including the body sent: {"key": "value", "key": 5}
[/code]

Alternatively, by wrapping a request in a [database function](</docs/guides/database/functions>), sent row data can be logged or returned for inspection and debugging.
[code] 
    1
    
    create or replace function debugging_example (row_id int)
    
    2
    
    returns jsonb as $$
    
    3
    
    declare
    
    4
    
        -- Store payload data
    
    5
    
        row_data_var jsonb;
    
    6
    
    begin
    
    7
    
        -- Retrieve row data and convert to JSON
    
    8
    
        select to_jsonb("<example_table>".*) into row_data_var
    
    9
    
        from "<example_table>"
    
    10
    
        where "<example_table>".id = row_id;
    
    11
    
    12
    
        -- Initiate HTTP POST request to URL
    
    13
    
        perform
    
    14
    
            net.http_post(
    
    15
    
                url := 'https://postman-echo.com/post',
    
    16
    
                -- Use row data as payload
    
    17
    
                body := row_data_var
    
    18
    
            ) as request_id;
    
    19
    
    20
    
        -- Optionally Log row data or other data for inspection in Supabase Dashboard's Postgres Logs
    
    21
    
        raise log 'Logging an entire row as JSON (%)', row_data_var;
    
    22
    
    23
    
        -- return row data to inspect
    
    24
    
        return row_data_var;
    
    25
    
    26
    
    -- Handle exceptions here if needed
    
    27
    
    exception
    
    28
    
        when others then
    
    29
    
            raise exception 'An error occurred: %', SQLERRM;
    
    30
    
    end;
    
    31
    
    $$ language plpgsql;
    
    32
    
    33
    
    -- calling function
    
    34
    
    select debugging_example(<row_id>);
[/code]

### Inspecting failed requests#

Finds all failed requests
[code] 
    1
    
    select
    
    2
    
      *
    
    3
    
    from net._http_response
    
    4
    
    where "status_code" >= 400 or "error_msg" is not null
    
    5
    
    order by "created" desc;
[/code]

## Configuration#

Must be on pg_net v0.12.0 or above to reconfigure 

Supabase supports reconfiguring pg*net starting from v0.12.0+. For the latest release, initiate a Postgres upgrade in the [Infrastructure Settings](</dashboard/project/*/settings/infrastructure>).

The extension is configured to reliably execute up to 200 requests per second. The response messages are stored for only 6 hours to prevent needless buildup. The default behavior can be modified by rewriting config variables.

### Get current settings#
[code] 
    1
    
    select
    
    2
    
      "name",
    
    3
    
      "setting"
    
    4
    
    from pg_settings
    
    5
    
    where "name" like 'pg_net%';
[/code]

### Alter settings#

You must change the `pg_net` settings at the system level.

Changing these settings requires superuser privileges. Contact Support to have the required permission granted for the parameter you want to change, e.g.:
[code]
    1
    
    grant alter system on parameter pg_net.ttl to postgres;
[/code]

Once the privilege is assigned, apply the setting at the system level and restart the background worker:
[code] 
    1
    
    alter system set pg_net.ttl to '24 hours';
    
    2
    
    select net.worker_restart();
[/code]

## Examples#

### Invoke a Supabase Edge Function#

Make a POST request to a Supabase Edge Function with auth header and JSON body payload:
[code] 
    1
    
    select
    
    2
    
        net.http_post(
    
    3
    
            url:='https://project-ref.supabase.co/functions/v1/function-name',
    
    4
    
            headers:='{"Content-Type": "application/json", "apikey": "<SUPABASE_PUBLISHABLE_KEY>"}'::jsonb,
    
    5
    
            body:='{"name": "pg_net"}'::jsonb
    
    6
    
        ) as request_id;
[/code]

### Call an endpoint every minute with [pg_cron](</docs/guides/database/extensions/pg_cron>)#

The pg_cron extension enables Postgres to become its own cron server. With it you can schedule regular calls with up to a minute precision to endpoints.
[code] 
    1
    
    select cron.schedule(
    
    2
    
    	'cron-job-name',
    
    3
    
    	'* * * * *', -- Executes every minute (cron syntax)
    
    4
    
    	$$
    
    5
    
    	    -- SQL query
    
    6
    
    	    select "net"."http_post"(
    
    7
    
                -- URL of Edge function
    
    8
    
                url:='https://project-ref.supabase.co/functions/v1/function-name',
    
    9
    
                headers:='{"apikey": "<SUPABASE_PUBLISHABLE_KEY>"}'::jsonb,
    
    10
    
                body:='{"name": "pg_net"}'::jsonb
    
    11
    
    	    ) as "request_id";
    
    12
    
    	$$
    
    13
    
    );
[/code]

### Execute pg_net in a trigger#

Make a call to an external endpoint when a trigger event occurs.
[code] 
    1
    
    -- function called by trigger
    
    2
    
    create or replace function <function_name>()
    
    3
    
        returns trigger
    
    4
    
        language plpgSQL
    
    5
    
    as $$
    
    6
    
    begin
    
    7
    
        -- calls pg_net function net.http_post
    
    8
    
        -- sends request to postman API
    
    9
    
        perform "net"."http_post"(
    
    10
    
          'https://postman-echo.com/post'::text,
    
    11
    
          jsonb_build_object(
    
    12
    
            'old_row', to_jsonb(old.*),
    
    13
    
            'new_row', to_jsonb(new.*)
    
    14
    
          ),
    
    15
    
          headers:='{"Content-Type": "application/json"}'::jsonb
    
    16
    
        ) as request_id;
    
    17
    
        return new;
    
    18
    
    END $$;
    
    19
    
    20
    
    -- trigger for table update
    
    21
    
    create trigger <trigger_name>
    
    22
    
        after update on <table_name>
    
    23
    
        for each row
    
    24
    
        execute function <function_name>();
[/code]

### Send multiple table rows in one request#
[code] 
    1
    
    with "selected_table_rows" as (
    
    2
    
        select
    
    3
    
            -- Converts all the rows into a JSONB array
    
    4
    
            jsonb_agg(to_jsonb(<table_name>.*)) as JSON_payload
    
    5
    
        from <table_name>
    
    6
    
        -- good practice to LIMIT the max amount of rows
    
    7
    
    )
    
    8
    
    select
    
    9
    
        net.http_post(
    
    10
    
            url := 'https://postman-echo.com/post'::text,
    
    11
    
            body := JSON_payload
    
    12
    
        ) AS request_id
    
    13
    
    FROM "selected_table_rows";
[/code]

More examples can be seen on the [Extension's GitHub page](<https://github.com/supabase/pg_net/>)

## Limitations#

  * To improve speed and performance, the requests and responses are stored in [unlogged tables](<https://pgpedia.info/u/unlogged-table.html>), which are not preserved during a crash or unclean shutdown.
  * By default, response data is saved for only 6 hours
  * Can only make POST requests with JSON data. No other data formats are supported
  * Intended to handle at most 200 requests per second. Increasing the rate can introduce instability
  * Does not have support for PATCH/PUT requests
  * Can only work with one database at a time. It defaults to the `postgres` database.


## Resources#

  * Source code: [github.com/supabase/pg_net](<https://github.com/supabase/pg_net/>)
  * Official Docs: [github.com/supabase/pg_net](<https://github.com/supabase/pg_net/>)