---
タイトル: Logflare
URL: https://supabase.com/docs/guides/database/extensions/wrappers/logflare
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, logflare, wrappers
---

# Logflare

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/logflare
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, logflare, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Logflare Wrapper#](#enable-the-logflare-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Logflare#](#connecting-to-logflare)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Logflare#](#logflare)
- [Query Pushdown Support#](#query-pushdown-support)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Query Parameters Example#](#query-parameters-example)

## 概要

Searchdocs...

---

You can enable the Logflare wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/logflare_wrapper/overview>)

[Logflare](<https://logflare.app>) is a centralized web-based log management solution to easily access Cloudflare, Vercel & Elixir logs.

The Logflare Wrapper allows you to read data from Logflare endpoints within your Postgres database.

## Preparation#

Before you can query Logflare, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Logflare Wrapper#

Enable the `logflare_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper logflare_wrapper
    
    2
    
      handler logflare_fdw_handler
    
    3
    
      validator logflare_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Logflare API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<YOUR_SECRET>',
    
    4
    
      'logflare',
    
    5
    
      'Logflare API key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Logflare#

We need to provide Postgres with the credentials to connect to Logflare, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server logflare_server
    
    2
    
      foreign data wrapper logflare_wrapper
    
    3
    
      options (
    
    4
    
        api_key_id '<key_ID>' -- The Key ID from above.
    
    5
    
      );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists logflare;
[/code]

## Options#

The full list of foreign table options are below:

  * `endpoint` \- Logflare endpoint UUID or name, required.


## Entities#

### Logflare#

This is an object representing Logflare endpoint data.

Ref: [Logflare docs](<https://logflare.app>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Logflare| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table logflare.my_logflare_table (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      _result text
    
    5
    
    )
    
    6
    
      server logflare_server
    
    7
    
      options (
    
    8
    
        endpoint '9dd9a6f6-8e9b-4fa4-b682-4f2f5cd99da3'
    
    9
    
      );
[/code]

#### Notes#

##### Meta Column `_result`:

  * Data type must be `text`
  * Stores the whole result record in JSON string format
  * Use JSON queries to extract fields: `_result::json->>'field_name'`


##### Query Parameters:

  * Use parameter columns with prefix `_param_`
  * Example: `_param_org_id`, `_param_iso_timestamp_start`
  * Parameters are passed to the Logflare endpoint


## Query Pushdown Support#

This FDW doesn't support query pushdown.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Full result sets are loaded into memory, which can impact PostgreSQL performance with large datasets
  * Parameter names must be prefixed with '_param_ ' and match the expected endpoint parameters exactly
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

Given a Logflare endpoint response:
[code] 
    1
    
    [
    
    2
    
      {
    
    3
    
        "id": 123,
    
    4
    
        "name": "foo"
    
    5
    
      }
    
    6
    
    ]
[/code]

You can create and query a foreign table:
[code] 
    1
    
    create foreign table logflare.people (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      _result text
    
    5
    
    )
    
    6
    
      server logflare_server
    
    7
    
      options (
    
    8
    
        endpoint '9dd9a6f6-8e9b-4fa4-b682-4f2f5cd99da3'
    
    9
    
      );
    
    10
    
    11
    
    select * from logflare.people;
[/code]

### Query Parameters Example#

For an endpoint accepting parameters:

  * org_id
  * iso_timestamp_start
  * iso_timestamp_end


With response format:
[code] 
    1
    
    [
    
    2
    
      {
    
    3
    
        "db_size": "large",
    
    4
    
        "org_id": "123",
    
    5
    
        "runtime_hours": 21.95,
    
    6
    
        "runtime_minutes": 1317
    
    7
    
      }
    
    8
    
    ]
[/code]

Create and query the table with parameters:
[code] 
    1
    
    create foreign table logflare.runtime_hours (
    
    2
    
      db_size text,
    
    3
    
      org_id text,
    
    4
    
      runtime_hours numeric,
    
    5
    
      runtime_minutes bigint,
    
    6
    
      _param_org_id bigint,
    
    7
    
      _param_iso_timestamp_start text,
    
    8
    
      _param_iso_timestamp_end text,
    
    9
    
      _result text
    
    10
    
    )
    
    11
    
      server logflare_server
    
    12
    
      options (
    
    13
    
        endpoint 'my.custom.endpoint'
    
    14
    
      );
    
    15
    
    16
    
    select
    
    17
    
      db_size,
    
    18
    
      org_id,
    
    19
    
      runtime_hours,
    
    20
    
      runtime_minutes
    
    21
    
    from
    
    22
    
      logflare.runtime_hours
    
    23
    
    where _param_org_id = 123
    
    24
    
      and _param_iso_timestamp_start = '2023-07-01 02:03:04'
    
    25
    
      and _param_iso_timestamp_end = '2023-07-02';
[/code]