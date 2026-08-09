---
タイトル: Build a User Management App with SolidJS
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-solidjs
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, solidjs, tutorials, user, with, with-solidjs
---

# Build a User Management App with SolidJS

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-solidjs
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, solidjs, tutorials, user, with, with-solidjs

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a SolidJS app#](#initialize-a-solidjs-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the Account component#](#update-the-account-component)
  - [Launch!#](#launch)
- [Add a server route (SolidStart)#](#add-a-server-route-solidstart)

## 概要

Learn how to use Supabase in your SolidJS App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/solid-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=solidjs>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the SolidJS app from scratch.

### Initialize a SolidJS app#

You can use [degit](<https://github.com/Rich-Harris/degit>) to initialize an app called `supabase-solid`:
[code] 
    1
    
    npx degit solidjs/templates/ts supabase-solid
    
    2
    
    cd supabase-solid
[/code]

Then install the only additional dependency: [supabase-js](<https://github.com/supabase/supabase-js>)
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

And finally save the environment variables in a `.env` with the API URL and the key that you copied earlier.

.env
[code]
    1
    
    VITE_SUPABASE_URL=https://your-project-ref.supabase.co
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/.env.example>)

Now that you have the API credentials in place, create a helper file to initialize the Supabase client. These variables will be exposed on the browser, and that's completely fine since you have [Row Level Security](</docs/guides/auth#row-level-security>) enabled on the Database.

src/supabaseClient.tsx
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    import { Database } from './schema'
    
    3
    
    4
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    5
    
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    6
    
    7
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey)
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/src/supabaseClient.tsx>)

### App styling (optional)#

An optional step is to update the CSS file `src/index.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/solid-user-management/src/index.css>).

### Set up a login component#

Set up a SolidJS component to manage logins and sign ups using Magic Links, so users can sign in with their email without using passwords.

src/Auth.tsx
[code]
    1
    
    import { Component, createSignal } from 'solid-js'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    4
    
    const Auth: Component = () => {
    
    5
    
      const [loading, setLoading] = createSignal(false)
    
    6
    
      const [email, setEmail] = createSignal('')
    
    7
    
    8
    
      const handleLogin = async (e: SubmitEvent) => {
    
    9
    
        e.preventDefault()
    
    10
    
    11
    
        try {
    
    12
    
          setLoading(true)
    
    13
    
          const { error } = await supabase.auth.signInWithOtp({ email: email() })
    
    14
    
          if (error) throw error
    
    15
    
          alert('Check your email for the login link!')
    
    16
    
        } catch (error) {
    
    17
    
          if (error instanceof Error) {
    
    18
    
            alert(error.message)
    
    19
    
          }
    
    20
    
        } finally {
    
    21
    
          setLoading(false)
    
    22
    
        }
    
    23
    
      }
    
    24
    
    25
    
      return (
    
    26
    
        <div class="row flex-center flex">
    
    27
    
          <div class="col-6 form-widget" aria-live="polite">
    
    28
    
            <h1 class="header">Supabase + SolidJS</h1>
    
    29
    
            <p class="description">Sign in via magic link with your email below</p>
    
    30
    
            <form class="form-widget" onSubmit={handleLogin}>
    
    31
    
              <div>
    
    32
    
                <label for="email">Email</label>
    
    33
    
                <input
    
    34
    
                  id="email"
    
    35
    
                  class="inputField"
    
    36
    
                  type="email"
    
    37
    
                  placeholder="Your email"
    
    38
    
                  value={email()}
    
    39
    
                  onChange={(e) => setEmail(e.currentTarget.value)}
    
    40
    
                />
    
    41
    
              </div>
    
    42
    
              <div>
    
    43
    
                <button type="submit" class="button block" aria-live="polite">
    
    44
    
                  {loading() ? <span>Loading</span> : <span>Send magic link</span>}
    
    45
    
                </button>
    
    46
    
              </div>
    
    47
    
            </form>
    
    48
    
          </div>
    
    49
    
        </div>
    
    50
    
      )
    
    51
    
    }
    
    52
    
    53
    
    export default Auth
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/src/Auth.tsx>)

### Account page#

After a user is signed in allow them to edit their profile details and manage their account.

Create a new component for that called `Account.tsx`.

src/Account.tsx
[code]
    1
    
    import { Component, createEffect, createSignal } from 'solid-js'
    
    2
    
    3
    
    // ...
    
    4
    
    5
    
    import { supabase } from './supabaseClient'
    
    6
    
    7
    
    interface Props {
    
    8
    
      userId: string
    
    9
    
      userEmail: string | null
    
    10
    
    }
    
    11
    
    12
    
    const Account: Component<Props> = ({ userId, userEmail }) => {
    
    13
    
      const [loading, setLoading] = createSignal(true)
    
    14
    
      const [username, setUsername] = createSignal<string | null>(null)
    
    15
    
      const [website, setWebsite] = createSignal<string | null>(null)
    
    16
    
      const [avatarUrl, setAvatarUrl] = createSignal<string | null>(null)
    
    17
    
    18
    
      createEffect(() => {
    
    19
    
        getProfile()
    
    20
    
      })
    
    21
    
    22
    
      const getProfile = async () => {
    
    23
    
        try {
    
    24
    
          setLoading(true)
    
    25
    
    26
    
          let { data, error, status } = await supabase
    
    27
    
            .from('profiles')
    
    28
    
            .select(`username, website, avatar_url`)
    
    29
    
            .eq('id', userId)
    
    30
    
            .single()
    
    31
    
    32
    
          if (error && status !== 406) {
    
    33
    
            throw error
    
    34
    
          }
    
    35
    
    36
    
          if (data) {
    
    37
    
            setUsername(data.username)
    
    38
    
            setWebsite(data.website)
    
    39
    
            setAvatarUrl(data.avatar_url)
    
    40
    
          }
    
    41
    
        } catch (error) {
    
    42
    
          if (error instanceof Error) {
    
    43
    
            alert(error.message)
    
    44
    
          }
    
    45
    
        } finally {
    
    46
    
          setLoading(false)
    
    47
    
        }
    
    48
    
      }
    
    49
    
    50
    
      const updateProfile = async (e: Event) => {
    
    51
    
        e.preventDefault()
    
    52
    
    53
    
        try {
    
    54
    
          setLoading(true)
    
    55
    
    56
    
          const updates = {
    
    57
    
            id: userId,
    
    58
    
            username: username(),
    
    59
    
            website: website(),
    
    60
    
            avatar_url: avatarUrl(),
    
    61
    
            updated_at: new Date().toISOString(),
    
    62
    
          }
    
    63
    
    64
    
          let { error } = await supabase.from('profiles').upsert(updates)
    
    65
    
    66
    
          if (error) {
    
    67
    
            throw error
    
    68
    
          }
    
    69
    
        } catch (error) {
    
    70
    
          if (error instanceof Error) {
    
    71
    
            alert(error.message)
    
    72
    
          }
    
    73
    
        } finally {
    
    74
    
          setLoading(false)
    
    75
    
        }
    
    76
    
      }
    
    77
    
    78
    
      return (
    
    79
    
        <div aria-live="polite">
    
    80
    
          <form onSubmit={updateProfile} class="form-widget">
    
    81
    
    82
    
            {/* ... */}
    
    83
    
    84
    
            <div>Email: {userEmail}</div>
    
    85
    
            <div>
    
    86
    
              <label for="username">Name</label>
    
    87
    
              <input
    
    88
    
                id="username"
    
    89
    
                type="text"
    
    90
    
                value={username() || ''}
    
    91
    
                onChange={(e) => setUsername(e.currentTarget.value)}
    
    92
    
              />
    
    93
    
            </div>
    
    94
    
            <div>
    
    95
    
              <label for="website">Website</label>
    
    96
    
              <input
    
    97
    
                id="website"
    
    98
    
                type="text"
    
    99
    
                value={website() || ''}
    
    100
    
                onChange={(e) => setWebsite(e.currentTarget.value)}
    
    101
    
              />
    
    102
    
            </div>
    
    103
    
            <div>
    
    104
    
              <button type="submit" class="button primary block" disabled={loading()}>
    
    105
    
                {loading() ? 'Saving ...' : 'Update profile'}
    
    106
    
              </button>
    
    107
    
            </div>
    
    108
    
            <button type="button" class="button block" onClick={() => supabase.auth.signOut()}>
    
    109
    
              Sign Out
    
    110
    
            </button>
    
    111
    
          </form>
    
    112
    
        </div>
    
    113
    
      )
    
    114
    
    }
    
    115
    
    116
    
    export default Account
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/src/Account.tsx>)

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Start by creating a new component:

src/Avatar.tsx
[code]
    1
    
    import { Component, createEffect, createSignal, JSX } from 'solid-js'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    4
    
    interface Props {
    
    5
    
      size: number
    
    6
    
      url: string | null
    
    7
    
      onUpload: (event: Event, filePath: string) => void
    
    8
    
    }
    
    9
    
    10
    
    const Avatar: Component<Props> = (props) => {
    
    11
    
      const [avatarUrl, setAvatarUrl] = createSignal<string | null>(null)
    
    12
    
      const [uploading, setUploading] = createSignal(false)
    
    13
    
    14
    
      createEffect(() => {
    
    15
    
        if (props.url) downloadImage(props.url)
    
    16
    
      })
    
    17
    
    18
    
      const downloadImage = async (path: string) => {
    
    19
    
        try {
    
    20
    
          const { data, error } = await supabase.storage.from('avatars').download(path)
    
    21
    
          if (error) {
    
    22
    
            throw error
    
    23
    
          }
    
    24
    
          const url = URL.createObjectURL(data)
    
    25
    
          setAvatarUrl(url)
    
    26
    
        } catch (error) {
    
    27
    
          if (error instanceof Error) {
    
    28
    
            console.log('Error downloading image: ', error.message)
    
    29
    
          }
    
    30
    
        }
    
    31
    
      }
    
    32
    
    33
    
      const uploadAvatar: JSX.EventHandler<HTMLInputElement, Event> = async (event) => {
    
    34
    
        try {
    
    35
    
          setUploading(true)
    
    36
    
    37
    
          const target = event.currentTarget
    
    38
    
          if (!target?.files || target.files.length === 0) {
    
    39
    
            throw new Error('You must select an image to upload.')
    
    40
    
          }
    
    41
    
    42
    
          const file = target.files[0]
    
    43
    
          const fileExt = file.name.split('.').pop()
    
    44
    
          const fileName = `${Math.random()}.${fileExt}`
    
    45
    
          const filePath = `${fileName}`
    
    46
    
    47
    
          let { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    
    48
    
    49
    
          if (uploadError) {
    
    50
    
            throw uploadError
    
    51
    
          }
    
    52
    
    53
    
          props.onUpload(event, filePath)
    
    54
    
        } catch (error) {
    
    55
    
          if (error instanceof Error) {
    
    56
    
            alert(error.message)
    
    57
    
          }
    
    58
    
        } finally {
    
    59
    
          setUploading(false)
    
    60
    
        }
    
    61
    
      }
    
    62
    
    63
    
      return (
    
    64
    
        <div style={{ width: `${props.size}px` }} aria-live="polite">
    
    65
    
          {avatarUrl() ? (
    
    66
    
            <img
    
    67
    
              src={avatarUrl()!}
    
    68
    
              alt={avatarUrl() ? 'Avatar' : 'No image'}
    
    69
    
              class="avatar image"
    
    70
    
              style={{ height: `${props.size}px`, width: `${props.size}px` }}
    
    71
    
            />
    
    72
    
          ) : (
    
    73
    
            <div
    
    74
    
              class="avatar no-image"
    
    75
    
              style={{ height: `${props.size}px`, width: `${props.size}px` }}
    
    76
    
            />
    
    77
    
          )}
    
    78
    
          <div style={{ width: `${props.size}px` }}>
    
    79
    
            <label class="button primary block" for="single">
    
    80
    
              {uploading() ? 'Uploading ...' : 'Upload avatar'}
    
    81
    
            </label>
    
    82
    
            <span style="display:none">
    
    83
    
              <input
    
    84
    
                type="file"
    
    85
    
                id="single"
    
    86
    
                accept="image/*"
    
    87
    
                onChange={uploadAvatar}
    
    88
    
                disabled={uploading()}
    
    89
    
              />
    
    90
    
            </span>
    
    91
    
          </div>
    
    92
    
        </div>
    
    93
    
      )
    
    94
    
    }
    
    95
    
    96
    
    export default Avatar
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/src/Avatar.tsx>)

### Update the Account component#

With the Avatar component created, update `src/Account.tsx` to include it:

src/Account.tsx
[code]
    1
    
    import { Component, createEffect, createSignal } from 'solid-js'
    
    2
    
    import Avatar from './Avatar'
    
    3
    
    import { supabase } from './supabaseClient'
    
    4
    
    5
    
    interface Props {
    
    6
    
      userId: string
    
    7
    
      userEmail: string | null
    
    8
    
    }
    
    9
    
    10
    
    const Account: Component<Props> = ({ userId, userEmail }) => {
    
    11
    
      const [loading, setLoading] = createSignal(true)
    
    12
    
      const [username, setUsername] = createSignal<string | null>(null)
    
    13
    
      const [website, setWebsite] = createSignal<string | null>(null)
    
    14
    
      const [avatarUrl, setAvatarUrl] = createSignal<string | null>(null)
    
    15
    
    16
    
      createEffect(() => {
    
    17
    
        getProfile()
    
    18
    
      })
    
    19
    
    20
    
      const getProfile = async () => {
    
    21
    
        try {
    
    22
    
          setLoading(true)
    
    23
    
    24
    
          let { data, error, status } = await supabase
    
    25
    
            .from('profiles')
    
    26
    
            .select(`username, website, avatar_url`)
    
    27
    
            .eq('id', userId)
    
    28
    
            .single()
    
    29
    
    30
    
          if (error && status !== 406) {
    
    31
    
            throw error
    
    32
    
          }
    
    33
    
    34
    
          if (data) {
    
    35
    
            setUsername(data.username)
    
    36
    
            setWebsite(data.website)
    
    37
    
            setAvatarUrl(data.avatar_url)
    
    38
    
          }
    
    39
    
        } catch (error) {
    
    40
    
          if (error instanceof Error) {
    
    41
    
            alert(error.message)
    
    42
    
          }
    
    43
    
        } finally {
    
    44
    
          setLoading(false)
    
    45
    
        }
    
    46
    
      }
    
    47
    
    48
    
      const updateProfile = async (e: Event) => {
    
    49
    
        e.preventDefault()
    
    50
    
    51
    
        try {
    
    52
    
          setLoading(true)
    
    53
    
    54
    
          const updates = {
    
    55
    
            id: userId,
    
    56
    
            username: username(),
    
    57
    
            website: website(),
    
    58
    
            avatar_url: avatarUrl(),
    
    59
    
            updated_at: new Date().toISOString(),
    
    60
    
          }
    
    61
    
    62
    
          let { error } = await supabase.from('profiles').upsert(updates)
    
    63
    
    64
    
          if (error) {
    
    65
    
            throw error
    
    66
    
          }
    
    67
    
        } catch (error) {
    
    68
    
          if (error instanceof Error) {
    
    69
    
            alert(error.message)
    
    70
    
          }
    
    71
    
        } finally {
    
    72
    
          setLoading(false)
    
    73
    
        }
    
    74
    
      }
    
    75
    
    76
    
      return (
    
    77
    
        <div aria-live="polite">
    
    78
    
          <form onSubmit={updateProfile} class="form-widget">
    
    79
    
            <Avatar
    
    80
    
              url={avatarUrl()}
    
    81
    
              size={150}
    
    82
    
              onUpload={(e: Event, url: string) => {
    
    83
    
                setAvatarUrl(url)
    
    84
    
                updateProfile(e)
    
    85
    
              }}
    
    86
    
            />
    
    87
    
            <div>Email: {userEmail}</div>
    
    88
    
            <div>
    
    89
    
              <label for="username">Name</label>
    
    90
    
              <input
    
    91
    
                id="username"
    
    92
    
                type="text"
    
    93
    
                value={username() || ''}
    
    94
    
                onChange={(e) => setUsername(e.currentTarget.value)}
    
    95
    
              />
    
    96
    
            </div>
    
    97
    
            <div>
    
    98
    
              <label for="website">Website</label>
    
    99
    
              <input
    
    100
    
                id="website"
    
    101
    
                type="text"
    
    102
    
                value={website() || ''}
    
    103
    
                onChange={(e) => setWebsite(e.currentTarget.value)}
    
    104
    
              />
    
    105
    
            </div>
    
    106
    
            <div>
    
    107
    
              <button type="submit" class="button primary block" disabled={loading()}>
    
    108
    
                {loading() ? 'Saving ...' : 'Update profile'}
    
    109
    
              </button>
    
    110
    
            </div>
    
    111
    
            <button type="button" class="button block" onClick={() => supabase.auth.signOut()}>
    
    112
    
              Sign Out
    
    113
    
            </button>
    
    114
    
          </form>
    
    115
    
        </div>
    
    116
    
      )
    
    117
    
    }
    
    118
    
    119
    
    export default Account
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/src/Account.tsx>)

### Launch!#

With all the components in place, update `App.tsx`:

src/App.tsx
[code]
    1
    
    import { Component, createEffect, createSignal } from 'solid-js'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    import Account from './Account'
    
    4
    
    import Auth from './Auth'
    
    5
    
    6
    
    const App: Component = () => {
    
    7
    
      const [userId, setUserId] = createSignal<string | null>(null)
    
    8
    
      const [userEmail, setUserEmail] = createSignal<string | null>(null)
    
    9
    
    10
    
      const syncClaims = async () => {
    
    11
    
        const { data } = await supabase.auth.getClaims()
    
    12
    
        setUserId((data?.claims.sub as string) ?? null)
    
    13
    
        setUserEmail((data?.claims.email as string) ?? null)
    
    14
    
      }
    
    15
    
    16
    
      createEffect(() => {
    
    17
    
        syncClaims()
    
    18
    
    19
    
        supabase.auth.onAuthStateChange(() => {
    
    20
    
          syncClaims()
    
    21
    
        })
    
    22
    
      })
    
    23
    
    24
    
      return (
    
    25
    
        <div class="container" style={{ padding: '50px 0 100px 0' }}>
    
    26
    
          {!userId() ? <Auth /> : <Account userId={userId()!} userEmail={userEmail()} />}
    
    27
    
        </div>
    
    28
    
      )
    
    29
    
    }
    
    30
    
    31
    
    export default App
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/solid-user-management/src/App.tsx>)

Once that's done, run this in a terminal window:
[code] 
    1
    
    npm start
[/code]

And then open the browser to [localhost:3000](<http://localhost:3000>) and you should see the completed app.

![Supabase SolidJS](/docs/img/supabase-solidjs-demo.png)

At this stage you have a fully functional application!

## Add a server route (SolidStart)#

The example above is client-only. If you migrate the app to [SolidStart](<https://start.solidjs.com/>) for server-side rendering and API routes, you can add protected server endpoints with [`@supabase/server`](<https://supabase.github.io/server/>).

`createSupabaseContext` validates the incoming request's JWT locally (using your project's asymmetric signing keys, no round-trip to the Auth server), scopes a Supabase client to the authenticated user via RLS, and exposes the user's claims, all from a single call inside your SolidStart API route handler.
[code] 
    1
    
    npm install @supabase/server
[/code]

src/routes/api/profile.ts
[code]
    1
    
    import type { APIEvent } from '@solidjs/start/server'
    
    2
    
    import { createSupabaseContext } from '@supabase/server'
    
    3
    
    4
    
    export async function GET({ request }: APIEvent) {
    
    5
    
      const { data: ctx, error } = await createSupabaseContext(request, {
    
    6
    
        auth: 'user',
    
    7
    
      })
    
    8
    
    9
    
      if (error) {
    
    10
    
        return Response.json({ message: error.message, code: error.code }, { status: error.status })
    
    11
    
      }
    
    12
    
    13
    
      const { supabase, userClaims } = ctx
    
    14
    
      const { data, error: queryError } = await supabase
    
    15
    
        .from('profiles')
    
    16
    
        .select('username, website, avatar_url')
    
    17
    
        .eq('id', userClaims.id)
    
    18
    
        .single()
    
    19
    
    20
    
      if (queryError) {
    
    21
    
        return Response.json({ message: queryError.message }, { status: 500 })
    
    22
    
      }
    
    23
    
    24
    
      return Response.json(data)
    
    25
    
    }
[/code]

To make a route public, swap `auth: 'user'` for `auth: 'none'`. For app-wide authentication via SolidStart middleware, or for the full `@supabase/server` API, see the [getting started guide](<https://supabase.github.io/server/getting-started>).