---
タイトル: Foreign Data Wrappers
URL: https://supabase.com/docs/guides/database/extensions/wrappers/overview
カテゴリ: database
更新日: 2026-08-02
タグ: data, database, extensions, foreign, overview, wrappers
---

# Foreign Data Wrappers

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/overview
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** data, database, extensions, foreign, overview, wrappers

## 目次

- [Concepts#](#concepts)
  - [Remote servers#](#remote-servers)
  - [Foreign tables#](#foreign-tables)
  - [ETL with Wrappers#](#etl-with-wrappers)
  - [On-demand ETL with Wrappers#](#on-demand-etl-with-wrappers)
  - [Batch ETL with Wrappers#](#batch-etl-with-wrappers)
  - [WebAssembly Wrappers#](#webassembly-wrappers)
- [Security#](#security)
- [Resources#](#resources)

## 概要

Connecting to external systems using Postgres Foreign Data Wrappers.

---

Foreign Data Wrappers (FDW) are a core feature of Postgres that allow you to access and query data stored in external data sources as if they were native Postgres tables.

Postgres includes several built-in foreign data wrappers, such as [`postgres_fdw`](<https://www.postgresql.org/docs/current/postgres-fdw.html>) for accessing other Postgres databases, and [`file_fdw`](<https://www.postgresql.org/docs/current/file-fdw.html>) for reading data from files. Supabase extends this feature to query other databases or any other external systems. We do this with our open source [Wrappers](<https://github.com/supabase/wrappers>) framework. In these guides we'll refer to them as "Wrappers", Foreign Data Wrappers, or FDWs. They are conceptually the same thing.

## Concepts#

Wrappers introduce some new terminology and different workflows.

![Foreign Data Wrappers \(FDW\)](/docs/_next/image?url=%2Fdocs%2Fimg%2Fdatabase%2Fforeign-data-wrappers%2Fextracting-data--light.png&w=3840&q=75)

### Remote servers#

A Remote Server is an external database, API, or any system containing data that you want to query from your Postgres database. Examples include:

  * An external database, like Postgres or Firebase.
  * A remote data warehouse, like ClickHouse, BigQuery, or Snowflake.
  * An API, like Stripe or GitHub.


It's possible to connect to multiple remote servers of the same type. For example, you can connect to two different Firebase projects within the same Supabase database.

### Foreign tables#

A table in your database which maps to some data inside a Remote Server.

Examples:

  * An `analytics` table which maps to a table inside your data warehouse.
  * A `subscriptions` table which maps to your Stripe subscriptions.
  * A `collections` table which maps to a Firebase collection.


Although a foreign table behaves like any other table, the data is not stored inside your database. The data remains inside the Remote Server.

### ETL with Wrappers#

ETL stands for Extract, Transform, Load. It's an established process for moving data from one system to another. For example, it's common to move data from a production database to a data warehouse.

There are many popular ETL tools, such as [Fivetran](<https://fivetran.com/>) and [Airbyte](<https://airbyte.io/>).

Wrappers provide an alternative to these tools. You can use SQL to move data from one table to another:
[code] 
    1
    
    -- Copy data from your production database to your
    
    2
    
    -- data warehouse for the last 24 hours:
    
    3
    
    4
    
    insert into warehouse.analytics
    
    5
    
    select * from public.analytics
    
    6
    
    where ts > (now() - interval '1 DAY');
[/code]

This approach provides several benefits:

  1. **Simplicity:** the Wrappers API is SQL, so data engineers don't need to learn new tools and languages.
  2. **Save on time:** avoid setting up additional data pipelines.
  3. **Save on Data Engineering costs:** less infrastructure to be managed.


One disadvantage is that Wrappers are not as feature-rich as ETL tools. They also couple the ETL process to your database.

### On-demand ETL with Wrappers#

Supabase extends the ETL concept with real-time data access. Instead of moving gigabytes of data from one system to another before you can query it, you can instead query the data directly from the remote server. This additional option, "Query", extends the ETL process and is called [QETL](<https://www.sciencedirect.com/science/article/abs/pii/S0169023X1730438X>) (pronounced "kettle"): Query, Extract, Transform, Load.
[code] 
    1
    
    -- Get all purchases for a user from your data warehouse:
    
    2
    
    select
    
    3
    
      auth.users.id as user_id,
    
    4
    
      warehouse.orders.id as order_id
    
    5
    
    from
    
    6
    
      warehouse.orders
    
    7
    
    join 
    
    8
    
      auth.users on auth.users.id = warehouse.orders.user_id
    
    9
    
    where 
    
    10
    
      auth.users.id = '<some_user_id>';
[/code]

This approach has several benefits:

  1. **On-demand:** analytical data is immediately available within your application with no additional infrastructure.
  2. **Always in sync:** since the data is queried directly from the remote server, it's always up-to-date.
  3. **Integrated:** large datasets are available within your application, and can be joined with your operational/transactional data.
  4. **Save on egress:** only extract/load what you need.


### Batch ETL with Wrappers#

A common use case for Wrappers is to extract data from a production database and load it into a data warehouse. This can be done within your database using [pg_cron](</docs/guides/database/extensions/pg_cron>). For example, you can schedule a job to run every night to extract data from your production database and load it into your data warehouse.
[code] 
    1
    
    -- Every day at 3am, copy data from your
    
    2
    
    -- production database to your data warehouse:
    
    3
    
    select cron.schedule(
    
    4
    
      'nightly-etl',
    
    5
    
      '0 3 * * *',
    
    6
    
      $$
    
    7
    
        insert into warehouse.analytics
    
    8
    
        select * from public.analytics
    
    9
    
        where ts > (now() - interval '1 DAY');
    
    10
    
      $$
    
    11
    
    );
[/code]

![FDW with pg_cron](/docs/_next/image?url=%2Fdocs%2Fimg%2Fdatabase%2Fforeign-data-wrappers%2Fextracting-data-pgcron--light.png&w=3840&q=75)

This process can be taxing on your database if you are moving large amounts of data. Often, it's better to use an external tool for batch ETL, such as [Fivetran](<https://fivetran.com/>) or [Airbyte](<https://airbyte.io/>).

### WebAssembly Wrappers#

WebAssembly (Wasm) is a binary instruction format that enables high-performance execution of code on the web. Wrappers now includes a Wasm runtime, which provides a sandboxed execution environment, to run Wasm foreign data wrappers. Combined Wrappers with Wasm, developing and distributing new FDW becomes much easier and you can even build your own Wasm FDW and use it on Supabase platform.

To learn more about Wasm FDW, visit [Wrappers official documentation](<https://supabase.github.io/wrappers/>).

## Security#

Foreign Data Wrappers do not provide Row Level Security, thus it is not advised to expose them via your API. Wrappers should _always_ be stored in a private schema. For example, if you are connecting to your Stripe account, you should create a `stripe` schema to store all of your foreign tables inside. This schema should _not_ be added to the “Additional Schemas” setting in the API section.

If you want to expose any of the foreign table columns to your public API, you can create a [Database Function with security definer](</docs/guides/database/functions#security-definer-vs-invoker>) in the `public` schema, and then you can interact with your foreign table through API. For better access control, the function should have appropriate filters on the foreign table to apply security rules based on your business needs.

As an example, go to [SQL Editor](</dashboard/project/_/sql/new>) and then follow below steps,

  1. Create a Stripe Products foreign table:
[code] 1
         
         create foreign table stripe.stripe_products (
         
         2
         
           id text,
         
         3
         
           name text,
         
         4
         
           active bool,
         
         5
         
           default_price text,
         
         6
         
           description text,
         
         7
         
           created timestamp,
         
         8
         
           updated timestamp,
         
         9
         
           attrs jsonb
         
         10
         
         )
         
         11
         
           server stripe_fdw_server
         
         12
         
           options (
         
         13
         
             object 'products',
         
         14
         
             rowid_column 'id'
         
         15
         
           );
[/code]

  2. Create a security definer function that queries the foreign table and filters on the name prefix parameter:
[code] 1
         
         create function public.get_stripe_products(name_prefix text)
         
         2
         
         returns table (
         
         3
         
           id text,
         
         4
         
           name text,
         
         5
         
           active boolean,
         
         6
         
           default_price text,
         
         7
         
           description text
         
         8
         
         )
         
         9
         
         language plpgsql
         
         10
         
         security definer set search_path = ''
         
         11
         
         as $$
         
         12
         
         begin
         
         13
         
           return query
         
         14
         
           select
         
         15
         
             t.id,
         
         16
         
             t.name,
         
         17
         
             t.active,
         
         18
         
             t.default_price,
         
         19
         
             t.description
         
         20
         
           from
         
         21
         
             stripe.stripe_products t
         
         22
         
           where
         
         23
         
             t.name like name_prefix || '%'
         
         24
         
           ;
         
         25
         
         end;
         
         26
         
         $$;
[/code]

  3. Restrict the function execution to a specific role only, for example, the authenticated users:

By default, the function created can be executed by any roles like `anon`, that means the foreign table is public accessible. Always limit the function execution permission to appropriate roles.
[code] 1
         
         -- revoke public execute permission
         
         2
         
         revoke execute on function public.get_stripe_products from public;
         
         3
         
         revoke execute on function public.get_stripe_products from anon;
         
         4
         
         5
         
         -- grant execute permission to a specific role only
         
         6
         
         grant execute on function public.get_stripe_products to authenticated;
[/code]


Once the preceding steps are finished, the function can be invoked from Supabase client to query the foreign table:
[code] 
    1
    
    const { data, error } = await supabase
    
    2
    
      .rpc('get_stripe_products', { name_prefix: 'Test' })
    
    3
    
      .select('*')
    
    4
    
    if (error) console.error(error)
    
    5
    
    else console.log(data)
[/code]

## Resources#

  * Official [`supabase/wrappers` documentation](<https://supabase.github.io/wrappers/>)