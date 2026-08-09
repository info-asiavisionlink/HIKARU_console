---
タイトル: Troubleshooting prisma errors
URL: https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting
カテゴリ: database
更新日: 2026-08-02
タグ: database, errors, prisma, prisma-troubleshooting, troubleshooting
---

# Troubleshooting prisma errors

**URL:** https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, errors, prisma, prisma-troubleshooting, troubleshooting

## 目次

- [Understanding connection string parameters:#](#start)
- [Errors#](#errors)
  - [Prepared statement already exists#](#prepared-statement-already-exists)
  - [Can't reach the database server#](#cant-reach-the-database-server)
  - [Timed out fetching a new connection from the connection pool#](#timed-out-fetching-a-new-connection-from-the-connection-pool)
  - [Server has closed the connection#](#server-has-closed-the-connection)
  - [Drift detected: Your database schema is not in sync with your migration history#](#drift-detected-your-database-schema-is-not-in-sync-with-your-migration-history)
  - [Max client connections reached#](#max-client-connections-reached)
  - [Cross schema references are only allowed when the target schema is listed in the schemas property of your data-source#](#cross-schema-references-are-only-allowed-when-the-target-schema-is-listed-in-the-schemas-property-of-your-data-source)

## 概要

Prisma error troubleshooting

---

This guide addresses common Prisma errors that you might encounter while using Supabase.

A full list of errors can be found in [Prisma's official docs](<https://www.prisma.io/docs/orm/reference/error-reference>).

## Understanding connection string parameters: #

Unlike other libraries, Prisma lets you configure [its settings](<https://www.prisma.io/docs/orm/overview/databases/postgresql#arguments>) through special options appended to your connection string.

These options, called "query parameters," can be used to address specific errors.
[code] 
    1
    
    # Example of query parameters
    
    2
    
    3
    
    connection_string.../postgres?KEY1=VALUE&KEY2=VALUE&KEY3=VALUE
[/code]

## Errors#

### Prepared statement already exists#

Supavisor in transaction mode (port 6543) does not support [prepared statements](<https://www.postgresql.org/docs/current/sql-prepare.html>), which Prisma will try to create in the background.

#### Solution: #

  * Add `pgbouncer=true` to the connection string. This turns off prepared statements in Prisma.


[code] 
    1
    
    .../postgres?pgbouncer=true
[/code]

* * *

### Can't reach the database server#

Prisma couldn't establish a connection with Postgres or Supavisor before the timeout.

#### Possible causes: #

  * **Database overload** : The database server is under heavy load, causing Prisma to struggle to connect.
  * **Malformed connection string** : The connection string used by Prisma is incorrect or incomplete.
  * **Transient network issues** : Temporary network problems are disrupting the connection.


#### Solutions: #

  * **Check database health** : Use the [Observability Dashboard](</dashboard/project/_/observability/database>) to monitor CPU, memory, and I/O usage. If the database is overloaded, consider increasing your [compute size](</docs/guides/platform/compute-and-disk>) or [optimizing your queries](</docs/guides/database/query-optimization>).
  * **Verify connection string** : Double-check the connection string in your Prisma configuration to ensure it matches in your [project connect page](</dashboard/project/_?showConnect=true>).
  * **Increase connection timeout** : Try increasing the `connect_timeout` parameter in your Prisma configuration to give it more time to establish a connection.


[code] 
    1
    
    .../postgres?connect_timeout=30
[/code]

* * *

### Timed out fetching a new connection from the connection pool#

Prisma is unable to allocate connections to pending queries fast enough to meet demand.

#### Possible causes: #

  * **Overwhelmed server** : The server hosting Prisma is under heavy load, limiting its ability to manage connections. By default, Prisma will create the default `num_cpus * 2 + 1` worth of connections. A common cause for server strain is increasing the `connection_limit` significantly past the default.
  * **Insufficient pool size** : The Supavisor pooler does not have enough connections available to satisfy Prisma's requests.
  * **Slow queries** : Prisma's queries are taking too long to execute, preventing it from releasing connections for reuse.


#### Solutions: #

  * **Increase the pool timeout** : Increase the `pool_timeout` parameter in your Prisma configuration to give the pooler more time to allocate connections.
  * **Reduce the connection limit** : If you've explicitly increased the `connection_limit` parameter in your Prisma configuration, try reducing it to a more reasonable value.
  * **Increase pool size** : If you are connecting with Supavisor, try increasing the pool size in the [Database Settings](</dashboard/project/_/database/settings>).
  * **Optimize queries** : [Improve the efficiency of your queries](</docs/guides/database/query-optimization>) to reduce execution time.
  * **Increase compute size** : Like the preceding option, this is a strategy to reduce query execution time.


* * *

### Server has closed the connection#

According to this [GitHub Issue for Prisma](<https://github.com/prisma/prisma/discussions/7389>), this error may be related to large return values for queries. It may also be caused by significant database strain.

#### Solutions: #

  * **Limit row return sizes** : Try to limit the total amount of rows returned for particularly large requests.
  * **Minimize database strain** :Check the Reports Page for database strain. If there is obvious strain, consider [optimizing](</docs/guides/database/query-optimization>) or increasing compute size


* * *

### Drift detected: Your database schema is not in sync with your migration history#

Prisma relies on migration files to ensure your database aligns with Prisma's model. External schema changes are detected as "drift", which Prisma will try to overwrite, potentially causing data loss.

#### Possible causes: #

  * **Supabase Managed Schemas** : Supabase may update managed schemas like auth and storage to introduce new features. Granting Prisma access to these schemas can lead to drift during updates.
  * **External Schema Modifications** : Your team or another tool might have modified the database schema outside of Prisma, causing drift.


#### Solution: #

  * **Baselining migrations** : [baselining](<https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining>) re-syncs Prisma by capturing the current database schema as the starting point for future migrations.


* * *

### Max client connections reached#

Postgres or Supavisor rejected a request for more connections

#### Possible causes:#

  * **When working in transaction mode (port 6543):** The error "Max client connections reached" occurs when clients try to form more connections with the pooler than it can support.
  * **When working in session mode (port 5432):** The max amount of clients is restricted to the "Pool Size" value in the [Database Settings](</dashboard/project/_/database/settings>). If the "Pool Size" is set to 15, even if the pooler can handle 200 client connections, it will still be effectively capped at 15 for each unique ["database-role+database" combination](<https://github.com/orgs/supabase/discussions/21566>).
  * **When working with direct connections** : Postgres is already servicing the max amount of connections


#### Solutions #

  * **Transaction Mode for serverless apps** : If you are using serverless functions (Supabase Edge, Vercel, AWS Lambda), switch to transaction mode (port 6543). It handles more connections than session mode or direct connections.
  * **Reduce the number of Prisma connections** : A single client-server can establish multiple connections with a pooler. Typically, serverless setups do not need many connections. Starting with fewer, like five or three, or even one, is often sufficient. In serverless setups, begin with `connection_limit=1`, increasing cautiously if needed to avoid maxing out connections.
  * **Increase pool size** : If you are connecting with Supavisor, try increasing the pool size in the [Database Settings](</dashboard/project/_/database/settings>).
  * **Disconnect appropriately** : Close Prisma connections when they are no longer needed.
  * **Decrease query time** : Reduce query complexity or add [strategic indexes](</docs/guides/database/postgres/indexes>) to your tables to speed up queries.
  * **Increase compute size** : Sometimes the best option is to increase your compute size, which also increases your max client size and query execution speed


* * *

### Cross schema references are only allowed when the target schema is listed in the schemas property of your data-source#

A Prisma migration is referencing a schema it is not permitted to manage.

#### Possible causes: #

  * A migration references a schema that Prisma is not permitted to manage


#### Solutions: #

  * Multi-schema support: If the external schema isn't Supabase managed, list the relevant schemas on the `datasource` block in your `schema.prisma` file.


[code] 
    1
    
    generator client {
    
    2
    
      provider = "prisma-client"
    
    3
    
      output   = "../generated/prisma"
    
    4
    
    }
    
    5
    
    6
    
    datasource db {
    
    7
    
      provider  = "postgresql"
    
    8
    
      schemas   = ["public", "other_schema"] //list out relevant schemas
    
    9
    
    }
[/code]

  * Supabase managed schemas: Schemas managed by Supabase, such as `auth` and `storage`, may be changed to support new features. Referencing these schemas directly will cause schema drift in the future. It is best to remove references to these schemas from your migrations.


An alternative strategy to reference these tables is to duplicate values into Prisma managed table with triggers. Below is an example for duplicating values from `auth.users` into a table called `profiles`.

Show/Hide Details
[code]
    1
    
    -- Create the 'profiles' table in the 'public' schema
    
    2
    
    create table public.profiles (
    
    3
    
      id uuid primary key,             -- 'id' is a UUID and the primary key for the table
    
    4
    
      email varchar(256)               -- 'email' is a variable character field with a maximum length of 256 characters
    
    5
    
    );
[/code]
[code]
    1
    
    -- Function to handle the insertion of a new user into the 'profiles' table
    
    2
    
    create function public.handle_new_user()
    
    3
    
    returns trigger
    
    4
    
    language plpgsql
    
    5
    
    security definer set search_path = ''
    
    6
    
    as $$
    
    7
    
    begin
    
    8
    
    9
    
      -- Insert the new user's data into the 'profiles' table
    
    10
    
      insert into public.profiles (id, email)
    
    11
    
      values (new.id, new.email);
    
    12
    
    13
    
      return new;     -- Return the new record
    
    14
    
    end;
    
    15
    
    $$;
[/code]
[code]
    1
    
    -- Function to handle the updating of a user's information in the 'profiles' table
    
    2
    
    create function public.update_user()
    
    3
    
    returns trigger
    
    4
    
    language plpgsql
    
    5
    
    security definer set search_path = ''
    
    6
    
    as
    
    7
    
    $$
    
    8
    
    begin
    
    9
    
      -- Update the user's data in the 'profiles' table
    
    10
    
      update public.profiles
    
    11
    
      set email = new.email     -- Update the 'email' field
    
    12
    
      where id = new.id;        -- Match the 'id' field with the new record
    
    13
    
    14
    
      return new;  -- Return the new record
    
    15
    
    end;
    
    16
    
    $$;
[/code]
[code]
    1
    
    -- Function to handle the deletion of a user from the 'profiles' table
    
    2
    
    create function public.delete_user()
    
    3
    
    returns trigger
    
    4
    
    language plpgsql
    
    5
    
    security definer set search_path = ''
    
    6
    
    as
    
    7
    
    $$
    
    8
    
    begin
    
    9
    
      -- Delete the user's data from the 'profiles' table
    
    10
    
      delete from public.profiles
    
    11
    
      where id = old.id;  -- Match the 'id' field with the old record
    
    12
    
    13
    
      return old;  -- Return the old record
    
    14
    
    end;
    
    15
    
    $$;
[/code]
[code]
    1
    
    -- Trigger to run 'handle_new_user' function after a new user is inserted into 'auth.users' table
    
    2
    
    create trigger on_auth_user_created
    
    3
    
      after insert on auth.users
    
    4
    
      for each row execute procedure public.handle_new_user();
    
    5
    
    6
    
    -- Trigger to run 'update_user' function after a user is updated in the 'auth.users' table
    
    7
    
    create trigger on_auth_user_updated
    
    8
    
      after update on auth.users
    
    9
    
      for each row execute procedure public.update_user();
    
    10
    
    11
    
    -- Trigger to run 'delete_user' function after a user is deleted from the 'auth.users' table
    
    12
    
    create trigger on_auth_user_deleted
    
    13
    
      after delete on auth.users
    
    14
    
      for each row execute procedure public.delete_user();
[/code]