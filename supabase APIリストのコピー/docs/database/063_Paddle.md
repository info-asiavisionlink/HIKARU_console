---
タイトル: Paddle
URL: https://supabase.com/docs/guides/database/extensions/wrappers/paddle
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, paddle, wrappers
---

# Paddle

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/paddle
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, paddle, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Paddle Wrapper#](#enable-the-paddle-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Paddle#](#connecting-to-paddle)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Products#](#products)
  - [Customers#](#customers)
  - [Subscriptions#](#subscriptions)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Query JSON Attributes#](#query-json-attributes)
  - [Data Modify Example#](#data-modify-example)

## 概要

Searchdocs...

---

You can enable the Paddle wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/paddle_wrapper/overview>)

[Paddle](<https://www.paddle.com>) is a merchant of record that acts to provide a payment infrastructure to thousands of software companies around the world.

The Paddle Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read and write data from Paddle within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_paddle_fdw_v0.2.0/paddle_fdw.wasm`| `e788b29ae46c158643e1e1f229d94b28a9af8edbd3233f59c5a79053c25da213`| >=0.5.0  
0.1.1| `https://github.com/supabase/wrappers/releases/download/wasm_paddle_fdw_v0.1.1/paddle_fdw.wasm`| `c5ac70bb2eef33693787b7d4efce9a83cde8d4fa40889d2037403a51263ba657`| >=0.4.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_paddle_fdw_v0.1.0/paddle_fdw.wasm`| `7d0b902440ac2ef1af85d09807145247f14d1d8fd4d700227e5a4d84c8145409`| >=0.4.0  
  
## Preparation#

Before you can query Paddle, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Paddle Wrapper#

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
    
    -- Save your Paddle API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Paddle API key>', -- Paddle API key
    
    4
    
      'paddle',
    
    5
    
      'Paddle API key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Paddle#

We need to provide Postgres with the credentials to access Paddle, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server paddle_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_paddle_fdw_v0.2.0/paddle_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:paddle-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'e788b29ae46c158643e1e1f229d94b28a9af8edbd3233f59c5a79053c25da213',
    
    8
    
        api_url 'https://sandbox-api.paddle.com', -- Use https://api.paddle.com for live account
    
    9
    
        api_key_id '<key_ID>' -- The Key ID from above.
    
    10
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists paddle;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in Paddle, required.


Supported objects are listed below:

Object  
---  
products  
prices  
discounts  
customers  
transactions  
reports  
notification-settings  
notifications  
  
  * `rowid_column` \- Primary key column name, optional for data scan, required for data modify


## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Paddle.

For example, using below SQL can automatically create foreign tables in the `paddle` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema paddle from server paddle_server into paddle;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema paddle
    
    6
    
       limit to ("products", "customers")
    
    7
    
       from server paddle_server into paddle;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema paddle
    
    11
    
       except ("customers")
    
    12
    
       from server paddle_server into paddle;
[/code]

### Products#

This is an object representing Paddle Products.

Ref: [Paddle API docs](<https://developer.paddle.com/api-reference/about/data-types>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Products| ✅| ✅| ✅| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table paddle.products (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      tax_category text,
    
    5
    
      status text,
    
    6
    
      description text,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server paddle_server
    
    12
    
      options (
    
    13
    
        object 'products',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
[/code]

#### Notes#

  * Requires `rowid_column` option for data modification operations
  * Query pushdown supported for `id` column
  * Product type can be extracted using: `attrs->>'type'`


### Customers#

This is an object representing Paddle Customers.

Ref: [Paddle API docs](<https://developer.paddle.com/api-reference/about/data-types>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Customers| ✅| ✅| ✅| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table paddle.customers (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      email text,
    
    5
    
      status text,
    
    6
    
      custom_data jsonb,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server paddle_server
    
    12
    
      options (
    
    13
    
        object 'customers',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
[/code]

#### Notes#

  * Requires `rowid_column` option for data modification operations
  * Query pushdown supported for `id` column
  * Custom data stored in dedicated `custom_data` column


### Subscriptions#

This is an object representing Paddle Subscriptions.

Ref: [Paddle API docs](<https://developer.paddle.com/api-reference/about/data-types>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Subscriptions| ✅| ✅| ✅| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table paddle.subscriptions (
    
    2
    
      id text,
    
    3
    
      status text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server paddle_server
    
    9
    
      options (
    
    10
    
        object 'subscriptions',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
[/code]

#### Notes#

  * Requires `rowid_column` option for data modification operations
  * Query pushdown supported for `id` column
  * Subscription items status can be extracted using: `attrs#>'{items,status}'`


## Query Pushdown Support#

This FDW supports `where` clause pushdown with `id` as the filter. For example,
[code] 
    1
    
    select * from paddle.customers where id = 'ctm_01hymwgpkx639a6mkvg99563sp';
[/code]

## Supported Data Types#

Postgres Data Type| Paddle Data Type  
---|---  
boolean| Boolean  
smallint| Money  
integer| Money  
bigint| Money  
real| Money  
double precision| Money  
numeric| Money  
text| Text  
date| Dates and time  
timestamp| Dates and time  
timestamptz| Dates and time  
  
The Paddle API uses JSON formatted data, please refer to [Paddle docs](<https://developer.paddle.com/api-reference/about/data-types>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Query pushdown is only supported for the `id` column, resulting in full table scans for other filters
  * Large result sets may experience slower performance due to full data transfer requirement
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table paddle.customers (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      email text,
    
    5
    
      status text,
    
    6
    
      custom_data jsonb,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server paddle_server
    
    12
    
      options (
    
    13
    
        object 'customers',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
    
    16
    
    17
    
    select * from paddle.customers;
[/code]

`attrs` is a special column which stores all the object attributes in JSON format, you can extract any attributes needed or its associated sub objects from it. See more examples below.

### Query JSON Attributes#
[code] 
    1
    
    create foreign table paddle.products (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      tax_category text,
    
    5
    
      status text,
    
    6
    
      description text,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server paddle_server
    
    12
    
      options (
    
    13
    
        object 'products',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
    
    16
    
    17
    
    -- extract product type for a product
    
    18
    
    select id, attrs->>'type' as type
    
    19
    
    from paddle.products where id = 'pro_01hymwj50rfavry9kqsf2vk6sy';
    
    20
    
    21
    
    create foreign table paddle.subscriptions (
    
    22
    
      id text,
    
    23
    
      status text,
    
    24
    
      created_at timestamp,
    
    25
    
      updated_at timestamp,
    
    26
    
      attrs jsonb
    
    27
    
    )
    
    28
    
      server paddle_server
    
    29
    
      options (
    
    30
    
        object 'subscriptions',
    
    31
    
        rowid_column 'id'
    
    32
    
      );
    
    33
    
    34
    
    -- extract subscription items for a subscription
    
    35
    
    select id, attrs#>'{items,status}' as item_status
    
    36
    
    from paddle.subscriptions where id = 'sub_01hv959anj4zrw503h2acawb3p';
[/code]

### Data Modify Example#

This example will modify data in a "foreign table" inside your Postgres database, note that `rowid_column` option is mandatory for data modify:
[code] 
    1
    
    -- insert new data
    
    2
    
    insert into paddle.products(name, tax_category)
    
    3
    
    values ('my prod', 'standard');
    
    4
    
    5
    
    -- update existing data
    
    6
    
    update paddle.products
    
    7
    
    set name = 'my prod'
    
    8
    
    where id = 'pro_01hzrr95qz1g0cys1f9sgj4t3h';
[/code]