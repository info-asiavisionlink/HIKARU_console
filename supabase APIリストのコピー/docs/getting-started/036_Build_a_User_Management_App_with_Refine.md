---
タイトル: Build a User Management App with Refine
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-refine
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, refine, tutorials, user, with, with-refine
---

# Build a User Management App with Refine

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-refine
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, refine, tutorials, user, with, with-refine

## 目次

- [About Refine#](#about-refine)
- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Refine app#](#initialize-a-refine-app)
  - [RefinesupabaseClient#](#refine-supabaseclient)
  - [App styling (optional)#](#app-styling-optional)
  - [The<Refine />component#](#the-refine--component)
  - [CustomizeauthProvider#](#customize-authprovider)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the Account component#](#update-the-account-component)
  - [Launch!#](#launch)

## 概要

Learn how to use Supabase in your Refine App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/refine-user-management>).

## About Refine#

[Refine](<https://github.com/refinedev/refine>) is a React-based framework used to rapidly build data-heavy applications like admin panels, dashboards, storefronts and any type of CRUD apps. It separates app concerns into individual layers, each backed by a React context and respective provider object. For example, the auth layer represents a context served by a specific set of [`authProvider`](<https://refine.dev/docs/tutorial/understanding-authprovider/index/>) methods that carry out authentication and authorization actions such as logging in, logging out, getting roles data, etc. Similarly, the data layer offers another level of abstraction equipped with [`dataProvider`](<https://refine.dev/docs/tutorial/understanding-dataprovider/index/>) methods to handle CRUD operations at appropriate backend API endpoints.

Refine provides hassle-free integration with a Supabase backend with its supplementary [`@refinedev/supabase`](<https://github.com/refinedev/refine/tree/main/packages/supabase>) package. It generates `authProvider` and `dataProvider` methods at project initialization, so you don't need to spend much effort defining them yourself, choose Supabase as the backend service while creating the app with `create refine-app`.

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=refine>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the Refine app from scratch.

### Initialize a Refine app#

Use [create refine-app](<https://refine.dev/docs/tutorial/getting-started/headless/create-project/#launch-the-refine-cli-setup>) command to initialize an app. Run the following in the terminal:
[code] 
    1
    
    npm create refine-app@latest -- --preset refine-supabase
[/code]

The command above uses the `refine-supabase` preset which chooses the Supabase supplementary package for the app. There's no UI framework, so the app has a headless UI with plain React and CSS styling.

The `refine-supabase` preset installs the `@refinedev/supabase` package which out-of-the-box includes the Supabase dependency: [supabase-js](<https://github.com/supabase/supabase-js>).

Install the `@refinedev/react-hook-form` and `react-hook-form` packages that to use [React Hook Form](<https://react-hook-form.com>) inside Refine apps. Run:
[code] 
    1
    
    npm install @refinedev/react-hook-form react-hook-form
[/code]

### Refine `supabaseClient`#

The `create refine-app` generated a Supabase client in the `src/utility/supabaseClient.ts` file. It has two constants: `SUPABASE_URL` and `SUPABASE_KEY`. Replace them as `supabaseUrl` and `supabasePublishableKey` respectively and assign them your Supabase server's values.

Update it with environment variables managed by Vite:

src/utility/supabaseClient.ts
[code]
    1
    
    import { createClient } from '@refinedev/supabase'
    
    2
    
    3
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    4
    
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    5
    
    6
    
    export const supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    
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

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/utility/supabaseClient.ts>)

Save the environment variables in a `.env.local` file. All you need are the API URL and the key that you copied earlier.
[code] 
    1
    
    VITE_SUPABASE_URL=YOUR_SUPABASE_URL
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
[/code]

The `supabaseClient` fetches calls to Supabase endpoints from the app. The client is instrumental in implementing authentication using Refine's auth provider methods and CRUD actions with appropriate data provider methods.

### App styling (optional)#

An optional step is to update the CSS file `src/App.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/refine-user-management/src/App.css>).

### The `<Refine />` component#

In order to add login and user profile pages in this App, tweak the `<Refine />` component inside `App.tsx`.

The `App.tsx` file initially looks like this:

src/App.tsx
[code]
    1
    
    import { Refine, WelcomePage } from '@refinedev/core'
    
    2
    
    import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar'
    
    3
    
    import routerProvider, {
    
    4
    
      DocumentTitleHandler,
    
    5
    
      UnsavedChangesNotifier,
    
    6
    
    } from '@refinedev/react-router'
    
    7
    
    import { dataProvider, liveProvider } from '@refinedev/supabase'
    
    8
    
    import { BrowserRouter, Route, Routes } from 'react-router'
    
    9
    
    import './App.css'
    
    10
    
    import authProvider from './authProvider'
    
    11
    
    import { supabaseClient } from './utility'
    
    12
    
    13
    
    function App() {
    
    14
    
      return (
    
    15
    
        <BrowserRouter>
    
    16
    
          <RefineKbarProvider>
    
    17
    
            <Refine
    
    18
    
              dataProvider={dataProvider(supabaseClient)}
    
    19
    
              liveProvider={liveProvider(supabaseClient)}
    
    20
    
              authProvider={authProvider}
    
    21
    
              routerProvider={routerProvider}
    
    22
    
              options={{
    
    23
    
                syncWithLocation: true,
    
    24
    
                warnWhenUnsavedChanges: true,
    
    25
    
              }}
    
    26
    
            >
    
    27
    
              <Routes>
    
    28
    
                <Route index element={<WelcomePage />} />
    
    29
    
              </Routes>
    
    30
    
              <RefineKbar />
    
    31
    
              <UnsavedChangesNotifier />
    
    32
    
              <DocumentTitleHandler />
    
    33
    
            </Refine>
    
    34
    
          </RefineKbarProvider>
    
    35
    
        </BrowserRouter>
    
    36
    
      )
    
    37
    
    }
    
    38
    
    39
    
    export default App
[/code]

Focus on the [`<Refine />`](<https://refine.dev/docs/api-reference/core/components/refine-config/>) component, which comes with props passed to it. Notice the `dataProvider` prop. It uses a `dataProvider()` function with `supabaseClient` passed as argument to generate the data provider object. The `authProvider` object also uses `supabaseClient` in implementing its methods. You can look it up in `src/authProvider.ts` file.

### Customize `authProvider`#

If you examine the `authProvider` object you can notice that it has a `login` method that implements an OAuth and Email / Password strategy for authentication. This tutorial instead removes them and use Magic Links to allow users sign in with their email without using passwords.

Use `supabaseClient` auth's `signInWithOtp` method inside `authProvider.login` method:

src/authProvider.ts
[code]
    1
    
    login: async ({ email }) => {
    
    2
    
      try {
    
    3
    
        const { error } = await supabaseClient.auth.signInWithOtp({ email });
    
    4
    
    5
    
        if (!error) {
    
    6
    
          alert("Check your email for the login link!");
    
    7
    
          return {
    
    8
    
            success: true,
    
    9
    
          };
    
    10
    
        };
    
    11
    
    12
    
        throw error;
    
    13
    
      } catch (e: any) {
    
    14
    
        alert(e.message);
    
    15
    
        return {
    
    16
    
          success: false,
    
    17
    
          e,
    
    18
    
        };
    
    19
    
      }
    
    20
    
    },
[/code]

Remove `register`, `updatePassword`, `forgotPassword` and `getPermissions` properties, which are optional type members and also not necessary for the app. The final `authProvider` object looks like this:

src/authProvider.ts
[code]
    1
    
    import { AuthProvider } from '@refinedev/core'
    
    2
    
    3
    
    import { supabaseClient } from './utility'
    
    4
    
    5
    
    const authProvider: AuthProvider = {
    
    6
    
      login: async ({ email }) => {
    
    7
    
        try {
    
    8
    
          const { error } = await supabaseClient.auth.signInWithOtp({ email })
    
    9
    
    10
    
          if (!error) {
    
    11
    
            alert('Check your email for the login link!')
    
    12
    
            return {
    
    13
    
              success: true,
    
    14
    
            }
    
    15
    
          }
    
    16
    
    17
    
          throw error
    
    18
    
        } catch (e: any) {
    
    19
    
          alert(e.message)
    
    20
    
          return {
    
    21
    
            success: false,
    
    22
    
            e,
    
    23
    
          }
    
    24
    
        }
    
    25
    
      },
    
    26
    
      logout: async () => {
    
    27
    
        const { error } = await supabaseClient.auth.signOut()
    
    28
    
    29
    
        if (error) {
    
    30
    
          return {
    
    31
    
            success: false,
    
    32
    
            error,
    
    33
    
          }
    
    34
    
        }
    
    35
    
    36
    
        return {
    
    37
    
          success: true,
    
    38
    
          redirectTo: '/',
    
    39
    
        }
    
    40
    
      },
    
    41
    
      onError: async (error) => {
    
    42
    
        console.error(error)
    
    43
    
        return { error }
    
    44
    
      },
    
    45
    
      check: async () => {
    
    46
    
        try {
    
    47
    
          const { data, error } = await supabaseClient.auth.getClaims()
    
    48
    
    49
    
          if (error || !data) {
    
    50
    
            return {
    
    51
    
              authenticated: false,
    
    52
    
              error: {
    
    53
    
                message: 'Check failed',
    
    54
    
                name: 'Session not found',
    
    55
    
              },
    
    56
    
              logout: true,
    
    57
    
              redirectTo: '/login',
    
    58
    
            }
    
    59
    
          }
    
    60
    
        } catch (error: any) {
    
    61
    
          return {
    
    62
    
            authenticated: false,
    
    63
    
            error: error || {
    
    64
    
              message: 'Check failed',
    
    65
    
              name: 'Not authenticated',
    
    66
    
            },
    
    67
    
            logout: true,
    
    68
    
            redirectTo: '/login',
    
    69
    
          }
    
    70
    
        }
    
    71
    
    72
    
        return {
    
    73
    
          authenticated: true,
    
    74
    
        }
    
    75
    
      },
    
    76
    
      getIdentity: async () => {
    
    77
    
        const { data } = await supabaseClient.auth.getUser()
    
    78
    
    79
    
        if (data?.user) {
    
    80
    
          return {
    
    81
    
            ...data.user,
    
    82
    
            name: data.user.email,
    
    83
    
          }
    
    84
    
        }
    
    85
    
    86
    
        return null
    
    87
    
      },
    
    88
    
    }
    
    89
    
    90
    
    export default authProvider
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/authProvider.ts>)

### Set up a login component#

As the app uses the headless Refine core package that comes with no supported UI framework set up a plain React component to manage logins and sign ups.

Create and edit `src/components/auth.tsx`:

src/components/auth.tsx
[code]
    1
    
    import { useState } from 'react'
    
    2
    
    3
    
    import { useLogin } from '@refinedev/core'
    
    4
    
    5
    
    export default function Auth() {
    
    6
    
      const [email, setEmail] = useState('')
    
    7
    
      const { isPending, mutate: login } = useLogin()
    
    8
    
    9
    
      const handleLogin = async (event: { preventDefault: () => void }) => {
    
    10
    
        event.preventDefault()
    
    11
    
        login({ email })
    
    12
    
      }
    
    13
    
    14
    
      return (
    
    15
    
        <div className="row flex flex-center container">
    
    16
    
          <div className="col-6 form-widget">
    
    17
    
            <h1 className="header">Supabase + Refine</h1>
    
    18
    
            <p className="description">Sign in via magic link with your email below</p>
    
    19
    
            <form className="form-widget" onSubmit={handleLogin}>
    
    20
    
              <div>
    
    21
    
                <input
    
    22
    
                  className="inputField"
    
    23
    
                  type="email"
    
    24
    
                  placeholder="Your email"
    
    25
    
                  value={email}
    
    26
    
                  required={true}
    
    27
    
                  onChange={(e) => setEmail(e.target.value)}
    
    28
    
                />
    
    29
    
              </div>
    
    30
    
              <div>
    
    31
    
                <button className={'button block'} disabled={isPending}>
    
    32
    
                  {isPending ? <span>Loading</span> : <span>Send magic link</span>}
    
    33
    
                </button>
    
    34
    
              </div>
    
    35
    
            </form>
    
    36
    
          </div>
    
    37
    
        </div>
    
    38
    
      )
    
    39
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/components/auth.tsx>)

The [`useLogin()`](<https://refine.dev/docs/api-reference/core/hooks/authentication/useLogin/>) Refine auth hook to grab the `mutate: login` method to use inside `handleLogin()` function and `isLoading` state for the form submission. The `useLogin()` hook conveniently offers access to `authProvider.login` method for authenticating the user with OTP.

### Account page#

After a user is signed in, allow them to edit their profile details and manage their account.

Create a new component for that in `src/components/account.tsx`.

src/components/account.tsx
[code]
    1
    
    import { BaseKey, useGetIdentity, useLogout } from '@refinedev/core'
    
    2
    
    3
    
    import { useForm } from '@refinedev/react-hook-form'
    
    4
    
    5
    
    // ...
    
    6
    
    7
    
    interface IUserIdentity {
    
    8
    
      id?: BaseKey
    
    9
    
      username: string
    
    10
    
      name: string
    
    11
    
    }
    
    12
    
    13
    
    export interface IProfile {
    
    14
    
      id?: string
    
    15
    
      username?: string
    
    16
    
      website?: string
    
    17
    
      avatar_url?: string
    
    18
    
    }
    
    19
    
    20
    
    export default function Account() {
    
    21
    
      const { data: userIdentity } = useGetIdentity<IUserIdentity>()
    
    22
    
    23
    
      const { mutate: logOut } = useLogout()
    
    24
    
    25
    
      const {
    
    26
    
        refineCore: { formLoading, query, onFinish },
    
    27
    
        register,
    
    28
    
        control,
    
    29
    
        handleSubmit,
    
    30
    
      } = useForm<IProfile>({
    
    31
    
        refineCoreProps: {
    
    32
    
          resource: 'profiles',
    
    33
    
          action: 'edit',
    
    34
    
          id: userIdentity?.id,
    
    35
    
          redirect: false,
    
    36
    
          onMutationError: (data) => alert(data?.message),
    
    37
    
        },
    
    38
    
      })
    
    39
    
    40
    
      return (
    
    41
    
        <div className="container" style={{ padding: '50px 0 100px 0' }}>
    
    42
    
          <form onSubmit={handleSubmit(onFinish)} className="form-widget">
    
    43
    
    44
    
              {/* ... */}
    
    45
    
    46
    
              <label htmlFor="email">Email</label>
    
    47
    
              <input id="email" name="email" type="text" value={userIdentity?.name} disabled />
    
    48
    
            </div>
    
    49
    
            <div>
    
    50
    
              <label htmlFor="username">Name</label>
    
    51
    
              <input id="username" type="text" {...register('username')} />
    
    52
    
            </div>
    
    53
    
            <div>
    
    54
    
              <label htmlFor="website">Website</label>
    
    55
    
              <input id="website" type="url" {...register('website')} />
    
    56
    
            </div>
    
    57
    
    58
    
            <div>
    
    59
    
              <button className="button block primary" type="submit" disabled={formLoading}>
    
    60
    
                {formLoading ? 'Loading ...' : 'Update'}
    
    61
    
              </button>
    
    62
    
            </div>
    
    63
    
    64
    
            <div>
    
    65
    
              <button className="button block" type="button" onClick={() => logOut()}>
    
    66
    
                Sign Out
    
    67
    
              </button>
    
    68
    
            </div>
    
    69
    
          </form>
    
    70
    
        </div>
    
    71
    
      )
    
    72
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/components/account.tsx>)

This uses three Refine hooks, namely the [`useGetIdentity()`](<https://refine.dev/docs/api-reference/core/hooks/authentication/useGetIdentity/>), [`useLogOut()`](<https://refine.dev/docs/api-reference/core/hooks/authentication/useLogout/>) and [`useForm()`](<https://refine.dev/docs/packages/documentation/react-hook-form/useForm/>) hooks.

`useGetIdentity()` is a auth hook that gets the identity of the authenticated user. It grabs the current user by invoking the `authProvider.getIdentity` method under the hood.

`useLogOut()` is also an auth hook. It calls the `authProvider.logout` method to end the session.

`useForm()`, in contrast, is a data hook that exposes a series of useful objects that serve the edit form. For example, grabbing the `onFinish` function to submit the form with the `handleSubmit` event handler. It also uses `formLoading` property to present state changes of the submitted form.

The `useForm()` hook is a higher-level hook built on top of Refine's `useForm()` core hook. It fully supports form state management, field validation and submission using React Hook Form. Behind the scenes, it invokes the `dataProvider.getOne` method to get the user profile data from the Supabase `/profiles` endpoint and also invokes `dataProvider.update` method when `onFinish()` is called.

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Add a new component:

Create and edit `src/components/avatar.tsx`:

src/components/avatar.tsx
[code]
    1
    
    import { useEffect, useState } from 'react'
    
    2
    
    3
    
    import { supabaseClient } from '../utility/supabaseClient'
    
    4
    
    5
    
    type TAvatarProps = {
    
    6
    
      url?: string
    
    7
    
      size: number
    
    8
    
      onUpload: (filePath: string) => void
    
    9
    
    }
    
    10
    
    11
    
    export default function Avatar({ url, size, onUpload }: TAvatarProps) {
    
    12
    
      const [avatarUrl, setAvatarUrl] = useState('')
    
    13
    
      const [uploading, setUploading] = useState(false)
    
    14
    
    15
    
      useEffect(() => {
    
    16
    
        if (url) downloadImage(url)
    
    17
    
      }, [url])
    
    18
    
    19
    
      async function downloadImage(path: string) {
    
    20
    
        try {
    
    21
    
          const { data, error } = await supabaseClient.storage.from('avatars').download(path)
    
    22
    
          if (error) {
    
    23
    
            throw error
    
    24
    
          }
    
    25
    
          const url = URL.createObjectURL(data)
    
    26
    
          setAvatarUrl(url)
    
    27
    
        } catch (error: any) {
    
    28
    
          console.log('Error downloading image: ', error?.message)
    
    29
    
        }
    
    30
    
      }
    
    31
    
    32
    
      async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    
    33
    
        try {
    
    34
    
          setUploading(true)
    
    35
    
    36
    
          if (!event.target.files || event.target.files.length === 0) {
    
    37
    
            throw new Error('You must select an image to upload.')
    
    38
    
          }
    
    39
    
    40
    
          const file = event.target.files[0]
    
    41
    
          const fileExt = file.name.split('.').pop()
    
    42
    
          const fileName = `${Math.random()}.${fileExt}`
    
    43
    
          const filePath = `${fileName}`
    
    44
    
    45
    
          const { error: uploadError } = await supabaseClient.storage
    
    46
    
            .from('avatars')
    
    47
    
            .upload(filePath, file)
    
    48
    
    49
    
          if (uploadError) {
    
    50
    
            throw uploadError
    
    51
    
          }
    
    52
    
          onUpload(filePath)
    
    53
    
        } catch (error: any) {
    
    54
    
          alert(error.message)
    
    55
    
        } finally {
    
    56
    
          setUploading(false)
    
    57
    
        }
    
    58
    
      }
    
    59
    
    60
    
      return (
    
    61
    
        <div>
    
    62
    
          {avatarUrl ? (
    
    63
    
            <img
    
    64
    
              src={avatarUrl}
    
    65
    
              alt="Avatar"
    
    66
    
              className="avatar image"
    
    67
    
              style={{ height: size, width: size }}
    
    68
    
            />
    
    69
    
          ) : (
    
    70
    
            <div className="avatar no-image" style={{ height: size, width: size }} />
    
    71
    
          )}
    
    72
    
          <div style={{ width: size }}>
    
    73
    
            <label className="button primary block" htmlFor="single">
    
    74
    
              {uploading ? 'Uploading ...' : 'Upload'}
    
    75
    
            </label>
    
    76
    
            <input
    
    77
    
              style={{
    
    78
    
                visibility: 'hidden',
    
    79
    
                position: 'absolute',
    
    80
    
              }}
    
    81
    
              type="file"
    
    82
    
              id="single"
    
    83
    
              name="avatar_url"
    
    84
    
              accept="image/*"
    
    85
    
              onChange={uploadAvatar}
    
    86
    
              disabled={uploading}
    
    87
    
            />
    
    88
    
          </div>
    
    89
    
        </div>
    
    90
    
      )
    
    91
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/components/avatar.tsx>)

### Update the Account component#

With the Avatar component created, update `src/components/account.tsx` to include it:

src/components/account.tsx
[code]
    1
    
    import { BaseKey, useGetIdentity, useLogout } from '@refinedev/core'
    
    2
    
    3
    
    import { useForm } from '@refinedev/react-hook-form'
    
    4
    
    import { Controller } from 'react-hook-form'
    
    5
    
    6
    
    import Avatar from './avatar'
    
    7
    
    8
    
    interface IUserIdentity {
    
    9
    
      id?: BaseKey
    
    10
    
      username: string
    
    11
    
      name: string
    
    12
    
    }
    
    13
    
    14
    
    export interface IProfile {
    
    15
    
      id?: string
    
    16
    
      username?: string
    
    17
    
      website?: string
    
    18
    
      avatar_url?: string
    
    19
    
    }
    
    20
    
    21
    
    export default function Account() {
    
    22
    
      const { data: userIdentity } = useGetIdentity<IUserIdentity>()
    
    23
    
    24
    
      const { mutate: logOut } = useLogout()
    
    25
    
    26
    
      const {
    
    27
    
        refineCore: { formLoading, query, onFinish },
    
    28
    
        register,
    
    29
    
        control,
    
    30
    
        handleSubmit,
    
    31
    
      } = useForm<IProfile>({
    
    32
    
        refineCoreProps: {
    
    33
    
          resource: 'profiles',
    
    34
    
          action: 'edit',
    
    35
    
          id: userIdentity?.id,
    
    36
    
          redirect: false,
    
    37
    
          onMutationError: (data) => alert(data?.message),
    
    38
    
        },
    
    39
    
      })
    
    40
    
    41
    
      return (
    
    42
    
        <div className="container" style={{ padding: '50px 0 100px 0' }}>
    
    43
    
          <form onSubmit={handleSubmit(onFinish)} className="form-widget">
    
    44
    
            <Controller
    
    45
    
              control={control}
    
    46
    
              name="avatar_url"
    
    47
    
              render={({ field }) => {
    
    48
    
                return (
    
    49
    
                  <Avatar
    
    50
    
                    url={field.value}
    
    51
    
                    size={150}
    
    52
    
                    onUpload={(filePath) => {
    
    53
    
                      onFinish({
    
    54
    
                        ...query?.data?.data,
    
    55
    
                        avatar_url: filePath,
    
    56
    
                        onMutationError: (data: { message: string }) => alert(data?.message),
    
    57
    
                      })
    
    58
    
                      field.onChange({
    
    59
    
                        target: {
    
    60
    
                          value: filePath,
    
    61
    
                        },
    
    62
    
                      })
    
    63
    
                    }}
    
    64
    
                  />
    
    65
    
                )
    
    66
    
              }}
    
    67
    
            />
    
    68
    
            <div>
    
    69
    
              <label htmlFor="email">Email</label>
    
    70
    
              <input id="email" name="email" type="text" value={userIdentity?.name} disabled />
    
    71
    
            </div>
    
    72
    
            <div>
    
    73
    
              <label htmlFor="username">Name</label>
    
    74
    
              <input id="username" type="text" {...register('username')} />
    
    75
    
            </div>
    
    76
    
            <div>
    
    77
    
              <label htmlFor="website">Website</label>
    
    78
    
              <input id="website" type="url" {...register('website')} />
    
    79
    
            </div>
    
    80
    
    81
    
            <div>
    
    82
    
              <button className="button block primary" type="submit" disabled={formLoading}>
    
    83
    
                {formLoading ? 'Loading ...' : 'Update'}
    
    84
    
              </button>
    
    85
    
            </div>
    
    86
    
    87
    
            <div>
    
    88
    
              <button className="button block" type="button" onClick={() => logOut()}>
    
    89
    
                Sign Out
    
    90
    
              </button>
    
    91
    
            </div>
    
    92
    
          </form>
    
    93
    
        </div>
    
    94
    
      )
    
    95
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/components/account.tsx>)

### Launch!#

With all the components in place, define the routes for the pages in which they should be rendered.

Add the routes for `/login` with the `<Auth />` component and the routes for `index` path with the `<Account />` component. So, the final `App.tsx`:

src/App.tsx
[code]
    1
    
    import { Authenticated, Refine } from '@refinedev/core'
    
    2
    
    import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar'
    
    3
    
    import routerProvider, {
    
    4
    
      CatchAllNavigate,
    
    5
    
      DocumentTitleHandler,
    
    6
    
      UnsavedChangesNotifier,
    
    7
    
    } from '@refinedev/react-router'
    
    8
    
    import { BrowserRouter, Outlet, Route, Routes } from 'react-router'
    
    9
    
    10
    
    import { dataProvider, liveProvider } from '@refinedev/supabase'
    
    11
    
    import authProvider from './authProvider'
    
    12
    
    import { supabaseClient } from './utility'
    
    13
    
    14
    
    import Account from './components/account'
    
    15
    
    import Auth from './components/auth'
    
    16
    
    17
    
    import './App.css'
    
    18
    
    19
    
    function App() {
    
    20
    
      return (
    
    21
    
        <BrowserRouter>
    
    22
    
          <RefineKbarProvider>
    
    23
    
            <Refine
    
    24
    
              dataProvider={dataProvider(supabaseClient)}
    
    25
    
              liveProvider={liveProvider(supabaseClient)}
    
    26
    
              authProvider={authProvider}
    
    27
    
              routerProvider={routerProvider}
    
    28
    
              options={{
    
    29
    
                syncWithLocation: true,
    
    30
    
                warnWhenUnsavedChanges: true,
    
    31
    
              }}
    
    32
    
            >
    
    33
    
              <Routes>
    
    34
    
                <Route
    
    35
    
                  element={
    
    36
    
                    <Authenticated
    
    37
    
                      key="authenticated-routes"
    
    38
    
                      fallback={<CatchAllNavigate to="/login" />}
    
    39
    
                    >
    
    40
    
                      <Outlet />
    
    41
    
                    </Authenticated>
    
    42
    
                  }
    
    43
    
                >
    
    44
    
                  <Route index element={<Account />} />
    
    45
    
                </Route>
    
    46
    
                <Route element={<Authenticated key="auth-pages" fallback={<Outlet />} />}>
    
    47
    
                  <Route path="/login" element={<Auth />} />
    
    48
    
                </Route>
    
    49
    
              </Routes>
    
    50
    
              <RefineKbar />
    
    51
    
              <UnsavedChangesNotifier />
    
    52
    
              <DocumentTitleHandler />
    
    53
    
            </Refine>
    
    54
    
          </RefineKbarProvider>
    
    55
    
        </BrowserRouter>
    
    56
    
      )
    
    57
    
    }
    
    58
    
    59
    
    export default App
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/refine-user-management/src/App.tsx>)

Test the App by running the server again:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:5173](<http://localhost:5173>) and you should see the completed app.

![Supabase Refine](/docs/img/supabase-refine-demo.png)

At this stage, you have a fully functional application!