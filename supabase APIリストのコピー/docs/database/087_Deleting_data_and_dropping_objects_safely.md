---
タイトル: Deleting data and dropping objects safely
URL: https://supabase.com/docs/guides/database/postgres/data-deletion
カテゴリ: database
更新日: 2026-08-02
タグ: data, data-deletion, database, deleting, dropping, objects, postgres, safely
---

# Deleting data and dropping objects safely

**URL:** https://supabase.com/docs/guides/database/postgres/data-deletion
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** data, data-deletion, database, deleting, dropping, objects, postgres, safely

## 目次

- [Preparing to delete#](#preparing-to-delete)
  - [Identifying dependencies#](#identifying-dependencies)
- [Data deletion strategies#](#data-deletion-strategies)
  - [Small deletes#](#small-deletes)
  - [Large deletes#](#large-deletes)
  - [Soft deletes#](#soft-deletes)
  - [Deleting all data#](#deleting-all-data)
- [Object deletion strategies#](#object-deletion-strategies)
  - [Dropping tables#](#dropping-tables)
  - [Dropping columns#](#dropping-columns)
  - [Dropping indexes#](#dropping-indexes)
- [Monitoring#](#monitoring)
  - [Check for blocked queries#](#check-for-blocked-queries)
  - [Monitor table bloat after large deletes#](#monitor-table-bloat-after-large-deletes)
- [Reclaiming disk space#](#reclaiming-disk-space)
- [Related links#](#related-links)

## 概要

Strategies for removing data and schema objects while minimising impact.

---

Deleting rows and dropping database objects are routine operations, but on a live database they can lock tables, block queries, and cause downtime. This guide covers practical strategies for keeping these operations safe and fast.

## Preparing to delete#

  * Test in a staging environment
  * Ensure you have a recent backup
  * Confirm the table dependencies and foreign key constraints
  * Drop dependent objects explicitly, use [CASCADE](</docs/guides/database/postgres/cascade-deletes>) with caution
  * Choose a low traffic time to run the operation
  * Run operations inside a [migration](</docs/guides/deployment/database-migrations>)
  * Set timeouts, such as `lock_timeout` and `statement_timeout`


### Identifying dependencies#

The system catalog tables `pg_class`, `pg_constraint`, and `pg_depend` can be used to identify dependencies:
[code] 
    1
    
    -- Find tables that depend on a specific table
    
    2
    
    select
    
    3
    
      d.classid::regclass as dependent_object,
    
    4
    
      d.objid::regclass as dependent_object_id,
    
    5
    
      d.refclassid::regclass as referenced_object,
    
    6
    
      d.refobjid::regclass as referenced_object_id
    
    7
    
    from pg_depend d
    
    8
    
    where d.refobjid = 'public.logs'::regclass;
[/code]

If the object you want to delete has dependencies, you'll need to drop those first or use `CASCADE` which will automatically drop all related objects.

## Data deletion strategies#

There are several ways to delete data from a table and the approach you choose depends on how much you want to delete.

### Small deletes#

For tables with less than a few thousand rows, a `DELETE` operation is fine:
[code] 
    1
    
    delete from logs
    
    2
    
    where created_at < now() - interval '90 days';
[/code]

This acquires a `ROW EXCLUSIVE` lock on the table, which still allows other `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements to run concurrently. For small row counts, the operation completes with minimal impact.

### Large deletes#

Deleting millions of rows in a single statement can hold locks for a long time, generate WAL (Write-Ahead Log) traffic, and impact replication. Instead, delete in batches:
[code] 
    1
    
    -- Delete 5,000 rows at a time
    
    2
    
    DELETE FROM logs
    
    3
    
    WHERE id IN (
    
    4
    
      SELECT id
    
    5
    
      FROM logs
    
    6
    
      WHERE created_at < now() - interval '90 days'
    
    7
    
      LIMIT 5000
    
    8
    
    );
[/code]

This approach has the benefit of controlling when it runs, locking for a shorter period of time and minimising impact on other transactions.

If you know in advance that such large deletes will have to happen in the business cycle of your database, then you should seriously think about using [table partitioning](</docs/guides/database/partitions>) as a management tool.

### Soft deletes#

If you need to "delete" data but want the option to recover it, consider a soft-delete pattern:
[code] 
    1
    
    alter table orders
    
    2
    
    add column deleted_at timestamptz;
    
    3
    
    4
    
    -- "Delete" a row
    
    5
    
    update orders
    
    6
    
    set deleted_at = now()
    
    7
    
    where id = 42;
[/code]

Then exclude soft-deleted rows in your queries or views:
[code] 
    1
    
    create view active_orders as
    
    2
    
      select * from orders where deleted_at is null;
[/code]

Combine soft deletes with a scheduled hard-delete job (using [pg_cron](</docs/guides/database/extensions/pg_cron>)) to permanently remove old soft-deleted rows in batches during low-traffic periods.

### Deleting all data#

If you need to delete all data from a table, consider using `TRUNCATE` instead of `DELETE`:
[code] 
    1
    
    truncate table logs;
[/code]

`TRUNCATE` is much faster than `DELETE` because it doesn't generate individual row-level WAL entries and doesn't scan the table. It also resets any auto-incrementing sequences.

## Object deletion strategies#

### Dropping tables#

Dropping a table removes it and all its data permanently. Always use `IF EXISTS` to avoid errors in migrations:
[code] 
    1
    
    drop table if exists old_analytics;
[/code]

`DROP TABLE` acquires an `ACCESS EXCLUSIVE` lock, which blocks **all** other operations on the table, including reads. On a busy table, this can queue up behind long-running queries. See Monitoring locks below.

### Dropping columns#

Dropping a column is a metadata-only operation in Postgres — it doesn't rewrite the table. However, it still requires an `ACCESS EXCLUSIVE` lock:
[code] 
    1
    
    alter table users
    
    2
    
    drop column if exists legacy_field;
[/code]

Since the lock is brief (metadata-only), this is generally safe. But on a table with many concurrent transactions, even a brief `ACCESS EXCLUSIVE` lock can queue behind long-running queries. Use a lock timeout to avoid waiting indefinitely:
[code] 
    1
    
    set local lock_timeout = '5s';
    
    2
    
    alter table users drop column if exists legacy_field;
[/code]

If the statement times out, retry during a quieter period.

### Dropping indexes#

Dropping a regular index takes an `ACCESS EXCLUSIVE` lock on the index but **not** on the table, so reads and writes to the table continue uninterrupted:
[code] 
    1
    
    drop index if exists idx_users_legacy_field;
[/code]

The `inspect` command in the [Supabase CLI](</docs/reference/cli/supabase-inspect-db-index-stats>) can help you identify unused indexes:
[code]
    1
    
    supabase inspect db index-stats
[/code]

## Monitoring#

### Check for blocked queries#

Query `pg_locks` and `pg_stat_activity` to see currently active queries and queries waiting for locks.

The [Supabase CLI](</docs/reference/cli/supabase-inspect-db-locks>) provides commands to view these metrics:
[code] 
    1
    
    supabase inspect db locks
    
    2
    
    supabase inspect db blocking
[/code]

### Monitor table bloat after large deletes#

When deleting a large number of rows, the space is not always reclaimed and available for use. In normal cases, the rows are marked as deleted but the space is not immediately freed. You can monitor table bloat to see if the space is being reclaimed:
[code] 
    1
    
    supabase inspect db bloat
[/code]

## Reclaiming disk space#

To reclaim the disk space freed by deleted rows, Postgres' autovacuum process runs automatically to mark deleted rows as reusable, but it may not always keep up with large deletes.

If autovacuum is not keeping up, you can trigger a manual vacuum:
[code] 
    1
    
    vacuum (verbose) logs;
[/code]

To reclaim disk space rather than only marking tuples as reusable, use `VACUUM FULL`. Note that this rewrites the entire table and takes an `ACCESS EXCLUSIVE` lock:
[code] 
    1
    
    -- This locks the table for the duration — use during maintenance windows only
    
    2
    
    vacuum full logs;
[/code]

The most efficient way to reclaim disk space, without locks, is to use [pg_repack](</docs/guides/database/extensions/pg_repack>).

## Related links#

  * [Safe Cascading Deletes](</docs/guides/database/postgres/cascade-deletes>)
  * [Inspecting your Database](</docs/guides/database/inspect>)
  * [Understanding Database and Disk Size](</docs/guides/platform/database-size>)
  * [Bloat in Postgres](</blog/postgres-bloat>)