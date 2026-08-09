---
タイトル: Advanced Log Querying and Filtering
URL: https://supabase.com/docs/guides/monitoring-and-debugging/advanced-log-filtering
カテゴリ: platform
更新日: 2026-08-02
タグ: advanced, advanced-log-filtering, filtering, monitoring-and-debugging, platform, querying
---

# Advanced Log Querying and Filtering

**URL:** https://supabase.com/docs/guides/monitoring-and-debugging/advanced-log-filtering
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** advanced, advanced-log-filtering, filtering, monitoring-and-debugging, platform, querying

## 目次

- [Timestamp display and behavior#](#timestamp-display-and-behavior)
- [Reading fields from log_attributes#](#reading-fields-from-logattributes)
- [LIMIT and result row limitations#](#limit-and-result-row-limitations)
- [Best practices#](#best-practices)
- [Examples and templates#](#examples-and-templates)
- [Understanding field references#](#understanding-field-references)
- [Expanding results#](#expanding-results)
- [Filtering withregular expressions#](#filtering-with-regular-expressions)
  - [Find messages that start with a phrase#](#find-messages-that-start-with-a-phrase)
  - [Find messages that end with a phrase#](#find-messages-that-end-with-a-phrase)
  - [Ignore case sensitivity#](#ignore-case-sensitivity)
  - [Wildcards#](#wildcards)
  - [Alphanumeric ranges#](#alphanumeric-ranges)
  - [Repeated values#](#repeated-values)
  - [Escaping reserved characters#](#escaping-reserved-characters)
  - [orstatements#](#or-statements)
  - [and/or/notstatements in SQL#](#and--or--not-statements-in-sql)
  - [Filtering example#](#filtering-example)
- [Limitations#](#limitations)
  - [The wildcard operator*is not supported#](#the-wildcard-operator--is-not-supported)

## 概要

Query and filter logs with regular expressions

---

The [Logs Explorer](</dashboard/project/_/logs-explorer>) exposes logs from each part of the Supabase stack, which you can query and filter using SQL.

![Logs Explorer](/docs/img/guides/platform/logs/logs-explorer.png)

You can access the following log sources from the **Sources** drop-down:

  * `auth_logs`: GoTrue server logs, containing authentication/authorization activity.
  * `edge_logs`: Edge network logs, containing request and response metadata retrieved from Cloudflare.
  * `function_edge_logs`: Edge network logs for only edge functions, containing network requests and response metadata for each execution.
  * `function_logs`: Function internal logs, containing any `console` logging from within the edge function.
  * `postgres_logs`: Postgres database logs, containing statements executed by connected applications.
  * `realtime_logs`: Realtime server logs, containing client connection information.
  * `storage_logs`: Storage server logs, containing object upload and retrieval information.


The Logs Explorer runs on ClickHouse. Every log line from every source is one row in a single `logs` table, tagged by a `source` column. Structured fields live in a `log_attributes` map, and the raw line is in `event_message`. Filter by `source` to scope a query to one service.

ClickHouse has been the default engine since June 2026. Projects created before this date use BigQuery, whose `cross join unnest(metadata)` syntax is deprecated. We recommend rewriting those queries in the ClickHouse syntax shown in this guide.

## Timestamp display and behavior#

The `timestamp` column is a `DateTime64` value in UTC, formatted as an ISO-8601 string like `2026-06-22T09:34:06.215000`. You can order and compare it directly, so no conversion function is needed. In the Logs Explorer the selected time range is applied for you, so you rarely need to filter on `timestamp` by hand.
[code] 
    1
    
    select timestamp, event_message
    
    2
    
    from logs
    
    3
    
    where source = 'edge_logs'
    
    4
    
    order by timestamp desc
    
    5
    
    limit 100;
[/code]

## Reading fields from log_attributes#

Structured fields live in the `log_attributes` map. Read a field with bracket access, keeping the full dotted key. There are no unnesting joins.
[code] 
    1
    
    select
    
    2
    
      log_attributes['request.method'] as method,
    
    3
    
      log_attributes['request.path'] as path,
    
    4
    
      log_attributes['response.status_code'] as status
    
    5
    
    from logs
    
    6
    
    where source = 'edge_logs'
    
    7
    
    limit 100;
[/code]

The key keeps the full dotted path, with the `metadata` root dropped. What BigQuery expressed as `metadata.request.cf.country` is `log_attributes['request.cf.country']`. Keep the full prefix rather than shortening it.

Map values are always strings. To compare or aggregate a numeric field, wrap it in `toInt32OrZero`, which returns `0` for a missing or non-numeric value:
[code] 
    1
    
    select count() as server_errors
    
    2
    
    from logs
    
    3
    
    where source = 'edge_logs'
    
    4
    
      and toInt32OrZero(log_attributes['response.status_code']) between 500 and 599;
[/code]

Do not guess keys. Discover the keys a source sets from recent rows:
[code] 
    1
    
    select arrayJoin(mapKeys(log_attributes)) as key, count() as n
    
    2
    
    from logs
    
    3
    
    where source = 'postgres_logs'
    
    4
    
    group by key
    
    5
    
    order by n desc
    
    6
    
    limit 100;
[/code]

## LIMIT and result row limitations#

The Logs Explorer has a maximum of 1000 rows per run. Use `LIMIT` to reduce the number of rows returned further.

## Best practices#

  1. **Use a narrow time range.**


The Logs Explorer applies the time range you select, so keep it tight. Querying a very large range risks timeouts, especially for Enterprise customers with long retention, because of the extra data scanned.

  2. **Select only the fields you need.**


Selecting the whole `log_attributes` map, or every column, reads far more data than you need and slows the query down. Select the specific keys instead.
[code] 
    1
    
    -- ❌ Avoid this: selecting the whole attributes map
    
    2
    
    select timestamp, log_attributes
    
    3
    
    from logs
    
    4
    
    where source = 'edge_logs';
    
    5
    
    6
    
    -- ✅ Do this: select only the keys you need
    
    7
    
    select timestamp, log_attributes['request.method'] as method
    
    8
    
    from logs
    
    9
    
    where source = 'edge_logs';
[/code]

## Examples and templates#

The Logs Explorer includes **Templates** (available in the Templates tab or the dropdown in the Query tab) to help you get started.

For example, you can enter the following query in the SQL Editor to retrieve each user's IP address:
[code] 
    1
    
    select timestamp, log_attributes['request.headers.x_real_ip'] as x_real_ip
    
    2
    
    from logs
    
    3
    
    where source = 'edge_logs'
    
    4
    
      and log_attributes['request.headers.x_real_ip'] != ''
    
    5
    
      and log_attributes['request.method'] = 'GET'
    
    6
    
    order by timestamp desc
    
    7
    
    limit 100;
[/code]

## Understanding field references#

Every log source shares the same `logs` table. Each row has these columns:

column| description  
---|---  
`id`| unique log identifier  
`timestamp`| time the event was recorded  
`event_message`| the log's message  
`severity_text`| log level, when the source sets one  
`source`| the service the log came from  
`log_attributes`| structured per-source fields, keyed by dotted path  
  
Service-specific details live in `log_attributes`. For example, in `postgres_logs` the `log_attributes['parsed.error_severity']` field holds the error level of an event. Read those fields with bracket access:
[code] 
    1
    
    select
    
    2
    
      event_message,
    
    3
    
      log_attributes['parsed.error_severity'] as error_severity,
    
    4
    
      log_attributes['parsed.user_name'] as user_name
    
    5
    
    from logs
    
    6
    
    where source = 'postgres_logs'
    
    7
    
    limit 100;
[/code]

## Expanding results#

Logs returned by queries may be difficult to read in table format. Double-click a row to expand the result into more readable JSON:

![Expanding log results](/docs/img/guides/platform/expanded-log-results.png)

## Filtering with [regular expressions](<https://en.wikipedia.org/wiki/Regular_expression>)#

Use the ClickHouse [`match` function](<https://clickhouse.com/docs/sql-reference/functions/string-search-functions#match>) for regular expressions. In its most basic form, it checks whether a pattern is present in a column.
[code] 
    1
    
    select timestamp, event_message
    
    2
    
    from logs
    
    3
    
    where source = 'postgres_logs'
    
    4
    
      and match(event_message, 'is present')
    
    5
    
    limit 100;
[/code]

There are multiple operators to consider using.

### Find messages that start with a phrase#

`^` only looks for values at the start of a string
[code] 
    1
    
    -- find only messages that start with connection
    
    2
    
    match(event_message, '^connection')
[/code]

### Find messages that end with a phrase#

`$` only looks for values at the end of the string
[code] 
    1
    
    -- find only messages that end with port=12345
    
    2
    
    match(event_message, 'port=12345$')
[/code]

### Ignore case sensitivity#

`(?i)` ignores capitalization for all proceeding characters
[code] 
    1
    
    -- find all event_messages with the word "connection"
    
    2
    
    match(event_message, '(?i)COnnecTion')
[/code]

For a plain case-insensitive substring match, `ilike` is simpler:
[code] 
    1
    
    -- find all event_messages containing "connection", in any case
    
    2
    
    event_message ilike '%connection%'
[/code]

### Wildcards#

`.` matches any single character, and `.*` matches any sequence of characters
[code] 
    1
    
    -- find event_messages like "hello<anything>world"
    
    2
    
    match(event_message, 'hello.*world')
[/code]

### Alphanumeric ranges#

`[0-9a-zA-Z]` matches a single alphanumeric character. Anchor it with `^[0-9a-zA-Z]+$` to match a value that is entirely alphanumeric.
[code] 
    1
    
    -- find event_messages that contain a digit between 1 and 5 (inclusive)
    
    2
    
    match(event_message, '[1-5]')
[/code]

### Repeated values#

`x*` zero or more x `x+` one or more x `x?` zero or one x `x{4,}` four or more x `x{3}` exactly 3 x
[code] 
    1
    
    -- find event_messages that contain any sequence of 3 digits
    
    2
    
    match(event_message, '[0-9]{3}')
[/code]

### Escaping reserved characters#

`\.` is interpreted as a period `.` instead of as a wildcard
[code] 
    1
    
    -- escapes .
    
    2
    
    match(event_message, 'hello world\.')
[/code]

### `or` statements#

`x|y` any string with `x` or `y` present
[code] 
    1
    
    -- find event_messages that have the word 'started' followed by either "host" or "authenticated"
    
    2
    
    match(event_message, 'started (host|authenticated)')
[/code]

### `and`/`or`/`not` statements in SQL#

`and`, `or`, and `not` are native terms in SQL and can be used with regular expressions to filter results
[code] 
    1
    
    select timestamp, event_message
    
    2
    
    from logs
    
    3
    
    where source = 'postgres_logs'
    
    4
    
      and (
    
    5
    
        (match(event_message, 'connection') and match(event_message, 'host'))
    
    6
    
        or not match(event_message, 'received')
    
    7
    
      )
    
    8
    
    limit 100;
[/code]

### Filtering example#

Filter for Postgres errors:
[code] 
    1
    
    select
    
    2
    
      timestamp,
    
    3
    
      log_attributes['parsed.error_severity'] as error_severity,
    
    4
    
      log_attributes['parsed.user_name'] as user_name,
    
    5
    
      event_message
    
    6
    
    from logs
    
    7
    
    where source = 'postgres_logs'
    
    8
    
      and match(log_attributes['parsed.error_severity'], 'ERROR|FATAL|PANIC')
    
    9
    
    order by timestamp desc
    
    10
    
    limit 100;
[/code]

## Limitations#

### The wildcard operator `*` is not supported#

The logs query surface rejects `select *` and `count(*)`. List the columns you need, and use `count()` for row counts:
[code] 
    1
    
    select timestamp, event_message, log_attributes['parsed.error_severity'] as error_severity
    
    2
    
    from logs
    
    3
    
    where source = 'postgres_logs'
    
    4
    
    order by timestamp desc
    
    5
    
    limit 100;
[/code]