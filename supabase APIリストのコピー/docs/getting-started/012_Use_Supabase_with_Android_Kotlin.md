---
タイトル: Use Supabase with Android Kotlin
URL: https://supabase.com/docs/guides/getting-started/quickstarts/kotlin
カテゴリ: getting-started
更新日: 2026-08-02
タグ: android, getting-started, kotlin, quickstarts, supabase, with
---

# Use Supabase with Android Kotlin

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/kotlin
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** android, getting-started, kotlin, quickstarts, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create an Android app with Android Studio#](#3-create-an-android-app-with-android-studio)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install dependencies#](#5-install-dependencies)
- [6. Add internet access permission#](#6-add-internet-access-permission)
- [7. Initialize the Supabase client#](#7-initialize-the-supabase-client)
  - [Get API details#](#get-api-details)
- [8. Create a data model for instruments#](#8-create-a-data-model-for-instruments)
- [9. Query data from the app#](#9-query-data-from-the-app)
- [10. Start the app#](#10-start-the-app)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from an Android Kotlin app.

---

AI Prompt

Help me add Supabase to my Android Kotlin project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Create a new Android project in Android Studio. 2\. Add the Kotlin serialization plugin, Ktor client, and Supabase BOM to `build.gradle.kts`. 3\. Add `<uses-permission android:name="android.permission.INTERNET" />` to `AndroidManifest.xml`. 4\. Initialize the Supabase client in `MainActivity.kt` with your project URL and publishable key. 5\. Add a serializable `Instrument` data class. 6\. Use `LaunchedEffect` and `LazyColumn` to fetch and display the instruments table. 7\. Click Run in Android Studio to start the app. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/kotlin.md

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

## 3\. Create an Android app with Android Studio#

Select the **Android Studio > New > New Android Project** menu item.

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install dependencies#

Open `build.gradle.kts` (app) file and add the serialization plugin, Ktor client, and Supabase client.

Replace the version placeholders `$kotlin_version` with the Kotlin version of the project, and `$supabase_version` and `$ktor_version` with the respective latest versions.

You can find the latest supabase-kt version [on GitHub](<https://github.com/supabase-community/supabase-kt/releases>) and Ktor [in the Ktor documentation](<https://ktor.io/docs/welcome.html>).
[code] 
    1
    
    plugins {
    
    2
    
      ...
    
    3
    
      kotlin("plugin.serialization") version "$kotlin_version"
    
    4
    
    }
    
    5
    
    ...
    
    6
    
    dependencies {
    
    7
    
      ...
    
    8
    
      implementation(platform("io.github.jan-tennert.supabase:bom:$supabase_version"))
    
    9
    
      implementation("io.github.jan-tennert.supabase:postgrest-kt")
    
    10
    
      implementation("io.ktor:ktor-client-android:$ktor_version")
    
    11
    
    }
[/code]

## 6\. Add internet access permission#

Add the following line to the `AndroidManifest.xml` file under the `manifest` tag and outside the `application` tag.
[code] 
    1
    
    ...
    
    2
    
    <uses-permission android:name="android.permission.INTERNET" />
    
    3
    
    ...
[/code]

## 7\. Initialize the Supabase client#

You can create a Supabase client whenever you need to perform an API call.

For a quick example, create a client at the top of the `MainActivity.kt` file below the imports.

Replace the `supabaseUrl` and `supabaseKey` with your own, which you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&framework=androidkotlin&tab=mobiles>):

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=androidkotlin>)
[code] 
    1
    
    import ...
    
    2
    
    3
    
    val supabase = createSupabaseClient(
    
    4
    
        supabaseUrl = "https://xyzcompany.supabase.co",
    
    5
    
        supabaseKey = "your_publishable_key"
    
    6
    
      ) {
    
    7
    
        install(Postgrest)
    
    8
    
    }
    
    9
    
    ...
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=androidkotlin>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 8\. Create a data model for instruments#

Create a serializable data class to represent the data from the database.

Add the following below the `createSupabaseClient` function in the `MainActivity.kt` file.
[code] 
    1
    
    @Serializable
    
    2
    
    data class Instrument(
    
    3
    
        val id: Int,
    
    4
    
        val name: String,
    
    5
    
    )
[/code]

## 9\. Query data from the app#

Use `LaunchedEffect` to fetch data from the database and display it in a `LazyColumn`.

Replace the default `MainActivity` class with the following code.

This example application makes a network request from the UI code. In production, you should use a `ViewModel` to separate the UI and data fetching logic.
[code] 
    1
    
    class MainActivity : ComponentActivity() {
    
    2
    
        override fun onCreate(savedInstanceState: Bundle?) {
    
    3
    
            super.onCreate(savedInstanceState)
    
    4
    
            setContent {
    
    5
    
                SupabaseTutorialTheme {
    
    6
    
                    // A surface container using the 'background' color from the theme
    
    7
    
                    Surface(
    
    8
    
                        modifier = Modifier.fillMaxSize(),
    
    9
    
                        color = MaterialTheme.colorScheme.background
    
    10
    
                    ) {
    
    11
    
                        InstrumentsList()
    
    12
    
                    }
    
    13
    
                }
    
    14
    
            }
    
    15
    
        }
    
    16
    
    }
    
    17
    
    18
    
    @Composable
    
    19
    
    fun InstrumentsList() {
    
    20
    
        var instruments by remember { mutableStateOf<List<Instrument>>(listOf()) }
    
    21
    
        LaunchedEffect(Unit) {
    
    22
    
            withContext(Dispatchers.IO) {
    
    23
    
                instruments = supabase.from("instruments")
    
    24
    
                                  .select().decodeList<Instrument>()
    
    25
    
            }
    
    26
    
        }
    
    27
    
        LazyColumn {
    
    28
    
            items(
    
    29
    
                instruments,
    
    30
    
                key = { instrument -> instrument.id },
    
    31
    
            ) { instrument ->
    
    32
    
                Text(
    
    33
    
                    instrument.name,
    
    34
    
                    modifier = Modifier.padding(8.dp),
    
    35
    
                )
    
    36
    
            }
    
    37
    
        }
    
    38
    
    }
[/code]

## 10\. Start the app#

Run the app on an emulator or a physical device by clicking the `Run app` button in Android Studio.