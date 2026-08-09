---
タイトル: Use Supabase with Expo React Native
URL: https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
カテゴリ: getting-started
更新日: 2026-08-02
タグ: expo, expo-react-native, getting-started, native, quickstarts, react, supabase, with
---

# Use Supabase with Expo React Native

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** expo, expo-react-native, getting-started, native, quickstarts, react, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create an Expo app#](#3-create-an-expo-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install the Supabase client library#](#5-install-the-supabase-client-library)
- [6. Declare Supabase environment variables#](#6-declare-supabase-environment-variables)
  - [Get API details#](#get-api-details)
- [7. Initialize the Supabase client#](#7-initialize-the-supabase-client)
- [8. Query data from the app#](#8-query-data-from-the-app)
- [9. Start the app#](#9-start-the-app)
- [Next steps#](#next-steps)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from an Expo app.

---

AI Prompt

Help me add Supabase to my Expo React Native project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Run `npx create-expo-app my-app --template blank-typescript` to scaffold the app. 2\. Run `npx expo install @supabase/supabase-js react-native-url-polyfill expo-sqlite` to install dependencies. 3\. Create `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. 4\. Create `lib/supabase.ts` to initialize the Supabase client with localStorage persistence. 5\. Update `App.tsx` to fetch and display instruments using `useEffect` and `FlatList`. 6\. Run `npx expo start` and scan the QR code or press `i`/`a` for simulator. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native.md

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

## 3\. Create an Expo app#

Create a minimal Expo app using the `create-expo-app` command with the blank TypeScript template.
[code] 
    1
    
    npx create-expo-app my-app --template blank-typescript
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install the Supabase client library#

The fastest way to get started is to use the `@supabase/supabase-js` client library which provides a convenient interface for working with Supabase from a React Native app.

Navigate to the Expo app and install `supabase-js` along with the required dependencies for session storage and URL handling.
[code] 
    1
    
    cd my-app && npx expo install @supabase/supabase-js react-native-url-polyfill expo-sqlite
[/code]

## 6\. Declare Supabase environment variables#

Create a `.env` file in the root of your project and populate it with your Supabase connection variables that you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true>).

[Open Connect panel](</dashboard/project/_?showConnect=true>)

Expo requires environment variables to be prefixed with `EXPO_PUBLIC_` to be accessible in your app code.

.env
[code]
    1
    
    EXPO_PUBLIC_SUPABASE_URL=<SUBSTITUTE_SUPABASE_URL>
    
    2
    
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<SUBSTITUTE_SUPABASE_PUBLISHABLE_KEY>
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=&framework=>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 7\. Initialize the Supabase client#

Create a helper file at `lib/supabase.ts` to initialize the Supabase client using the environment variables.

The code below uses Expo's localStorage polyfill to persist authentication sessions.

lib/supabase.ts
[code]
    1
    
    import 'react-native-url-polyfill/auto'
    
    2
    
    3
    
    import { createClient } from '@supabase/supabase-js'
    
    4
    
    5
    
    import 'expo-sqlite/localStorage/install'
    
    6
    
    7
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
    
    8
    
    const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    
    9
    
    10
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    
    11
    
      auth: {
    
    12
    
        storage: localStorage,
    
    13
    
        autoRefreshToken: true,
    
    14
    
        persistSession: true,
    
    15
    
        detectSessionInUrl: false,
    
    16
    
      },
    
    17
    
    })
[/code]

## 8\. Query data from the app#

Replace the contents of `App.tsx` with the following code to fetch and display the instruments from your database.

Use `useEffect` to fetch the data when the component mounts and display the query result using React Native components.

App.tsx
[code]
    1
    
    import { useEffect, useState } from 'react'
    
    2
    
    import { FlatList, StyleSheet, Text, View } from 'react-native'
    
    3
    
    4
    
    import { supabase } from './lib/supabase'
    
    5
    
    6
    
    export default function App() {
    
    7
    
      const [instruments, setInstruments] = useState([])
    
    8
    
    9
    
      useEffect(() => {
    
    10
    
        getInstruments()
    
    11
    
      }, [])
    
    12
    
    13
    
      async function getInstruments() {
    
    14
    
        const { data } = await supabase.from('instruments').select()
    
    15
    
        setInstruments(data)
    
    16
    
      }
    
    17
    
    18
    
      return (
    
    19
    
        <View style={styles.container}>
    
    20
    
          <FlatList
    
    21
    
            data={instruments}
    
    22
    
            keyExtractor={(item) => item.id.toString()}
    
    23
    
            renderItem={({ item }) => <Text style={styles.item}>{item.name}</Text>}
    
    24
    
          />
    
    25
    
        </View>
    
    26
    
      )
    
    27
    
    }
    
    28
    
    29
    
    const styles = StyleSheet.create({
    
    30
    
      container: {
    
    31
    
        flex: 1,
    
    32
    
        backgroundColor: '#fff',
    
    33
    
        paddingTop: 50,
    
    34
    
        paddingHorizontal: 16,
    
    35
    
      },
    
    36
    
      item: {
    
    37
    
        padding: 16,
    
    38
    
        borderBottomWidth: 1,
    
    39
    
        borderBottomColor: '#ccc',
    
    40
    
      },
    
    41
    
    })
[/code]

## 9\. Start the app#

Run the development server and scan the QR code with the Expo Go app on your phone, or press `i` for iOS simulator or `a` for Android emulator.
[code] 
    1
    
    npx expo start
[/code]

## Next steps#

  * Set up [Auth](</docs/guides/auth>) for your app
  * [Insert more data](</docs/guides/database/import-data>) into your database
  * Upload and serve static files using [Storage](</docs/guides/storage>)