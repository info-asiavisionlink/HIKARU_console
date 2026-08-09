---
タイトル: Build a User Management App with Svelte
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-svelte
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, svelte, tutorials, user, with, with-svelte
---

# Build a User Management App with Svelte

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-svelte
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, svelte, tutorials, user, with, with-svelte

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Svelte app#](#initialize-a-svelte-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the account component#](#update-the-account-component)
  - [Launch!#](#launch)

## 概要

Learn how to use Supabase in your Svelte App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/svelte-user-management>).

## Project setup#

Before you start building you need to set up the Database and API. You can do this by starting a new Project in Supabase and then creating a "schema" inside the database.

### Create a project#

  1. [Create a new project](</dashboard>) in the Supabase Dashboard.
  2. Enter your project details.
  3. Wait for the new database to launch.


### Set up the database schema#

Now set up the database schema. You can use the "User Management Starter" quickstart in the SQL Editor, or you can copy/paste the SQL from below and run it.

DashboardSQL

  1. Go to the [SQL Editor](</dashboard/project/_/sql>) page in the Dashboard.
  2. Click **User Management Starter** under the **Community > Quickstarts** tab.
  3. Click **Run**.


You can pull the database schema down to your local project by running the `db pull` command. Read the [local development docs](</docs/guides/local-development/database-migrations#link-your-project>) for detailed instructions.
[code]
    1
    
    supabase link --project-ref <project-id>
    
    2
    
    # You can get <project-id> from your project's dashboard URL: https://supabase.com/dashboard/project/<project-id>
    
    3
    
    supabase db pull
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=sveltekit>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the Svelte app from scratch.

### Initialize a Svelte app#

You can use the Vite Svelte TypeScript Template to initialize an app called `supabase-svelte`:
[code] 
    1
    
    npm create vite@latest supabase-svelte -- --template svelte-ts
    
    2
    
    cd supabase-svelte
    
    3
    
    npm install
[/code]

Install the only additional dependency: [supabase-js](<https://github.com/supabase/supabase-js>)
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

Finally, save the environment variables in a `.env`. All you need are the API URL and the key that you copied earlier.

.env
[code]
    1
    
    VITE_SUPABASE_URL=YOUR_SUPABASE_URL
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
[/code]

Now you have the API credentials in place, create a helper file to initialize the Supabase client. These variables will be exposed on the browser, and that's fine since you have [Row Level Security](</docs/guides/auth#row-level-security>) enabled on the Database.

src/supabaseClient.ts
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    4
    
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    5
    
    6
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey)
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/svelte-user-management/src/supabaseClient.ts>)

### App styling (optional)#

