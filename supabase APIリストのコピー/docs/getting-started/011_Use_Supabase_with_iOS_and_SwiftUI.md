---
タイトル: Use Supabase with iOS and SwiftUI
URL: https://supabase.com/docs/guides/getting-started/quickstarts/ios-swiftui
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, ios-swiftui, quickstarts, supabase, swift, swiftui, with
---

# Use Supabase with iOS and SwiftUI

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/ios-swiftui
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, ios-swiftui, quickstarts, supabase, swift, swiftui, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create an iOS SwiftUI app with Xcode#](#3-create-an-ios-swiftui-app-with-xcode)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install the Supabase client library#](#5-install-the-supabase-client-library)
- [6. Initialize the Supabase client#](#6-initialize-the-supabase-client)
  - [Get API details#](#get-api-details)
- [7. Create a data model for instruments#](#7-create-a-data-model-for-instruments)
- [8. Query data from the app#](#8-query-data-from-the-app)
- [9. Start the app#](#9-start-the-app)
- [10. Setting up deep links (optional)#](#10-setting-up-deep-links-optional)
- [Next steps#](#next-steps)

## 概要

Learn how to create a Supabase project, add some sample data to your database, and query the data from an iOS app.

---

AI Prompt

Help me add Supabase to my iOS SwiftUI project. Create a Supabase project at database.new and run the instruments table SQL. Then: 1\. Create a new iOS App project in Xcode. 2\. Add the `supabase-swift` package via File > Add Package Dependencies using the GitHub URL https://github.com/supabase/supabase-swift. 3\. Create `Supabase.swift` and initialize `SupabaseClient` with your project URL and publishable key. 4\. Create `Instrument.swift` as a decodable struct. 5\. Update `ContentView.swift` to fetch and display the instruments table using a `task` modifier and `List`. 6\. Run the app with Cmd + R in Xcode. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/ios-swiftui.md

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

## 3\. Create an iOS SwiftUI app with Xcode#

Select the **Xcode > New Project > iOS > App** menu item.

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install the Supabase client library#

Add the [supabase-swift](<https://github.com/supabase/supabase-swift>) package to your app using the Swift Package Manager.

In Xcode, navigate to **File > Add Package Dependencies...** and enter the repository URL `https://github.com/supabase/supabase-swift` in the search bar. For detailed instructions, see Apple's [tutorial on adding package dependencies](<https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app>).

Make sure to add `Supabase` product package as a dependency to your application target.

## 6\. Initialize the Supabase client#

Create a new `Supabase.swift` file add a new Supabase instance using your project URL and publishable key, which you can get from the helper below, or [from the project **Connect** panel](</dashboard/project/_?showConnect=true&framework=swift&tab=mobiles>):

[Open Connect panel](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=swift>)

Supabase.swift
[code]
    1
    
    import Supabase
    
    2
    
    3
    
    let supabase = SupabaseClient(
    
    4
    
      supabaseURL: URL(string: "YOUR_SUPABASE_URL")!,
    
    5
    
      supabaseKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
    
    6
    
    )
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=swift>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## 7\. Create a data model for instruments#

Create a decodable struct to deserialize the data from the database.

Add the following code to a new file named `Instrument.swift`.

Instrument.swift
[code]
    1
    
    struct Instrument: Decodable, Identifiable {
    
    2
    
      let id: Int
    
    3
    
      let name: String
    
    4
    
    }
[/code]

## 8\. Query data from the app#

Use a `task` to fetch the data from the database and display it using a `List`.

Replace the default `ContentView` with the following code.

ContentView.swift
[code]
    1
    
    import SwiftUI
    
    2
    
    3
    
    struct ContentView: View {
    
    4
    
    5
    
      @State var instruments: [Instrument] = []
    
    6
    
    7
    
      var body: some View {
    
    8
    
        List(instruments) { instrument in
    
    9
    
          Text(instrument.name)
    
    10
    
        }
    
    11
    
        .overlay {
    
    12
    
          if instruments.isEmpty {
    
    13
    
            ProgressView()
    
    14
    
          }
    
    15
    
        }
    
    16
    
        .task {
    
    17
    
          do {
    
    18
    
            instruments = try await supabase.from("instruments").select().execute().value
    
    19
    
          } catch {
    
    20
    
            dump(error)
    
    21
    
          }
    
    22
    
        }
    
    23
    
      }
    
    24
    
    }
[/code]

## 9\. Start the app#

Run the app on a simulator or a physical device by hitting `Cmd + R` on Xcode.

## 10\. Setting up deep links (optional)#

If you want to implement authentication features like magic links or OAuth, you need to set up deep links to redirect users back to your app. For instructions on configuring custom URL schemes for your iOS app, see the [deep linking guide](</docs/guides/auth/native-mobile-deep-linking?platform=swift>).

## Next steps#

  * Learn how to build a complete user management app with authentication in the [Swift tutorial](</docs/guides/getting-started/tutorials/with-swift>)
  * Explore the [supabase-swift](<https://github.com/supabase/supabase-swift>) library on GitHub