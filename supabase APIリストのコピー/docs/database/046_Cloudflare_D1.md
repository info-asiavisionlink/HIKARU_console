---
タイトル: Cloudflare D1
URL: https://supabase.com/docs/guides/database/extensions/wrappers/cloudflare-d1
カテゴリ: database
更新日: 2026-08-02
タグ: cloudflare, cloudflare-d1, database, extensions, wrappers
---

# Cloudflare D1

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/cloudflare-d1
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** cloudflare, cloudflare-d1, database, extensions, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the D1 Wrapper#](#enable-the-d1-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to D1#](#connecting-to-d1)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [D1 Databases#](#d1-databases)
  - [D1 Tables#](#d1-tables)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Query A Table#](#query-a-table)
  - [Table With Subquery#](#table-with-subquery)
  - [Modify Data#](#modify-data)

## 概要

Searchdocs...

---

You can enable the Cloudflare D1 wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/cfd1_wrapper/overview>)

[Cloudflare D1](<https://developers.cloudflare.com/d1/>) is Cloudflare's managed, serverless database with SQLite's SQL semantics, built-in disaster recovery, and Worker and HTTP API access.

The Cloudflare D1 Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read data from Cloudflare D1 database for use within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_cfd1_fdw_v0.2.0/cfd1_fdw.wasm`| `0f1d022d9733b5dd0c39d65f35ffcfd86102e7ee53e72d8cf94749500c224c0d`| >=0.5.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_cfd1_fdw_v0.1.0/cfd1_fdw.wasm`| `783232834bb29dbd3ee6b09618c16f8a847286e63d05c54397d56c3e703fad31`| >=0.4.0  
  
## Preparation#

Before you can query D1, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the D1 Wrapper#

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
    
    -- Save your D1 API token in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<D1 API token>', -- Cloudflare D1 API token
    
    4
    
      'cfd1',
    
    5
    
      'Cloudflare D1 API key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to D1#

We need to provide Postgres with the credentials to access D1 and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server cfd1_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_cfd1_fdw_v0.1.0/cfd1_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:cfd1-fdw',
    
    6
    
        fdw_package_version '0.1.0',
    
    7
    
        fdw_package_checksum '783232834bb29dbd3ee6b09618c16f8a847286e63d05c54397d56c3e703fad31',
    
    8
    
        api_url 'https://api.cloudflare.com/client/v4/accounts/<account_id>/d1/database',  -- optional
    
    9
    
        account_id '<Account ID>',
    
    10
    
        database_id '<Database ID>',
    
    11
    
        api_token_id '<key_ID>' -- The Key ID from above.
    
    12
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists cfd1;
[/code]

## Options#

The full list of foreign table options are below:

  * `table` \- Source table name in D1, required.

    * This option can also be a subquery enclosed in parentheses, see below for examples.
    * A pseudo-table name `_meta_databases` can be used to query databases.
  * `rowid_column` \- Primary key column name, optional for data scan, required for data modify.


## Entities#

The D1 Wrapper supports data reads and writes from the Cloudflare D1 API.

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Cloudflare D1.

For example, using below SQL can automatically create foreign tables in the `cfd1` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema cfd1 from server cfd1_server into cfd1;
[/code]

The `import foreign schema` statement only imports `databases` table, other tables still need to be created manually.

### D1 Databases#

This is an object representing a D1 database.

Ref: [D1 databases docs](<https://developers.cloudflare.com/api/operations/cloudflare-d1-list-databases>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
database| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table cfd1.databases (
    
    2
    
      uuid text,
    
    3
    
      name text,
    
    4
    
      version text,
    
    5
    
      num_tables bigint,
    
    6
    
      file_size bigint,
    
    7
    
      created_at text,
    
    8
    
      _attrs jsonb
    
    9
    
    )
    
    10
    
      server cfd1_server
    
    11
    
      options (
    
    12
    
        table '_meta_databases'
    
    13
    
      );
[/code]

#### Notes#

  * The `_attrs` meta column contains all database attributes in JSON format
  * The table option must be `_meta_databases`
  * Only column names listed above are allowed


### D1 Tables#

This is an object representing a D1 table.

Ref: [D1 query docs](<https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
table| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table cfd1.mytable (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      amount double precision,
    
    5
    
      metadata text,
    
    6
    
      _attrs jsonb
    
    7
    
    )
    
    8
    
      server cfd1_server
    
    9
    
      options (
    
    10
    
        table 'mytable',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
[/code]

#### Notes#

  * The `_attrs` meta column contains all attributes in JSON format
  * Can use subquery in `table` option
  * Requires `rowid_column` for data modification operations
  * Supports query pushdown for `where`, `order by`, and `limit` clauses
  * Column names, except `_attrs`, must match between D1 and foreign table
  * Data types must be compatible according to type mapping table


## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown.

## Supported Data Types#

Postgres Data Type| D1 Data Type  
---|---  
bigint| integer  
double precision| real  
text| text  
text| blob  
  
The D1 API uses JSON formatted data, please refer to [D1 API docs](<https://developers.cloudflare.com/api/operations/cloudflare-d1-list-databases>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Foreign tables with subquery option cannot support data modify
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Below are some examples on how to use D1 foreign tables.

### Basic Example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table cfd1.databases (
    
    2
    
      uuid text,
    
    3
    
      name text,
    
    4
    
      version text,
    
    5
    
      num_tables bigint,
    
    6
    
      file_size bigint,
    
    7
    
      created_at text,
    
    8
    
      _attrs jsonb
    
    9
    
    )
    
    10
    
      server cfd1_server
    
    11
    
      options (
    
    12
    
        table '_meta_databases'
    
    13
    
      );
    
    14
    
    15
    
    -- query D1 databases
    
    16
    
    select * from cfd1.databases;
[/code]

### Query A Table#

Let's create a source table `test_table` in D1 web console and add some testing data.

Column Name| Data Type  
---|---  
id| integer  
name| text  
amount| real  
metadata| blob  
  
This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table cfd1.test_table (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      amount double precision,
    
    5
    
      metadata text,
    
    6
    
      _attrs jsonb
    
    7
    
    )
    
    8
    
      server cfd1_server
    
    9
    
      options (
    
    10
    
        table 'test_table',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
    
    13
    
    14
    
    select * from cfd1.test_table;
[/code]

### Table With Subquery#

The `table` option can also be a subquery enclosed in parentheses.
[code] 
    1
    
    create foreign table cfd1.test_table_subquery (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      amount double precision,
    
    5
    
      metadata text,
    
    6
    
      _attrs jsonb
    
    7
    
    )
    
    8
    
      server cfd1_server
    
    9
    
      options (
    
    10
    
        table '(select * from test_table)'
    
    11
    
      );
    
    12
    
    13
    
    select * from cfd1.test_table_subquery;
[/code]

The foreign table with subquery option cannot support data modification.

### Modify Data#

This example will modify data in a "foreign table" inside your Postgres database, note that `rowid_column` table option is required for data modify.
[code] 
    1
    
    -- insert new data
    
    2
    
    insert into cfd1.test_table(id, name, amount)
    
    3
    
    values (123, 'test name 123', 321.654);
    
    4
    
    5
    
    -- update existing data
    
    6
    
    update cfd1.test_table
    
    7
    
    set name = 'new name', amount = null
    
    8
    
    where id = 123;
    
    9
    
    10
    
    -- delete data
    
    11
    
    delete from cfd1.test_table where id = 123;
[/code]