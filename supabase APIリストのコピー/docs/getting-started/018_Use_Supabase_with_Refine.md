---
タイトル: Use Supabase with Refine
URL: https://supabase.com/docs/guides/getting-started/quickstarts/refine
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, quickstarts, refine, supabase, with
---

# Use Supabase with Refine

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/refine
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, quickstarts, refine, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create a Refine app#](#3-create-a-refine-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. UpdatesupabaseClientwith environment variables#](#5-update-supabaseclient-with-environment-variables)
  - [Get API details#](#get-api-details)
- [6. Add instruments resource and pages#](#6-add-instruments-resource-and-pages)
- [7. Add routes for instruments pages#](#7-add-routes-for-instruments-pages)
- [8. View instruments pages#](#8-view-instruments-pages)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from a Refine app.

---

AI Prompt

Help me add Supabase to my Refine project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Run `npm create refine-app@latest -- --preset refine-supabase my-app` to scaffold the app with Supabase pre-configured. 2\. Update `src/utility/supabaseClient.ts` with your Supabase URL and publishable key. 3\. Run `npm run refine create-resource instruments` to generate CRUD pages for the instruments table. 4\. Update `src/App.tsx` to add routes for the instruments list, create, edit, and show pages. 5\. Run `npm run dev` and open http://localhost:5173/instruments. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/refine.md

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

## 3\. Create a Refine app#

Create a [Refine](<https://github.com/refinedev/refine>) app using the [create refine-app](<https://refine.dev/docs/getting-started/quickstart/>).

The `refine-supabase` preset adds `@refinedev/supabase` supplementary package that supports Supabase in a Refine app. `@refinedev/supabase` out-of-the-box includes the Supabase dependency: [supabase-js](<https://github.com/supabase/supabase-js>).
[code] 
    1
    
    npm create refine-app@latest -- --preset refine-supabase my-app
[/code]

![Refine welcome page](/docs/img/refine-qs-welcome-page.png)

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Update `supabaseClient` with environment variables#

Update the `supabaseClient` with the `SUPABASE_URL` and `SUPABASE_KEY` of your Supabase API, which you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&framework=refine&tab=frameworks>). The `supabaseClient` is used in auth provider and data provider methods that allow the Refine app to connect to your Supabase backend.

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=refine>)

src/utility/supabaseClient.ts
[code]
    1
    
    import { createClient } from '@refinedev/supabase'
    
    2
    
    3
    
    const SUPABASE_URL = '<your-supabase-url>'
    
    4
    
    const SUPABASE_KEY = '<your-supabase-publishable-key>'
    
    5
    
    6
    
    export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    
    7
    
      db: {
    
    8
    
        schema: 'public',
    
    9
    
      },
    
    10
    
      auth: {
    
    11
    
        persistSession: true,
    
    12
    
      },
    
    13
    
    })
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=refine>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 6\. Add instruments resource and pages#

Use the following code to automatically add resources and generate code for the pages to show the `instruments` data using Refine Inferencer.

This defines pages for `list`, `create`, `show` and `edit` actions inside the `src/pages/instruments/` directory with a `<HeadlessInferencer />` component.

The `<HeadlessInferencer />` component depends on `@refinedev/react-table` and `@refinedev/react-hook-form` packages. To avoid errors, you should install them as dependencies with `npm install @refinedev/react-table @refinedev/react-hook-form`.

The `<HeadlessInferencer />` is a Refine Inferencer component that automatically generates necessary code for the `list`, `create`, `show` and `edit` pages.

Read more on [how the Inferencer works is in the Refine docs](<https://refine.dev/docs/packages/documentation/inferencer/>).
[code] 
    1
    
    npm run refine create-resource instruments
[/code]

## 7\. Add routes for instruments pages#

Add routes for the `list`, `create`, `show`, and `edit` pages.

Remove the `index` route for the Welcome page presented with the `<Welcome />` component.

src/App.tsx
[code]
    1
    
    import { Refine } from '@refinedev/core'
    
    2
    
    import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar'
    
    3
    
    import routerProvider, {
    
    4
    
      DocumentTitleHandler,
    
    5
    
      NavigateToResource,
    
    6
    
      UnsavedChangesNotifier,
    
    7
    
    } from '@refinedev/react-router'
    
    8
    
    import { dataProvider, liveProvider } from '@refinedev/supabase'
    
    9
    
    import { BrowserRouter, Route, Routes } from 'react-router-dom'
    
    10
    
    11
    
    import './App.css'
    
    12
    
    13
    
    import authProvider from './authProvider'
    
    14
    
    import {
    
    15
    
      InstrumentsCreate,
    
    16
    
      InstrumentsEdit,
    
    17
    
      InstrumentsList,
    
    18
    
      InstrumentsShow,
    
    19
    
    } from './pages/instruments'
    
    20
    
    import { supabaseClient } from './utility'
    
    21
    
    22
    
    function App() {
    
    23
    
      return (
    
    24
    
        <BrowserRouter>
    
    25
    
          <RefineKbarProvider>
    
    26
    
            <Refine
    
    27
    
              dataProvider={dataProvider(supabaseClient)}
    
    28
    
              liveProvider={liveProvider(supabaseClient)}
    
    29
    
              authProvider={authProvider}
    
    30
    
              routerProvider={routerProvider}
    
    31
    
              options={{
    
    32
    
                syncWithLocation: true,
    
    33
    
                warnWhenUnsavedChanges: true,
    
    34
    
              }}
    
    35
    
              resources={[
    
    36
    
                {
    
    37
    
                  name: 'instruments',
    
    38
    
                  list: '/instruments',
    
    39
    
                  create: '/instruments/create',
    
    40
    
                  edit: '/instruments/edit/:id',
    
    41
    
                  show: '/instruments/show/:id',
    
    42
    
                },
    
    43
    
              ]}
    
    44
    
            >
    
    45
    
              <Routes>
    
    46
    
                <Route index element={<NavigateToResource resource="instruments" />} />
    
    47
    
                <Route path="/instruments">
    
    48
    
                  <Route index element={<InstrumentsList />} />
    
    49
    
                  <Route path="create" element={<InstrumentsCreate />} />
    
    50
    
                  <Route path="edit/:id" element={<InstrumentsEdit />} />
    
    51
    
                  <Route path="show/:id" element={<InstrumentsShow />} />
    
    52
    
                </Route>
    
    53
    
              </Routes>
    
    54
    
              <RefineKbar />
    
    55
    
              <UnsavedChangesNotifier />
    
    56
    
              <DocumentTitleHandler />
    
    57
    
            </Refine>
    
    58
    
          </RefineKbarProvider>
    
    59
    
        </BrowserRouter>
    
    60
    
      )
    
    61
    
    }
    
    62
    
    63
    
    export default App
[/code]

## 8\. View instruments pages#

Start the app with the following command:
[code] 
    1
    
    npm run dev
[/code]

Open <http://localhost:5173/instruments>[](<http://localhost:5173/instruments>) in a browser, and you should be able to see the instruments pages along the `/instruments` routes. You can edit and add new instruments using the Inferencer generated UI.

The Inferencer auto-generated code gives you a good starting point on which to keep building your `list`, `create`, `show` and `edit` pages. You can get these by clicking the `Show the auto-generated code` buttons in their respective pages.