Optionally, update the CSS file `src/app.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/svelte-user-management/src/app.css>).

### Set up a login component#

Set up a Svelte component to manage logins and sign ups. It uses Magic Links, so users can sign in with their email without using passwords.

src/lib/Auth.svelte
[code]
    1
    
    <script lang="ts">
    
    2
    
      import { supabase } from "../supabaseClient";
    
    3
    
    4
    
      let loading = $state(false);
    
    5
    
      let email = $state("");
    
    6
    
    7
    
      const handleLogin = async () => {
    
    8
    
        try {
    
    9
    
          loading = true;
    
    10
    
          const { error } = await supabase.auth.signInWithOtp({ email });
    
    11
    
          if (error) throw error;
    
    12
    
          alert("Check your email for login link!");
    
    13
    
        } catch (error) {
    
    14
    
          if (error instanceof Error) {
    
    15
    
            alert(error.message);
    
    16
    
          }
    
    17
    
        } finally {
    
    18
    
          loading = false;
    
    19
    
        }
    
    20
    
      };
    
    21
    
    </script>
    
    22
    
    23
    
    <div class="row flex-center flex">
    
    24
    
      <div class="col-6 form-widget" aria-live="polite">
    
    25
    
        <h1 class="header">Supabase + Svelte</h1>
    
    26
    
        <p class="description">Sign in via magic link with your email below</p>
    
    27
    
        <form class="form-widget" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
    
    28
    
          <div>
    
    29
    
            <label for="email">Email</label>
    
    30
    
            <input
    
    31
    
              id="email"
    
    32
    
              class="inputField"
    
    33
    
              type="email"
    
    34
    
              placeholder="Your email"
    
    35
    
              bind:value={email}
    
    36
    
            />
    
    37
    
          </div>
    
    38
    
          <div>
    
    39
    
            <button
    
    40
    
              type="submit"
    
    41
    
              class="button block"
    
    42
    
              aria-live="polite"
    
    43
    
              disabled={loading}
    
    44
    
            >
    
    45
    
              <span>{loading ? "Loading" : "Send magic link"}</span>
    
    46
    
            </button>
    
    47
    
          </div>
    
    48
    
        </form>
    
    49
    
      </div>
    
    50
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/svelte-user-management/src/lib/Auth.svelte>)

### Account page#

After a user is signed in, allow them to edit their profile details and manage their account. Create a new component for that called `Account.svelte`.
[code] 
    1
    
    <script lang="ts">
    
    2
    
      import { onMount } from "svelte";
    
    3
    
      import type { AuthSession } from "@supabase/supabase-js";
    
    4
    
      import { supabase } from "../supabaseClient";
    
    5
    
    6
    
    // ...
    
    7
    
    8
    
    9
    
      interface Props {
    
    10
    
        session: AuthSession;
    
    11
    
      }
    
    12
    
    13
    
      let { session }: Props = $props();
    
    14
    
    15
    
      let loading = $state(false);
    
    16
    
      let username = $state<string | null>(null);
    
    17
    
      let website = $state<string | null>(null);
    
    18
    
      let avatarUrl = $state<string | null>(null);
    
    19
    
    20
    
      onMount(() => {
    
    21
    
        getProfile();
    
    22
    
      });
    
    23
    
    24
    
      const getProfile = async () => {
    
    25
    
        try {
    
    26
    
          loading = true;
    
    27
    
          const { user } = session;
    
    28
    
    29
    
          const { data, error, status } = await supabase
    
    30
    
            .from("profiles")
    
    31
    
            .select("username, website, avatar_url")
    
    32
    
            .eq("id", user.id)
    
    33
    
            .single();
    
    34
    
    35
    
          if (error && status !== 406) throw error;
    
    36
    
    37
    
          if (data) {
    
    38
    
            username = data.username;
    
    39
    
            website = data.website;
    
    40
    
            avatarUrl = data.avatar_url;
    
    41
    
          }
    
    42
    
        } catch (error) {
    
    43
    
          if (error instanceof Error) {
    
    44
    
            alert(error.message);
    
    45
    
          }
    
    46
    
        } finally {
    
    47
    
          loading = false;
    
    48
    
        }
    
    49
    
      };
    
    50
    
    51
    
      const updateProfile = async () => {
    
    52
    
        try {
    
    53
    
          loading = true;
    
    54
    
          const { user } = session;
    
    55
    
    56
    
          const updates = {
    
    57
    
            id: user.id,
    
    58
    
            username,
    
    59
    
            website,
    
    60
    
            avatar_url: avatarUrl,
    
    61
    
            updated_at: new Date().toISOString(),
    
    62
    
          };
    
    63
    
    64
    
          const { error } = await supabase.from("profiles").upsert(updates);
    
    65
    
    66
    
          if (error) {
    
    67
    
            throw error;
    
    68
    
          }
    
    69
    
        } catch (error) {
    
    70
    
          if (error instanceof Error) {
    
    71
    
            alert(error.message);
    
    72
    
          }
    
    73
    
        } finally {
    
    74
    
          loading = false;
    
    75
    
        }
    
    76
    
      };
    
    77
    
    </script>
    
    78
    
    79
    
    <form onsubmit={(e) => { e.preventDefault(); updateProfile(); }} class="form-widget">
    
    80
    
      <div>Email: {session.user.email}</div>
    
    81
    
      <div>
    
    82
    
    83
    
        // ...
    
    84
    
    85
    
        <label for="username">Name</label>
    
    86
    
        <input id="username" type="text" bind:value={username} />
    
    87
    
      </div>
    
    88
    
      <div>
    
    89
    
        <label for="website">Website</label>
    
    90
    
        <input id="website" type="text" bind:value={website} />
    
    91
    
      </div>
    
    92
    
      <div>
    
    93
    
        <button type="submit" class="button primary block" disabled={loading}>
    
    94
    
          {loading ? "Saving ..." : "Update profile"}
    
    95
    
        </button>
    
    96
    
      </div>
    
    97
    
      <button
    
    98
    
        type="button"
    
    99
    
        class="button block"
    
    100
    
        onclick={() => supabase.auth.signOut()}
    
    101
    
      >
    
    102
    
        Sign Out
    
    103
    
      </button>
    
    104
    
    </form>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/svelte-user-management/src/lib/Account.svelte>)

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Start by creating a new component:

src/lib/Avatar.svelte
[code]
    1
    
    <script lang="ts">
    
    2
    
      import { supabase } from "../supabaseClient";
    
    3
    
    4
    
      interface Props {
    
    5
    
        size: number;
    
    6
    
        url?: string | null;
    
    7
    
        onupload?: () => void;
    
    8
    
      }
    
    9
    
    10
    
      let { size, url = $bindable(null), onupload }: Props = $props();
    
    11
    
    12
    
      let avatarUrl = $state<string | null>(null);
    
    13
    
      let uploading = $state(false);
    
    14
    
      let files = $state<FileList>();
    
    15
    
    16
    
      const downloadImage = async (path: string) => {
    
    17
    
        try {
    
    18
    
          const { data, error } = await supabase.storage
    
    19
    
            .from("avatars")
    
    20
    
            .download(path);
    
    21
    
    22
    
          if (error) {
    
    23
    
            throw error;
    
    24
    
          }
    
    25
    
    26
    
          const url = URL.createObjectURL(data);
    
    27
    
          avatarUrl = url;
    
    28
    
        } catch (error) {
    
    29
    
          if (error instanceof Error) {
    
    30
    
            console.log("Error downloading image: ", error.message);
    
    31
    
          }
    
    32
    
        }
    
    33
    
      };
    
    34
    
    35
    
      const uploadAvatar = async () => {
    
    36
    
        try {
    
    37
    
          uploading = true;
    
    38
    
    39
    
          if (!files || files.length === 0) {
    
    40
    
            throw new Error("You must select an image to upload.");
    
    41
    
          }
    
    42
    
    43
    
          const file = files[0];
    
    44
    
          const fileExt = file.name.split(".").pop();
    
    45
    
          const filePath = `${Math.random()}.${fileExt}`;
    
    46
    
    47
    
          const { error } = await supabase.storage
    
    48
    
            .from("avatars")
    
    49
    
            .upload(filePath, file);
    
    50
    
    51
    
          if (error) {
    
    52
    
            throw error;
    
    53
    
          }
    
    54
    
    55
    
          url = filePath;
    
    56
    
          onupload?.();
    
    57
    
        } catch (error) {
    
    58
    
          if (error instanceof Error) {
    
    59
    
            alert(error.message);
    
    60
    
          }
    
    61
    
        } finally {
    
    62
    
          uploading = false;
    
    63
    
        }
    
    64
    
      };
    
    65
    
    66
    
      $effect(() => {
    
    67
    
        if (url) downloadImage(url);
    
    68
    
      });
    
    69
    
    </script>
    
    70
    
    71
    
    <div style="width: {size}px" aria-live="polite">
    
    72
    
      {#if avatarUrl}
    
    73
    
        <img
    
    74
    
          src={avatarUrl}
    
    75
    
          alt={avatarUrl ? "Avatar" : "No image"}
    
    76
    
          class="avatar image"
    
    77
    
          style="height: {size}px, width: {size}px"
    
    78
    
        />
    
    79
    
      {:else}
    
    80
    
        <div class="avatar no-image" style="height: {size}px, width: {size}px"></div>
    
    81
    
      {/if}
    
    82
    
      <div style="width: {size}px">
    
    83
    
        <label class="button primary block" for="single">
    
    84
    
          {uploading ? "Uploading ..." : "Upload avatar"}
    
    85
    
        </label>
    
    86
    
        <span style="display:none">
    
    87
    
          <input
    
    88
    
            type="file"
    
    89
    
            id="single"
    
    90
    
            accept="image/*"
    
    91
    
            bind:files
    
    92
    
            onchange={uploadAvatar}
    
    93
    
            disabled={uploading}
    
    94
    
          />
    
    95
    
        </span>
    
    96
    
      </div>
    
    97
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/svelte-user-management/src/lib/Avatar.svelte>)

### Update the account component#

With the Avatar component created, update `src/lib/Account.svelte` to include it:

src/lib/Account.svelte
[code]
    1
    
    <script lang="ts">
    
    2
    
      import { onMount } from "svelte";
    
    3
    
      import type { AuthSession } from "@supabase/supabase-js";
    
    4
    
      import { supabase } from "../supabaseClient";
    
    5
    
      import Avatar from "./Avatar.svelte";
    
    6
    
    7
    
      interface Props {
    
    8
    
        session: AuthSession;
    
    9
    
      }
    
    10
    
    11
    
      let { session }: Props = $props();
    
    12
    
    13
    
      let loading = $state(false);
    
    14
    
      let username = $state<string | null>(null);
    
    15
    
      let website = $state<string | null>(null);
    
    16
    
      let avatarUrl = $state<string | null>(null);
    
    17
    
    18
    
      onMount(() => {
    
    19
    
        getProfile();
    
    20
    
      });
    
    21
    
    22
    
      const getProfile = async () => {
    
    23
    
        try {
    
    24
    
          loading = true;
    
    25
    
          const { user } = session;
    
    26
    
    27
    
          const { data, error, status } = await supabase
    
    28
    
            .from("profiles")
    
    29
    
            .select("username, website, avatar_url")
    
    30
    
            .eq("id", user.id)
    
    31
    
            .single();
    
    32
    
    33
    
          if (error && status !== 406) throw error;
    
    34
    
    35
    
          if (data) {
    
    36
    
            username = data.username;
    
    37
    
            website = data.website;
    
    38
    
            avatarUrl = data.avatar_url;
    
    39
    
          }
    
    40
    
        } catch (error) {
    
    41
    
          if (error instanceof Error) {
    
    42
    
            alert(error.message);
    
    43
    
          }
    
    44
    
        } finally {
    
    45
    
          loading = false;
    
    46
    
        }
    
    47
    
      };
    
    48
    
    49
    
      const updateProfile = async () => {
    
    50
    
        try {
    
    51
    
          loading = true;
    
    52
    
          const { user } = session;
    
    53
    
    54
    
          const updates = {
    
    55
    
            id: user.id,
    
    56
    
            username,
    
    57
    
            website,
    
    58
    
            avatar_url: avatarUrl,
    
    59
    
            updated_at: new Date().toISOString(),
    
    60
    
          };
    
    61
    
    62
    
          const { error } = await supabase.from("profiles").upsert(updates);
    
    63
    
    64
    
          if (error) {
    
    65
    
            throw error;
    
    66
    
          }
    
    67
    
        } catch (error) {
    
    68
    
          if (error instanceof Error) {
    
    69
    
            alert(error.message);
    
    70
    
          }
    
    71
    
        } finally {
    
    72
    
          loading = false;
    
    73
    
        }
    
    74
    
      };
    
    75
    
    </script>
    
    76
    
    77
    
    <form onsubmit={(e) => { e.preventDefault(); updateProfile(); }} class="form-widget">
    
    78
    
      <div>Email: {session.user.email}</div>
    
    79
    
      <div>
    
    80
    
        <Avatar bind:url={avatarUrl} size={150} onupload={updateProfile} />
    
    81
    
        <label for="username">Name</label>
    
    82
    
        <input id="username" type="text" bind:value={username} />
    
    83
    
      </div>
    
    84
    
      <div>
    
    85
    
        <label for="website">Website</label>
    
    86
    
        <input id="website" type="text" bind:value={website} />
    
    87
    
      </div>
    
    88
    
      <div>
    
    89
    
        <button type="submit" class="button primary block" disabled={loading}>
    
    90
    
          {loading ? "Saving ..." : "Update profile"}
    
    91
    
        </button>
    
    92
    
      </div>
    
    93
    
      <button
    
    94
    
        type="button"
    
    95
    
        class="button block"
    
    96
    
        onclick={() => supabase.auth.signOut()}
    
    97
    
      >
    
    98
    
        Sign Out
    
    99
    
      </button>
    
    100
    
    </form>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/svelte-user-management/src/lib/Account.svelte>)

### Launch!#

With all the components in place, update `App.svelte`:

src/App.svelte
[code]
    1
    
    <script lang="ts">
    
    2
    
      import { onMount } from 'svelte'
    
    3
    
      import { supabase } from './supabaseClient'
    
    4
    
      import type { AuthSession } from '@supabase/supabase-js'
    
    5
    
      import Account from './lib/Account.svelte'
    
    6
    
      import Auth from './lib/Auth.svelte'
    
    7
    
    8
    
      let session = $state<AuthSession | null>(null)
    
    9
    
    10
    
      onMount(() => {
    
    11
    
        supabase.auth.getSession().then(({ data }) => {
    
    12
    
          session = data.session
    
    13
    
        })
    
    14
    
    15
    
        supabase.auth.onAuthStateChange((_event, _session) => {
    
    16
    
          session = _session
    
    17
    
        })
    
    18
    
      })
    
    19
    
    </script>
    
    20
    
    21
    
    <div class="container" style="padding: 50px 0 100px 0">
    
    22
    
      {#if !session}
    
    23
    
      <Auth />
    
    24
    
      {:else}
    
    25
    
      <Account {session} />
    
    26
    
      {/if}
    
    27
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/svelte-user-management/src/App.svelte>)

Once that's done, run this in a terminal window:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:5173](<http://localhost:5173>) and you should see the completed app.

Svelte uses Vite and the default port is `5173`, Supabase uses `port 3000`. To change the redirection port for Supabase go to: **Authentication > URL Configuration** and change the **Site URL** to `http://localhost:5173/`

![Supabase Svelte](/docs/img/supabase-svelte-demo.png)

At this stage you have a fully functional application!