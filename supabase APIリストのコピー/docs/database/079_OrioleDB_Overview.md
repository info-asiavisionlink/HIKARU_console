---
タイトル: OrioleDB Overview
URL: https://supabase.com/docs/guides/database/orioledb
カテゴリ: database
更新日: 2026-08-02
タグ: database, orioledb, overview
---

# OrioleDB Overview

**URL:** https://supabase.com/docs/guides/database/orioledb
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, orioledb, overview

## 目次

- [Concepts#](#concepts)
  - [Index-organized tables#](#index-organized-tables)
  - [No buffer mapping#](#no-buffer-mapping)
  - [Undo log#](#undo-log)
  - [Copy-on-write checkpoints#](#copy-on-write-checkpoints)
- [Usage#](#usage)
  - [Creating OrioleDB project#](#creating-orioledb-project)
  - [Creating tables#](#creating-tables)
  - [Creating indexes#](#creating-indexes)
  - [Data manipulation#](#data-manipulation)
  - [Viewing query plans#](#viewing-query-plans)
- [Resources#](#resources)

## 概要

A storage extension for Postgres which uses Postgres's pluggable storage system

---

The [OrioleDB](<https://www.orioledb.com/>) Postgres extension provides a drop-in replacement storage engine for the default heap storage method. It is designed to improve Postgres' scalability and performance.

OrioleDB addresses Postgres's scalability limitations by removing bottlenecks in the shared memory cache under high concurrency. It also optimizes write-ahead-log (WAL) insertion through row-level WAL logging. These changes lead to significant improvements in the industry standard TPC-C benchmark, which approximates a real-world transactional workload. The following benchmark was performed on a c7g.metal instance and shows OrioleDB's performance outperforming the default Postgres heap method with a 3.3x speedup.

![TPC-C \(warehouses = 500\)](/docs/_next/image?url=%2Fdocs%2Fimg%2Fdatabase%2Forioledb-tpc-c-500-warehouse.png&w=2048&q=75)

OrioleDB is in active development and currently has [certain limitations](<https://www.orioledb.com/docs/usage/getting-started#current-limitations>). Currently, only B-tree indexes are supported, so features like pg_vector's HNSW indexes are not yet available. An Index Access Method bridge to unlock support for all index types used with heap storage is under active development. In the Supabase OrioleDB image the default storage method has been updated to use OrioleDB, granting better performance out of the box.

## Concepts#

### Index-organized tables#

OrioleDB uses index-organized tables, where table data is stored in the index structure. This design eliminates the need for separate heap storage, reduces overhead and improves lookup performance for primary key queries.

### No buffer mapping#

In-memory pages are connected to the storage pages using direct links. This allows OrioleDB to bypass Postgres's shared buffer pool and eliminate the associated complexity and contention in buffer mapping.

### Undo log#

Multi-Version Concurrency Control (MVCC) is implemented using an undo log. The undo log stores previous row versions and transaction information, which enables consistent reads while removing the need for table vacuuming completely.

### Copy-on-write checkpoints#

OrioleDB implements copy-on-write checkpoints to persist data efficiently. This approach writes only modified data during a checkpoint, reducing the I/O overhead compared to traditional Postgres checkpointing and allowing row-level WAL logging.

## Usage#

### Creating OrioleDB project#

You can get started with OrioleDB by enabling the extension in your Supabase dashboard. To get started with OrioleDB you need to [create a new Supabase project](</dashboard/new/_>) and choose `OrioleDB Public Alpha` Postgres version.

![Creating OrioleDB project](/docs/_next/image?url=%2Fdocs%2Fimg%2Fdatabase%2Forioledb-creating-project--light.png&w=3840&q=75)

### Creating tables#

To create a table using the OrioleDB storage engine, execute the standard `CREATE TABLE` statement. By default it will create a table using OrioleDB storage engine. For example:
[code] 
    1
    
    -- Create a table
    
    2
    
    create table blog_post (
    
    3
    
      id int8 not null,
    
    4
    
      title text not null,
    
    5
    
      body text not null,
    
    6
    
      author text not null,
    
    7
    
      published_at timestamptz not null default CURRENT_TIMESTAMP,
    
    8
    
      views bigint not null,
    
    9
    
      primary key (id)
    
    10
    
    );
[/code]

### Creating indexes#

OrioleDB tables always have a primary key. If it wasn't defined explicitly, a hidden primary key is created using the `ctid` column. Additionally you can create secondary indexes.

Currently, only B-tree indexes are supported, so features like pg_vector's HNSW indexes are not yet available.
[code] 
    1
    
    -- Create an index
    
    2
    
    create index blog_post_published_at on blog_post (published_at);
    
    3
    
    4
    
    create index blog_post_views on blog_post (views) where (views > 1000);
[/code]

### Data manipulation#

You can query and modify data in OrioleDB tables using standard SQL statements, including `SELECT`, `INSERT`, `UPDATE`, `DELETE` and `INSERT ... ON CONFLICT`.
[code] 
    1
    
    INSERT INTO blog_post (id, title, body, author, views)
    
    2
    
    VALUES (1, 'Hello, World!', 'This is my first blog post.', 'John Doe', 1000);
    
    3
    
    4
    
    SELECT * FROM blog_post ORDER BY published_at DESC LIMIT 10;
    
    5
    
     id │     title     │            body             │  author  │         published_at          │ views
    
    6
    
    ────┼───────────────┼─────────────────────────────┼──────────┼───────────────────────────────┼───────
    
    7
    
      1 │ Hello, World! │ This is my first blog post. │ John Doe │ 2024-11-15 12:04:18.756824+01 │  1000
[/code]

### Viewing query plans#

You can see the execution plan using standard `EXPLAIN` statement.
[code] 
    1
    
    EXPLAIN SELECT * FROM blog_post ORDER BY published_at DESC LIMIT 10;
    
    2
    
                                                     QUERY PLAN
    
    3
    
    ────────────────────────────────────────────────────────────────────────────────────────────────────────────
    
    4
    
     Limit  (cost=0.15..1.67 rows=10 width=120)
    
    5
    
       ->  Index Scan Backward using blog_post_published_at on blog_post  (cost=0.15..48.95 rows=320 width=120)
    
    6
    
    7
    
    EXPLAIN SELECT * FROM blog_post WHERE id = 1;
    
    8
    
                                        QUERY PLAN
    
    9
    
    ──────────────────────────────────────────────────────────────────────────────────
    
    10
    
     Index Scan using blog_post_pkey on blog_post  (cost=0.15..8.17 rows=1 width=120)
    
    11
    
       Index Cond: (id = 1)
    
    12
    
    13
    
    EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM blog_post ORDER BY published_at DESC LIMIT 10;
    
    14
    
                                                                          QUERY PLAN
    
    15
    
    ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    
    16
    
     Limit  (cost=0.15..1.67 rows=10 width=120) (actual time=0.052..0.054 rows=1 loops=1)
    
    17
    
       ->  Index Scan Backward using blog_post_published_at on blog_post  (cost=0.15..48.95 rows=320 width=120) (actual time=0.050..0.052 rows=1 loops=1)
    
    18
    
     Planning Time: 0.186 ms
    
    19
    
     Execution Time: 0.088 ms
[/code]

## Resources#

  * [Official OrioleDB documentation](<https://www.orioledb.com/docs>)
  * [OrioleDB GitHub repository](<https://github.com/orioledb/orioledb>)