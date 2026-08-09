---
タイトル: Integrating with Supabase Database (Postgres)
URL: https://supabase.com/docs/guides/functions/connect-to-postgres
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: connect-to-postgres, database, edge-functions, functions, integrating, postgres, supabase, with
---

# Integrating with Supabase Database (Postgres)

**URL:** https://supabase.com/docs/guides/functions/connect-to-postgres
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** connect-to-postgres, database, edge-functions, functions, integrating, postgres, supabase, with

## 目次

- [Using supabase-js#](#using-supabase-js)
- [Using a Postgres client#](#using-a-postgres-client)
- [Using Drizzle#](#using-drizzle)
- [SSL connections#](#ssl-connections)
  - [Production#](#production)
  - [Local development#](#local-development)

## 概要

Connecting to Postgres from Edge Functions.

---

Connect to your Postgres database from an Edge Function by using the `supabase-js` client. You can also use other Postgres clients like [Deno Postgres](<https://deno.land/x/postgres>)

* * *

## Using supabase-js#

The [`withSupabase`](</docs/guides/functions/auth>) wrapper from `@supabase/server` hands you a `supabase-js` client (`ctx.supabase`) already scoped to the caller's Row Level Security policies, so you don't manage keys or authorization headers yourself. It also provides `ctx.supabaseAdmin` for privileged operations that bypass Row Level Security. Responses are automatically formatted as JSON. This is the recommended approach for most applications:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    5
    
        try {
    
    6
    
          // ctx.supabase respects the caller's RLS policies.
    
    7
    
          // ctx.supabaseAdmin bypasses RLS for privileged operations.
    
    8
    
          const { data, error } = await ctx.supabase.from('countries').select('*')
    
    9
    
    10
    
          if (error) {
    
    11
    
            throw error
    
    12
    
          }
    
    13
    
    14
    
          return Response.json({ data })
    
    15
    
        } catch (err) {
    
    16
    
          return Response.json({ error: String(err?.message ?? err) }, { status: 500 })
    
    17
    
        }
    
    18
    
      }),
    
    19
    
    }
[/code]

This enables:

  * Automatic Row Level Security enforcement
  * Built-in JSON serialization
  * Consistent error handling
  * TypeScript support for database schema


* * *

## Using a Postgres client#

Because Edge Functions are a server-side technology, it's safe to connect directly to your database using any popular Postgres client. This means you can run raw SQL from your Edge Functions.

Here is how you can connect to the database using Deno Postgres driver and run raw SQL. Check out the [full example](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/postgres-on-the-edge>).
[code] 
    1
    
    import { Pool } from 'jsr:@db/postgres@^0'
    
    2
    
    3
    
    // Create a database pool with one connection.
    
    4
    
    const pool = new Pool(Deno.env.get('SUPABASE_DB_URL')!, 1)
    
    5
    
    6
    
    export default {
    
    7
    
      fetch: async (_req) => {
    
    8
    
        try {
    
    9
    
          // Grab a connection from the pool
    
    10
    
          const connection = await pool.connect()
    
    11
    
    12
    
          try {
    
    13
    
            // Run a query
    
    14
    
            const result = await connection.queryObject`SELECT * FROM animals`
    
    15
    
            const animals = result.rows // [{ id: 1, name: "Lion" }, ...]
    
    16
    
    17
    
            const data = animals.map((animal) =>
    
    18
    
              Object.fromEntries(
    
    19
    
                Object.entries(animal).map(([key, value]) => [
    
    20
    
                  key,
    
    21
    
                  typeof value === 'bigint' ? value.toString() : value,
    
    22
    
                ])
    
    23
    
              )
    
    24
    
            )
    
    25
    
    26
    
            return Response.json(data, {
    
    27
    
              headers: {
    
    28
    
                'Content-Type': 'application/json; charset=utf-8',
    
    29
    
              },
    
    30
    
            })
    
    31
    
          } finally {
    
    32
    
            // Release the connection back into the pool
    
    33
    
            connection.release()
    
    34
    
          }
    
    35
    
        } catch (err) {
    
    36
    
          console.error(err)
    
    37
    
          return Response.json({ error: String(err?.message ?? err) }, { status: 500 })
    
    38
    
        }
    
    39
    
      },
    
    40
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/postgres-on-the-edge/index.ts>)

* * *

## Using Drizzle#

You can use Drizzle together with [Postgres.js](<https://github.com/porsager/postgres>). Both can be loaded directly from npm.

Declare the dependencies in a `deno.json` file inside the function directory (see [Managing functions dependencies](</docs/guides/functions/dependencies>) for more details):
[code] 
    1
    
    {
    
    2
    
      "imports": {
    
    3
    
        "drizzle-orm": "npm:drizzle-orm@0.29.1",
    
    4
    
        "drizzle-orm/": "npm:/drizzle-orm@0.29.1/",
    
    5
    
        "postgres": "npm:postgres@3.4.3"
    
    6
    
      }
    
    7
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/drizzle/deno.json>)

Then define your schema and query the database:
[code] 
    1
    
    import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
    
    2
    
    3
    
    export const user = pgTable('user', {
    
    4
    
      id: serial('id'),
    
    5
    
      name: text('name'),
    
    6
    
      email: text('email'),
    
    7
    
      password: text('password'),
    
    8
    
      role: text('role').$type<'admin' | 'customer'>(),
    
    9
    
      createdAt: timestamp('created_at'),
    
    10
    
      updatedAt: timestamp('updated_at'),
    
    11
    
    })
    
    12
    
    13
    
    export const countries = pgTable('countries', {
    
    14
    
      id: serial('id'),
    
    15
    
      name: text('name'),
    
    16
    
    })
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/_shared/schema.ts>)
[code] 
    1
    
    import { drizzle } from 'npm:drizzle-orm@^0/postgres-js'
    
    2
    
    import postgres from 'npm:postgres@^3'
    
    3
    
    4
    
    import { countries } from '../_shared/schema.ts'
    
    5
    
    6
    
    const connectionString = Deno.env.get('SUPABASE_DB_URL')!
    
    7
    
    // Disable prefetch as it is not supported for "Transaction" pool mode
    
    8
    
    const client = postgres(connectionString, { prepare: false })
    
    9
    
    const db = drizzle(client)
    
    10
    
    11
    
    export default {
    
    12
    
      fetch: async (_req) => {
    
    13
    
        const allCountries = await db.select().from(countries)
    
    14
    
    15
    
        return Response.json(allCountries)
    
    16
    
      },
    
    17
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/drizzle/index.ts>)

You can find the full example on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/drizzle>).

* * *

## SSL connections#

### Production#

Deployed edge functions are pre-configured to use SSL for connections to the Supabase database. You don't need to add any extra configurations.

### Local development#

If you want to use SSL connections during local development, follow these steps:

  1. Download the SSL certificate from [Database Settings](</dashboard/project/_/database/settings>)
  2. Add to your [local .env file](</docs/guides/functions/secrets>), add these two variables:


[code] 
    1
    
    SSL_CERT_FILE=/path/to/cert.crt # set the path to the downloaded cert
    
    2
    
    DENO_TLS_CA_STORE=mozilla,system
[/code]

Then, restart your local development server:
[code] 
    1
    
    supabase functions serve your-function
[/code]