---
タイトル: DuckDB
URL: https://supabase.com/docs/guides/database/extensions/wrappers/duckdb
カテゴリ: database
更新日: 2026-08-02
タグ: database, duckdb, extensions, wrappers
---

# DuckDB

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/duckdb
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, duckdb, extensions, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the DuckDB Wrapper#](#enable-the-duckdb-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to DuckDB#](#connecting-to-duckdb)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [DuckDB Tables#](#duckdb-tables)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Read AWS S3 Tables#](#read-aws-s3-tables)
  - [Read Cloudflare R2 Data Catalog#](#read-cloudflare-r2-data-catalog)
  - [Query Pushdown Examples#](#query-pushdown-examples)

## 概要

Searchdocs...

---

[DuckDB](<https://duckdb.org/>) is an open-source column-oriented Relational Database Management System.

The DuckDB Wrapper allows you to read data from DuckDB within your Postgres database.

## Preparation#

Before you can query DuckDB, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the DuckDB Wrapper#

Enable the `duckdb_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper duckdb_wrapper
    
    2
    
      handler duckdb_fdw_handler
    
    3
    
      validator duckdb_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.

DuckDB can connect to many data sources, the credential to be saved in Vault depends on which data source you're going to use. For example, to store AWS credentials for S3 connection, you can run below SQL and note down the secret IDs returned:
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

### Connecting to DuckDB#

We need to provide Postgres with the credentials to connect to DuckDB. We can do this using the `create server` command. Depends on the data source, there are different server options needs to be specified. Below is the list of supported data sources and their corresponding server options.

For any server options need to be stored in Vault, you can add a prefix `vault_` to its name and use the secret ID returned from the `select vault.create_secret()` statement as the option value.

#### AWS S3#

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `s3`| Y|   
key_id| The ID of the key to use| Y|   
secret| The secret of the key to use| Y|   
region| The region for which to authenticate| | `us-east-1`  
endpoint| Specify a custom S3 endpoint| | `s3.amazonaws.com`  
session_token| A session token passed to use as temporary credentials| |   
url_compatibility_mode| Can help when URLs contain problematic characters| | `true`  
url_style| Either `vhost` or `path`| | `vhost`  
use_ssl| Whether to use HTTPS or HTTP| | `true`  
kms_key_id| AWS KMS (Key Management Service) key for Server Side Encryption S3| |   
  
A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 's3',
    
    5
    
    6
    
        -- The key id saved in Vault
    
    7
    
        vault_key_id '<key_ID>',
    
    8
    
    9
    
        -- The secret saved in Vault
    
    10
    
        vault_secret '<secret_key>',
    
    11
    
    12
    
        -- AWS region
    
    13
    
        region 'us-east-1'
    
    14
    
      );
[/code]

This `s3` server type can also be used for other S3-compatible storage services such like [Supabase Storage](<https://supabase.com/docs/guides/storage>). For example,
[code] 
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 's3',
    
    5
    
        key_id '<key_ID>',
    
    6
    
        secret '<secret_key>',
    
    7
    
        region 'us-east-1',
    
    8
    
        url_style 'path',
    
    9
    
    	endpoint 'bctmhusapdbcvpetbnev.supabase.co/storage/v1/s3'
    
    10
    
      );
[/code]

#### AWS S3 Tables#

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `s3_tables`| Y|   
key_id| The ID of the key to use| Y|   
secret| The secret of the key to use| Y|   
s3_tables_arn| S3 Tables ARN (available in the AWS Management Console)| Y|   
region| The region for which to authenticate| | `us-east-1`  
  
A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 's3_tables',
    
    5
    
    6
    
        -- The key id saved in Vault
    
    7
    
        vault_key_id '<key_ID>',
    
    8
    
    9
    
        -- The secret saved in Vault
    
    10
    
        vault_secret '<secret_key>',
    
    11
    
    12
    
        -- AWS region
    
    13
    
        region 'us-east-1',
    
    14
    
    15
    
        -- S3 Tables ARN
    
    16
    
        s3_tables_arn 'arn:aws:s3tables:us-east-1:203212701384:bucket/my-bucket'
    
    17
    
      );
[/code]

#### Cloudflare R2#

This is to access [Cloudflare R2](<https://developers.cloudflare.com/r2/>) using the [S3 Compatibility API](<https://developers.cloudflare.com/r2/api/s3/api/>).

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `r2`| Y|   
key_id| The ID of the key to use| Y|   
secret| The secret of the key to use| Y|   
account_id| The account ID to use| Y|   
  
A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'r2',
    
    5
    
    6
    
        -- The key id saved in Vault
    
    7
    
        vault_key_id '<key_ID>',
    
    8
    
    9
    
        -- The secret saved in Vault
    
    10
    
        vault_secret '<secret_key>',
    
    11
    
    12
    
        -- Account ID
    
    13
    
        account_id '<account_ID>'
    
    14
    
      );
[/code]

#### Cloudflare R2 Data Catalog#

This is to access [Cloudflare R2 Data Catalog](<https://developers.cloudflare.com/r2/data-catalog/>).

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `r2_catalog`| Y|   
token| The R2 API token to use| Y|   
warehouse| Warehouse name in R2 Data Catalog| Y|   
catalog_uri| R2 Data Catalog URI| Y|   
  
A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'r2_catalog',
    
    5
    
    6
    
        -- The R2 API token saved in Vault
    
    7
    
        vault_token '<token>',
    
    8
    
    9
    
        -- Warehouse name
    
    10
    
        warehouse 'my_warehouse',
    
    11
    
    12
    
        -- R2 Data Catalog URI
    
    13
    
        catalog_uri 'catalog.cloudflarestorage.com/1a4d06e707l56a1a724719292be42e3a/r2-data-catalog'
    
    14
    
      );
[/code]

#### Apache Polaris#

This is to access [Apache Polaris](<https://polaris.apache.org/>) Iceberg service.

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `polaris`| Y|   
client_id| The client ID to use| Y|   
client_secret| The client secret to use| Y|   
warehouse| Warehouse name| Y|   
catalog_uri| Polaris REST Catalog URI| Y|   
  
A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'polaris',
    
    5
    
    6
    
        -- The client id saved in Vault
    
    7
    
        vault_client_id '<client_id>',
    
    8
    
    9
    
        -- The client secret in Vault
    
    10
    
        vault_client_secret '<secret>',
    
    11
    
    12
    
        -- Warehouse name
    
    13
    
        warehouse 'quickstart_catalog',
    
    14
    
    15
    
        -- Polaris REST Catalog URI
    
    16
    
        catalog_uri '<polaris_rest_catalog_endpoint>'
    
    17
    
      );
[/code]

#### Lakekeeper#

This is to access [Lakekeeper](<https://docs.lakekeeper.io/>) Iceberg service.

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `lakekeeper`| Y|   
client_id| The client ID to use| Y|   
client_secret| The client secret to use| Y|   
oauth2_scope| OAuth2 authentication scope| Y|   
oauth2_server_uri| Lakekeeper OAuth2 authentication URI| Y|   
warehouse| Warehouse name| Y|   
catalog_uri| Lakekeeper REST Catalog URI| Y|   
  
A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'lakekeeper',
    
    5
    
    6
    
        -- The client id saved in Vault
    
    7
    
        vault_client_id '<client_id>',
    
    8
    
    9
    
        -- The client secret in Vault
    
    10
    
        vault_client_secret '<secret>',
    
    11
    
    12
    
        -- OAuth2 authentication settings
    
    13
    
        oauth2_scope 'lakekeeper',
    
    14
    
        oauth2_server_uri 'http://keycloak:8080/realms/iceberg/protocol/openid-connect/token'
    
    15
    
    16
    
        -- Warehouse name
    
    17
    
        warehouse 'warehouse',
    
    18
    
    19
    
        use_ssl 'false',
    
    20
    
    21
    
        -- Lakekeeper REST Catalog URI
    
    22
    
        catalog_uri 'lakekeeper:8181/catalog'
    
    23
    
      );
[/code]

#### Iceberg#

This is to access generic Iceberg services. Check above for other specific Iceberg services like S3 Tables, R2 Data Catalog and etc. All the S3 options are supported with below additional options.

Reading from Iceberg REST Catalogs backed by remote storage that is not S3 or S3 compatible is not supported yet.

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `iceberg`| Y|   
warehouse| Warehouse name| Y|   
catalog_uri| REST Catalog URI| Y|   
token| The API token to use| |   
client_id| The client ID to use| |   
client_secret| The client secret to use| |   
oauth2_scope| OAuth2 authentication scope| |   
oauth2_server_uri| OAuth2 authentication URI| |   
  
A `create server` statement example used to access local Iceberg service:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'iceberg',
    
    5
    
    6
    
        -- The key id saved in Vault
    
    7
    
        vault_key_id '<key_ID>',
    
    8
    
    9
    
        -- The secret saved in Vault
    
    10
    
        vault_secret '<secret_key>',
    
    11
    
    12
    
        -- AWS region
    
    13
    
        region 'us-east-1',
    
    14
    
    15
    
        -- S3 access settings
    
    16
    
        endpoint 'localhost:8000',
    
    17
    
        url_style 'path',
    
    18
    
        use_ssl 'false',
    
    19
    
    20
    
        -- a dummy access token
    
    21
    
        token 'dummy',
    
    22
    
    23
    
        -- Warehouse name
    
    24
    
        warehouse 'warehouse',
    
    25
    
    26
    
        -- REST Catalog URI
    
    27
    
        catalog_uri 'localhost:8181'
    
    28
    
      );
[/code]

#### MotherDuck#

This is to access [MotherDuck](<https://motherduck.com/>), a cloud-hosted DuckDB service.

Server Option| Description| Required| Default  
---|---|---|---  
type| Server type, must be `md`| Y|   
database| The MotherDuck database name to use| Y|   
motherduck_token| The MotherDuck access token| Y|   
  
To obtain a MotherDuck access token, visit <https://app.motherduck.com/settings/tokens>[](<https://app.motherduck.com/settings/tokens>) in your browser and create a new token.

A `create server` statement example:

With VaultWithout Vault
[code]
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'md',
    
    5
    
    6
    
        -- The database name
    
    7
    
        database 'my_db',
    
    8
    
    9
    
        -- The MotherDuck token saved in Vault
    
    10
    
        vault_motherduck_token '<token>'
    
    11
    
      );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists duckdb;
[/code]

## Options#

The full list of foreign table options are below:

  * `table` \- Fully qualified source table name in DuckDB, required.


This can also be a subquery enclosed in parentheses, for example,
[code] 
    1
    
    table '(select * from my_table)'
[/code]

or, an URI points to remote file or a function (with corresponding type of server),
[code] 
    1
    
    table '''s3://my_bucket/products.parquet'''
[/code]
[code] 
    1
    
    table 'read_json(''s3://my_bucket/products.json'')'
[/code]

## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from DuckDB.

For example, using below SQL can automatically create foreign tables in the `duckdb` schema.
[code] 
    1
    
    -- create all the foreign tables from Iceberg "docs_example" namespace
    
    2
    
    import foreign schema "docs_example"
    
    3
    
      from server duckdb_server into duckdb;
    
    4
    
    5
    
    -- or, only create "readme" and "guides" foreign tables
    
    6
    
    import foreign schema "docs_example"
    
    7
    
      limit to ("readme", "guides")
    
    8
    
      from server duckdb_server into duckdb;
    
    9
    
    10
    
    -- or, create all foreign tables except "readme"
    
    11
    
    import foreign schema "docs_example"
    
    12
    
      except ("readme")
    
    13
    
      from server duckdb_server into duckdb;
[/code]

Currently only MotherDuck and Iceberg-like servers, such as S3 Tables, R2 Data Catalog and etc., support `import foreign schema` without specifying source tables. For other types of servers, source tables must be explicitly specified in options. For example,
[code] 
    1
    
    -- 'duckdb_server_md' server type is 'md', all tables under 'main' schema
    
    2
    
    -- will be imported from MotherDuck automatically
    
    3
    
    import foreign schema "main"
    
    4
    
      from server duckdb_server_md into duckdb;
    
    5
    
    6
    
    -- 'duckdb_server_s3_tables' server type is 's3_tables', all tables
    
    7
    
    -- under 'docs_example' namespace will be imported automatically
    
    8
    
    import foreign schema "docs_example"
    
    9
    
      from server duckdb_server_s3_tables into duckdb;
    
    10
    
    11
    
    -- 'duckdb_server_s3' server type is 's3', source tables to be imported
    
    12
    
    -- must be specified explicitly
    
    13
    
    import foreign schema s3
    
    14
    
      from server duckdb_server_s3 into duckdb
    
    15
    
      options (
    
    16
    
        tables '
    
    17
    
          s3://my_bucket/products.parquet,
    
    18
    
          s3://my_bucket/users.json
    
    19
    
    	'
    
    20
    
      );
[/code]

The imported table name format from Iceberg-like server is:

  * `<server_type>_<schema_name>_<table_name>`


For example, the above statement will import a table name `s3_tables_docs_example_guides`.

For other types of server with explicitly specified sources tables, the imported foreign table names have the schema and sequence number as prefix with this format:

  * `<schema_name>_<sequence_number>_<filename_stem>`


For example, by using belew statement,
[code] 
    1
    
    import foreign schema s3
    
    2
    
      from server duckdb_server_s3 into duckdb
    
    3
    
      options (
    
    4
    
        tables '
    
    5
    
          s3://my_bucket/products.parquet,
    
    6
    
          s3://my_bucket/users.json
    
    7
    
    	'
    
    8
    
      );
[/code]

The imported foreign table names are:

  * `s3_0_products`
  * `s3_1_users`


By default, the `import foreign schema` statement will silently skip all the incompatible columns. Use the option `strict` to prevent this behavior. For example,
[code]
    1
    
    import foreign schema "docs_example" from server duckdb_server into duckdb
    
    2
    
    options (
    
    3
    
      -- this will fail the 'import foreign schema' statement when DuckDB table
    
    4
    
      -- column cannot be mapped to Postgres
    
    5
    
      strict 'true'
    
    6
    
    );
[/code]

### DuckDB Tables#

This is an object representing DuckDB table.

Ref: [DuckDB Table](<https://duckdb.org/docs/stable/sql/statements/create_table>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
table| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#

You can manually create the foreign table like below if you did not use `import foreign schema`.
[code] 
    1
    
    create foreign table duckdb.products (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      sku text,
    
    5
    
      created_at timestamp
    
    6
    
    )
    
    7
    
      server duckdb_server
    
    8
    
      options (
    
    9
    
        table '''s3://my_bucket/products.parquet'''
    
    10
    
      );
[/code]

## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown.

## Supported Data Types#

Postgres Type| DuckDB Type  
---|---  
boolean| BOOLEAN, BOOL, LOGICAL  
"char"| TINYINT, INT1  
smallint| SMALLINT, INT2, SHORT  
real| FLOAT, FLOAT4, REAL  
integer| INTEGER, INT4, INT, SIGNED  
double precision| DOUBLE, FLOAT8  
bigint| BIGINT, INT8, LONG  
numeric| DECIMAL, NUMERIC  
text| BIT, VARCHAR, CHAR, BPCHAR, TEXT, STRING  
date| DATE  
time| TIME  
timestamp| TIMESTAMP, DATETIME  
timestamptz| TIMESTAMP WITH TIME ZONE, TIMESTAMPTZ  
jsonb| JSON, ARRAY, LIST, MAP, STRUCT, UNION  
bytea| BLOB, BYTEA, BINARY, VARBINARY  
uuid| UUID  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Only supports certain server types, which data is stored remotely
  * Only supports specific data type mappings between Postgres and DuckDB
  * Only supports read operations (no INSERT, UPDATE, DELETE, or TRUNCATE)
  * When using Iceberg REST Catalog, only supports AWS S3 (or compatible) as the storage
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

First, create a `s3` server:
[code] 
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 's3',
    
    5
    
        key_id '<AWS_access_key_ID>',
    
    6
    
        secret '<AWS_secret_access_key>',
    
    7
    
        region 'us-east-1'
    
    8
    
      );
[/code]

Then import foreign table from a parquet file and query it:
[code] 
    1
    
    import foreign schema s3
    
    2
    
      from server duckdb_server into duckdb
    
    3
    
      options (
    
    4
    
        tables '
    
    5
    
          s3://my_bucket/products.parquet
    
    6
    
        '
    
    7
    
      );
    
    8
    
    9
    
    select * from duckdb.s3_0_products;
[/code]

This is the same as creating the foreign table manually like below,
[code] 
    1
    
    create foreign table duckdb.products (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      sku text,
    
    5
    
      created_at timestamp
    
    6
    
    )
    
    7
    
      server duckdb_server
    
    8
    
      options (
    
    9
    
        table '''s3://my_bucket/products.parquet'''
    
    10
    
      );
    
    11
    
    12
    
    select * from duckdb.products;
[/code]

### Read AWS S3 Tables#

First, create a `s3_tables` server:
[code] 
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 's3_tables',
    
    5
    
        key_id '<AWS_access_key_ID>',
    
    6
    
        secret '<AWS_secret_access_key>',
    
    7
    
        region 'us-east-1',
    
    8
    
        s3_tables_arn 'arn:aws:s3tables:us-east-1:203212701384:bucket/my-bucket'
    
    9
    
      );
[/code]

Then, import all the tables in `docs_example` namespace and query it:
[code] 
    1
    
    import foreign schema "docs_example"
    
    2
    
      from server duckdb_server into duckdb;
    
    3
    
    4
    
    select * from duckdb.s3_tables_docs_example_guides;
[/code]

### Read Cloudflare R2 Data Catalog#

First, follow the steps in [Getting Started Guide](<https://developers.cloudflare.com/r2/data-catalog/get-started/>) to create a R2 Catalog on Cloudflare. Once it is completed, create a `r2_catalog` server like below:
[code] 
    1
    
    create server duckdb_server
    
    2
    
      foreign data wrapper duckdb_wrapper
    
    3
    
      options (
    
    4
    
        type 'r2_catalog',
    
    5
    
        token '<R2 API token>',
    
    6
    
        warehouse '2b303ef0293bc91a0217a0381af14a3e_r2-data-catalog-tutorial',
    
    7
    
        catalog_uri 'catalog.cloudflarestorage.com/2b303ef0293bc91a0217a0381af14a3e/r2-data-catalog-tutorial'
    
    8
    
      );
[/code]

Then, import all the tables in `default` namespace and query it:
[code] 
    1
    
    import foreign schema "default"
    
    2
    
      from server duckdb_server into duckdb;
    
    3
    
    4
    
    select * from duckdb.r2_catalog_default_people;
[/code]

### Query Pushdown Examples#

Follow the above Read R2 Data Catalog example, below are some query pushdown examples:
[code] 
    1
    
    -- the filter "name = 'Alice'" will be pushed down to DuckDB
    
    2
    
    select * from duckdb.r2_catalog_default_people where name = 'Alice';
    
    3
    
    4
    
    -- multiple filters must use logical 'AND'
    
    5
    
    select * from duckdb.r2_catalog_default_people
    
    6
    
    where name = 'Alice' and score = 80;
    
    7
    
    8
    
    -- 'order by' and 'limit' will be pushed down to DuckDB
    
    9
    
    select * from duckdb.r2_catalog_default_people order by id limit 2;
[/code]