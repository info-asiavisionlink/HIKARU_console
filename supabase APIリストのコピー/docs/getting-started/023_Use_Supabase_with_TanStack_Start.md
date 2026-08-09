---
タイトル: Use Supabase with TanStack Start
URL: https://supabase.com/docs/guides/getting-started/quickstarts/tanstack
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, quickstarts, start, supabase, tanstack, with
---

# Use Supabase with TanStack Start

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/tanstack
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, quickstarts, start, supabase, tanstack, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create a TanStack Start app#](#3-create-a-tanstack-start-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install the Supabase client libraries#](#5-install-the-supabase-client-libraries)
- [6. Declare Supabase environment variables#](#6-declare-supabase-environment-variables)
  - [Get API details#](#get-api-details)
- [7. Create Supabase client utilities#](#7-create-supabase-client-utilities)
- [8. Query Supabase data from TanStack Start#](#8-query-supabase-data-from-tanstack-start)
- [9. Start the app#](#9-start-the-app)
- [Next steps#](#next-steps)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from a TanStack Start app.

---

AI Prompt

Help me add Supabase to my TanStack Start project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Run `npx @tanstack/cli@latest create my-app` to scaffold the app. 2\. Run `npm install @supabase/supabase-js @supabase/ssr`. 3\. Create `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. 4\. Create `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts` for browser and server clients. 5\. Update `src/routes/index.tsx` with a loader that queries and displays the instruments table using the server client. 6\. Run `npm run dev` and open http://localhost:3000. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/tanstack.md

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

## 3\. Create a TanStack Start app#

Create a TanStack Start app using the official CLI.
[code] 
    1
    
    npx @tanstack/cli@latest create my-app
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install the Supabase client libraries#

Navigate to the TanStack Start app and install `supabase-js` and `@supabase/ssr`, the helper package that manages cookie-based sessions for server-side rendering.
[code] 
    1
    
    cd my-app && npm install @supabase/supabase-js @supabase/ssr
[/code]

## 6\. Declare Supabase environment variables#

Create a `.env.local` file in the root of your project and populate it with your Supabase connection variables. Get the values from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=tanstack>).

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=tanstack>)

.env.local
[code]
    1
    
    VITE_SUPABASE_URL=<SUBSTITUTE_SUPABASE_URL>
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=<SUBSTITUTE_SUPABASE_PUBLISHABLE_KEY>
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=tanstack>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 7\. Create Supabase client utilities#

TanStack Start needs two Supabase clients: a browser client for components that run in the browser, and a server client for loaders and server functions. Create a `src/lib/supabase` folder with a file for each client.

src/lib/supabase/client.ts
[code]
    1
    
    /// <reference types="vite/types/importMeta.d.ts" />
    
    2
    
    import { createBrowserClient } from '@supabase/ssr'
    
    3
    
    4
    
    export function createClient() {
    
    5
    
      return createBrowserClient(
    
    6
    
        import.meta.env.VITE_SUPABASE_URL!,
    
    7
    
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
    
    8
    
      )
    
    9
    
    }
[/code]

src/lib/supabase/server.ts
[code]
    1
    
    import { createServerClient } from '@supabase/ssr'
    
    2
    
    import { getCookies, setCookie, setResponseHeader } from '@tanstack/react-start/server'
    
    3
    
    4
    
    export function createClient() {
    
    5
    
      return createServerClient(
    
    6
    
        process.env.VITE_SUPABASE_URL!,
    
    7
    
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    
    8
    
        {
    
    9
    
          cookies: {
    
    10
    
            getAll() {
    
    11
    
              return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
    
    12
    
            },
    
    13
    
            setAll(cookies, headers) {
    
    14
    
              cookies.forEach(({ name, value, options }) => {
    
    15
    
                setCookie(name, value, options)
    
    16
    
              })
    
    17
    
    18
    
              Object.entries(headers).forEach(([name, value]) => {
    
    19
    
                setResponseHeader(name, value)
    
    20
    
              })
    
    21
    
            },
    
    22
    
          },
    
    23
    
        }
    
    24
    
      )
    
    25
    
    }
[/code]

## 8\. Query Supabase data from TanStack Start#

Replace the contents of `src/routes/index.tsx` with the following to add a loader that queries the `instruments` table through the server client. The loader runs on the server, so the data is part of the initial server-rendered response.

src/routes/index.tsx
[code]
    1
    
    import { createFileRoute } from '@tanstack/react-router'
    
    2
    
    3
    
    import { createClient } from '@/lib/supabase/server'
    
    4
    
    5
    
    export const Route = createFileRoute('/')({
    
    6
    
      loader: async () => {
    
    7
    
        const supabase = createClient()
    
    8
    
        const { data: instruments } = await supabase.from('instruments').select()
    
    9
    
        return { instruments }
    
    10
    
      },
    
    11
    
      component: Home,
    
    12
    
    })
    
    13
    
    14
    
    function Home() {
    
    15
    
      const { instruments } = Route.useLoaderData()
    
    16
    
    17
    
      return (
    
    18
    
        <ul>
    
    19
    
          {instruments?.map((instrument) => (
    
    20
    
            <li key={instrument.name}>{instrument.name}</li>
    
    21
    
          ))}
    
    22
    
        </ul>
    
    23
    
      )
    
    24
    
    }
[/code]

## 9\. Start the app#

Run the development server, go to <http://localhost:3000>[](<http://localhost:3000>) in a browser and you should see the list of instruments.
[code] 
    1
    
    npm run dev
[/code]

## Next steps#

  * Learn how to [protect routes and check sessions](</docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=tanstack>) with the server client
  * Set up a complete [login and sign-up flow](</ui/docs/tanstack/password-based-auth>) from the Supabase UI Library
  * Explore [drop-in UI components](</ui>) for your Supabase app
  * [Insert more data](</docs/guides/database/import-data>) into your database
  * Upload and serve static files using [Storage](</docs/guides/storage>)