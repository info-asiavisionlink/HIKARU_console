---
タイトル: MSSQL
URL: https://supabase.com/docs/guides/database/extensions/wrappers/mssql
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, mssql, sql, wrappers
---

# MSSQL

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/mssql
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, mssql, sql, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the SQL Server Wrapper#](#enable-the-sql-server-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to SQL Server#](#connecting-to-sql-server)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [SQL Server Tables#](#sql-server-tables)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Aggregate Pushdown#](#aggregate-pushdown)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Example#](#basic-example)
  - [Remote Subquery Example#](#remote-subquery-example)
  - [Aggregate Query Examples#](#aggregate-query-examples)

## 概要

Searchdocs...

---

You can enable the MSSQL wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/mssql_wrapper/overview>)

# SQL Server

[Microsoft SQL Server](<https://www.microsoft.com/en-au/sql-server/>) is a proprietary relational database management system developed by Microsoft.

The SQL Server Wrapper allows you to read data from Microsoft SQL Server within your Postgres database.

## Preparation#

Before you can query SQL Server, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the SQL Server Wrapper#

Enable the `mssql_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper mssql_wrapper
    
    2
    
      handler mssql_fdw_handler
    
    3
    
      validator mssql_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your SQL Server connection string in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'Server=localhost,1433;User=sa;Password=my_password;Database=master;IntegratedSecurity=false;TrustServerCertificate=true;encrypt=DANGER_PLAINTEXT;ApplicationName=wrappers',
    
    4
    
      'mssql',
    
    5
    
      'MS SQL Server connection string for Wrappers'
    
    6
    
    );
[/code]

The connection string is an [ADO.NET connection string](<https://learn.microsoft.com/en-us/dotnet/framework/data/adonet/connection-strings>), which specifies connection parameters in semicolon-delimited string.

**Supported parameters**

All parameter keys are handled case-insensitive.

Parameter| Allowed Values| Description  
---|---|---  
Server| `<string>`| The name or network address of the instance of SQL Server to which to connect. Format: `host,port`  
User| `<string>`| The SQL Server login account.  
Password| `<string>`| The password for the SQL Server account logging on.  
Database| `<string>`| The name of the database.  
IntegratedSecurity| false| Windows/Kerberos authentication and SQL authentication.  
TrustServerCertificate| true, false| Specifies whether the driver trusts the server certificate when connecting using TLS.  
Encrypt| true, false, DANGER_PLAINTEXT| Specifies whether the driver uses TLS to encrypt communication.  
ApplicationName| `<string>`| Sets the application name for the connection.  
  
### Connecting to SQL Server#

We need to provide Postgres with the credentials to connect to SQL Server. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server mssql_server
    
    2
    
      foreign data wrapper mssql_wrapper
    
    3
    
      options (
    
    4
    
        conn_string_id '<key_ID>' -- The Key ID from above.
    
    5
    
      );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists mssql;
[/code]

## Options#

The full list of foreign table options are below:

  * `table` \- Source table or view name in SQL Server, required.


This can also be a subquery enclosed in parentheses, for example,
[code] 
    1
    
    table '(select * from users where id = 42 or id = 43)'
[/code]

## Entities#

### SQL Server Tables#

This is an object representing SQL Server tables and views.

Ref: [Microsoft SQL Server docs](<https://www.microsoft.com/en-au/sql-server/>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
table/view| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table mssql.users (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      dt timestamp
    
    5
    
    )
    
    6
    
      server mssql_server
    
    7
    
      options (
    
    8
    
        table 'users'
    
    9
    
      );
[/code]

#### Notes#

  * Supports both tables and views as data sources
  * Can use subqueries in the `table` option
  * Query pushdown supported for:
    * `where` clauses
    * `order by` clauses
    * `limit` clauses
    * aggregate clauses
  * See Data Types section for type mappings between PostgreSQL and SQL Server


## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown.

### Aggregate Pushdown#

The FDW pushes common aggregate queries down to SQL Server so the aggregation runs remotely and only the final result rows are transferred to Postgres. This is much faster than fetching every row and aggregating locally, especially over large tables.

**Supported aggregates** — `count(*)`, `count(col)`, `count(distinct col)`, `sum(col)`, `avg(col)`, `min(col)`, `max(col)`.

**Supported shapes** — scalar aggregates, `group by` over plain columns, with or without a `where` clause. Pushdown also works when the foreign `table` option is a sub-query.
[code] 
    1
    
    -- All of these run as a single aggregate query on SQL Server:
    
    2
    
    select count(*) from mssql.users;
    
    3
    
    select id, sum(amount) from mssql.users group by id;
    
    4
    
    select count(distinct name) from mssql.users where id = 42;
[/code]

`count(*)` and `count(col)` are translated to SQL Server's `count_big` so the result fits Postgres' `bigint` without overflow. Each aggregate is also wrapped in a `cast(... as <sql_server_type>)` so values come back in the exact type Postgres expects (for example, `sum` over a `bigint` column is cast to `numeric`, matching Postgres' `sum(bigint) → numeric` rule).

**Cases that are not pushed down** — the query still returns the correct result, but the aggregation happens in Postgres after fetching the rows:

  * The query has a `having` clause
  * The aggregate has a `filter (where …)` clause
  * A `distinct` modifier is used on anything other than `count`
  * The aggregate's argument is not a plain column (for example `sum(a + 1)`)
  * A `group by` item is not a plain column (for example `group by id + 1`)
  * The aggregate function is not in the list above (for example `stddev`, `string_agg`)


## Supported Data Types#

Postgres Type| SQL Server Type  
---|---  
boolean| bit  
char| tinyint  
smallint| smallint  
real| float(24)  
integer| int  
double precision| float(53)  
bigint| bigint  
numeric| numeric/decimal  
text| varchar/char/text  
date| date  
timestamp| datetime/datetime2/smalldatetime  
timestamptz| datetime/datetime2/smalldatetime  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Only supports specific data type mappings between Postgres and SQL Server
  * Only support read operations (no INSERT, UPDATE, DELETE, or TRUNCATE)
  * Windows authentication (Integrated Security) not supported
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Example#

First, create a source table in SQL Server:
[code] 
    1
    
    -- Run below SQLs on SQL Server to create source table
    
    2
    
    create table users (
    
    3
    
      id bigint,
    
    4
    
      name varchar(30),
    
    5
    
      dt datetime2
    
    6
    
    );
    
    7
    
    8
    
    -- Add some test data
    
    9
    
    insert into users(id, name, dt) values (42, 'Foo', '2023-12-28');
    
    10
    
    insert into users(id, name, dt) values (43, 'Bar', '2023-12-27');
    
    11
    
    insert into users(id, name, dt) values (44, 'Baz', '2023-12-26');
[/code]

Then create and query the foreign table in PostgreSQL:
[code] 
    1
    
    create foreign table mssql.users (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      dt timestamp
    
    5
    
    )
    
    6
    
      server mssql_server
    
    7
    
      options (
    
    8
    
        table 'users'
    
    9
    
      );
    
    10
    
    11
    
    select * from mssql.users;
[/code]

### Remote Subquery Example#

Create a foreign table using a subquery:
[code] 
    1
    
    create foreign table mssql.users_subquery (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      dt timestamp
    
    5
    
    )
    
    6
    
      server mssql_server
    
    7
    
      options (
    
    8
    
        table '(select * from users where id = 42 or id = 43)'
    
    9
    
      );
    
    10
    
    11
    
    select * from mssql.users_subquery;
[/code]

### Aggregate Query Examples#

These examples assume an `orders` table on SQL Server and a matching foreign table on Postgres:
[code] 
    1
    
    -- Run on SQL Server
    
    2
    
    create table orders (
    
    3
    
      id        bigint,
    
    4
    
      user_id   bigint,
    
    5
    
      amount    numeric(18,2),
    
    6
    
      status    varchar(20)
    
    7
    
    );
    
    8
    
    9
    
    insert into orders (id, user_id, amount, status) values
    
    10
    
      (1, 42, 100.00, 'paid'),
    
    11
    
      (2, 42,  50.00, 'paid'),
    
    12
    
      (3, 43, 200.00, 'pending'),
    
    13
    
      (4, 43,  75.00, 'paid'),
    
    14
    
      (5, 44, 300.00, 'paid');
[/code]
[code] 
    1
    
    -- Foreign table on Postgres
    
    2
    
    create foreign table mssql.orders (
    
    3
    
      id      bigint,
    
    4
    
      user_id bigint,
    
    5
    
      amount  numeric(18,2),
    
    6
    
      status  text
    
    7
    
    )
    
    8
    
      server mssql_server
    
    9
    
      options (
    
    10
    
        table 'orders'
    
    11
    
      );
[/code]

Each query below runs a single aggregate query against SQL Server and returns just the result rows:
[code] 
    1
    
    -- Total order count
    
    2
    
    select count(*) from mssql.orders;
    
    3
    
    4
    
    -- Total revenue from paid orders
    
    5
    
    select sum(amount) from mssql.orders where status = 'paid';
    
    6
    
    7
    
    -- Per-user order count and revenue
    
    8
    
    select user_id, count(*) as orders, sum(amount) as revenue
    
    9
    
    from mssql.orders
    
    10
    
    group by user_id
    
    11
    
    order by user_id;
    
    12
    
    13
    
    -- Smallest and largest order
    
    14
    
    select min(amount), max(amount) from mssql.orders;
    
    15
    
    16
    
    -- Number of distinct users who placed an order
    
    17
    
    select count(distinct user_id) from mssql.orders;
    
    18
    
    19
    
    -- Average order value per status
    
    20
    
    select status, avg(amount) as avg_amount
    
    21
    
    from mssql.orders
    
    22
    
    group by status;
[/code]