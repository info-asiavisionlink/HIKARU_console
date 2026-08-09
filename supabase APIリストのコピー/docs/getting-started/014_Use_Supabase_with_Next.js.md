---
タイトル: Use Supabase with Next.js
URL: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, next, nextjs, quickstarts, supabase, with
---

# Use Supabase with Next.js

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, next, nextjs, quickstarts, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create a Next.js app#](#3-create-a-nextjs-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Declare Supabase environment variables#](#5-declare-supabase-environment-variables)
  - [Get API details#](#get-api-details)
- [6. Query Supabase data from Next.js#](#6-query-supabase-data-from-nextjs)
- [7. Start the app#](#7-start-the-app)
- [Next steps#](#next-steps)

## 概要

Learn how to create a Supabase project, add some sample data, and query from a Next.js app.

---

AI Prompt

Help me add Supabase to my Next.js project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Run `npx create-next-app -e with-supabase` to scaffold the app. 2\. Rename `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. 3\. Create `app/instruments/page.tsx` using `createClient()` from `@/lib/supabase/server` to query and display the instruments table. 4\. Run `npm run dev` and open http://localhost:3000/instruments. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/nextjs.md

Show more

## 1\. Create a Supabase project#

To start, you need a Supabase project.

Create a new Supabase project from [the Dashboard of any organization](</dashboard/new/_>) you belong to.

Want to create a project programmatically?

Use [the Management API](</docs/reference/api/v1-create-a-project>) or ask [the MCP server](</docs/guides/ai-tools/mcp#account-management>) to create a new Supabase project.

## 2\. Set up your database#

When your Supabase project is up and running, create an `instruments` table with some sample data. Then set only the privileges each Postgres role needs, add [Row Level Security (RLS)](</docs/guides/database/postgres/row-level-security>) for enhanced security for database data by default, and create an RLS policy to make the data in the table publicly readable.

Do these steps within your project's dashboard by copying and running the snippet in your project's [SQL Editor](</dashboard/project/_/sql/new>).

Save some steps by [clicking here to prefill the SQL](</dashboard/project/_/sql/new?content=--%20Create%20the%20table%0Acreate%20table%20instruments%20\(%0A%20%20id%20bigint%20primary%20key%20generated%20always%20as%20identity%2C%0A%20%20name%20text%20not%20null%0A\)%3B%0A%0A--%20Insert%20sample%20data%20into%20the%20table%0Ainsert%20into%20instruments%20\(name\)%0Avalues%0A\('violin'\)%2C%0A\('viola'\)%2C%0A\('cello'\)%3B%0A%0A--%20Grant%20the%20privileges%20the%20role%20needs%2C%20which%20is%20read%20access%0Agrant%20select%20on%20public.instruments%20to%20anon%3B%0A%0A--%20Enable%20row%20level%20security%20for%20the%20table%0Aalter%20table%20instruments%20enable%20row%20level%20security%3B%0A%0A--%20Create%20a%20policy%20to%20allow%20the%20anon%20role%20to%20read%20from%20the%20instruments%20table%0Acreate%20policy%20%22public%20can%20read%20instruments%22%0Aon%20public.instruments%0Afor%20select%20to%20anon%0Ausing%20\(true\)%3B>) in the SQL Editor, and then clicking **Run**.

Want to setup the database programmatically?

You can use [the Management API](</docs/reference/api/v1-run-a-query>) or ask [the MCP server](</docs/guides/ai-tools/mcp#database>) to execute SQL queries.
[code] 
    1
    
    -- Create the table
    
    2
    
    create table instruments (
    
    3
    
      id bigint primary key generated always as identity,
    
    4
    
      name text not null
    
    5
    
    );
    
    6
    
    7
    
    -- Insert sample data into the table
    
    8
    
    insert into instruments (name)
    
    9
    
    values
    
    10
    
      ('violin'),
    
    11
    
      ('viola'),
    
    12
    
      ('cello');
    
    13
    
    14
    
    -- Grant the privileges the role needs, which is read access
    
    15
    
    grant select on public.instruments to anon;
    
    16
    
    17
    
    -- Enable row level security for the table
    
    18
    
    alter table instruments enable row level security;
    
    19
    
    20
    
    -- Create a policy to allow the anon role to read from the instruments table
    
    21
    
    create policy "public can read instruments"
    
    22
    
    on public.instruments
    
    23
    
    for select to anon
    
    24
    
    using (true);
[/code]

If you disabled the Data API during project setup, enable it in the [**Integrations > Data API**](</dashboard/project/_/integrations/data_api/settings>) section of the Dashboard and expose the specific tables or functions you want to access. To automatically grant access for new tables and functions in `public`, enable **Automatically expose new tables**.

## 3\. Create a Next.js app#

Use the `create-next-app` command and the `with-supabase` template, to create a Next.js app pre-configured with [Cookie-based Auth](</docs/guides/auth/server-side/creating-a-client?queryGroups=package-manager&package-manager=npm&queryGroups=framework&framework=nextjs&queryGroups=environment&environment=server>), [TypeScript](<https://www.typescriptlang.org/>), and [Tailwind CSS](<https://tailwindcss.com/>).
[code] 
    1
    
    npx create-next-app -e with-supabase
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Declare Supabase environment variables#

Rename `.env.example` to `.env.local` and populate with your Supabase connection variables that you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&framework=nextjs&tab=frameworks>).

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nextjs>)

.env.local
[code]
    1
    
    NEXT_PUBLIC_SUPABASE_URL=<SUBSTITUTE_SUPABASE_URL>
    
    2
    
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<SUBSTITUTE_SUPABASE_PUBLISHABLE_KEY>
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nextjs>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 6\. Query Supabase data from Next.js#

Create a new file at `app/instruments/page.tsx` and populate with the following.

This selects all the rows from the `instruments` table you created earlier and renders them on the page.

app/instruments/page.tsx
[code]
    1
    
    import { createClient } from "@/lib/supabase/server";
    
    2
    
    import { Suspense } from "react";
    
    3
    
    4
    
    async function InstrumentsData() {
    
    5
    
      const supabase = await createClient();
    
    6
    
      const { data: instruments } = await supabase.from("instruments").select();
    
    7
    
    8
    
      return <pre>{JSON.stringify(instruments, null, 2)}</pre>;
    
    9
    
    }
    
    10
    
    11
    
    export default function Instruments() {
    
    12
    
      return (
    
    13
    
        <Suspense fallback={<div>Loading instruments...</div>}>
    
    14
    
          <InstrumentsData />
    
    15
    
        </Suspense>
    
    16
    
      );
    
    17
    
    }
[/code]

## 7\. Start the app#

Run the development server, go to <http://localhost:3000/instruments>[](<http://localhost:3000/instruments>) in a browser and you should see the list of instruments.
[code] 
    1
    
    npm run dev
[/code]

## Next steps#

  * Explore [drop-in UI components](</ui>) for your Supabase app
  * Set up [Auth](</docs/guides/auth>) for your app
  * [Insert more data](</docs/guides/database/import-data>) into your database
  * Upload and serve static files using [Storage](</docs/guides/storage>)