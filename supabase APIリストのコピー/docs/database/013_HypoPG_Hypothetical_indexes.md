---
タイトル: HypoPG: Hypothetical indexes
URL: https://supabase.com/docs/guides/database/extensions/hypopg
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, hypopg, hypothetical, indexes
---

# HypoPG: Hypothetical indexes

**URL:** https://supabase.com/docs/guides/database/extensions/hypopg
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, hypopg, hypothetical, indexes

## 目次

- [Enable the extension#](#enable-the-extension)
  - [Speeding up a query#](#speeding-up-a-query)
- [Functions#](#functions)
- [Resources#](#resources)

## 概要

Quickly check if an index can be used without creating it.

---

`HypoPG` is Postgres extension for creating hypothetical/virtual indexes. HypoPG allows users to rapidly create hypothetical/virtual indexes that have no resource cost (CPU, disk, memory) that are visible to the Postgres query planner.

The motivation for HypoPG is to allow users to search for an index to improve a slow query without consuming server resources or waiting for them to build.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `hypopg` and enable the extension.


### Speeding up a query#

Given the following table and a basic query to select from the table by `id`:
[code] 
    1
    
    create table account (
    
    2
    
      id int,
    
    3
    
      address text
    
    4
    
    );
    
    5
    
    6
    
    insert into account(id, address)
    
    7
    
    select
    
    8
    
      id,
    
    9
    
      id || ' main street'
    
    10
    
    from
    
    11
    
      generate_series(1, 10000) id;
[/code]

We can generate an explain plan for a description of how the Postgres query planner intends to execute the query.
[code] 
    1
    
    explain select * from account where id=1;
    
    2
    
    3
    
                          QUERY PLAN
    
    4
    
    -------------------------------------------------------
    
    5
    
     Seq Scan on account  (cost=0.00..180.00 rows=1 width=13)
    
    6
    
       Filter: (id = 1)
    
    7
    
    (2 rows)
[/code]

Using HypoPG, we can create a hypothetical index on the `account(id)` column to check if it would be useful to the query planner and then re-run the explain plan.

Note that the virtual indexes created by HypoPG are only visible in the Postgres connection that they were created in. Supabase connects to Postgres through a connection pooler so the `hypopg_create_index` statement and the `explain` statement should be executed in a single query.
[code] 
    1
    
    select * from hypopg_create_index('create index on account(id)');
    
    2
    
    3
    
    explain select * from account where id=1;
    
    4
    
    5
    
                                         QUERY PLAN
    
    6
    
    ------------------------------------------------------------------------------------
    
    7
    
     Index Scan using <13504>btree_account_id on hypo  (cost=0.29..8.30 rows=1 width=13)
    
    8
    
       Index Cond: (id = 1)
    
    9
    
    (2 rows)
[/code]

The query plan has changed from a `Seq Scan` to an `Index Scan` using the newly created virtual index, so we may choose to create a real version of the index to improve performance on the target query:
[code] 
    1
    
    create index on account(id);
[/code]

## Functions#

  * [`hypo_create_index(text)`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#create-a-hypothetical-index>): A function to create a hypothetical index.
  * [`hypopg_list_indexes`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#manipulate-hypothetical-indexes>): A View that lists all hypothetical indexes that have been created.
  * [`hypopg()`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#manipulate-hypothetical-indexes>): A function that lists all hypothetical indexes that have been created with the same format as `pg_index`.
  * [`hypopg_get_index_def(oid)`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#manipulate-hypothetical-indexes>): A function to display the `create index` statement that would create the index.
  * [`hypopg_get_relation_size(oid)`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#manipulate-hypothetical-indexes>): A function to estimate how large a hypothetical index would be.
  * [`hypopg_drop_index(oid)`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#manipulate-hypothetical-indexes>): A function to remove a given hypothetical index by `oid`.
  * [`hypopg_reset()`](<https://hypopg.readthedocs.io/en/rel1_stable/usage.html#manipulate-hypothetical-indexes>): A function to remove all hypothetical indexes.


## Resources#

  * Official [HypoPG documentation](<https://hypopg.readthedocs.io/en/rel1_stable/>)