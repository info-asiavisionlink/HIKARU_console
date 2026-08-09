---
タイトル: Migrate from TimescaleDB to pg_partman
URL: https://supabase.com/docs/guides/database/migrating-to-pg-partman
カテゴリ: database
更新日: 2026-08-02
タグ: database, from, migrate, migrating-to-pg-partman, timescaledb
---

# Migrate from TimescaleDB to pg_partman

**URL:** https://supabase.com/docs/guides/database/migrating-to-pg-partman
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, from, migrate, migrating-to-pg-partman, timescaledb

## 目次

- [Before you begin#](#before-you-begin)
- [Migration overview#](#migration-overview)
- [Example: Migratemessagesfrom hypertable to native partitions#](#example-migrate-messages-from-hypertable-to-native-partitions)
  - [1. Rename the existing hypertable#](#1-rename-the-existing-hypertable)
  - [2. Create a new partitioned table#](#2-create-a-new-partitioned-table)
  - [3. Copy data into the new table#](#3-copy-data-into-the-new-table)
  - [4. Drop the old hypertable (and TimescaleDB)#](#4-drop-the-old-hypertable-and-timescaledb)
  - [5. Configurepg_partman(optional)#](#5-configure-pgpartman-optional)
- [Keep partitions up to date#](#keep-partitions-up-to-date)
- [Additional resources#](#additional-resources)

## 概要

Convert TimescaleDB hypertables to Postgres native partitions managed by pg_partman.

---

Starting from Postgres 17, Supabase projects do not have the `timescaledb` extension available. If your project relies on TimescaleDB hypertables, you will need to migrate to standard Postgres tables before upgrading.

This guide shows one approach to migrate a hypertable to a native Postgres partitioned table and optionally configure `pg_partman` to automate ongoing partition maintenance. The approach outlined in this guide can also be used for traditional partitioned tables.

## Before you begin#

  * Test the migration path in a staging environment (for example by creating a copy of your production project or using branching).
  * Review your application for TimescaleDB-specific SQL usage (for example `time_bucket()`, compression policies). Those features are not provided by `pg_partman`.


## Migration overview#

  1. Create a new partitioned table.
  2. Copy data from the hypertable to the new table.
  3. Swap over and drop the hypertable.
  4. Configure `pg_partman` (optional) and schedule maintenance.


## Example: Migrate `messages` from hypertable to native partitions#

This example assumes a `messages` hypertable partitioned by `sent_at`.

### 1\. Rename the existing hypertable#

This keeps the original data in place while you create a new partitioned table with the original name.
[code] 
    1
    
    alter table public.messages rename to ht_messages;
[/code]

### 2\. Create a new partitioned table#

When using native partitioning, the partitioning column must be included in any unique index (including the primary key).
[code] 
    1
    
    create table public.messages (
    
    2
    
      like public.ht_messages including all,
    
    3
    
      primary key (sent_at, id)
    
    4
    
    )
    
    5
    
    partition by range (sent_at);
[/code]

### 3\. Copy data into the new table#

For large tables, consider copying in batches (for example by time range) during a maintenance window.
[code] 
    1
    
    insert into public.messages
    
    2
    
    select *
    
    3
    
    from public.ht_messages;
[/code]

### 4\. Drop the old hypertable (and TimescaleDB)#

Only drop the extension once you’ve migrated all hypertables and no other objects depend on it.
[code] 
    1
    
    drop table public.ht_messages;
    
    2
    
    3
    
    drop extension if exists timescaledb;
[/code]

### 5\. Configure `pg_partman` (optional)#

Enable `pg_partman` and register your table so partitions are created ahead of time.
[code] 
    1
    
    create schema if not exists partman;
    
    2
    
    create extension if not exists pg_partman with schema partman;
    
    3
    
    4
    
    select partman.create_parent(
    
    5
    
      p_parent_table := 'public.messages',
    
    6
    
      p_control := 'sent_at',
    
    7
    
      p_type := 'range',
    
    8
    
      p_interval := '7 days',
    
    9
    
      p_premake := 7,
    
    10
    
      p_start_partition := '2025-01-01 00:00:00'
    
    11
    
    );
[/code]

## Keep partitions up to date#

`pg_partman` requires running maintenance to pre-make partitions and apply retention policies.
[code] 
    1
    
    call partman.run_maintenance_proc();
[/code]

To automate this, schedule it with `pg_cron`.
[code] 
    1
    
    create extension if not exists pg_cron;
    
    2
    
    3
    
    select cron.schedule('@daily', $$call partman.run_maintenance_proc()$$);
[/code]

## Additional resources#

  * [Partitioning your tables](</docs/guides/database/partitions>).
  * [`pg_partman` documentation](</docs/guides/database/extensions/pg_partman>)
  * [`pg_partman` migration guides](<https://github.com/pgpartman/pg_partman/blob/development/doc/migrate_to_partman.md>)