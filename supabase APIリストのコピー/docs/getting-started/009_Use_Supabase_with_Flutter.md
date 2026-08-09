---
タイトル: Use Supabase with Flutter
URL: https://supabase.com/docs/guides/getting-started/quickstarts/flutter
カテゴリ: getting-started
更新日: 2026-08-02
タグ: flutter, getting-started, quickstarts, supabase, with
---

# Use Supabase with Flutter

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/flutter
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** flutter, getting-started, quickstarts, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create a Flutter app#](#3-create-a-flutter-app)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install the Supabase client library#](#5-install-the-supabase-client-library)
- [6. Initialize the Supabase client#](#6-initialize-the-supabase-client)
  - [Get API details#](#get-api-details)
- [7. Query data from the app#](#7-query-data-from-the-app)
- [8. Start the app#](#8-start-the-app)
- [9. Setup deep links (optional)#](#9-setup-deep-links-optional)
- [Going to production#](#going-to-production)
  - [Android#](#android)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from a Flutter app.

---

AI Prompt

Help me add Supabase to my Flutter project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Run `flutter create my_app` to scaffold the app. 2\. Add `supabase_flutter: ^2.0.0` to `pubspec.yaml`. 3\. Initialize Supabase in `lib/main.dart` with your project URL and publishable key. 4\. Replace the default app with a `FutureBuilder` and `ListView` to query and display the instruments table. 5\. Run `flutter run` to start the app. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/flutter.md

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

## 3\. Create a Flutter app#

Create a Flutter app using the `flutter create` command.
[code] 
    1
    
    flutter create my_app
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install the Supabase client library#

The fastest way to get started is to use the [`supabase_flutter`](<https://pub.dev/packages/supabase_flutter>) client library which provides a convenient interface for working with Supabase from a Flutter app.

Open the `pubspec.yaml` file inside your Flutter app and add `supabase_flutter` as a dependency.

pubspec.yaml
[code]
    1
    
    supabase_flutter: ^2.0.0
[/code]

## 6\. Initialize the Supabase client#

Open `lib/main.dart` and edit the main function to initialize Supabase using your project URL and publishable key, which you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&framework=flutter&tab=mobiles>):

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=flutter>)

lib/main.dart
[code]
    1
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    2
    
    3
    
    Future<void> main() async {
    
    4
    
      WidgetsFlutterBinding.ensureInitialized();
    
    5
    
    6
    
      await Supabase.initialize(
    
    7
    
        url: 'YOUR_SUPABASE_URL',
    
    8
    
        publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    
    9
    
      );
    
    10
    
      runApp(MyApp());
    
    11
    
    }
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=flutter>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 7\. Query data from the app#

Use a `FutureBuilder` to fetch the data when the home page loads and display the query result in a `ListView`.

Replace the default `MyApp` and `MyHomePage` classes with the following code.

lib/main.dart
[code]
    1
    
    class MyApp extends StatelessWidget {
    
    2
    
      const MyApp({super.key});
    
    3
    
    4
    
      @override
    
    5
    
      Widget build(BuildContext context) {
    
    6
    
        return const MaterialApp(
    
    7
    
          title: 'Instruments',
    
    8
    
          home: HomePage(),
    
    9
    
        );
    
    10
    
      }
    
    11
    
    }
    
    12
    
    13
    
    class HomePage extends StatefulWidget {
    
    14
    
      const HomePage({super.key});
    
    15
    
    16
    
      @override
    
    17
    
      State<HomePage> createState() => _HomePageState();
    
    18
    
    }
    
    19
    
    20
    
    class _HomePageState extends State<HomePage> {
    
    21
    
      final _future = Supabase.instance.client
    
    22
    
          .from('instruments')
    
    23
    
          .select();
    
    24
    
    25
    
      @override
    
    26
    
      Widget build(BuildContext context) {
    
    27
    
        return Scaffold(
    
    28
    
          body: FutureBuilder(
    
    29
    
            future: _future,
    
    30
    
            builder: (context, snapshot) {
    
    31
    
              if (!snapshot.hasData) {
    
    32
    
                return const Center(child: CircularProgressIndicator());
    
    33
    
              }
    
    34
    
              final instruments = snapshot.data!;
    
    35
    
              return ListView.builder(
    
    36
    
                itemCount: instruments.length,
    
    37
    
                itemBuilder: ((context, index) {
    
    38
    
                  final instrument = instruments[index];
    
    39
    
                  return ListTile(
    
    40
    
                    title: Text(instrument['name']),
    
    41
    
                  );
    
    42
    
                }),
    
    43
    
              );
    
    44
    
            },
    
    45
    
          ),
    
    46
    
        );
    
    47
    
      }
    
    48
    
    }
[/code]

## 8\. Start the app#

Run your app on a platform of your choosing! By default an app should launch in your web browser.

Note that `supabase_flutter` is compatible with web, iOS, Android, macOS, and Windows apps. Running the app on macOS requires additional configuration to [set the entitlements](<https://docs.flutter.dev/development/platform-integration/macos/building#setting-up-entitlements>).
[code] 
    1
    
    flutter run
[/code]

## 9\. Setup deep links (optional)#

Many sign in methods require deep links to redirect the user back to your app after authentication. Read more about setting deep links up for all platforms (including web) in the [Flutter Mobile Guide](</docs/guides/getting-started/tutorials/with-flutter#setup-deep-links>).

## Going to production#

### Android#

In production, your Android app needs explicit permission to use the internet connection on the user's device which is required to communicate with Supabase APIs. To do this, add the following line to the `android/app/src/main/AndroidManifest.xml` file.
[code] 
    1
    
    <manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    2
    
      <!-- Required to fetch data from the internet. -->
    
    3
    
      <uses-permission android:name="android.permission.INTERNET" />
    
    4
    
      <!-- ... -->
    
    5
    
    </manifest>
[/code]