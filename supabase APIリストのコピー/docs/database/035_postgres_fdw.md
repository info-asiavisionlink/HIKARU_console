---
タイトル: postgres_fdw
URL: https://supabase.com/docs/guides/database/extensions/postgres_fdw
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, postgres, postgres_fdw
---

# postgres_fdw

**URL:** https://supabase.com/docs/guides/database/extensions/postgres_fdw
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, postgres, postgres_fdw

## 目次

- [Enable the extension#](#enable-the-extension)
- [Create a connection to another database#](#create-a-connection-to-another-database)
  - [Configuring execution options#](#configuring-execution-options)
- [Resources#](#resources)

## 概要

Query Postgres server from another

---

The extension enables Postgres to query tables and views on a remote Postgres server.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "postgres_fdw" and enable the extension.


## Create a connection to another database#

1

Create a foreign server

Define the remote database address
[code]
    1
    
    create server "<foreign_server_name>"
    
    2
    
        foreign data wrapper postgres_fdw
    
    3
    
        options (
    
    4
    
            host '<host>',
    
    5
    
            port '<port>',
    
    6
    
            dbname '<dbname>'
    
    7
    
        );
[/code]

2

Create a server mapping

Set the user credentials for the remote server
[code]
    1
    
    create user mapping for "<dbname>"
    
    2
    
    server "<foreign_server_name>"
    
    3
    
    options (
    
    4
    
        user '<db_user>',
    
    5
    
        password '<password>'
    
    6
    
    );
[/code]

3

Import tables

Import tables from the foreign database

Example: Import all tables from a schema
[code]
    1
    
    import foreign schema "<foreign_schema>"
    
    2
    
    from server "<foreign_server>"
    
    3
    
    into "<host_schema>";
[/code]

Example: Import specific tables
[code]
    1
    
    import foreign schema "<foreign_schema>"
    
    2
    
    limit to (
    
    3
    
        "<table_name1>",
    
    4
    
        "<table_name2>"
    
    5
    
    )
    
    6
    
    from server "<foreign_server>"
    
    7
    
    into "<host_schema>";
[/code]

4

Query foreign table
[code]
    1
    
    select * from "<foreign_table>"
[/code]

### Configuring execution options#

#### Fetch_size#

Maximum rows fetched per operation. For example, fetching 200 rows with `fetch_size` set to 100 requires 2 requests.
[code] 
    1
    
    alter server "<foreign_server_name>"
    
    2
    
    options (fetch_size '10000');
[/code]

#### Batch_size#

Maximum rows inserted per cycle. For example, inserting 200 rows with `batch_size` set to 100 requires 2 requests.
[code] 
    1
    
    alter server "<foreign_server_name>"
    
    2
    
    options (batch_size '1000');
[/code]

#### Extensions#

Lists shared extensions. Without them, queries involving unlisted extension functions or operators may fail or omit references.
[code] 
    1
    
    alter server "<foreign_server_name>"
    
    2
    
    options (extensions 'vector, postgis');
[/code]

For more server options, check the extension's [official documentation](<https://www.postgresql.org/docs/current/postgres-fdw.html#POSTGRES-FDW>)

## Resources#

  * Official [`postgres_fdw` documentation](<https://www.postgresql.org/docs/current/postgres-fdw.html#POSTGRES-FDW>)