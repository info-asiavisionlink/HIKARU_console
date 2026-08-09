---
タイトル: pg_plan_filter: Restrict Total Cost
URL: https://supabase.com/docs/guides/database/extensions/pg_plan_filter
カテゴリ: database
更新日: 2026-08-02
タグ: cost, database, extensions, pg_plan_filter, rest, restrict, total
---

# pg_plan_filter: Restrict Total Cost

**URL:** https://supabase.com/docs/guides/database/extensions/pg_plan_filter
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** cost, database, extensions, pg_plan_filter, rest, restrict, total

## 目次

- [Enable the extension#](#enable-the-extension)
- [API#](#api)
- [Example#](#example)
- [Resources#](#resources)

## 概要

Block queries over a total cost limit

---

[`pg_plan_filter`](<https://github.com/pgexperts/pg_plan_filter>) is Postgres extension to block execution of statements where query planner's estimate of the total cost exceeds a threshold. This is intended to give database administrators a way to restrict the contribution an individual query has on database load.

## Enable the extension#

The extension is already enabled by default via `shared_preload_libraries` setting.

You can follow the instructions below.

## API#

`plan_filter.statement_cost_limit`: restricts the maximum total cost for executed statements `plan_filter.limit_select_only`: restricts to `select` statements

Note that `limit_select_only = true` is not the same as read-only because `select` statements may modify data, for example, through a function call.

## Example#

To demonstrate total cost filtering, we'll compare how `plan_filter.statement_cost_limit` treats queries that are under and over its cost limit. First, we set up a table with some data:
[code] 
    1
    
    create table book(
    
    2
    
      id int primary key
    
    3
    
    );
    
    4
    
    -- CREATE TABLE
    
    5
    
    6
    
    insert into book(id) select * from generate_series(1, 10000);
    
    7
    
    -- INSERT 0 10000
[/code]

Next, we can review the explain plans for a single record select, and a whole table select.
[code] 
    1
    
    explain select * from book where id =1;
    
    2
    
                                    QUERY PLAN
    
    3
    
    ---------------------------------------------------------------------------
    
    4
    
     Index Only Scan using book_pkey on book  (cost=0.28..2.49 rows=1 width=4)
    
    5
    
       Index Cond: (id = 1)
    
    6
    
    (2 rows)
    
    7
    
    8
    
    explain select * from book;
    
    9
    
                           QUERY PLAN
    
    10
    
    ---------------------------------------------------------
    
    11
    
     Seq Scan on book  (cost=0.00..135.00 rows=10000 width=4)
    
    12
    
    (1 row)
[/code]

Now we can choose a `statement_cost_limit` value between the total cost for the single select (2.49) and the whole table select (135.0) so one statement will succeed and one will fail.
[code] 
    1
    
    set plan_filter.statement_cost_limit = 50; -- between 2.49 and 135.0
    
    2
    
    3
    
    select * from book where id = 1;
    
    4
    
     id
    
    5
    
    ----
    
    6
    
      1
    
    7
    
    (1 row)
    
    8
    
    -- SUCCESS
[/code]
[code] 
    1
    
    select * from book;
    
    2
    
    3
    
    ERROR:  plan cost limit exceeded
    
    4
    
    HINT:  The plan for your query shows that it would probably have an excessive run time. This may be due to a logic error in the SQL, or it maybe just a very costly query. Rewrite your query or increase the configuration parameter "plan_filter.statement_cost_limit".
    
    5
    
    -- FAILURE
[/code]

## Resources#

  * Official [`pg_plan_filter` documentation](<https://github.com/pgexperts/pg_plan_filter>)