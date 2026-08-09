---
タイトル: Use Supabase with RedwoodJS
URL: https://supabase.com/docs/guides/getting-started/quickstarts/redwoodjs
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, quickstarts, redwoodjs, supabase, with
---

# Use Supabase with RedwoodJS

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/redwoodjs
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, quickstarts, redwoodjs, supabase, with

## 目次

- [1. Setup your new Supabase project#](#1-setup-your-new-supabase-project)
- [2. Gather database connection strings#](#2-gather-database-connection-strings)
- [3. Create a RedwoodJS app#](#3-create-a-redwoodjs-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install MCP server (optional)#](#5-install-mcp-server-optional)
- [6. Configure environment variables#](#6-configure-environment-variables)
- [7. Update your Prisma schema#](#7-update-your-prisma-schema)
- [8. Create the instrument model and apply a schema migration#](#8-create-the-instrument-model-and-apply-a-schema-migration)
- [9. Update seed script#](#9-update-seed-script)
- [10. Seed your database#](#10-seed-your-database)
- [11. Scaffold the instrument UI#](#11-scaffold-the-instrument-ui)
- [12. Start the app#](#12-start-the-app)
- [13. View instruments UI#](#13-view-instruments-ui)

## 概要

Learn how to create a Supabase project, add some sample data to your database using Prisma migration and seeds, and query the data from a RedwoodJS app.

---

AI Prompt

Help me add Supabase to my RedwoodJS project. Create a Supabase project at database.new and copy the Transaction and Session pooler connection strings. Then: 1\. Run `yarn create redwood-app my-app --ts` to scaffold the app. 2\. Set `DATABASE_URL` (Transaction pooler with `?pgbouncer=true`) and `DIRECT_URL` (Session pooler) in `.env`. 3\. Update `api/db/schema.prisma` to use the PostgreSQL datasource with those env vars. 4\. Add an `Instrument` model to the Prisma schema and run `yarn rw prisma migrate dev`. 5\. Update `scripts/seed.ts` with instrument data and run `yarn rw prisma db seed`. 6\. Run `yarn rw g scaffold instrument` to scaffold the CRUD UI. 7\. Run `yarn rw dev` and open http://localhost:8910/instruments. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/redwoodjs.md

Show more

## 1\. Setup your new Supabase project#

[Create a new project](</dashboard>) in the Supabase Dashboard.

Be sure to make note of the Database Password you used as you will need this later to connect to your database.

![New project for redwoodjs](/docs/img/guides/getting-started/quickstarts/redwoodjs/new-project.png)

## 2\. Gather database connection strings#

Open the project [**Connect** panel](</dashboard/project/_?showConnect=true>). This quickstart connects using the [**Transaction pooler**](</dashboard/project/_?showConnect=true&method=transaction>) and [**Session pooler**](</dashboard/project/_?showConnect=true&method=session>) mode. Transaction mode is used for application queries and Session mode is used for running migrations with Prisma.

To do this, set the connection mode to `Transaction` in the [Database Settings page](</dashboard/project/_/database/settings>) and copy the connection string and append `?pgbouncer=true&connection_limit=1`. `pgbouncer=true` disables Prisma from generating prepared statements. This is required since our connection pooler does not support prepared statements in transaction mode yet. The `connection_limit=1` parameter is only required if you are using Prisma from a serverless environment. This is the Transaction mode connection string.

To get the Session mode connection pooler string, change the port of the connection string from the dashboard to 5432.

You will need the Transaction mode connection string and the Session mode connection string to set up environment variables in Step 6.

You can copy and paste these connection strings from the Supabase Dashboard when needed in later steps.

![pooled connection for redwoodjs](/docs/img/guides/getting-started/quickstarts/redwoodjs/pooled-connection-strings.png)

## 3\. Create a RedwoodJS app#

Create a RedwoodJS app with TypeScript.

The [`yarn` package manager](<https://yarnpkg.com>) is required to create a RedwoodJS app. You will use it to run RedwoodJS commands later.

While TypeScript is recommended, If you want a JavaScript app, omit the `--ts` flag.
[code] 
    1
    
    yarn create redwood-app my-app --ts
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install MCP server (optional)#

The Supabase MCP server connects AI assistants to Supabase, allowing you to interact with your projects on your behalf. Find out more on how to add it to your client in [the MCP docs](</docs/guides/ai-tools/mcp>).

## 6\. Configure environment variables#

In your `.env` file, add the following environment variables for your database connection:

  * The `DATABASE_URL` should use the Transaction mode connection string you copied in Step 2.

  * The `DIRECT_URL` should use the Session mode connection string you copied in Step 2.


.env
[code]
    1
    
    # Transaction mode connection string used for migrations
    
    2
    
    DATABASE_URL="postgres://postgres.[project-ref]:[db-password]@xxx.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
    
    3
    
    4
    
    # Session mode connection string — used by Prisma Client
    
    5
    
    DIRECT_URL="postgres://postgres.[project-ref]:[db-password]@xxx.pooler.supabase.com:5432/postgres"
[/code]

## 7\. Update your Prisma schema#

By default, RedwoodJS ships with a SQLite database, but we want to use Postgres.

Update your Prisma schema file `api/db/schema.prisma` to use your Supabase Postgres database connection environment variables you set up in Step 6.

api/db/schema.prisma
[code]
    1
    
    datasource db {
    
    2
    
      provider  = "postgresql"
    
    3
    
      url       = env("DATABASE_URL")
    
    4
    
      directUrl = env("DIRECT_URL")
    
    5
    
    }
[/code]

## 8\. Create the instrument model and apply a schema migration#

Create the Instrument model in `api/db/schema.prisma` and then run `yarn rw prisma migrate dev` from your terminal to apply the migration.

api/db/schema.prisma
[code]
    1
    
    model Instrument {
    
    2
    
      id   Int    @id @default(autoincrement())
    
    3
    
      name String @unique
    
    4
    
    }
[/code]

## 9\. Update seed script#

Seed the database with a few instruments.

Update the file `scripts/seed.ts` to contain the following code:

scripts/seed.ts
[code]
    1
    
    import type { Prisma } from '@prisma/client'
    
    2
    
    import { db } from 'api/src/lib/db'
    
    3
    
    4
    
    export default async () => {
    
    5
    
      try {
    
    6
    
        const data: Prisma.InstrumentCreateArgs['data'][] = [
    
    7
    
          { name: 'dulcimer' },
    
    8
    
          { name: 'harp' },
    
    9
    
          { name: 'guitar' },
    
    10
    
        ]
    
    11
    
    12
    
        console.log('Seeding instruments ...')
    
    13
    
    14
    
        const instruments = await db.instrument.createMany({ data })
    
    15
    
    16
    
        console.log('Done.', instruments)
    
    17
    
      } catch (error) {
    
    18
    
        console.error(error)
    
    19
    
      }
    
    20
    
    }
[/code]

## 10\. Seed your database#

Run the seed database command to populate the `Instrument` table with the instruments you created.

The reset database command `yarn rw prisma db reset` recreates the tables and also runs the seed script.
[code] 
    1
    
    yarn rw prisma db seed
[/code]

## 11\. Scaffold the instrument UI#

Use RedwoodJS generators to scaffold a CRUD UI for the `Instrument` model.
[code] 
    1
    
    yarn rw g scaffold instrument
[/code]

## 12\. Start the app#

Start the app via `yarn rw dev`. A browser will open to the RedwoodJS Splash page.

![RedwoodJS Splash Page](/docs/img/redwoodjs-qs-splash.png)

## 13\. View instruments UI#

Click on `/instruments` to visit <http://localhost:8910/instruments>[](<http://localhost:8910/instruments>) where should see the list of instruments.

You may now edit, delete, and add new instruments using the scaffolded UI.