---
タイトル: Snowflake
URL: https://supabase.com/docs/guides/database/extensions/wrappers/snowflake
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, snowflake, wrappers
---

# Snowflake

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/snowflake
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, snowflake, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Snowflake Wrapper#](#enable-the-snowflake-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Snowflake#](#connecting-to-snowflake)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Snowflake Tables/Views#](#snowflake-tablesviews)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Data Modify Example#](#data-modify-example)

## 概要

Searchdocs...

---

You can enable the Snowflake wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/snowflake_wrapper/overview>)

[Snowflake](<https://www.snowflake.com>) is a cloud-based data platform provided as a DaaS (Data-as-a-Service) solution with data storage and analytics service.

The Snowflake Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read and write data from Snowflake within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.1| `https://github.com/supabase/wrappers/releases/download/wasm_snowflake_fdw_v0.2.1/snowflake_fdw.wasm`| `9863b913308f2700090db7f2f8b50751524a39d743b401830cdae98cbace650e`| >=0.5.0  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_snowflake_fdw_v0.2.0/snowflake_fdw.wasm`| `921b18a1e9c20c4ef5a09af17b5d76fd6ebe56d41bcfa565b74a530420532437`| >=0.5.0  
0.1.1| `https://github.com/supabase/wrappers/releases/download/wasm_snowflake_fdw_v0.1.1/snowflake_fdw.wasm`| `7aaafc7edc1726bc93ddc04452d41bda9e1a264a1df2ea9bf1b00b267543b860`| >=0.4.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_snowflake_fdw_v0.1.0/snowflake_fdw.wasm`| `2fb46fd8afa63f3975dadf772338106b609b131861849356e0c09dde032d1af8`| >=0.4.0  
  
## Preparation#

Before you can query Snowflake, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Snowflake Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.

This FDW uses key-pair authentication to access Snowflake SQL Rest API, please refer to [Snowflake docs](<https://docs.snowflake.com/en/developer-guide/sql-api/authenticating#label-sql-api-authenticating-key-pair>) for more details about the key-pair authentication.
[code] 
    1
    
    -- Save your Snowflake private key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      E'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    
    4
    
      'snowflake',
    
    5
    
      'Snowflake private key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Snowflake#

We need to provide Postgres with the credentials to connect to Snowflake, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server snowflake_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_snowflake_fdw_v0.2.1/snowflake_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:snowflake-fdw',
    
    6
    
        fdw_package_version '0.2.1',
    
    7
    
        fdw_package_checksum '9863b913308f2700090db7f2f8b50751524a39d743b401830cdae98cbace650e',
    
    8
    
        account_identifier 'MYORGANIZATION-MYACCOUNT',
    
    9
    
        user 'MYUSER',
    
    10
    
        public_key_fingerprint 'SizgPofeFX0jwC8IhbOfGFyOggFgo8oTOS1uPLZhzUQ=',
    
    11
    
        private_key_id '<key_ID>', -- The Key ID from above.
    
    12
    
        timeout_secs '60'  -- Timeout in seconds for Snowflake statement execution, default is 60, value range is [0, 6048]
    
    13
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists snowflake;
[/code]

## Options#

The full list of foreign table options are below:

  * `table` \- Source table or view name in Snowflake, required.

This option can also be a subquery enclosed in parentheses.

  * `rowid_column` \- Primary key column name, optional for data scan, required for data modify


## Entities#

### Snowflake Tables/Views#

This is an object representing a Snowflake table or view.

Ref: [Snowflake docs](<https://docs.snowflake.com/en/sql-reference/sql/create-table>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
table/view| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table snowflake.mytable (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      num numeric,
    
    5
    
      dt date,
    
    6
    
      ts timestamp
    
    7
    
    )
    
    8
    
      server snowflake_server
    
    9
    
      options (
    
    10
    
        table 'mydatabase.public.mytable',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
[/code]

#### Notes#

  * Supports both tables and views as data sources
  * Can use subqueries in `table` option
  * Requires `rowid_column` for data modification operations
  * Supports query pushdown for `where`, `order by`, and `limit` clauses
  * Column names must match between Snowflake and foreign table
  * Data types must be compatible according to type mapping table


## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown.

## Supported Data Types#

Postgres Data Type| Snowflake Data Type  
---|---  
boolean| BOOLEAN  
smallint| SMALLINT  
integer| INT  
bigint| BIGINT  
real| FLOAT4  
double precision| FLOAT8  
numeric| NUMBER  
text| VARCHAR  
date| DATE  
timestamp| TIMESTAMP_NTZ  
timestamptz| TIMESTAMP_TZ  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Column names must exactly match between Snowflake and foreign table
  * Foreign tables with subquery option cannot support data modify
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

Let's prepare the source table in Snowflake first:
[code] 
    1
    
    -- Create a database
    
    2
    
    create database if not exists mydatabase;
    
    3
    
    4
    
    -- Run below SQLs on Snowflake to create source table
    
    5
    
    create table mydatabase.public.mytable (
    
    6
    
      id number(38,0),
    
    7
    
      name varchar(16777216),
    
    8
    
      num number(38,6),
    
    9
    
      dt date,
    
    10
    
      ts timestamp_ntz(9)
    
    11
    
    );
    
    12
    
    13
    
    -- Add some test data
    
    14
    
    insert into mydatabase.public.mytable(id, name, num, dt, ts)
    
    15
    
    values (42, 'foo', 12.34, '2024-05-18', '2024-05-18 12:34:56');
    
    16
    
    insert into mydatabase.public.mytable(id, name, num, dt, ts)
    
    17
    
    values (43, 'bar', 56.78, '2024-05-19', '2024-05-19 12:34:56');
[/code]

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table snowflake.mytable (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      num numeric,
    
    5
    
      dt date,
    
    6
    
      ts timestamp
    
    7
    
    )
    
    8
    
      server snowflake_server
    
    9
    
      options (
    
    10
    
        table 'mydatabase.public.mytable',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
    
    13
    
    14
    
    select * from snowflake.mytable;
[/code]

### Data Modify Example#

This example will modify data in a "foreign table" inside your Postgres database, note that `rowid_column` option is required for data modify:
[code] 
    1
    
    -- insert new data
    
    2
    
    insert into snowflake.mytable (id, name, num, dt, ts)
    
    3
    
    values (42, 'hello', 456.123, '2024-05-20', '2024-05-20 12:34:56');
    
    4
    
    5
    
    -- update existing data
    
    6
    
    update snowflake.mytable
    
    7
    
    set name = 'new name', num = null, dt = '2024-01-01', ts = '2024-01-02 21:43:56'
    
    8
    
    where id = 42;
    
    9
    
    10
    
    -- delete data
    
    11
    
    delete from snowflake.mytable
    
    12
    
    where id = 42;
[/code]