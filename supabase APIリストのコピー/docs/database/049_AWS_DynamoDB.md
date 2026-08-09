---
タイトル: AWS DynamoDB
URL: https://supabase.com/docs/guides/database/extensions/wrappers/dynamodb
カテゴリ: database
更新日: 2026-08-02
タグ: database, dynamodb, extensions, wrappers
---

# AWS DynamoDB

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/dynamodb
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, dynamodb, extensions, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the DynamoDB Wrapper#](#enable-the-dynamodb-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to DynamoDB#](#connecting-to-dynamodb)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [DynamoDB Tables#](#dynamodb-tables)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Query (efficient — uses DynamoDBQueryAPI)#](#query-efficient--uses-dynamodb-query-api)
  - [Scan (full table — uses DynamoDBScanAPI)#](#scan-full-table--uses-dynamodb-scan-api)
  - [Supported Operators#](#supported-operators)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic setup#](#basic-setup)
  - [Import all tables automatically#](#import-all-tables-automatically)
  - [Create a foreign table manually#](#create-a-foreign-table-manually)
  - [Query with partition key pushdown#](#query-with-partition-key-pushdown)
  - [Query with filter (full scan)#](#query-with-filter-full-scan)
  - [Insert a new item#](#insert-a-new-item)
  - [Update specific attributes#](#update-specific-attributes)
  - [Delete an item#](#delete-an-item)
  - [Using DynamoDB Local for development#](#using-dynamodb-local-for-development)

## 概要

Searchdocs...

---

[AWS DynamoDB](<https://aws.amazon.com/dynamodb/>) is a fully managed, serverless, key-value NoSQL database designed to run high-performance applications at any scale.

The DynamoDB Wrapper allows you to read and write DynamoDB table data within your Postgres database.

## Preparation#

Before you can query DynamoDB, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the DynamoDB Wrapper#

Enable the `dynamodb_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper dynamodb_wrapper
    
    2
    
      handler dynamo_db_fdw_handler
    
    3
    
      validator dynamo_db_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your AWS access key ID in Vault
    
    2
    
    select vault.create_secret(
    
    3
    
      '<access key id>',
    
    4
    
      'dynamodb_access_key_id',
    
    5
    
      'AWS access key ID for DynamoDB Wrappers'
    
    6
    
    );
    
    7
    
    8
    
    -- Save your AWS secret access key in Vault
    
    9
    
    select vault.create_secret(
    
    10
    
      '<secret access key>',
    
    11
    
      'dynamodb_secret_access_key',
    
    12
    
      'AWS secret access key for DynamoDB Wrappers'
    
    13
    
    );
[/code]

### Connecting to DynamoDB#

We need to provide Postgres with the credentials to connect to DynamoDB. We can do this using the `create server` command.

With VaultWithout Vault
[code]
    1
    
    create server dynamodb_server
    
    2
    
      foreign data wrapper dynamodb_wrapper
    
    3
    
      options (
    
    4
    
        -- The key id saved in Vault from above
    
    5
    
        vault_access_key_id '<vault_key_id>',
    
    6
    
    7
    
        -- The secret id saved in Vault from above
    
    8
    
        vault_secret_access_key '<vault_secret_id>',
    
    9
    
    10
    
        -- AWS region where your DynamoDB table(s) reside
    
    11
    
        region 'us-east-1'
    
    12
    
      );
[/code]

#### Additional Server Options#

Option| Required| Description  
---|---|---  
`region`| Yes| AWS region where your DynamoDB tables reside (e.g. `us-east-1`)  
`endpoint_url`| No| Custom endpoint URL, useful for local development with DynamoDB Local  
  
### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists dynamodb;
[/code]

## Options#

The full list of foreign table options are below:

Option| Required| Description  
---|---|---  
`table`| Yes| The DynamoDB table name to query  
`rowid_column`| No| The column to use as the row identifier for `UPDATE` and `DELETE` operations. Must be the partition key column. Required for write operations.  
  
## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to automatically create foreign table definitions from your DynamoDB tables.
[code] 
    1
    
    import foreign schema dynamodb from server dynamodb_server into dynamodb;
[/code]

This will call `ListTables` and `DescribeTable` for each table and generate a `CREATE FOREIGN TABLE` statement with:

  * Key columns (partition key and optional sort key) typed as `text`
  * A `_attrs jsonb` catch-all column that captures every non-key attribute as a JSON object


For example, a DynamoDB table `users` with partition key `id` and attributes `name`, `age`, and `active` would produce:
[code] 
    1
    
    create foreign table users (
    
    2
    
      id    text not null,
    
    3
    
      _attrs jsonb
    
    4
    
    )
    
    5
    
    server dynamodb_server
    
    6
    
    options (table 'users', rowid_column 'id');
[/code]

You can then access individual attributes via standard JSON operators:
[code] 
    1
    
    select
    
    2
    
      id,
    
    3
    
      _attrs->>'name'           as name,
    
    4
    
      (_attrs->>'age')::integer as age,
    
    5
    
      (_attrs->>'active')::boolean as active
    
    6
    
    from dynamodb.users;
[/code]

The `_attrs` name was chosen to avoid conflicts with real DynamoDB attribute names. If you need typed columns or a different layout, create the foreign table manually instead (see Create a foreign table manually).

You can also limit the import to specific tables:
[code] 
    1
    
    -- Import only specific tables
    
    2
    
    import foreign schema dynamodb
    
    3
    
      limit to (users, orders)
    
    4
    
      from server dynamodb_server into dynamodb;
    
    5
    
    6
    
    -- Import all tables except specific ones
    
    7
    
    import foreign schema dynamodb
    
    8
    
      except (staging_table)
    
    9
    
      from server dynamodb_server into dynamodb;
[/code]

### DynamoDB Tables#

Each foreign table maps to one DynamoDB table.

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Table| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table dynamodb.users (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      age bigint,
    
    5
    
      active boolean,
    
    6
    
      metadata jsonb
    
    7
    
    )
    
    8
    
    server dynamodb_server
    
    9
    
    options (
    
    10
    
      table 'users',
    
    11
    
      rowid_column 'id'
    
    12
    
    );
[/code]

#### Notes#

  * Column names in the foreign table must match the DynamoDB attribute names exactly (case-sensitive).
  * Any DynamoDB attribute not listed as a column is silently ignored during reads, **except** when a `jsonb` column has no matching DynamoDB attribute by name — in that case it acts as a catch-all and receives all attributes not covered by any other declared column. This is how the `_attrs` column generated by `import_foreign_schema` works.
  * `INSERT` uses DynamoDB's `PutItem` operation, which **replaces the entire item** if an item with the same key already exists. Use `UPDATE` for partial attribute changes.
  * `UPDATE` and `DELETE` require `rowid_column` to be set to the partition key column name.


## Query Pushdown Support#

The DynamoDB Wrapper supports two scan strategies depending on the `WHERE` clause:

### Query (efficient — uses DynamoDB `Query` API)#

When a `WHERE` clause includes an **equality filter on the partition key** , the wrapper uses the DynamoDB `Query` API. This reads only the items matching the partition key, consuming far fewer read capacity units than a full scan.
[code] 
    1
    
    -- Uses Query API (efficient)
    
    2
    
    select * from dynamodb.users where id = 'user123';
[/code]

Additional conditions on the sort key (if the table has one) are also pushed down as key condition expressions:
[code] 
    1
    
    -- Uses Query API with sort key condition
    
    2
    
    select * from dynamodb.orders where customer_id = 'cust1' and order_date >= '2024-01-01';
[/code]

### Scan (full table — uses DynamoDB `Scan` API)#

When no partition key equality filter is present, the wrapper performs a full `Scan`. Non-key column filters are sent as a `FilterExpression`, which reduces the data transferred over the network but **does not reduce the read capacity units consumed** — DynamoDB reads every item before applying the filter.
[code] 
    1
    
    -- Full Scan with FilterExpression (expensive on large tables)
    
    2
    
    select * from dynamodb.users where age > 30;
    
    3
    
    4
    
    -- Full Scan, no filter
    
    5
    
    select * from dynamodb.users;
[/code]

### Supported Operators#

Operator| Pushdown  
---|---  
`=`| ✅  
`<`| ✅  
`<=`| ✅  
`>`| ✅  
`>=`| ✅  
`<>`| ✅  
`LIKE`| ❌  
`IN`| ❌  
  
Scan costs on large tables

Full table scans on large DynamoDB tables consume significant read capacity and can be slow. Always include a partition key equality filter when querying large tables.

## Supported Data Types#

Postgres Type| DynamoDB Attribute Type  
---|---  
`boolean`| Boolean (BOOL)  
`text`| String (S), Number (N as string), or default  
`smallint`| Number (N)  
`integer`| Number (N)  
`bigint`| Number (N)  
`real`| Number (N)  
`double precision`| Number (N)  
`numeric`| Number (N)  
`date`| String (S, ISO 8601 format)  
`timestamp`| String (S, ISO 8601 format)  
`timestamptz`| String (S, ISO 8601 format)  
`bytea`| Binary (B)  
`jsonb`| List (L), Map (M), String Set (SS), Number Set (NS), Binary Set (BS)  
  
DynamoDB stores numbers as strings internally. The wrapper coerces them to the declared Postgres column type at read time. If no numeric type is declared, numbers are returned as `text`.

Compound types (List, Map, String Set, Number Set, Binary Set) are always converted to `jsonb`.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * `TRUNCATE` is not supported. Use `DELETE` without a `WHERE` clause to remove all rows (this performs a full scan and individual `DeleteItem` calls, so it is slow on large tables).
  * Full table scans (`Scan` API) do not reduce read capacity unit consumption even when a `FilterExpression` is used.
  * `LIKE` and `IN` operators are not pushed down — filtering is done in Postgres after fetching rows.
  * `UPDATE` cannot change partition key or sort key values, as DynamoDB does not support key updates in place.
  * `INSERT` replaces the entire item if the key already exists (`PutItem` semantics). Use `UPDATE` to add or change individual attributes without replacing the whole item.
  * Compound DynamoDB types (List, Map, sets) are read as `jsonb` and written as a JSON string (DynamoDB String attribute). To write native DynamoDB List or Map attributes, manage items directly through the AWS SDK.
  * Materialized views using these foreign tables may fail during logical backups.
  * DynamoDB transactions are not supported.


## Examples#

### Basic setup#
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
    
    2
    
    3
    
    create foreign data wrapper dynamodb_wrapper
    
    4
    
      handler dynamo_db_fdw_handler
    
    5
    
      validator dynamo_db_fdw_validator;
    
    6
    
    7
    
    create server dynamodb_server
    
    8
    
      foreign data wrapper dynamodb_wrapper
    
    9
    
      options (
    
    10
    
        aws_access_key_id '<aws_access_key>',
    
    11
    
        aws_secret_access_key '<aws_secret_key>',
    
    12
    
        region 'us-east-1'
    
    13
    
      );
    
    14
    
    15
    
    create schema if not exists dynamodb;
[/code]

### Import all tables automatically#
[code] 
    1
    
    import foreign schema dynamodb
    
    2
    
      from server dynamodb_server into dynamodb;
[/code]

Each imported table has key columns plus `_attrs jsonb` for everything else:
[code] 
    1
    
    -- Access non-key attributes via JSON operators
    
    2
    
    select
    
    3
    
      id,
    
    4
    
      _attrs->>'name'              as name,
    
    5
    
      (_attrs->>'age')::integer    as age,
    
    6
    
      (_attrs->>'active')::boolean as active,
    
    7
    
      _attrs->'tags'               as tags   -- nested Map
    
    8
    
    from dynamodb.users;
    
    9
    
    10
    
    -- Partition key pushdown still works on imported tables
    
    11
    
    select * from dynamodb.orders where order_id = 'ord-001';
[/code]

### Create a foreign table manually#
[code] 
    1
    
    create foreign table dynamodb.products (
    
    2
    
      product_id text,
    
    3
    
      name text,
    
    4
    
      price numeric,
    
    5
    
      in_stock boolean,
    
    6
    
      tags jsonb
    
    7
    
    )
    
    8
    
    server dynamodb_server
    
    9
    
    options (
    
    10
    
      table 'products',
    
    11
    
      rowid_column 'product_id'
    
    12
    
    );
[/code]

### Query with partition key pushdown#
[code] 
    1
    
    -- Efficient: uses DynamoDB Query API
    
    2
    
    select * from dynamodb.products where product_id = 'prod-001';
[/code]

### Query with filter (full scan)#
[code] 
    1
    
    -- Full scan with server-side FilterExpression
    
    2
    
    select * from dynamodb.products where price > 50;
[/code]

### Insert a new item#
[code] 
    1
    
    insert into dynamodb.products (product_id, name, price, in_stock)
    
    2
    
    values ('prod-999', 'Widget', 9.99, true);
[/code]

### Update specific attributes#
[code] 
    1
    
    -- Only updates 'price' and 'in_stock'; other attributes are preserved
    
    2
    
    update dynamodb.products
    
    3
    
    set price = 12.99, in_stock = false
    
    4
    
    where product_id = 'prod-999';
[/code]

### Delete an item#
[code] 
    1
    
    delete from dynamodb.products where product_id = 'prod-999';
[/code]

### Using DynamoDB Local for development#
[code] 
    1
    
    create server dynamodb_local_server
    
    2
    
      foreign data wrapper dynamodb_wrapper
    
    3
    
      options (
    
    4
    
        aws_access_key_id 'test',
    
    5
    
        aws_secret_access_key 'test',
    
    6
    
        region 'us-east-1',
    
    7
    
        endpoint_url 'http://localhost:8000'
    
    8
    
      );
[/code]