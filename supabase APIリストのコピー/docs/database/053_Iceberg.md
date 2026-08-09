---
タイトル: Iceberg
URL: https://supabase.com/docs/guides/database/extensions/wrappers/iceberg
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, iceberg, wrappers
---

# Iceberg

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/iceberg
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, iceberg, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Iceberg Wrapper#](#enable-the-iceberg-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Iceberg#](#connecting-to-iceberg)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Iceberg Tables#](#iceberg-tables)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Data Insertion#](#data-insertion)
  - [Basic Insert#](#basic-insert)
  - [Insert from Select#](#insert-from-select)
  - [Partition Considerations#](#partition-considerations)
  - [Performance Tips#](#performance-tips)
  - [Automatic Table Creation#](#automatic-table-creation)
  - [Limitations for Insertion#](#limitations-for-insertion)
- [Schema Evolution#](#schema-evolution)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Read Cloudflare R2 Data Catalog#](#read-cloudflare-r2-data-catalog)
  - [Query Pushdown Examples#](#query-pushdown-examples)
  - [Data Insertion Examples#](#data-insertion-examples)

## 概要

Searchdocs...

---

You can enable the Iceberg wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/iceberg_wrapper/overview>)

# Apache Iceberg

[Apache Iceberg](<https://iceberg.apache.org/>) is a high performance open-source format for large analytic tables.

The Iceberg Wrapper allows you to read from and write to Apache Iceberg within your Postgres database.

## Preparation#

Before you can query Iceberg, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Iceberg Wrapper#

Enable the `iceberg_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper iceberg_wrapper
    
    2
    
      handler iceberg_fdw_handler
    
    3
    
      validator iceberg_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your AWS credentials in Vault and retrieve the created
    
    2
    
    -- `aws_access_key_id` and `aws_secret_access_key`
    
    3
    
    select vault.create_secret(
    
    4
    
      '<access key id>',  -- secret to be encrypted
    
    5
    
      'aws_access_key_id',  -- secret name
    
    6
    
      'AWS access key for Wrappers'  -- secret description
    
    7
    
    );
    
    8
    
    select vault.create_secret(
    
    9
    
      '<secret access key>'
    
    10
    
      'aws_secret_access_key',
    
    11
    
      'AWS secret access key for Wrappers'
    
    12
    
    );
[/code]

### Connecting to Iceberg#

We need to provide Postgres with the credentials to connect to Iceberg. We can do this using the `create server` command.

For any server options need to be stored in Vault, you can add a prefix `vault_` to its name and use the secret ID returned from the `select vault.create_secret()` statement as the option value.

#### Connecting to AWS S3 Tables#

With VaultWithout Vault
[code]
    1
    
    create server iceberg_server
    
    2
    
      foreign data wrapper iceberg_wrapper
    
    3
    
      options (
    
    4
    
        -- The key id saved in Vault from above
    
    5
    
        vault_aws_access_key_id '<key_ID>',
    
    6
    
    7
    
        -- The secret id saved in Vault from above
    
    8
    
        vault_aws_secret_access_key '<secret_key>',
    
    9
    
    10
    
        -- AWS region
    
    11
    
        region_name 'us-east-1',
    
    12
    
    13
    
        -- AWS S3 table bucket ARN
    
    14
    
        aws_s3table_bucket_arn 'arn:aws:s3tables:us-east-1:204203087419:bucket/my-table-bucket'
    
    15
    
      );
[/code]

#### Connecting to Iceberg REST Catalog + AWS S3 (or compatible) storage#

With VaultWithout Vault
[code]
    1
    
    create server iceberg_server
    
    2
    
      foreign data wrapper iceberg_wrapper
    
    3
    
      options (
    
    4
    
        -- The key id saved in Vault from above
    
    5
    
        vault_aws_access_key_id '<key_ID>',
    
    6
    
    7
    
        -- The secret id saved in Vault from above
    
    8
    
        vault_aws_secret_access_key '<secret_key>',
    
    9
    
    10
    
        -- AWS region
    
    11
    
        region_name 'us-east-1',
    
    12
    
    13
    
        -- Iceberg REST Catalog URI
    
    14
    
        catalog_uri 'https://rest-catalog/ws',
    
    15
    
    16
    
        -- Warehouse name
    
    17
    
        warehouse 'warehouse',
    
    18
    
    19
    
        -- AWS S3 endpoint URL, optional
    
    20
    
        "s3.endpoint" 'https://alternative-s3-storage:8000'
    
    21
    
      );
[/code]

For other optional S3 options, please refer to [PyIceberg S3 Configuration](<https://py.iceberg.apache.org/configuration/#s3>).

#### Additional Server Options#

  * `batch_size` \- Controls the batch size of records read from Iceberg (value range: 1 - 65536, default: 8192)


### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists iceberg;
[/code]

## Options#

The full list of foreign table options are below:

  * `table` \- Fully qualified source table name with all namespaces in Iceberg, required.
  * `rowid_column` \- The column to use as the row identifier for INSERT operations, required for data insertion.
  * `create_table_if_not_exists` \- Boolean option (true/false) to automatically create the Iceberg table if it doesn't exist when inserting data, optional (default: false).
  * `partition_buffer_size` \- Controls the buffer size for partitioned data during insertion operations, determining how many rows are batched together before being written to Iceberg (value range: 1 - 65536, default: 8192).


## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Iceberg.

For example, using below SQL can automatically create foreign tables in the `iceberg` schema.
[code] 
    1
    
    -- create all the foreign tables from Iceberg "docs_example" namespace
    
    2
    
    import foreign schema "docs_example"
    
    3
    
      from server iceberg_server into iceberg;
    
    4
    
    5
    
    -- or, only create "readme" and "guides" foreign tables
    
    6
    
    import foreign schema "docs_example"
    
    7
    
      limit to ("readme", "guides")
    
    8
    
      from server iceberg_server into iceberg;
    
    9
    
    10
    
    -- or, create all foreign tables except "readme"
    
    11
    
    import foreign schema "docs_example"
    
    12
    
      except ("readme")
    
    13
    
      from server iceberg_server into iceberg;
[/code]

By default, the `import foreign schema` statement will silently skip all the incompatible columns. Use the option `strict` to prevent this behavior. For example,
[code]
    1
    
    import foreign schema "docs_example" from server iceberg_server into iceberg
    
    2
    
    options (
    
    3
    
      -- this will fail the 'import foreign schema' statement when Iceberg table
    
    4
    
      -- column cannot be mapped to Postgres
    
    5
    
      strict 'true'
    
    6
    
    );
[/code]

### Iceberg Tables#

This is an object representing Iceberg table.

Ref: [Iceberg Table Spec](<https://iceberg.apache.org/spec/#iceberg-table-spec>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
table| ✅| ✅| ❌| ❌| ❌  
  
#### Usage#

You can manually create the foreign table like below if you did not use `import foreign schema`.
[code] 
    1
    
    create foreign table iceberg.guides (
    
    2
    
      id bigint,
    
    3
    
      title text,
    
    4
    
      content text,
    
    5
    
      created_at timestamp
    
    6
    
    )
    
    7
    
      server iceberg_server
    
    8
    
      options (
    
    9
    
        table 'docs_example.guides',
    
    10
    
        rowid_column 'id'
    
    11
    
      );
[/code]

## Query Pushdown Support#

This FDW supports `where` clause pushdown with below operators.

Operator| Note  
---|---  
`=`, `>`, `>=`, `<`, `<=`, `<>`, `!=`|   
`is null`, `is not null`|   
`x`, `not x`, `x is true`, `x is not true`| column `x` data type is `boolean`  
`x between a and b`| column `x` data type can be datetime or numeric types  
`like 'abc%'`, `not like 'abc%'`| only support `starts with` pattern  
`in (x, y, z)`, `not in (x, y, z)`|   
  
For multiple filters, only logical `AND` is supported. For example,
[code]
    1
    
    -- this can be pushed down
    
    2
    
    select * from table where x = a and y = b;
    
    3
    
    4
    
    -- this cannot be pushed down
    
    5
    
    select * from table where x = a or y = b;
[/code]

## Supported Data Types#

Postgres Type| Iceberg Type  
---|---  
boolean| boolean  
real| float  
integer| int  
double precision| double  
bigint| long  
numeric| decimal  
text| string  
date| date  
time| time  
timestamp| timestamp, timestamp_ns  
timestamptz| timestamptz, timestamptz_ns  
jsonb| struct, list, map  
bytea| binary  
uuid| uuid  
  
## Data Insertion#

The Iceberg FDW supports inserting data into Iceberg tables using standard SQL `INSERT` statements.

### Basic Insert#
[code] 
    1
    
    -- insert a single row
    
    2
    
    insert into iceberg.guides (id, title, content, created_at)
    
    3
    
    values (1, 'Getting Started', 'Welcome to our guides', now());
    
    4
    
    5
    
    -- insert multiple rows
    
    6
    
    insert into iceberg.guides (id, title, content, created_at)
    
    7
    
    values
    
    8
    
      (2, 'Advanced Guide', 'Advanced topics', now()),
    
    9
    
      (3, 'Best Practices', 'Tips and tricks', now());
[/code]

### Insert from Select#
[code] 
    1
    
    -- insert data from another table
    
    2
    
    insert into iceberg.guides (id, title, content, created_at)
    
    3
    
    select id, title, content, created_at
    
    4
    
    from some_other_table
    
    5
    
    where condition = true;
[/code]

### Partition Considerations#

When inserting data into partitioned Iceberg tables, the FDW automatically handles partitioning based on the table's partition spec. Data will be written to the appropriate partition directories.
[code] 
    1
    
    -- for a table partitioned by sale_date, data is automatically partitioned
    
    2
    
    insert into iceberg.sales (product_id, amount, sale_date)
    
    3
    
    values (123, 99.99, '2025-01-15');
[/code]

### Performance Tips#

  * **Batch Inserts** : Use multi-row inserts for better performance
  * **Partition Awareness** : When possible, insert data in partition order to optimize file organization
  * **Transaction Size** : Consider breaking very large inserts into smaller transactions


### Automatic Table Creation#

When using the `create_table_if_not_exists` option, the Iceberg FDW will automatically create the target table in Iceberg if it doesn't exist when inserting data. This is useful for ad-hoc data insertion scenarios.
[code] 
    1
    
    create foreign table iceberg.new_table (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      created_at timestamp
    
    5
    
    )
    
    6
    
      server iceberg_server
    
    7
    
      options (
    
    8
    
        table 'docs_example.new_table',
    
    9
    
        rowid_column 'id',
    
    10
    
        create_table_if_not_exists 'true'
    
    11
    
      );
    
    12
    
    13
    
    -- when data is inserted, if the 'docs_example.new_table' doesn't exist in Iceberg,
    
    14
    
    -- it will be automatically created with a schema matching the foreign table definition
    
    15
    
    insert into iceberg.new_table (id, name, created_at)
    
    16
    
    values (1, 'New Record', now());
[/code]

### Limitations for Insertion#

  * Only append operations are supported (no upserts)
  * Complex data types (nested structs, arrays, maps) have limited support


#### Automatic Table Creation Limitations#

When using the `create_table_if_not_exists` option, please be aware of the following additional limitations:

  * **Type Support** : Only primitive types are supported (such as boolean, integer, text, etc.). Complex types like arrays, structs, and maps are not supported for automatic table creation.
  * **Partitioning** : The automatically created table will use default partitioning settings. You cannot specify custom partition or sort specifications during automatic creation.
  * **Identifier Fields** : The automatically created table will not have any identifier fields specified. If you need identifier fields, you must create the Iceberg table manually beforehand.


## Schema Evolution#

The Iceberg FDW supports [Apache Iceberg schema evolution](<https://iceberg.apache.org/spec/#schema-evolution>). When columns are added to an Iceberg table after data has already been written, rows from older data files will return `NULL` for those new columns, which matches Iceberg spec behavior.

For example, given a table that initially has `id` and `name` columns, and later gains a `score` column:
[code] 
    1
    
    -- rows written before the column was added return NULL for 'score',
    
    2
    
    -- while newer rows return the actual value
    
    3
    
    select id, name, score from iceberg.members order by id;
    
    4
    
    5
    
    -- id | name  | score
    
    6
    
    -- ----+-------+-------
    
    7
    
    --  1 | alice | NULL
    
    8
    
    --  2 | bob   | NULL
    
    9
    
    --  3 | carol |    42
    
    10
    
    --  4 | dave  |    99
[/code]

Filter pushdown on newly-added columns also works correctly:
[code] 
    1
    
    select name from iceberg.members where score > 50;
    
    2
    
    3
    
    -- name
    
    4
    
    -- ------
    
    5
    
    -- dave
[/code]

The foreign table definition in Postgres must include any new columns to read them. Re-run `import foreign schema` (which will refresh the `schema_id` option) or add the columns manually with `alter foreign table` and update or drop any pinned `schema_id` on the foreign table; otherwise, the FDW may still use an older schema and report `ColumnNotFound` for newly-evolved columns.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Only supports specific data type mappings between Postgres and Iceberg
  * UPDATE, DELETE, and TRUNCATE operations are not supported
  * When using Iceberg REST catalog, only supports AWS S3 (or compatible) as the storage
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

First, create a server for AWS S3 Tables:
[code] 
    1
    
    create server iceberg_server
    
    2
    
      foreign data wrapper iceberg_wrapper
    
    3
    
      options (
    
    4
    
        aws_access_key_id '<AWS_access_key_ID>',
    
    5
    
        aws_secret_access_key '<AWS_secret_access_key>',
    
    6
    
        region_name 'us-east-1',
    
    7
    
        aws_s3table_bucket_arn 'arn:aws:s3tables:us-east-1:204203087419:bucket/my-table-bucket'
    
    8
    
      );
[/code]

Import the foreign table:
[code] 
    1
    
    -- Run below SQL to import all tables under namespace 'docs_example'
    
    2
    
    import foreign schema "docs_example"
    
    3
    
      from server iceberg_server into iceberg;
    
    4
    
    5
    
    -- or, create the foreign table manually
    
    6
    
    create foreign table if not exists iceberg.guides (
    
    7
    
      id bigint,
    
    8
    
      title text,
    
    9
    
      content text,
    
    10
    
      created_at timestamp
    
    11
    
    )
    
    12
    
      server iceberg_server
    
    13
    
      options (
    
    14
    
        table 'docs_example.guides',
    
    15
    
        rowid_column 'id'
    
    16
    
      );
[/code]

Then query the foreign table:
[code] 
    1
    
    select * from iceberg.guides;
[/code]

### Read Cloudflare R2 Data Catalog#

First, follow the steps in [Getting Started Guide](<https://developers.cloudflare.com/r2/data-catalog/get-started/>) to create a R2 Catalog on Cloudflare. Once it is completed, create a server like below:
[code] 
    1
    
    create server iceberg_server
    
    2
    
      foreign data wrapper iceberg_wrapper
    
    3
    
      options (
    
    4
    
        aws_access_key_id '<R2_access_key_ID>',
    
    5
    
        aws_secret_access_key '<R2_secret_access_key>',
    
    6
    
        token '<R2 API token>',
    
    7
    
        warehouse 'xxx_r2-data-catalog-tutorial',
    
    8
    
        "s3.endpoint" 'https://xxx.r2.cloudflarestorage.com',
    
    9
    
        catalog_uri 'https://catalog.cloudflarestorage.com/xxx/r2-data-catalog-tutorial'
    
    10
    
      );
[/code]

Then, import all the tables in `default` namespace and query it:
[code] 
    1
    
    import foreign schema "default" from server iceberg_server into iceberg;
    
    2
    
    3
    
    select * from iceberg.people;
[/code]

### Query Pushdown Examples#
[code] 
    1
    
    -- the filter 'id = 42' will be pushed down to Iceberg
    
    2
    
    select * from iceberg.guides where id = 42;
    
    3
    
    4
    
    -- the pushdown filter can also be on the partition column 'created_at',
    
    5
    
    -- this can greatly reduce query cost
    
    6
    
    select * from iceberg.guides
    
    7
    
    where created_at >= timestamp '2025-05-16 12:34:56';
    
    8
    
    9
    
    -- multiple filters must use logical 'AND'
    
    10
    
    select * from iceberg.guides where id > 42 and title like 'Supabase%';
[/code]

### Data Insertion Examples#
[code] 
    1
    
    -- insert a single record
    
    2
    
    insert into iceberg.guides (id, title, content, created_at)
    
    3
    
    values (100, 'New Guide', 'This is a new guide', now());
    
    4
    
    5
    
    -- insert multiple records at once
    
    6
    
    insert into iceberg.guides (id, title, content, created_at)
    
    7
    
    values
    
    8
    
      (101, 'Guide A', 'Content for Guide A', now()),
    
    9
    
      (102, 'Guide B', 'Content for Guide B', now()),
    
    10
    
      (103, 'Guide C', 'Content for Guide C', now());
    
    11
    
    12
    
    -- insert data from a SELECT query
    
    13
    
    insert into iceberg.guides (id, title, content, created_at)
    
    14
    
    select
    
    15
    
      id + 1000,
    
    16
    
      'Migrated: ' || title,
    
    17
    
      content,
    
    18
    
      created_at
    
    19
    
    from other_guides
    
    20
    
    where id < 10;
    
    21
    
    22
    
    -- verify the inserted data
    
    23
    
    select count(*) from iceberg.guides;
    
    24
    
    select * from iceberg.guides where id >= 100 order by id;
[/code]