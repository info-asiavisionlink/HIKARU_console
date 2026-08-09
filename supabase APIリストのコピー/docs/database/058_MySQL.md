---
タイトル: MySQL
URL: https://supabase.com/docs/guides/database/extensions/wrappers/mysql
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, mysql, sql, wrappers
---

# MySQL

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/mysql
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, mysql, sql, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the MySQL Wrapper#](#enable-the-mysql-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to MySQL#](#connecting-to-mysql)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Tables#](#tables)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Aggregate Pushdown#](#aggregate-pushdown)
- [Import Foreign Schema#](#import-foreign-schema)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic example#](#basic-example)
  - [Data modification example#](#data-modification-example)
  - [Aggregate Query Examples#](#aggregate-query-examples)
  - [Import foreign schema example#](#import-foreign-schema-example)

## 概要

Searchdocs...

---

[MySQL](<https://www.mysql.com/>) is one of the world's most popular open-source relational database management systems.

The MySQL Wrapper allows you to read and write data from MySQL within your Postgres database.

## Preparation#

Before you can query MySQL, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the MySQL Wrapper#

Enable the `mysql_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper mysql_wrapper
    
    2
    
      handler mysql_fdw_handler
    
    3
    
      validator mysql_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your MySQL connection string in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'mysql://user:password@host:3306/mydb',
    
    4
    
      'mysql',
    
    5
    
      'MySQL connection string for Wrappers'
    
    6
    
    );
[/code]

### Connecting to MySQL#

We need to provide Postgres with the credentials to connect to MySQL, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server mysql_server
    
    2
    
      foreign data wrapper mysql_wrapper
    
    3
    
      options (
    
    4
    
        conn_string_id '<key_ID>' -- The Key ID from above.
    
    5
    
      );
[/code]

The connection string follows the standard MySQL URL format:
[code] 
    1
    
    mysql://[user[:password]@][host][:port]/database
[/code]

Some connection string examples:

  * `mysql://root:secret@localhost:3306/mydb`
  * `mysql://app_user:password@db.example.com:3306/production`
  * `mysql://user:password@127.0.0.1:3306/testdb?ssl-mode=required`


### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists mysql;
[/code]

## Options#

The following options are available when creating MySQL foreign tables:

  * `table` \- Source table name in MySQL, required

This can also be a subquery enclosed in parentheses, for example,
[code] 1
        
        table '(select id, name from my_table where active = 1)'
[/code]

  * `rowid_column` \- Primary key column name, optional for data scan, required for data modify


## Entities#

### Tables#

The MySQL Wrapper supports data reads and writes from MySQL tables.

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Tables| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table mysql.my_table (
    
    2
    
      id bigint,
    
    3
    
      name text
    
    4
    
    )
    
    5
    
      server mysql_server
    
    6
    
      options (
    
    7
    
        table 'people'
    
    8
    
      );
[/code]

#### Notes#

  * Supports `where`, `order by`, `limit` and aggregate clause pushdown
  * Data is streamed row-by-row from MySQL, making it suitable for large result sets
  * When using `rowid_column`, it must be specified for data modification operations


## Query Pushdown Support#

This FDW supports `where`, `order by` and `limit` clause pushdown.

### Aggregate Pushdown#

The FDW pushes common aggregate queries down to MySQL so the aggregation runs remotely and only the final result rows are transferred to Postgres. This is much faster than fetching every row and aggregating locally, especially over large tables.

**Supported aggregates** — `count(*)`, `count(col)`, `count(distinct col)`, `sum(col)`, `avg(col)`, `min(col)`, `max(col)`.

**Supported shapes** — scalar aggregates, `group by` over plain columns, with or without a `where` clause. Pushdown also works when the foreign `table` option is a sub-query.
[code] 
    1
    
    -- All of these run as a single aggregate query on MySQL:
    
    2
    
    select count(*) from mysql.my_table;
    
    3
    
    select status, sum(amount) from mysql.my_table group by status;
    
    4
    
    select count(distinct name) from mysql.my_table where id = 1;
[/code]

**Cases that are not pushed down** — the query still returns the correct result, but the aggregation happens in Postgres after fetching the rows:

  * The query has a `having` clause
  * The aggregate has a `filter (where …)` clause
  * A `distinct` modifier is used on anything other than `count`
  * The aggregate's argument is not a plain column (for example `sum(a + 1)`)
  * A `group by` item is not a plain column (for example `group by id + 1`)
  * The aggregate function is not in the list above (for example `stddev`, `group_concat`)


## Import Foreign Schema#

This FDW supports [`import foreign schema`](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to automatically create foreign table definitions by reading the MySQL table structure from `information_schema`.

The `remote_schema` maps to a MySQL database name. For example, to import all tables from the MySQL database `mydb`:
[code] 
    1
    
    import foreign schema mydb
    
    2
    
      from server mysql_server
    
    3
    
      into mysql;
[/code]

You can limit which tables are imported using `limit to` or `except`:
[code] 
    1
    
    -- Import only specific tables
    
    2
    
    import foreign schema mydb
    
    3
    
      limit to (users, orders)
    
    4
    
      from server mysql_server
    
    5
    
      into mysql;
    
    6
    
    7
    
    -- Import all tables except specific ones
    
    8
    
    import foreign schema mydb
    
    9
    
      except (tmp_data, archive)
    
    10
    
      from server mysql_server
    
    11
    
      into mysql;
[/code]

An additional option is available for `import foreign schema`:

  * `strict` \- If set to `true`, the import will fail if any MySQL column type cannot be mapped to a Postgres type. Defaults to `false` (unsupported column types are silently skipped).


[code] 
    1
    
    import foreign schema mydb
    
    2
    
      from server mysql_server
    
    3
    
      into mysql
    
    4
    
      options (strict 'true');
[/code]

Primary key columns are automatically detected and set as the `rowid_column` option on the generated foreign table, enabling INSERT, UPDATE, and DELETE operations without any manual configuration.

## Supported Data Types#

Postgres Type| MySQL Type  
---|---  
boolean| boolean, bool, tinyint(1)  
smallint| tinyint (non-boolean), smallint, year  
integer| mediumint, int, integer  
bigint| bigint  
real| float  
double precision| double, double precision  
numeric| decimal, numeric  
text| char, varchar, tinytext, text, mediumtext, longtext, enum, set  
date| date  
timestamp| datetime, timestamp  
time| time  
jsonb| json  
  
`tinyint(1)` is mapped to `boolean` as it is the conventional MySQL representation for boolean values. All other `tinyint` variants are mapped to `smallint`.

`decimal` and `numeric` columns with explicit precision and scale (e.g. `decimal(12,2)`) are imported as `numeric(p,s)` in Postgres.

`import foreign schema` always generates `text` for MySQL string types, but when defining a foreign table manually you may also declare these columns as `varchar(n)` or `char(n)`; all three Postgres types are read correctly.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Only a subset of MySQL data types are supported; columns with unmapped types are skipped during `import foreign schema` unless `strict` mode is enabled
  * `timestamp` and `datetime` values are treated as naive timestamps without timezone conversion
  * MySQL `json` columns are mapped to Postgres `jsonb`; invalid JSON will cause an error during reads
  * Materialized views using foreign tables may fail during logical backups


## Examples#

### Basic example#

This example shows how to query a MySQL table from Postgres.

First, create the source table in MySQL:
[code] 
    1
    
    -- Run on MySQL
    
    2
    
    create table people (
    
    3
    
      id bigint primary key auto_increment,
    
    4
    
      name varchar(100),
    
    5
    
      email varchar(200)
    
    6
    
    );
    
    7
    
    8
    
    insert into people (name, email) values
    
    9
    
      ('Alice', 'alice@example.com'),
    
    10
    
      ('Bob', 'bob@example.com'),
    
    11
    
      ('Carol', 'carol@example.com');
[/code]

Then create the foreign table in Postgres and query it:
[code] 
    1
    
    create foreign table mysql.people (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      email text
    
    5
    
    )
    
    6
    
      server mysql_server
    
    7
    
      options (
    
    8
    
        table 'people'
    
    9
    
      );
    
    10
    
    11
    
    select * from mysql.people;
[/code]

### Data modification example#

This example demonstrates INSERT, UPDATE, and DELETE on a foreign table. The `rowid_column` option is required for data modification:
[code] 
    1
    
    create foreign table mysql.people (
    
    2
    
      id bigint,
    
    3
    
      name text,
    
    4
    
      email text
    
    5
    
    )
    
    6
    
      server mysql_server
    
    7
    
      options (
    
    8
    
        table 'people',
    
    9
    
        rowid_column 'id'
    
    10
    
      );
    
    11
    
    12
    
    -- Insert a new row
    
    13
    
    insert into mysql.people (name, email)
    
    14
    
    values ('Dave', 'dave@example.com');
    
    15
    
    16
    
    -- Update an existing row
    
    17
    
    update mysql.people
    
    18
    
    set email = 'alice_new@example.com'
    
    19
    
    where id = 1;
    
    20
    
    21
    
    -- Delete a row
    
    22
    
    delete from mysql.people
    
    23
    
    where id = 2;
[/code]

### Aggregate Query Examples#

These examples assume an `orders` table in MySQL and a matching foreign table on Postgres:
[code] 
    1
    
    -- Run on MySQL
    
    2
    
    create table orders (
    
    3
    
      id      bigint primary key auto_increment,
    
    4
    
      user_id bigint not null,
    
    5
    
      amount  decimal(12,2) not null,
    
    6
    
      status  varchar(50) not null
    
    7
    
    );
    
    8
    
    9
    
    insert into orders (user_id, amount, status) values
    
    10
    
      (1, 100.00, 'paid'),
    
    11
    
      (1,  50.00, 'paid'),
    
    12
    
      (2, 200.00, 'pending'),
    
    13
    
      (2,  75.00, 'paid'),
    
    14
    
      (3, 300.00, 'paid');
[/code]
[code] 
    1
    
    -- Foreign table on Postgres
    
    2
    
    create foreign table mysql.orders (
    
    3
    
      id      bigint,
    
    4
    
      user_id bigint,
    
    5
    
      amount  numeric,
    
    6
    
      status  text
    
    7
    
    )
    
    8
    
      server mysql_server
    
    9
    
      options (
    
    10
    
        table 'orders'
    
    11
    
      );
[/code]

Each query below runs a single aggregate query against MySQL and returns just the result rows:
[code] 
    1
    
    -- Total order count
    
    2
    
    select count(*) from mysql.orders;
    
    3
    
    4
    
    -- Total revenue from paid orders
    
    5
    
    select sum(amount) from mysql.orders where status = 'paid';
    
    6
    
    7
    
    -- Per-user order count and revenue
    
    8
    
    select user_id, count(*) as orders, sum(amount) as revenue
    
    9
    
    from mysql.orders
    
    10
    
    group by user_id
    
    11
    
    order by user_id;
    
    12
    
    13
    
    -- Smallest and largest order
    
    14
    
    select min(amount), max(amount) from mysql.orders;
    
    15
    
    16
    
    -- Number of distinct users who placed an order
    
    17
    
    select count(distinct user_id) from mysql.orders;
    
    18
    
    19
    
    -- Average order value per status
    
    20
    
    select status, avg(amount) as avg_amount
    
    21
    
    from mysql.orders
    
    22
    
    group by status;
[/code]

### Import foreign schema example#

This example imports all tables from a MySQL database automatically:
[code] 
    1
    
    -- Import all tables from the MySQL 'shop' database
    
    2
    
    import foreign schema shop
    
    3
    
      from server mysql_server
    
    4
    
      into mysql;
    
    5
    
    6
    
    -- The foreign tables are now available
    
    7
    
    select * from mysql.products limit 10;
    
    8
    
    select * from mysql.orders where status = 'pending';
[/code]