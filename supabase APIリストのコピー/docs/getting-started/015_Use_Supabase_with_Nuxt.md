---
タイトル: Use Supabase with Nuxt
URL: https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, nuxt, nuxtjs, quickstarts, supabase, with
---

# Use Supabase with Nuxt

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, nuxt, nuxtjs, quickstarts, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create a Nuxt app#](#3-create-a-nuxt-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install the Supabase client library#](#5-install-the-supabase-client-library)
- [6. Declare Supabase environment variables#](#6-declare-supabase-environment-variables)
  - [Get API details#](#get-api-details)
- [7. Query data from the app#](#7-query-data-from-the-app)
- [8. Start the app#](#8-start-the-app)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from a Nuxt app.

---

AI Prompt

Help me add Supabase to my Nuxt project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Run `npx nuxi@latest init my-app` to scaffold the app. 2\. Run `npm install @supabase/supabase-js`. 3\. Create `.env` with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` and expose them via `nuxt.config.ts` runtimeConfig. 4\. Update `app.vue` to create a Supabase client and fetch and display the instruments table on mount. 5\. Run `npm run dev` and open http://localhost:3000. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs.md

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

## 3\. Create a Nuxt app#

Create a Nuxt app using the `npx nuxi` command.
[code] 
    1
    
    npx nuxi@latest init my-app
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install the Supabase client library#

The fastest way to get started is to use the `supabase-js` client library which provides a convenient interface for working with Supabase from a Nuxt app.

Navigate to the Nuxt app and install `supabase-js`.
[code] 
    1
    
    cd my-app && npm install @supabase/supabase-js
[/code]

## 6\. Declare Supabase environment variables#

Create a `.env` file and populate with your Supabase connection variables that you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&framework=nuxt&tab=frameworks>):

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nuxt>)

.envnuxt.config.ts
[code]
    1
    
    SUPABASE_URL=<SUBSTITUTE_SUPABASE_URL>
    
    2
    
    SUPABASE_PUBLISHABLE_KEY=<SUBSTITUTE_SUPABASE_PUBLISHABLE_KEY>
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nuxt>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 7\. Query data from the app#

In `app.vue`, create a Supabase client using your config values and replace the existing content with the following code.

app.vue
[code]
    1
    
    <script setup>
    
    2
    
    import { createClient } from '@supabase/supabase-js'
    
    3
    
    4
    
    const config = useRuntimeConfig()
    
    5
    
    const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
    
    6
    
    const instruments = ref([])
    
    7
    
    8
    
    async function getInstruments() {
    
    9
    
      const { data } = await supabase.from('instruments').select()
    
    10
    
      instruments.value = data
    
    11
    
    }
    
    12
    
    13
    
    onMounted(() => {
    
    14
    
      getInstruments()
    
    15
    
    })
    
    16
    
    </script>
    
    17
    
    18
    
    <template>
    
    19
    
      <ul>
    
    20
    
        <li v-for="instrument in instruments" :key="instrument.id">{{ instrument.name }}</li>
    
    21
    
      </ul>
    
    22
    
    </template>
[/code]

## 8\. Start the app#

Start the app, navigate to <http://localhost:3000>[](<http://localhost:3000>) in the browser, and you should see the list of instruments.
[code] 
    1
    
    npm run dev
[/code]

The community-maintained [@nuxtjs/supabase](<https://supabase.nuxtjs.org/>) module provides an alternate DX for working with Supabase in Nuxt.