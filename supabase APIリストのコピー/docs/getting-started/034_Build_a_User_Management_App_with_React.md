---
タイトル: Build a User Management App with React
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-react
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, react, tutorials, user, with, with-react
---

# Build a User Management App with React

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-react
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, react, tutorials, user, with, with-react

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a React app#](#initialize-a-react-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the Account component#](#update-the-account-component)
  - [Launch!#](#launch)
  - [Summary of the methods#](#summary-of-the-methods)

## 概要

Learn how to use Supabase in your React App.

---

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/react-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=react>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the React app from scratch.

### Initialize a React app#

Use [Vite](<https://vitejs.dev/guide/>) to initialize an app called `supabase-react`:
[code] 
    1
    
    npm create vite@latest supabase-react -- --template react
    
    2
    
    cd supabase-react
[/code]

Install [supabase-js](<https://github.com/supabase/supabase-js>):
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

Save the environment variables in a `.env.local` file, using the Project URL and the key that you copied earlier.

.env
[code]
    1
    
    VITE_SUPABASE_URL=
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/.env.example>)

With the API credentials in place, create a helper file to initialize the Supabase client. The application exposes these variables in the browser, and that's fine as Supabase enables [Row Level Security](</docs/guides/database/postgres/row-level-security>) by default on all tables.

Create and edit `src/supabaseClient.js`:

src/supabaseClient.js
[code]
    1
    
    /**
    
    2
    
     * lib/supabaseClient.js
    
    3
    
     * Helper to initialize the Supabase client.
    
    4
    
     */
    
    5
    
    6
    
    import { createClient } from '@supabase/supabase-js'
    
    7
    
    8
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    9
    
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    10
    
    11
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey)
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/src/supabaseClient.js>)

### App styling (optional)#

An optional step is to update the CSS file `src/index.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/react-user-management/src/index.css>).

### Set up a login component#

You need a React component to manage logins and sign-ups. It uses [Magic Links](</docs/guides/auth/auth-email-passwordless#with-magic-link>), so users can sign in with their email without using passwords.

Did you know?

You can customize other emails sent out to new users, including the email's looks, content, and query parameters from [the **Authentication > Email**](</dashboard/project/_/auth/templates>) section of the Dashboard.

Create and edit `src/Auth.jsx`:

src/Auth.jsx
[code]
    1
    
    import { useState } from 'react'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    4
    
    export default function Auth() {
    
    5
    
      const [loading, setLoading] = useState(false)
    
    6
    
      const [email, setEmail] = useState('')
    
    7
    
    8
    
      const handleLogin = async (event) => {
    
    9
    
        event.preventDefault()
    
    10
    
    11
    
        setLoading(true)
    
    12
    
        const { error } = await supabase.auth.signInWithOtp({ email })
    
    13
    
    14
    
        if (error) {
    
    15
    
          alert(error.error_description || error.message)
    
    16
    
        } else {
    
    17
    
          alert('Check your email for the login link!')
    
    18
    
        }
    
    19
    
        setLoading(false)
    
    20
    
      }
    
    21
    
    22
    
      return (
    
    23
    
        <div className="row flex flex-center">
    
    24
    
          <div className="col-6 form-widget">
    
    25
    
            <h1 className="header">Supabase + React</h1>
    
    26
    
            <p className="description">Sign in via magic link with your email below</p>
    
    27
    
            <form className="form-widget" onSubmit={handleLogin}>
    
    28
    
              <div>
    
    29
    
                <input
    
    30
    
                  className="inputField"
    
    31
    
                  type="email"
    
    32
    
                  placeholder="Your email"
    
    33
    
                  value={email}
    
    34
    
                  required={true}
    
    35
    
                  onChange={(e) => setEmail(e.target.value)}
    
    36
    
                />
    
    37
    
              </div>
    
    38
    
              <div>
    
    39
    
                <button className={'button block'} disabled={loading}>
    
    40
    
                  {loading ? <span>Loading</span> : <span>Send magic link</span>}
    
    41
    
                </button>
    
    42
    
              </div>
    
    43
    
            </form>
    
    44
    
          </div>
    
    45
    
        </div>
    
    46
    
      )
    
    47
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/src/Auth.jsx>)

### Account page#

After a user signs in, they need a way to edit their profile details and manage their accounts.

Create a new component called `src/Account.jsx` and add the following code:

src/Account.jsx
[code]
    1
    
    import { useState, useEffect } from 'react'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    4
    
    // ...
    
    5
    
    6
    
    7
    
    export default function Account({ user }) {
    
    8
    
      const [loading, setLoading] = useState(true)
    
    9
    
      const [username, setUsername] = useState(null)
    
    10
    
      const [website, setWebsite] = useState(null)
    
    11
    
      const [avatar_url, setAvatarUrl] = useState(null)
    
    12
    
    13
    
      useEffect(() => {
    
    14
    
        let ignore = false
    
    15
    
        async function getProfile() {
    
    16
    
          setLoading(true)
    
    17
    
    18
    
          const { data, error } = await supabase
    
    19
    
            .from('profiles')
    
    20
    
            .select(`username, website, avatar_url`)
    
    21
    
            .eq('id', user.id)
    
    22
    
            .single()
    
    23
    
    24
    
          if (!ignore) {
    
    25
    
            if (error) {
    
    26
    
              console.warn(error)
    
    27
    
            } else if (data) {
    
    28
    
              setUsername(data.username)
    
    29
    
              setWebsite(data.website)
    
    30
    
              setAvatarUrl(data.avatar_url)
    
    31
    
            }
    
    32
    
          }
    
    33
    
    34
    
          setLoading(false)
    
    35
    
        }
    
    36
    
    37
    
        getProfile()
    
    38
    
    39
    
        return () => {
    
    40
    
          ignore = true
    
    41
    
        }
    
    42
    
      }, [user])
    
    43
    
    44
    
      async function updateProfile(event, avatarUrl) {
    
    45
    
        event.preventDefault()
    
    46
    
    47
    
        setLoading(true)
    
    48
    
    49
    
        const updates = {
    
    50
    
          id: user.id,
    
    51
    
          username,
    
    52
    
          website,
    
    53
    
          avatar_url: avatarUrl,
    
    54
    
          updated_at: new Date(),
    
    55
    
        }
    
    56
    
    57
    
        const { error } = await supabase.from('profiles').upsert(updates)
    
    58
    
    59
    
        if (error) {
    
    60
    
          alert(error.message)
    
    61
    
        } else {
    
    62
    
          setAvatarUrl(avatarUrl)
    
    63
    
        }
    
    64
    
        setLoading(false)
    
    65
    
      }
    
    66
    
    67
    
      return (
    
    68
    
        <form onSubmit={updateProfile} className="form-widget">
    
    69
    
    70
    
          {/* ... */}
    
    71
    
    72
    
          <div>
    
    73
    
            <label htmlFor="email">Email</label>
    
    74
    
            <input id="email" type="text" value={user.email} disabled />
    
    75
    
          </div>
    
    76
    
          <div>
    
    77
    
            <label htmlFor="username">Name</label>
    
    78
    
            <input
    
    79
    
              id="username"
    
    80
    
              type="text"
    
    81
    
              required
    
    82
    
              value={username || ''}
    
    83
    
              onChange={(e) => setUsername(e.target.value)}
    
    84
    
            />
    
    85
    
          </div>
    
    86
    
          <div>
    
    87
    
            <label htmlFor="website">Website</label>
    
    88
    
            <input
    
    89
    
              id="website"
    
    90
    
              type="url"
    
    91
    
              value={website || ''}
    
    92
    
              onChange={(e) => setWebsite(e.target.value)}
    
    93
    
            />
    
    94
    
          </div>
    
    95
    
    96
    
          <div>
    
    97
    
            <button className="button block primary" type="submit" disabled={loading}>
    
    98
    
              {loading ? 'Loading ...' : 'Update'}
    
    99
    
            </button>
    
    100
    
          </div>
    
    101
    
    102
    
          <div>
    
    103
    
            <button className="button block" type="button" onClick={() => supabase.auth.signOut()}>
    
    104
    
              Sign Out
    
    105
    
            </button>
    
    106
    
          </div>
    
    107
    
        </form>
    
    108
    
      )
    
    109
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/src/Account.jsx>)

## Profile photos#

Add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Create `src/Avatar.jsx` and add the following code:

src/Avatar.jsx
[code]
    1
    
    import { useEffect, useState } from 'react'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    4
    
    export default function Avatar({ url, size, onUpload }) {
    
    5
    
      const [avatarUrl, setAvatarUrl] = useState(null)
    
    6
    
      const [uploading, setUploading] = useState(false)
    
    7
    
    8
    
      useEffect(() => {
    
    9
    
        if (url) downloadImage(url)
    
    10
    
      }, [url])
    
    11
    
    12
    
      async function downloadImage(path) {
    
    13
    
        try {
    
    14
    
          const { data, error } = await supabase.storage.from('avatars').download(path)
    
    15
    
          if (error) {
    
    16
    
            throw error
    
    17
    
          }
    
    18
    
          const url = URL.createObjectURL(data)
    
    19
    
          setAvatarUrl(url)
    
    20
    
        } catch (error) {
    
    21
    
          console.log('Error downloading image: ', error.message)
    
    22
    
        }
    
    23
    
      }
    
    24
    
    25
    
      async function uploadAvatar(event) {
    
    26
    
        try {
    
    27
    
          setUploading(true)
    
    28
    
    29
    
          if (!event.target.files || event.target.files.length === 0) {
    
    30
    
            throw new Error('You must select an image to upload.')
    
    31
    
          }
    
    32
    
    33
    
          const file = event.target.files[0]
    
    34
    
          const fileExt = file.name.split('.').pop()
    
    35
    
          const fileName = `${Math.random()}.${fileExt}`
    
    36
    
          const filePath = `${fileName}`
    
    37
    
    38
    
          let { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    
    39
    
    40
    
          if (uploadError) {
    
    41
    
            throw uploadError
    
    42
    
          }
    
    43
    
    44
    
          onUpload(event, filePath)
    
    45
    
        } catch (error) {
    
    46
    
          alert(error.message)
    
    47
    
        } finally {
    
    48
    
          setUploading(false)
    
    49
    
        }
    
    50
    
      }
    
    51
    
    52
    
      return (
    
    53
    
        <div>
    
    54
    
          {avatarUrl ? (
    
    55
    
            <img
    
    56
    
              src={avatarUrl}
    
    57
    
              alt="Avatar"
    
    58
    
              className="avatar image"
    
    59
    
              style={{ height: size, width: size }}
    
    60
    
            />
    
    61
    
          ) : (
    
    62
    
            <div className="avatar no-image" style={{ height: size, width: size }} />
    
    63
    
          )}
    
    64
    
          <div style={{ width: size }}>
    
    65
    
            <label className="button primary block" htmlFor="single">
    
    66
    
              {uploading ? 'Uploading ...' : 'Upload'}
    
    67
    
            </label>
    
    68
    
            <input
    
    69
    
              style={{
    
    70
    
                visibility: 'hidden',
    
    71
    
                position: 'absolute',
    
    72
    
              }}
    
    73
    
              type="file"
    
    74
    
              id="single"
    
    75
    
              accept="image/*"
    
    76
    
              onChange={uploadAvatar}
    
    77
    
              disabled={uploading}
    
    78
    
            />
    
    79
    
          </div>
    
    80
    
        </div>
    
    81
    
      )
    
    82
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/src/Avatar.jsx>)

### Update the Account component#

With the Avatar component created, update `src/Account.jsx` to include it:

src/Account.jsx
[code]
    1
    
    import { useState, useEffect } from 'react'
    
    2
    
    import { supabase } from './supabaseClient'
    
    3
    
    import Avatar from './Avatar'
    
    4
    
    5
    
    export default function Account({ user }) {
    
    6
    
      const [loading, setLoading] = useState(true)
    
    7
    
      const [username, setUsername] = useState(null)
    
    8
    
      const [website, setWebsite] = useState(null)
    
    9
    
      const [avatar_url, setAvatarUrl] = useState(null)
    
    10
    
    11
    
      useEffect(() => {
    
    12
    
        let ignore = false
    
    13
    
        async function getProfile() {
    
    14
    
          setLoading(true)
    
    15
    
    16
    
          const { data, error } = await supabase
    
    17
    
            .from('profiles')
    
    18
    
            .select(`username, website, avatar_url`)
    
    19
    
            .eq('id', user.id)
    
    20
    
            .single()
    
    21
    
    22
    
          if (!ignore) {
    
    23
    
            if (error) {
    
    24
    
              console.warn(error)
    
    25
    
            } else if (data) {
    
    26
    
              setUsername(data.username)
    
    27
    
              setWebsite(data.website)
    
    28
    
              setAvatarUrl(data.avatar_url)
    
    29
    
            }
    
    30
    
          }
    
    31
    
    32
    
          setLoading(false)
    
    33
    
        }
    
    34
    
    35
    
        getProfile()
    
    36
    
    37
    
        return () => {
    
    38
    
          ignore = true
    
    39
    
        }
    
    40
    
      }, [user])
    
    41
    
    42
    
      async function updateProfile(event, avatarUrl) {
    
    43
    
        event.preventDefault()
    
    44
    
    45
    
        setLoading(true)
    
    46
    
    47
    
        const updates = {
    
    48
    
          id: user.id,
    
    49
    
          username,
    
    50
    
          website,
    
    51
    
          avatar_url: avatarUrl,
    
    52
    
          updated_at: new Date(),
    
    53
    
        }
    
    54
    
    55
    
        const { error } = await supabase.from('profiles').upsert(updates)
    
    56
    
    57
    
        if (error) {
    
    58
    
          alert(error.message)
    
    59
    
        } else {
    
    60
    
          setAvatarUrl(avatarUrl)
    
    61
    
        }
    
    62
    
        setLoading(false)
    
    63
    
      }
    
    64
    
    65
    
      return (
    
    66
    
        <form onSubmit={updateProfile} className="form-widget">
    
    67
    
          <Avatar
    
    68
    
            url={avatar_url}
    
    69
    
            size={150}
    
    70
    
            onUpload={(event, url) => {
    
    71
    
              updateProfile(event, url)
    
    72
    
            }}
    
    73
    
          />
    
    74
    
          <div>
    
    75
    
            <label htmlFor="email">Email</label>
    
    76
    
            <input id="email" type="text" value={user.email} disabled />
    
    77
    
          </div>
    
    78
    
          <div>
    
    79
    
            <label htmlFor="username">Name</label>
    
    80
    
            <input
    
    81
    
              id="username"
    
    82
    
              type="text"
    
    83
    
              required
    
    84
    
              value={username || ''}
    
    85
    
              onChange={(e) => setUsername(e.target.value)}
    
    86
    
            />
    
    87
    
          </div>
    
    88
    
          <div>
    
    89
    
            <label htmlFor="website">Website</label>
    
    90
    
            <input
    
    91
    
              id="website"
    
    92
    
              type="url"
    
    93
    
              value={website || ''}
    
    94
    
              onChange={(e) => setWebsite(e.target.value)}
    
    95
    
            />
    
    96
    
          </div>
    
    97
    
    98
    
          <div>
    
    99
    
            <button className="button block primary" type="submit" disabled={loading}>
    
    100
    
              {loading ? 'Loading ...' : 'Update'}
    
    101
    
            </button>
    
    102
    
          </div>
    
    103
    
    104
    
          <div>
    
    105
    
            <button className="button block" type="button" onClick={() => supabase.auth.signOut()}>
    
    106
    
              Sign Out
    
    107
    
            </button>
    
    108
    
          </div>
    
    109
    
        </form>
    
    110
    
      )
    
    111
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/src/Account.jsx>)

### Launch!#

With all the components in place, change the contents of `src/App.jsx` to include the new components and Auth logic.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

src/App.jsx
[code]
    1
    
    function App() {
    
    2
    
      const [claims, setClaims] = useState(null)
    
    3
    
    4
    
      useEffect(() => {
    
    5
    
        const loadClaims = async () => {
    
    6
    
          const {
    
    7
    
            data: { claims },
    
    8
    
          } = await supabase.auth.getClaims()
    
    9
    
          setClaims(claims)
    
    10
    
        }
    
    11
    
    12
    
        loadClaims()
    
    13
    
    14
    
        const {
    
    15
    
          data: { subscription },
    
    16
    
        } = supabase.auth.onAuthStateChange(() => {
    
    17
    
          loadClaims()
    
    18
    
        })
    
    19
    
    20
    
        return () => subscription.unsubscribe()
    
    21
    
      }, [])
    
    22
    
    23
    
      return (
    
    24
    
        <div className="container" style={{ padding: '50px 0 100px 0' }}>
    
    25
    
          {!claims ? <Auth /> : <Account key={claims.sub} claims={claims} />}
    
    26
    
        </div>
    
    27
    
      )
    
    28
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/react-user-management/src/App.jsx>)

Once that's done, run this in a terminal window:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:5173](<http://localhost:5173>) and you should see the completed app.

![Screenshot of the Supabase React application running in a browser](/docs/img/supabase-react-demo.png)

At this stage you have a fully functional application!