---
タイトル: Prisma
URL: https://supabase.com/docs/guides/database/prisma
カテゴリ: database
更新日: 2026-08-02
タグ: database, prisma
---

# Prisma

**URL:** https://supabase.com/docs/guides/database/prisma
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, prisma

## 目次

（目次なし）

## 概要

Prisma Quickstart

---

This guide shows how to connect your Prisma application to Supabase Postgres. If you encounter any problems, reference the [Prisma troubleshooting docs](</docs/guides/database/prisma/prisma-troubleshooting>).

If you plan to solely use Prisma instead of the Supabase Data API (PostgREST), turn it off in the [API Settings](</dashboard/project/_/settings/api>).

1

Create a custom user for Prisma

  * In the [SQL Editor](</dashboard/project/_/sql/new>), create a Prisma DB user with full privileges on the public schema.
  * This gives you better control over Prisma's access and makes it easier to monitor using Supabase tools like the [Query Performance Dashboard](</dashboard/project/_/advisors/query-performance>) and [Log Explorer](</dashboard/project/_/logs/explorer>).


password manager

For security, consider using a [password generator](<https://bitwarden.com/password-generator/>) for the Prisma role.
[code]
    1
    
    -- Create custom user
    
    2
    
    create user "prisma" with password 'custom_password' bypassrls createdb;
    
    3
    
    4
    
    -- extend prisma's privileges to postgres (necessary to view changes in Dashboard)
    
    5
    
    grant "prisma" to "postgres";
    
    6
    
    7
    
    -- Grant it necessary permissions over the relevant schemas (public)
    
    8
    
    grant usage on schema public to prisma;
    
    9
    
    grant create on schema public to prisma;
    
    10
    
    grant all on all tables in schema public to prisma;
    
    11
    
    grant all on all routines in schema public to prisma;
    
    12
    
    grant all on all sequences in schema public to prisma;
    
    13
    
    alter default privileges for role postgres in schema public grant all on tables to prisma;
    
    14
    
    alter default privileges for role postgres in schema public grant all on routines to prisma;
    
    15
    
    alter default privileges for role postgres in schema public grant all on sequences to prisma;
[/code]
[code]
    1
    
    -- alter prisma password if needed
    
    2
    
    alter user "prisma" with password 'new_password';
[/code]

2

Create a Prisma Project

Create a new Prisma Project on your computer

Create a new directory
[code]
    1
    
    mkdir hello-prisma
    
    2
    
    cd hello-prisma
[/code]

Initiate a new Prisma project

npmpnpmyarnbun
[code]
    1
    
    npm init -y
    
    2
    
    npm install prisma tsx @types/pg --save-dev
    
    3
    
    npm install @prisma/client @prisma/adapter-pg dotenv pg
    
    4
    
    5
    
    npx tsc --init
    
    6
    
    7
    
    npx prisma init
[/code]

3

Add your connection information to your .env file

  * On your project dashboard, click [Connect](</dashboard/project/_?showConnect=true>)
  * Find your Supavisor Session pooler string. It should end with 5432. It will be used in your `.env` file.


If you're in an [IPv6 environment](<https://github.com/orgs/supabase/discussions/27034>) or have the IPv4 Add-On, you can use the direct connection string instead of Supavisor in Session mode.

  * If you plan on deploying Prisma to a serverless or auto-scaling environment, you'll also need your Supavisor transaction mode string.
  * The string is identical to the session mode string but uses port 6543 at the end.


server-based deploymentsserverless deployments

In your .env file, set the DATABASE_URL variable to your connection string
[code]
    1
    
    # Used for Prisma Migrations and within your application
    
    2
    
    DATABASE_URL="postgres://[DB-USER].[PROJECT-REF]:[PRISMA-PASSWORD]@[DB-REGION].pooler.supabase.com:5432/postgres"
[/code]

Change your string's `[DB-USER]` to `prisma` and add the password you created in step 1
[code]
    1
    
    postgres://prisma.[PROJECT-REF]...
[/code]

4

Configure prisma.config.ts

Add `import "dotenv/config"` to the generated `prisma.config.ts`. If you are using a serverless environment, change the data source URL to `DIRECT_URL`.

server-based deploymentsserverless deployments
[code]
    1
    
    import "dotenv/config";
    
    2
    
    import { defineConfig, env } from "prisma/config";
    
    3
    
    4
    
    export default defineConfig({
    
    5
    
      schema: "prisma/schema",
    
    6
    
      migrations: {
    
    7
    
        path: "prisma/migrations",
    
    8
    
      },
    
    9
    
      datasource: {
    
    10
    
        url: env("DATABASE_URL"),
    
    11
    
      },
    
    12
    
    });
[/code]

5

Migrate and generate your Prisma client

If you have already modified your Supabase database, synchronize it with your migration file. Otherwise create new tables for your database, then generate the Prisma client.

New ProjectsPopulated Projects

Create new tables in your prisma.schema file
[code]
    1
    
    model Post {
    
    2
    
      id        Int     @id @default(autoincrement())
    
    3
    
      title     String
    
    4
    
      content   String?
    
    5
    
      published Boolean @default(false)
    
    6
    
      author    User?   @relation(fields: [authorId], references: [id])
    
    7
    
      authorId  Int?
    
    8
    
    }
    
    9
    
    10
    
    model User {
    
    11
    
      id    Int     @id @default(autoincrement())
    
    12
    
      email String  @unique
    
    13
    
      name  String?
    
    14
    
      posts Post[]
    
    15
    
    }
[/code]

commit your migration

npmpnpmyarnbun
[code]
    1
    
    npx prisma migrate dev --name first_prisma_migration
    
    2
    
    npx prisma generate
[/code]

6

Test your API

Create a index.ts file and run it to test your connection
[code]
    1
    
    import "dotenv/config";
    
    2
    
    import { PrismaClient } from "./generated/prisma/client";
    
    3
    
    import { PrismaPg } from "@prisma/adapter-pg";
    
    4
    
    5
    
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    
    6
    
    export const prisma = new PrismaClient({ adapter });
    
    7
    
    8
    
    async function main() {
    
    9
    
      const val = await prisma.user.findMany({
    
    10
    
        take: 10,
    
    11
    
      });
    
    12
    
      console.log(val);
    
    13
    
    }
    
    14
    
    15
    
    main()
    
    16
    
      .then(async () => {
    
    17
    
        await prisma.$disconnect();
    
    18
    
      })
    
    19
    
      .catch(async (e) => {
    
    20
    
        console.error(e);
    
    21
    
        await prisma.$disconnect();
    
    22
    
        process.exit(1);
    
    23
    
    });
[/code]