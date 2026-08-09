---
タイトル: ClickHouse
URL: https://supabase.com/docs/guides/database/extensions/wrappers/clickhouse
カテゴリ: database
更新日: 2026-08-02
タグ: cli, clickhouse, database, extensions, wrappers
---

# ClickHouse

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/clickhouse
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** cli, clickhouse, database, extensions, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the ClickHouse Wrapper#](#enable-the-clickhouse-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to ClickHouse#](#connecting-to-clickhouse)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
  - [Parametrized views#](#parametrized-views)
- [Entities#](#entities)
  - [Tables#](#tables)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Aggregate Pushdown#](#aggregate-pushdown)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Query Example#](#basic-query-example)
  - [Aggregate Query Examples#](#aggregate-query-examples)

## 概要

Searchdocs...

---

You can enable the ClickHouse wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/clickhouse_wrapper/overview>)

[ClickHouse](<https://clickhouse.com/>) is a fast open-source column-oriented database management system that allows generating analytical data reports in real-time using SQL queries.

The ClickHouse Wrapper allows you to read and write data from ClickHouse within your Postgres database.

## Preparation#

Before you can query ClickHouse, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the ClickHouse Wrapper#

Enable the `clickhouse_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper clickhouse_wrapper
    
    2
    
      handler click_house_fdw_handler
    
    3
    
      validator click_house_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your ClickHouse credential in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'tcp://default:@localhost:9000/default',
    
    4
    
      'clickhouse',
    
    5
    
      'ClickHouse credential for Wrappers'
    
    6
    
    );
[/code]

### Connecting to ClickHouse#

We need to provide Postgres with the credentials to connect to ClickHouse, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server clickhouse_server
    
    2
    
      foreign data wrapper clickhouse_wrapper
    
    3
    
      options (
    
    4
    
        conn_string_id '<key_ID>' -- The Key ID from above.
    
    5
    
      );
[/code]

Some connection string examples:

  * `tcp://user:password@host:9000/clicks?compression=lz4&ping_timeout=42ms`
  * `tcp://default:PASSWORD@abc.eu-west-1.aws.clickhouse.cloud:9440/default?connection_timeout=30s&ping_before_query=false&secure=true`


Check out [more connection string parameters](<https://github.com/suharev7/clickhouse-rs#dns>).

This ClickHouse FDW only supports native protocol port `9000` and `9440`, HTTP(S) port like `8123` and `8443` are not supported yet.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists clickhouse;
[/code]

## Options#

The following options are available when creating ClickHouse foreign tables:

  * `table` \- Source table name in ClickHouse, required

This can also be a subquery enclosed in parentheses, for example,
[code] 1
        
        table '(select * from my_table)'
[/code]

  * `rowid_column` \- Primary key column name, optional for data scan, required for data modify

  * `stream_buffer_size` \- Size of the internal buffer used for streaming data from ClickHouse, defaults to 1024 rows. Must be between 1 and 100000.


### Parametrized views#

[Parametrized view](<https://clickhouse.com/docs/en/sql-reference/statements/create/view#parameterized-view>) is also supported in the subquery. In this case, you need to define a column for each parameter and use `where` to pass values to them. For example,
[code] 
    1
    
    create foreign table test_vw (
    
    2
    
        id bigint,
    
    3
    
        col1 text,
    
    4
    
        col2 bigint,
    
    5
    
        _param1 text,
    
    6
    
        _param2 bigint
    
    7
    
      )
    
    8
    
        server clickhouse_server
    
    9
    
        options (
    
    10
    
          table '(select * from my_view(column1=${_param1}, column2=${_param2}))'
    
    11
    
        );
    
    12
    
    13
    
      select * from test_vw where _param1='aaa' and _param2=32;
[/code]

## Entities#

### Tables#

The ClickHouse Wrapper supports data reads and writes from ClickHouse tables.

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Tables| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clickhouse.my_table (
    
    2
    
      id bigint,
    
    3
    
      name text
    
    4
    
    )
    
    5
    
      server clickhouse_server
    
    6
    
      options (
    
    7
    
        table 'people'
    
    8
    
      );
[/code]

#### Notes#

  * Supports `where`, `order by`, `limit` and aggregate clause pushdown
  * Supports parametrized views in subqueries
  * When using `rowid_column`, it must be specified for data modification operations


## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown, as well as parametrized view (see above).

### Aggregate Pushdown#

The FDW pushes common aggregate queries down to ClickHouse so the aggregation runs remotely and only the final result rows are transferred to Postgres. This is much faster than fetching every row and aggregating locally, especially over large tables.

**Supported aggregates** — `count(*)`, `count(col)`, `count(distinct col)`, `sum(col)`, `avg(col)`, `min(col)`, `max(col)`.

**Supported shapes** — scalar aggregates, `group by` over plain columns, with or without a `where` clause. Pushdown also works when the foreign `table` option is a sub-query or a parametrized view.
[code] 
    1
    
    -- All of these run as a single aggregate query on ClickHouse:
    
    2
    
    select count(*) from clickhouse.my_table;
    
    3
    
    select id, sum(amount) from clickhouse.my_table group by id;
    
    4
    
    select count(distinct name) from clickhouse.my_table where id = 1;
[/code]

**Cases that are not pushed down** — the query still returns the correct result, but the aggregation happens in Postgres after fetching the rows:

  * The query has a `having` clause
  * The aggregate has a `filter (where …)` clause
  * A `distinct` modifier is used on anything other than `count`
  * The aggregate's argument is not a plain column (for example `sum(a + 1)`)
  * A `group by` item is not a plain column (for example `group by id + 1`)
  * The aggregate function is not in the list above (for example `stddev`, `string_agg`)


## Supported Data Types#

Postgres Type| ClickHouse Type  
---|---  
boolean| Bool  
"char"| Int8  
smallint| UInt8  
smallint| Int16  
integer| UInt16  
integer| Int32  
bigint| UInt32  
bigint| Int64  
bigint| UInt64  
real| Float32  
double precision| Float64  
numeric| UInt128  
numeric| Int128  
text| UInt256  
text| Int256  
numeric| Decimal  
text| String  
text| FixedString(N)  
date| Date  
timestamp| DateTime  
uuid| UUID  
boolean[]| Array(Boolean)  
smallint[]| Array(Int16)  
integer[]| Array(Int32)  
bigint[]| Array(Int64)  
real[]| Array(Float32)  
double precision[]| Array(Float64)  
text[]| Array(String)  
*| Nullable<T>  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Full result sets must be transferred from ClickHouse to PostgreSQL
  * Large result sets consume significant PostgreSQL memory
  * Only basic query clauses (WHERE, ORDER BY, LIMIT) support pushdown
  * Limited data type mappings (see Supported Data Types section)
  * Materialized views using foreign tables may fail during logical backups


## Examples#

### Basic Query Example#

This example demonstrates basic ClickHouse table operations.
[code] 
    1
    
    -- Run below SQLs on ClickHouse to create source table
    
    2
    
    create table people (
    
    3
    
      id Int64,
    
    4
    
      name String
    
    5
    
    )
    
    6
    
    engine=MergeTree()
    
    7
    
    order by id;
    
    8
    
    9
    
    -- Add some test data
    
    10
    
    insert into people values (1, 'Luke Skywalker'), (2, 'Leia Organa'), (3, 'Han Solo');
[/code]

Create foreign table on Postgres database:
[code] 
    1
    
    create foreign table clickhouse.people (
    
    2
    
      id bigint,
    
    3
    
      name text
    
    4
    
    )
    
    5
    
      server clickhouse_server
    
    6
    
      options (
    
    7
    
        table 'people'
    
    8
    
      );
    
    9
    
    10
    
    -- data scan
    
    11
    
    select * from clickhouse.people;
    
    12
    
    13
    
    -- data modify
    
    14
    
    insert into clickhouse.people values (4, 'Yoda');
    
    15
    
    update clickhouse.people set name = 'Princess Leia' where id = 2;
    
    16
    
    delete from clickhouse.people where id = 3;
[/code]

### Aggregate Query Examples#

These examples assume the `clickhouse.people` foreign table from the previous section, plus an `orders` table with a row per order:
[code] 
    1
    
    -- Run on ClickHouse
    
    2
    
    create table orders (
    
    3
    
      id        Int64,
    
    4
    
      person_id Int64,
    
    5
    
      amount    Float64,
    
    6
    
      status    String
    
    7
    
    )
    
    8
    
    engine=MergeTree()
    
    9
    
    order by id;
    
    10
    
    11
    
    insert into orders values
    
    12
    
      (1, 1, 100.0, 'paid'),
    
    13
    
      (2, 1,  50.0, 'paid'),
    
    14
    
      (3, 2, 200.0, 'pending'),
    
    15
    
      (4, 2,  75.0, 'paid'),
    
    16
    
      (5, 3, 300.0, 'paid');
[/code]
[code] 
    1
    
    -- Foreign table on Postgres
    
    2
    
    create foreign table clickhouse.orders (
    
    3
    
      id        bigint,
    
    4
    
      person_id bigint,
    
    5
    
      amount    double precision,
    
    6
    
      status    text
    
    7
    
    )
    
    8
    
      server clickhouse_server
    
    9
    
      options (
    
    10
    
        table 'orders'
    
    11
    
      );
[/code]

Each query below runs a single aggregate query against ClickHouse and returns just the result rows:
[code] 
    1
    
    -- Total order count
    
    2
    
    select count(*) from clickhouse.orders;
    
    3
    
    4
    
    -- Total revenue from paid orders
    
    5
    
    select sum(amount) from clickhouse.orders where status = 'paid';
    
    6
    
    7
    
    -- Per-person order count and revenue
    
    8
    
    select person_id, count(*) as orders, sum(amount) as revenue
    
    9
    
    from clickhouse.orders
    
    10
    
    group by person_id
    
    11
    
    order by person_id;
    
    12
    
    13
    
    -- Smallest and largest order
    
    14
    
    select min(amount), max(amount) from clickhouse.orders;
    
    15
    
    16
    
    -- Number of distinct customers who placed an order
    
    17
    
    select count(distinct person_id) from clickhouse.orders;
    
    18
    
    19
    
    -- Average order value per status
    
    20
    
    select status, avg(amount) as avg_amount
    
    21
    
    from clickhouse.orders
    
    22
    
    group by status;
[/code]