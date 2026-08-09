---
タイトル: BigQuery
URL: https://supabase.com/docs/guides/database/extensions/wrappers/bigquery
カテゴリ: database
更新日: 2026-08-02
タグ: bigquery, database, extensions, wrappers
---

# BigQuery

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/bigquery
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** bigquery, database, extensions, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the BigQuery Wrapper#](#enable-the-bigquery-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to BigQuery#](#connecting-to-bigquery)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entites#](#entites)
  - [Tables#](#tables)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Aggregate Pushdown#](#aggregate-pushdown)
- [Inserting Rows & the Streaming Buffer#](#inserting-rows--the-streaming-buffer)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic example#](#basic-example)
  - [Data modify example#](#data-modify-example)
  - [Aggregate Query Examples#](#aggregate-query-examples)

## 概要

Searchdocs...

---

You can enable the BigQuery wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/bigquery_wrapper/overview>)

[BigQuery](<https://cloud.google.com/bigquery>) is a completely serverless and cost-effective enterprise data warehouse that works across clouds and scales with your data, with BI, machine learning and AI built in.

The BigQuery Wrapper allows you to read and write data from BigQuery within your Postgres database.

## Preparation#

Before you can query BigQuery, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the BigQuery Wrapper#

Enable the `bigquery_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper bigquery_wrapper
    
    2
    
      handler big_query_fdw_handler
    
    3
    
      validator big_query_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your BigQuery service account json in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '
    
    4
    
        {
    
    5
    
          "type": "service_account",
    
    6
    
          "project_id": "your_gcp_project_id",
    
    7
    
          "private_key_id": "your_private_key_id",
    
    8
    
          "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    
    9
    
          ...
    
    10
    
        }
    
    11
    
      ',
    
    12
    
      'bigquery',
    
    13
    
      'BigQuery service account json for Wrappers'
    
    14
    
    );
[/code]

### Connecting to BigQuery#

We need to provide Postgres with the credentials to connect to BigQuery, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server bigquery_server
    
    2
    
      foreign data wrapper bigquery_wrapper
    
    3
    
      options (
    
    4
    
        sa_key_id '<key_ID>', -- The Key ID from above.
    
    5
    
        project_id 'your_gcp_project_id',
    
    6
    
        dataset_id 'your_gcp_dataset_id'
    
    7
    
      );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists bigquery;
[/code]

## Options#

The following options are available when creating BigQuery foreign tables:

  * `table` \- Source table or view name in BigQuery, required
  * `location` \- Source table location (default: 'US')
  * `timeout` \- Query request timeout in milliseconds (default: 30000)
  * `rowid_column` \- Primary key column name (required for data modification)


You can also use a subquery as the table option:
[code] 
    1
    
    table '(select * except(props), to_json_string(props) as props from `my_project.my_dataset.my_table`)'
[/code]

Note: When using subquery, full qualified table name must be used.

## Entites#

### Tables#

The BigQuery Wrapper supports data reads and writes from BigQuery tables and views.

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Tables| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table bigquery.my_bigquery_table (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      ts timestamp
    
    5
    
    )
    
    6
    
      server bigquery_server
    
    7
    
      options (
    
    8
    
        table 'people',
    
    9
    
        location 'EU'
    
    10
    
      );
[/code]

#### Notes#

  * Supports `where`, `order by`, `limit` and aggregate clause pushdown
  * When using `rowid_column`, it must be specified for data modification operations
  * Data in the streaming buffer cannot be updated or deleted until the buffer is flushed (up to 90 minutes)


## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown.

### Aggregate Pushdown#

The FDW pushes common aggregate queries down to BigQuery so the aggregation runs remotely and only the final result rows are transferred to Postgres. This is much faster than fetching every row and aggregating locally, especially over large tables — and on BigQuery it also reduces the bytes scanned billed to your project.

**Supported aggregates** — `count(*)`, `count(col)`, `count(distinct col)`, `sum(col)`, `avg(col)`, `min(col)`, `max(col)`.

**Supported shapes** — scalar aggregates, `group by` over plain columns, with or without a `where` clause. Pushdown also works when the foreign `table` option is a sub-query.
[code] 
    1
    
    -- All of these run as a single aggregate query on BigQuery:
    
    2
    
    select count(*) from bigquery.my_table;
    
    3
    
    select id, sum(amount) from bigquery.my_table group by id;
    
    4
    
    select count(distinct name) from bigquery.my_table where id = 1;
[/code]

**Cases that are not pushed down** — the query still returns the correct result, but the aggregation happens in Postgres after fetching the rows:

  * The query has a `having` clause
  * The aggregate has a `filter (where …)` clause
  * A `distinct` modifier is used on anything other than `count`
  * The aggregate's argument is not a plain column (for example `sum(a + 1)`)
  * A `group by` item is not a plain column (for example `group by id + 1`)
  * The aggregate function is not in the list above (for example `stddev`, `string_agg`)


## Inserting Rows & the Streaming Buffer#

This foreign data wrapper uses BigQuery’s `insertAll` API method to create a `streamingBuffer` with an associated partition time. **Within that partition time, the data cannot be updated, deleted, or fully exported**. Only after the time has elapsed (up to 90 minutes according to [BigQuery’s documentation](<https://cloud.google.com/bigquery/docs/streaming-data-into-bigquery>)), can you perform operations.

If you attempt an `UPDATE` or `DELETE` statement on rows while in the streamingBuffer, you will get an error of `UPDATE` or `DELETE` statement over table datasetName - note that tableName would affect rows in the streaming buffer, which is not supported.

## Supported Data Types#

Postgres Type| BigQuery Type  
---|---  
boolean| BOOL  
bigint| INT64  
double precision| FLOAT64  
numeric| NUMERIC  
text| STRING  
varchar| STRING  
date| DATE  
timestamp| DATETIME  
timestamp| TIMESTAMP  
timestamptz| TIMESTAMP  
jsonb| JSON  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience network latency during data transfer
  * Data in streaming buffer cannot be modified for up to 90 minutes
  * Only supports specific data type mappings between Postgres and BigQuery
  * Materialized views using foreign tables may fail during logical backups


## Examples#

Some examples on how to use BigQuery foreign tables.

Let's prepare the source table in BigQuery first:
[code] 
    1
    
    -- Run below SQLs on BigQuery to create source table
    
    2
    
    create table your_project_id.your_dataset_id.people (
    
    3
    
      id int64,
    
    4
    
      name string,
    
    5
    
      ts timestamp,
    
    6
    
      props jsonb
    
    7
    
    );
    
    8
    
    9
    
    -- Add some test data
    
    10
    
    insert into your_project_id.your_dataset_id.people values
    
    11
    
      (1, 'Luke Skywalker', current_timestamp(), parse_json('{"coordinates":[10,20],"id":1}')),
    
    12
    
      (2, 'Leia Organa', current_timestamp(), null),
    
    13
    
      (3, 'Han Solo', current_timestamp(), null);
[/code]

### Basic example#

This example will create a "foreign table" inside your Postgres database called `people` and query its data:
[code] 
    1
    
    create foreign table bigquery.people (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      ts timestamp,
    
    5
    
      props jsonb
    
    6
    
    )
    
    7
    
      server bigquery_server
    
    8
    
      options (
    
    9
    
        table 'people',
    
    10
    
        location 'EU'
    
    11
    
      );
    
    12
    
    13
    
    select * from bigquery.people;
[/code]

### Data modify example#

This example will modify data in a "foreign table" inside your Postgres database called `people`, note that `rowid_column` option is mandatory:
[code] 
    1
    
    create foreign table bigquery.people (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      ts timestamp,
    
    5
    
      props jsonb
    
    6
    
    )
    
    7
    
      server bigquery_server
    
    8
    
      options (
    
    9
    
        table 'people',
    
    10
    
        location 'EU',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
    
    13
    
    14
    
    -- insert new data
    
    15
    
    insert into bigquery.people(id, name, ts, props)
    
    16
    
    values (4, 'Yoda', '2023-01-01 12:34:56', '{"coordinates":[10,20],"id":1}'::jsonb);
    
    17
    
    18
    
    -- update existing data
    
    19
    
    update bigquery.people
    
    20
    
    set name = 'Anakin Skywalker', props = '{"coordinates":[30,40],"id":42}'::jsonb
    
    21
    
    where id = 1;
    
    22
    
    23
    
    -- delete data
    
    24
    
    delete from bigquery.people
    
    25
    
    where id = 2;
[/code]

### Aggregate Query Examples#

These examples assume an `orders` table on BigQuery and a matching foreign table on Postgres:
[code] 
    1
    
    -- Run on BigQuery
    
    2
    
    create table your_project_id.your_dataset_id.orders (
    
    3
    
      id       int64,
    
    4
    
      user_id  int64,
    
    5
    
      amount   numeric,
    
    6
    
      status   string
    
    7
    
    );
    
    8
    
    9
    
    insert into your_project_id.your_dataset_id.orders values
    
    10
    
      (1, 1, 100.0, 'paid'),
    
    11
    
      (2, 1,  50.0, 'paid'),
    
    12
    
      (3, 2, 200.0, 'pending'),
    
    13
    
      (4, 2,  75.0, 'paid'),
    
    14
    
      (5, 3, 300.0, 'paid');
[/code]
[code] 
    1
    
    -- Foreign table on Postgres
    
    2
    
    create foreign table bigquery.orders (
    
    3
    
      id      bigint,
    
    4
    
      user_id bigint,
    
    5
    
      amount  numeric,
    
    6
    
      status  text
    
    7
    
    )
    
    8
    
      server bigquery_server
    
    9
    
      options (
    
    10
    
        table 'orders'
    
    11
    
      );
[/code]

Each query below runs a single aggregate query against BigQuery and returns just the result rows:
[code] 
    1
    
    -- Total order count
    
    2
    
    select count(*) from bigquery.orders;
    
    3
    
    4
    
    -- Total revenue from paid orders
    
    5
    
    select sum(amount) from bigquery.orders where status = 'paid';
    
    6
    
    7
    
    -- Per-user order count and revenue
    
    8
    
    select user_id, count(*) as orders, sum(amount) as revenue
    
    9
    
    from bigquery.orders
    
    10
    
    group by user_id
    
    11
    
    order by user_id;
    
    12
    
    13
    
    -- Smallest and largest order
    
    14
    
    select min(amount), max(amount) from bigquery.orders;
    
    15
    
    16
    
    -- Number of distinct users who placed an order
    
    17
    
    select count(distinct user_id) from bigquery.orders;
    
    18
    
    19
    
    -- Average order value per status
    
    20
    
    select status, avg(amount) as avg_amount
    
    21
    
    from bigquery.orders
    
    22
    
    group by status;
[/code]