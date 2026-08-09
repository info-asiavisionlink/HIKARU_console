---
タイトル: Notion
URL: https://supabase.com/docs/guides/database/extensions/wrappers/notion
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, notion, wrappers
---

# Notion

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/notion
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, notion, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Notion Wrapper#](#enable-the-notion-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Notion#](#connecting-to-notion)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Block#](#block)
  - [Page#](#page)
  - [Database#](#database)
  - [User#](#user)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Query JSON Attributes#](#query-json-attributes)
  - [Query Blocks#](#query-blocks)

## 概要

Searchdocs...

---

You can enable the Notion wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/notion_wrapper/overview>)

[Notion](<https://notion.so/>) provides a versatile, ready-to-use solution for managing your data.

The Notion Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read data from your Notion workspace for use within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_notion_fdw_v0.2.0/notion_fdw.wasm`| `719910b65a049f1d9b82dc4f5f1466457582bec855e1e487d5c3cc1e6f986dc6`| >=0.5.0  
0.1.1| `https://github.com/supabase/wrappers/releases/download/wasm_notion_fdw_v0.1.1/notion_fdw.wasm`| `6dea3014f462aafd0c051c37d163fe326e7650c26a7eb5d8017a30634b5a46de`| >=0.4.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_notion_fdw_v0.1.0/notion_fdw.wasm`| `e017263d1fc3427cc1df8071d1182cdc9e2f00363344dddb8c195c5d398a2099`| >=0.4.0  
  
## Preparation#

Before you can query Notion, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Notion Wrapper#

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
[code] 
    1
    
    -- Save your Notion API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Notion API key>', -- Notion API key, should look like ntn_589513........
    
    4
    
      'notion',
    
    5
    
      'Notion API key for Wrappers'
    
    6
    
    );
[/code]

> ⚠️ ** Getting a Notion API key**
> 
>   1. Visit [Notion > Profile > Integrations](<https://www.notion.so/profile/integrations>)
>   2. Click `New integration`
>   3. Add an integration name, select your workspace, then select Internal as the Type
>   4. This will give you an `Internal Integration Secret` that will look like `ntn_589513........`
>   5. Use this as your Notion API key
> 


### Connecting to Notion#

We need to provide Postgres with the credentials to access Notion and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server notion_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_notion_fdw_v0.1.1/notion_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:notion-fdw',
    
    6
    
        fdw_package_version '0.1.1',
    
    7
    
        fdw_package_checksum '6dea3014f462aafd0c051c37d163fe326e7650c26a7eb5d8017a30634b5a46de',
    
    8
    
        api_url 'https://api.notion.com/v1',  -- optional
    
    9
    
        api_key_id '<vault key_ID>' -- the Vault key id from the previous step, not the Notion API key itself
    
    10
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists notion;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in Notion, required.


Supported objects are listed below:

Object name  
---  
block  
page  
database  
user  
  
## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Notion.

For example, using below SQL can automatically create foreign tables in the `notion` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema notion from server notion_server into notion;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema notion
    
    6
    
       limit to ("blocks", "pages")
    
    7
    
       from server notion_server into notion;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema notion
    
    11
    
       except ("blocks")
    
    12
    
       from server notion_server into notion;
[/code]

### Block#

This is an object representing Notion Block content.

Ref: [Notion API docs](<https://developers.notion.com/reference/intro>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Block| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table notion.blocks (
    
    2
    
      id text,
    
    3
    
      page_id text,
    
    4
    
      type text,
    
    5
    
      created_time timestamp,
    
    6
    
      last_edited_time timestamp,
    
    7
    
      archived boolean,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server notion_server
    
    11
    
      options (
    
    12
    
        object 'block'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all user attributes in JSON format
  * The `page_id` field is added by the FDW for development convenience
  * All blocks, including nested children blocks, belong to one page will have the same `page_id`
  * Query pushdown supported for both `id` and `page_id` columns
  * Use `page_id` filter to fetch all blocks of a specific page recursively
  * Querying all blocks without filters may take a long time due to recursive data requests


### Page#

This is an object representing Notion Pages.

Ref: [Notion API docs](<https://developers.notion.com/reference/intro>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Page| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table notion.pages (
    
    2
    
      id text,
    
    3
    
      url text,
    
    4
    
      created_time timestamp,
    
    5
    
      last_edited_time timestamp,
    
    6
    
      archived boolean,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server notion_server
    
    10
    
      options (
    
    11
    
        object 'page'
    
    12
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all page attributes in JSON format
  * Query pushdown supported for `id` column


### Database#

This is an object representing Notion Databases.

Ref: [Notion API docs](<https://developers.notion.com/reference/intro>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Database| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table notion.databases (
    
    2
    
      id text,
    
    3
    
      url text,
    
    4
    
      created_time timestamp,
    
    5
    
      last_edited_time timestamp,
    
    6
    
      archived boolean,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server notion_server
    
    10
    
      options (
    
    11
    
        object 'database'
    
    12
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all database attributes in JSON format
  * Query pushdown supported for `id` column


### User#

This is an object representing Notion Users.

Ref: [Notion API docs](<https://developers.notion.com/reference/intro>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
User| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table notion.users (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      type text,
    
    5
    
      avatar_url text,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server notion_server
    
    9
    
      options (
    
    10
    
        object 'user'
    
    11
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all user attributes in JSON format
  * Query pushdown supported for `id` column
  * User email can be extracted using: `attrs->'person'->>'email'`


## Query Pushdown Support#

This FDW supports `where` clause pushdown with `id` as the filter. For example,
[code] 
    1
    
    select * from notion.pages
    
    2
    
    where id = '5a67c86f-d0da-4d0a-9dd7-f4cf164e6247';
[/code]

will be translated to a Notion API call: `https://api.notion.com/v1/pages/5a67c86f-d0da-4d0a-9dd7-f4cf164e6247`.

In addition to `id` column pushdown, `page_id` column pushdown is also supported for `Block` object. For example,
[code] 
    1
    
    select * from notion.blocks
    
    2
    
    where page_id = '5a67c86f-d0da-4d0a-9dd7-f4cf164e6247';
[/code]

will recursively fetch all children blocks of the Page with id '5a67c86f-d0da-4d0a-9dd7-f4cf164e6247'. This can dramatically reduce number of API calls and improve query performance.

Below query will request ALL the blocks of ALL pages recursively, it may take very long time to run if there are many pages in Notion. So it is recommended to always query Block object with an `id` or `page_id` filter like above.
[code]
    1
    
    select * from notion.blocks;
[/code]

## Supported Data Types#

Postgres Data Type| Notion Data Type  
---|---  
boolean| Boolean  
text| String  
timestamp| Time  
timestamptz| Time  
jsonb| Json  
  
The Notion API uses JSON formatted data, please refer to [Notion API docs](<https://developers.notion.com/reference/intro>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Query pushdown support limited to 'id' and 'page_id' columns only
  * Recursive block fetching can be extremely slow for large page hierarchies
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table notion.pages (
    
    2
    
      id text,
    
    3
    
      url text,
    
    4
    
      created_time timestamp,
    
    5
    
      last_edited_time timestamp,
    
    6
    
      archived boolean,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server notion_server
    
    10
    
      options (
    
    11
    
        object 'page'
    
    12
    
      );
    
    13
    
    14
    
    -- query all pages
    
    15
    
    select * from notion.pages;
    
    16
    
    17
    
    -- query one page
    
    18
    
    select * from notion.pages
    
    19
    
    where id = '5a67c86f-d0da-4d0a-9dd7-f4cf164e6247';
[/code]

`attrs` is a special column which stores all the object attributes in JSON format, you can extract any attributes needed from it. See more examples below.

### Query JSON Attributes#
[code] 
    1
    
    create foreign table notion.users (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      type text,
    
    5
    
      avatar_url text,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server notion_server
    
    9
    
      options (
    
    10
    
        object 'user'
    
    11
    
      );
    
    12
    
    13
    
    -- extract user's email address
    
    14
    
    select id, attrs->'person'->>'email' as email
    
    15
    
    from notion.users
    
    16
    
    where id = 'fd0ed76c-44bd-413a-9448-18ff4b1d6a5e';
[/code]

### Query Blocks#
[code] 
    1
    
    -- query ALL blocks of ALL pages recursively, may take long time!
    
    2
    
    select * from notion.blocks;
    
    3
    
    4
    
    -- query a single block by block id
    
    5
    
    select * from notion.blocks
    
    6
    
    where id = 'fc248547-83ef-4069-b7c9-18897edb7150';
    
    7
    
    8
    
    -- query all block of a page by page id
    
    9
    
    select * from notion.blocks
    
    10
    
    where page_id = '5a67c86f-d0da-4d0a-9dd7-f4cf164e6247';
[/code]