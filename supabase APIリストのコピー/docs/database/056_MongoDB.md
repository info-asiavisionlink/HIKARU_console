---
タイトル: MongoDB
URL: https://supabase.com/docs/guides/database/extensions/wrappers/mongodb
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, mongodb, wrappers
---

# MongoDB

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/mongodb
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, mongodb, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the MongoDB Wrapper#](#enable-the-mongodb-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to MongoDB#](#connecting-to-mongodb)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Collections#](#collections)
- [Schema Mapping#](#schema-mapping)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Supported Operators#](#supported-operators)
- [Supported Data Types#](#supported-data-types)
- [Writes#](#writes)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic example#](#basic-example)
  - [Data modification example#](#data-modification-example)
  - [Using Vault for credentials#](#using-vault-for-credentials)

## 概要

Searchdocs...

---

[MongoDB](<https://www.mongodb.com/>) is a popular open-source document database that stores data as flexible BSON documents.

The MongoDB Wrapper allows you to read and write data from MongoDB within your Postgres database. Top-level BSON fields are mapped to declared columns by exact name; missing fields surface as SQL `NULL`. A special `_doc jsonb` column receives the full document for nested and array access.

## Preparation#

Before you can query MongoDB, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the MongoDB Wrapper#

Enable the `mongodb_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper mongodb_wrapper
    
    2
    
      handler mongodb_fdw_handler
    
    3
    
      validator mongodb_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your MongoDB connection string in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'mongodb://user:password@host:27017/?replicaSet=rs0',
    
    4
    
      'mongodb',
    
    5
    
      'MongoDB connection string for Wrappers'
    
    6
    
    );
[/code]

### Connecting to MongoDB#

We need to provide Postgres with the credentials to connect to MongoDB, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server mongo_server
    
    2
    
      foreign data wrapper mongodb_wrapper
    
    3
    
      options (
    
    4
    
        conn_string_id '<key_ID>' -- The Key ID from above.
    
    5
    
      );
[/code]

The connection string follows the standard MongoDB URI format and supports `mongodb://` and `mongodb+srv://` schemes. Credentials, TLS options, replica set names, and other driver options can all be encoded in the URI.

Some connection string examples:

  * `mongodb://root:secret@localhost:27017/`
  * `mongodb://app_user:password@db.example.com:27017/?tls=true`
  * `mongodb://user:pass@host1:27017,host2:27017/?replicaSet=rs0`
  * `mongodb+srv://user:password@cluster0.mcqtkst.mongodb.net/?appName=Cluster0`


MongoDB Atlas IP Access List

If you connect to MongoDB Atlas, you must allow network access from your Supabase database server in Atlas **Network Access / IP Access List**.

Supabase database server egress IP addresses are dynamic and there is no fixed IP range you can safelist. In practice, this often means allowing `0.0.0.0/0` in Atlas to make the connection work.

If you are concerned about this security risk, place a proxy or gateway with a fixed public IP between your Supabase database instance and MongoDB, and safelist only that proxy IP in Atlas.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists mongo;
[/code]

## Options#

The following options are available when creating MongoDB foreign tables:

  * `database` \- MongoDB database name, required
  * `collection` \- MongoDB collection name, required
  * `rowid_column` \- Column to use as the row identifier, optional for data scan, required for data modify. The conventional value is `_id`.


## Entities#

### Collections#

The MongoDB Wrapper supports data reads and writes from MongoDB collections.

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Collections| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table mongo.users (
    
    2
    
      _id text,
    
    3
    
      name text,
    
    4
    
      age int,
    
    5
    
      created_at timestamp,
    
    6
    
      _doc jsonb
    
    7
    
    )
    
    8
    
      server mongo_server
    
    9
    
      options (
    
    10
    
        database 'app',
    
    11
    
        collection 'users',
    
    12
    
        rowid_column '_id'
    
    13
    
      );
[/code]

#### Notes#

  * Supports `where`, `order by`, and `limit` clause pushdown
  * Documents are streamed one at a time from MongoDB; no full buffering in memory
  * A column named `_doc` of type `jsonb` receives the complete document and can be used with Postgres JSON operators (`->`, `->>`) to access nested fields and arrays
  * When `rowid_column` is set, INSERT, UPDATE, and DELETE are supported


## Schema Mapping#

Each column declared on the foreign table maps to a top-level BSON field of the same name (exact match):

  * If a document does not contain a field, the corresponding column is set to `NULL`.
  * Dots in column names are treated as literal characters — they do not traverse embedded documents. Use the `_doc` column for nested field access.
  * If a column named `_doc` of type `jsonb` is declared, it receives the full BSON document serialized as JSON. When `_doc` is declared, projection is disabled so that the complete document is returned from MongoDB.


Example: access a nested `address.city` field via `_doc`:
[code] 
    1
    
    select _doc->>'name', _doc->'address'->>'city'
    
    2
    
    from mongo.users;
[/code]

## Query Pushdown Support#

This FDW supports `where`, `order by`, and `limit` clause pushdown.

### Supported Operators#

The following SQL predicates are translated to MongoDB filter operators:

SQL predicate| MongoDB filter  
---|---  
`=`| `{field: {$eq: v}}`  
`!=`| `{field: {$ne: v}}`  
`<`| `{field: {$lt: v}}`  
`<=`| `{field: {$lte: v}}`  
`>`| `{field: {$gt: v}}`  
`>=`| `{field: {$gte: v}}`  
`IN (...)`| `{field: {$in: [...]}}`  
`NOT IN (...)`| `{field: {$nin: [...]}}`  
`IS NULL`| `{field: {$eq: null}}`  
`IS NOT NULL`| `{field: {$ne: null}}`  
  
Multiple `where` predicates are AND'd at the top level of the filter document. Array-form predicates like `IN (...)` / `NOT IN (...)` (and the equivalent `= ANY(ARRAY[...])` / `<> ALL(ARRAY[...])`) are pushed down as `$in` / `$nin`. Arbitrary `OR` predicates between unrelated columns are not pushed down — they are re-checked by Postgres. Any predicate shape that is not supported is omitted from the MongoDB filter and re-checked by Postgres after the rows are returned, so the result is always correct.

## Supported Data Types#

BSON Type| Postgres Type| Notes  
---|---|---  
Boolean| bool|   
Int32| int2 / int4 / int8|   
Int64| int8 / numeric|   
Double| float8 / float4|   
Decimal128| numeric|   
String| text / varchar|   
ObjectId| text| Returned as a 24-character lowercase hex string. A 24-char hex value in a qual is coerced back to `ObjectId` for the filter.  
DateTime| timestamp / timestamptz|   
Document| jsonb|   
Array| jsonb|   
Binary| bytea|   
Null / missing| any| Column is set to `NULL`  
  
`_id` fields that are `ObjectId` values are returned as their 24-character hex representation. When querying by `_id` with a 24-character hex string, the value is automatically coerced back to an `ObjectId` for the filter — no explicit casting is required.

## Writes#

INSERT, UPDATE, and DELETE are enabled when `rowid_column` is set on the foreign table.

  * **INSERT** : Each non-null column is written as a top-level BSON field. Null columns are omitted entirely (not stored as explicit BSON nulls). If `_id` is not supplied, MongoDB generates an `ObjectId` automatically.
  * **UPDATE** : Non-null columns are passed to `$set`; null columns are passed to `$unset`, which removes the field from the document. The document is located by matching `rowid_column`.
  * **DELETE** : The document matching `rowid_column = rowid` is deleted via `delete_one`.


## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Aggregate pushdown is not supported — `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX` are computed in Postgres after fetching rows
  * `import foreign schema` is not supported; foreign table definitions must be declared manually
  * `LIKE` predicates are not pushed down to MongoDB `$regex`; pattern matching happens in Postgres
  * Nested field path access (e.g., `address.city`) is not supported as column names — use the `_doc jsonb` column and Postgres JSON operators instead
  * Multi-document transactions and batched writes are not supported in v1
  * Change streams are not supported
  * Materialized views using foreign tables may fail during logical backups
  * For MongoDB Atlas, Supabase egress IPs are dynamic (no fixed range). You may need to allow `0.0.0.0/0` in Atlas IP Access List, or use a proxy/gateway with a fixed IP to avoid broad public access


## Examples#

### Basic example#

This example shows how to query a MongoDB collection from Postgres.
[code] 
    1
    
    -- Create the server
    
    2
    
    create server mongo_server
    
    3
    
      foreign data wrapper mongodb_wrapper
    
    4
    
      options (
    
    5
    
        conn_string 'mongodb://localhost:27017/'
    
    6
    
      );
    
    7
    
    8
    
    -- Create the foreign table
    
    9
    
    create foreign table mongo.users (
    
    10
    
      _id text,
    
    11
    
      name text,
    
    12
    
      age int,
    
    13
    
      created_at timestamp,
    
    14
    
      _doc jsonb
    
    15
    
    )
    
    16
    
      server mongo_server
    
    17
    
      options (
    
    18
    
        database 'app',
    
    19
    
        collection 'users'
    
    20
    
      );
    
    21
    
    22
    
    -- Query all users
    
    23
    
    select _id, name, age from mongo.users;
    
    24
    
    25
    
    -- Filter with pushdown
    
    26
    
    select name from mongo.users where age > 25;
    
    27
    
    28
    
    -- Access nested fields via _doc
    
    29
    
    select _doc->>'email', _doc->'address'->>'city'
    
    30
    
    from mongo.users
    
    31
    
    where name = 'Alice';
[/code]

### Data modification example#

This example demonstrates INSERT, UPDATE, and DELETE on a foreign table. The `rowid_column` option is required for data modification:
[code] 
    1
    
    create foreign table mongo.users (
    
    2
    
      _id text,
    
    3
    
      name text,
    
    4
    
      age int,
    
    5
    
      _doc jsonb
    
    6
    
    )
    
    7
    
      server mongo_server
    
    8
    
      options (
    
    9
    
        database 'app',
    
    10
    
        collection 'users',
    
    11
    
        rowid_column '_id'
    
    12
    
      );
    
    13
    
    14
    
    -- Insert a new document (_id is generated by MongoDB if omitted)
    
    15
    
    insert into mongo.users (name, age)
    
    16
    
    values ('Alice', 30);
    
    17
    
    18
    
    -- Update a document (null columns remove the field via $unset)
    
    19
    
    update mongo.users
    
    20
    
    set age = 31
    
    21
    
    where _id = '507f1f77bcf86cd799439011';
    
    22
    
    23
    
    -- Remove a field by setting it to null
    
    24
    
    update mongo.users
    
    25
    
    set age = null
    
    26
    
    where _id = '507f1f77bcf86cd799439011';
    
    27
    
    28
    
    -- Delete a document
    
    29
    
    delete from mongo.users
    
    30
    
    where _id = '507f1f77bcf86cd799439011';
[/code]

### Using Vault for credentials#
[code] 
    1
    
    -- Store the connection string in Vault
    
    2
    
    select vault.create_secret(
    
    3
    
      'mongodb+srv://user:password@cluster.example.mongodb.net/',
    
    4
    
      'mongodb_atlas',
    
    5
    
      'MongoDB Atlas connection string'
    
    6
    
    );
    
    7
    
    8
    
    -- Create the server using the Vault secret ID
    
    9
    
    create server mongo_atlas_server
    
    10
    
      foreign data wrapper mongodb_wrapper
    
    11
    
      options (
    
    12
    
        conn_string_id '<key_ID>'
    
    13
    
      );
    
    14
    
    15
    
    create foreign table mongo.products (
    
    16
    
      _id text,
    
    17
    
      name text,
    
    18
    
      price numeric,
    
    19
    
      in_stock bool
    
    20
    
    )
    
    21
    
      server mongo_atlas_server
    
    22
    
      options (
    
    23
    
        database 'shop',
    
    24
    
        collection 'products',
    
    25
    
        rowid_column '_id'
    
    26
    
      );
    
    27
    
    28
    
    -- Query with multiple pushed-down predicates
    
    29
    
    select name, price
    
    30
    
    from mongo.products
    
    31
    
    where in_stock = true
    
    32
    
      and price < 100
    
    33
    
    order by price
    
    34
    
    limit 10;
[/code]