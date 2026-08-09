---
タイトル: pg_stat_statements: Query Performance Monitoring
URL: https://supabase.com/docs/guides/database/extensions/pg_stat_statements
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, monitoring, performance, pg_stat_statements, query
---

# pg_stat_statements: Query Performance Monitoring

**URL:** https://supabase.com/docs/guides/database/extensions/pg_stat_statements
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, monitoring, performance, pg_stat_statements, query

## 目次

- [Enable the extension#](#enable-the-extension)
- [Inspecting activity#](#inspecting-activity)
- [Resources#](#resources)

## 概要

Track planning and execution statistics of all SQL statements executed on the database.

---

`pg_stat_statements` is a database extension that exposes a view, of the same name, to track statistics about SQL statements executed on the database. The following table shows some of the available statistics and metadata:

Column Name| Column Type| Description  
---|---|---  
`userid`| `oid` (references `pg_authid.oid`)| OID of user who executed the statement  
`dbid`| `oid` (references `pg_database.oid`)| OID of database in which the statement was executed  
`toplevel`| `bool`| True if the query was executed as a top-level statement (always true if pg_stat_statements.track is set to top)  
`queryid`| `bigint`| Hash code to identify identical normalized queries.  
`query`| `text`| Text of a representative statement  
`plans`| `bigint`| Number of times the statement was planned (if pg_stat_statements.track_planning is enabled, otherwise zero)  
`total_plan_time`| `double precision`| Total time spent planning the statement, in milliseconds (if pg_stat_statements.track_planning is enabled, otherwise zero)  
`min_plan_time`| `double precision`| Minimum time spent planning the statement, in milliseconds (if pg_stat_statements.track_planning is enabled, otherwise zero)  
  
A full list of statistics is available in the [pg_stat_statements docs](<https://www.postgresql.org/docs/current/pgstatstatements.html>).

For more information on query optimization, check out the [query performance guide](</docs/guides/platform/performance#examining-query-performance>).

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "pg_stat_statements" and enable the extension.


## Inspecting activity#

A common use for `pg_stat_statements` is to track down expensive or slow queries. The `pg_stat_statements` view contains a row for each executed query with statistics inlined. For example, you can leverage the statistics to identify frequently executed and slow queries against a given table.
[code] 
    1
    
    select
    
    2
    
    	calls,
    
    3
    
    	mean_exec_time,
    
    4
    
    	max_exec_time,
    
    5
    
    	total_exec_time,
    
    6
    
    	stddev_exec_time,
    
    7
    
    	query
    
    8
    
    from
    
    9
    
    	pg_stat_statements
    
    10
    
    where
    
    11
    
        calls > 50                   -- at least 50 calls
    
    12
    
        and mean_exec_time > 2.0     -- averaging at least 2ms/call
    
    13
    
        and total_exec_time > 60000  -- at least one minute total server time spent
    
    14
    
        and query ilike '%user_in_organization%' -- filter to queries that touch the user_in_organization table
    
    15
    
    order by
    
    16
    
    	calls desc
[/code]

From the results, we can make an informed decision about which queries to optimize or index.

## Resources#

  * Official [pg_stat_statements documentation](<https://www.postgresql.org/docs/current/pgstatstatements.html>)