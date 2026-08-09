---
タイトル: Build a User Management App with Next.js
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, next, nextjs, tutorials, user, with, with-nextjs
---

# Build a User Management App with Next.js

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, next, nextjs, tutorials, user, with, with-nextjs

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Next.js app#](#initialize-a-nextjs-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Supabase Server-Side Auth package#](#supabase-server-side-auth-package)
  - [Supabase utilities#](#supabase-utilities)
  - [Next.js proxy#](#nextjs-proxy)
  - [Summary of the methods#](#summary-of-the-methods)
  - [Set up a login page#](#set-up-a-login-page)
  - [Account page#](#account-page)
  - [Sign out#](#sign-out)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the account form#](#update-the-account-form)
  - [Launch#](#launch)
- [See also#](#see-also)

## 概要

Learn how to use Supabase in your Next.js App.

---

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/nextjs-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nextjs>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the Next.js app from scratch.

### Initialize a Next.js app#

Use [`create-next-app`](<https://nextjs.org/docs/getting-started>) to initialize an app called `supabase-nextjs`:
[code] 
    1
    
    npx create-next-app@latest --ts --use-npm supabase-nextjs
    
    2
    
    cd supabase-nextjs
[/code]

Install [supabase-js](<https://github.com/supabase/supabase-js>):
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

Save the environment variables in a `.env.local` file at the root of the project, and paste the API URL and the key that you copied earlier.

The application exposes these variables in the browser, and that's fine as Supabase enables [Row Level Security](</docs/guides/database/postgres/row-level-security>) by default on all tables.
[code] 
    1
    
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    
    2
    
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
[/code]

### App styling (optional)#

An optional step is to update the CSS file `app/globals.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/nextjs-user-management/app/globals.css>).

### Supabase Server-Side Auth package#

Next.js is a versatile framework offering pre-rendering at build time (SSG), server-side rendering at request time (SSR), API routes, and proxy edge-functions.

To better integrate with the framework, we've created the `@supabase/ssr` package for Server-Side Auth. It has all the functionalities to configure your Supabase project to use cookies for storing user sessions. Read the [Next.js Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client?queryGroups=package-manager&package-manager=npm&queryGroups=framework&framework=nextjs>) for more information.

Install the package for Next.js.
[code] 
    1
    
    npm install @supabase/ssr
[/code]

### Supabase utilities#

There are two different types of clients in Supabase:

  1. **Client Component client** \- To access Supabase from Client Components, which run in the browser.
  2. **Server Component client** \- To access Supabase from Server Components, Server Actions, and Route Handlers, which run only on the server.


We recommend creating the following utilities files for creating clients, and organize them within `lib/supabase` at the root of the project.

Create a `client.ts` and a `server.ts` with the following code for client-side Supabase and server-side Supabase, respectively.

lib/supabase/client.tslib/supabase/server.ts
[code]
    1
    
    import { createBrowserClient } from '@supabase/ssr'
    
    2
    
    3
    
    export function createClient() {
    
    4
    
      // Create a supabase client on the browser with project's credentials
    
    5
    
      return createBrowserClient(
    
    6
    
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    
    7
    
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    
    8
    
      )
    
    9
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/lib/supabase/client.ts>)

### Next.js proxy#

Since Server Components can't write cookies, you need [Proxy](<https://nextjs.org/docs/app/getting-started/proxy>) to refresh expired Auth tokens and store them.

You accomplish this by:

  * Refreshing the Auth token with the call to `supabase.auth.getClaims`.
  * Passing the refreshed Auth token to Server Components through `request.cookies.set`, so they don't attempt to refresh the same token themselves.
  * Passing the refreshed Auth token to the browser, so it replaces the old token. This is done with `response.cookies.set`.


You could also add a matcher, so that the Proxy only runs on routes that access Supabase. For more information, read [the Next.js matcher documentation](<https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher>).

Be careful when protecting pages. The server gets the user session from the cookies, which anyone can spoof.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

Create a `proxy.ts` file at the project root and another one within the `lib/supabase` folder. The `lib/supabase` file contains the logic for updating the session. The `proxy.ts` file uses this, which is a Next.js convention.

proxy.tslib/supabase/proxy.ts
[code]
    1
    
    import { type NextRequest } from 'next/server'
    
    2
    
    import { updateSession } from '@/lib/supabase/proxy'
    
    3
    
    4
    
    export async function proxy(request: NextRequest) {
    
    5
    
      // update user's auth session
    
    6
    
      return await updateSession(request)
    
    7
    
    }
    
    8
    
    9
    
    export const config = {
    
    10
    
      matcher: [
    
    11
    
        /*
    
    12
    
         * Match all request paths except for the ones starting with:
    
    13
    
         * - _next/static (static files)
    
    14
    
         * - _next/image (image optimization files)
    
    15
    
         * - favicon.ico (favicon file)
    
    16
    
         * Feel free to modify this pattern to include more paths.
    
    17
    
         */
    
    18
    
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    
    19
    
      ],
    
    20
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/proxy.ts>)

### Set up a login page#

#### Login and signup form#

To add login/signup page for your application, create a new folder named `login`, containing a `page.tsx` file with the following code for a login/signup form:

app/login/page.tsx
[code]
    1
    
    import { login, signup } from './actions'
    
    2
    
    3
    
    export default function LoginPage() {
    
    4
    
      return (
    
    5
    
        <form>
    
    6
    
          <label htmlFor="email">Email:</label>
    
    7
    
          <input id="email" name="email" type="email" required />
    
    8
    
          <label htmlFor="password">Password:</label>
    
    9
    
          <input id="password" name="password" type="password" required />
    
    10
    
          <button formAction={login}>Log in</button>
    
    11
    
          <button formAction={signup}>Sign up</button>
    
    12
    
        </form>
    
    13
    
      )
    
    14
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/login/page.tsx>)

Create the login/signup actions to hook up the form to the function which does the following:

  * Retrieve the user's information.
  * Send that information to Supabase as a signup request, which in turns sends a confirmation email. It uses [Magic Links](</docs/guides/auth/auth-email-passwordless#with-magic-link>), so users can sign in with their email without using passwords.
  * Handle any error that arises.


Create the `action.ts` file in the `app/login` folder, which contains the login and signup functions and the `error/page.tsx` file, which displays an error message if the login or signup fails.

app/login/actions.tsapp/error/page.tsx
[code]
    1
    
    'use server'
    
    2
    
    3
    
    import { revalidatePath } from 'next/cache'
    
    4
    
    import { redirect } from 'next/navigation'
    
    5
    
    6
    
    import { createClient } from '@/lib/supabase/server'
    
    7
    
    8
    
    export async function login(formData: FormData) {
    
    9
    
      const supabase = await createClient()
    
    10
    
    11
    
      // type-casting here for convenience
    
    12
    
      // in practice, you should validate your inputs
    
    13
    
      const data = {
    
    14
    
        email: formData.get('email') as string,
    
    15
    
        password: formData.get('password') as string,
    
    16
    
      }
    
    17
    
    18
    
      const { error } = await supabase.auth.signInWithPassword(data)
    
    19
    
    20
    
      if (error) {
    
    21
    
        redirect('/error')
    
    22
    
      }
    
    23
    
    24
    
      revalidatePath('/', 'layout')
    
    25
    
      redirect('/account')
    
    26
    
    }
    
    27
    
    28
    
    export async function signup(formData: FormData) {
    
    29
    
      const supabase = await createClient()
    
    30
    
    31
    
      // type-casting here for convenience
    
    32
    
      // in practice, you should validate your inputs
    
    33
    
      const data = {
    
    34
    
        email: formData.get('email') as string,
    
    35
    
        password: formData.get('password') as string,
    
    36
    
      }
    
    37
    
    38
    
      const { error } = await supabase.auth.signUp(data)
    
    39
    
    40
    
      if (error) {
    
    41
    
        redirect('/error')
    
    42
    
      }
    
    43
    
    44
    
      revalidatePath('/', 'layout')
    
    45
    
      redirect('/account')
    
    46
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/login/actions.ts>)

The `cookies` method is called before any calls to Supabase, which takes fetch calls out of Next.js's caching. This is important for authenticated data fetches, to ensure that users get access only to their own data.

Read the Next.js docs to learn more about [opting out of data caching](<https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating#opting-out-of-data-caching>).

#### Email template#

Before proceeding, change the email template to support a server-side authentication flow that sends a token hash:

  * Go to the [Auth templates](</dashboard/project/_/auth/templates>) page in your dashboard.
  * Select the **Confirm signup** template.
  * Change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.


Did you know?

You can customize other emails sent out to new users, including the email's looks, content, and query parameters from [the **Authentication > Email**](</dashboard/project/_/auth/templates>) section of the Dashboard.

#### Confirmation endpoint#

As you are working in a server-side rendering (SSR) environment, you need to create a server endpoint responsible for exchanging the `token_hash` for a session.

The code performs the following steps:

  * Retrieves the code sent back from the Supabase Auth server using the `token_hash` query parameter.
  * Exchanges this code for a session, which you store in your chosen storage mechanism (in this case, cookies).
  * Finally, redirects the user to the `account` page.


app/auth/confirm/route.ts
[code]
    1
    
    import { type EmailOtpType } from '@supabase/supabase-js'
    
    2
    
    import { type NextRequest, NextResponse } from 'next/server'
    
    3
    
    import { createClient } from '@/lib/supabase/server'
    
    4
    
    5
    
    // Creating a handler to a GET request to route /auth/confirm
    
    6
    
    export async function GET(request: NextRequest) {
    
    7
    
      const { searchParams } = new URL(request.url)
    
    8
    
      const token_hash = searchParams.get('token_hash')
    
    9
    
      const type = searchParams.get('type') as EmailOtpType | null
    
    10
    
      const next = '/account'
    
    11
    
    12
    
      // Create redirect link without the secret token
    
    13
    
      const redirectTo = request.nextUrl.clone()
    
    14
    
      redirectTo.pathname = next
    
    15
    
      redirectTo.searchParams.delete('token_hash')
    
    16
    
      redirectTo.searchParams.delete('type')
    
    17
    
    18
    
      if (token_hash && type) {
    
    19
    
        const supabase = await createClient()
    
    20
    
    21
    
        const { error } = await supabase.auth.verifyOtp({
    
    22
    
          type,
    
    23
    
          token_hash,
    
    24
    
        })
    
    25
    
        if (!error) {
    
    26
    
          redirectTo.searchParams.delete('next')
    
    27
    
          return NextResponse.redirect(redirectTo)
    
    28
    
        }
    
    29
    
      }
    
    30
    
    31
    
      // return the user to an error page with some instructions
    
    32
    
      redirectTo.pathname = '/error'
    
    33
    
      return NextResponse.redirect(redirectTo)
    
    34
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/auth/confirm/route.ts>)

### Account page#

After a user signs in, they need a way to edit their profile details and manage their accounts.

Create a new component for that called `AccountForm` within the `app/account` folder.

app/account/account-form.tsx
[code]
    1
    
    'use client'
    
    2
    
    import { useCallback, useEffect, useState } from 'react'
    
    3
    
    import { createClient } from '@/lib/supabase/client'
    
    4
    
    import Avatar from './avatar'
    
    5
    
    6
    
    // ...
    
    7
    
    8
    
    9
    
    export default function AccountForm({ claims }: { claims: Claims | null }) {
    
    10
    
      const supabase = createClient()
    
    11
    
      const [loading, setLoading] = useState(true)
    
    12
    
      const [fullname, setFullname] = useState<string | null>(null)
    
    13
    
      const [username, setUsername] = useState<string | null>(null)
    
    14
    
      const [website, setWebsite] = useState<string | null>(null)
    
    15
    
      const [avatar_url, setAvatarUrl] = useState<string | null>(null)
    
    16
    
    17
    
      const getProfile = useCallback(async () => {
    
    18
    
        try {
    
    19
    
          if (!claims?.sub) {
    
    20
    
            setLoading(false)
    
    21
    
            return
    
    22
    
          }
    
    23
    
    24
    
          setLoading(true)
    
    25
    
    26
    
          const { data, error, status } = await supabase
    
    27
    
            .from('profiles')
    
    28
    
            .select(`full_name, username, website, avatar_url`)
    
    29
    
            .eq('id', claims.sub)
    
    30
    
            .single()
    
    31
    
    32
    
          if (error && status !== 406) {
    
    33
    
            console.log(error)
    
    34
    
            throw error
    
    35
    
          }
    
    36
    
    37
    
          if (data) {
    
    38
    
            setFullname(data.full_name)
    
    39
    
            setUsername(data.username)
    
    40
    
            setWebsite(data.website)
    
    41
    
            setAvatarUrl(data.avatar_url)
    
    42
    
          }
    
    43
    
        } catch (error) {
    
    44
    
          alert('Error loading user data!')
    
    45
    
        } finally {
    
    46
    
          setLoading(false)
    
    47
    
        }
    
    48
    
      }, [claims, supabase])
    
    49
    
    50
    
      useEffect(() => {
    
    51
    
        getProfile()
    
    52
    
      }, [claims, getProfile])
    
    53
    
    54
    
      async function updateProfile({
    
    55
    
        username,
    
    56
    
        website,
    
    57
    
        avatar_url,
    
    58
    
      }: {
    
    59
    
        username: string | null
    
    60
    
        fullname: string | null
    
    61
    
        website: string | null
    
    62
    
        avatar_url: string | null
    
    63
    
      }) {
    
    64
    
        try {
    
    65
    
          if (!claims?.sub) {
    
    66
    
            alert('You must be logged in to update your profile')
    
    67
    
            return
    
    68
    
          }
    
    69
    
    70
    
          setLoading(true)
    
    71
    
    72
    
          const { error } = await supabase.from('profiles').upsert({
    
    73
    
            id: claims.sub,
    
    74
    
            full_name: fullname,
    
    75
    
            username,
    
    76
    
            website,
    
    77
    
            avatar_url,
    
    78
    
            updated_at: new Date().toISOString(),
    
    79
    
          })
    
    80
    
    81
    
      // ...
    
    82
    
    83
    
      return (
    
    84
    
        <div className="form-widget">
    
    85
    
    86
    
          {/* ... */}
    
    87
    
    88
    
          <div>
    
    89
    
            <label htmlFor="email">Email</label>
    
    90
    
            <input id="email" type="text" value={claims?.email ?? ''} disabled />
    
    91
    
          </div>
    
    92
    
          <div>
    
    93
    
            <label htmlFor="fullName">Full Name</label>
    
    94
    
            <input
    
    95
    
              id="fullName"
    
    96
    
              type="text"
    
    97
    
              value={fullname || ''}
    
    98
    
              onChange={(e) => setFullname(e.target.value)}
    
    99
    
            />
    
    100
    
          </div>
    
    101
    
          <div>
    
    102
    
            <label htmlFor="username">Username</label>
    
    103
    
            <input
    
    104
    
              id="username"
    
    105
    
              type="text"
    
    106
    
              value={username || ''}
    
    107
    
              onChange={(e) => setUsername(e.target.value)}
    
    108
    
            />
    
    109
    
          </div>
    
    110
    
          <div>
    
    111
    
            <label htmlFor="website">Website</label>
    
    112
    
            <input
    
    113
    
              id="website"
    
    114
    
              type="url"
    
    115
    
              value={website || ''}
    
    116
    
              onChange={(e) => setWebsite(e.target.value)}
    
    117
    
            />
    
    118
    
          </div>
    
    119
    
    120
    
          <div>
    
    121
    
            <button
    
    122
    
              className="button primary block"
    
    123
    
              onClick={() => updateProfile({ fullname, username, website, avatar_url })}
    
    124
    
              disabled={loading || !claims?.sub}
    
    125
    
            >
    
    126
    
              {loading ? 'Loading ...' : 'Update'}
    
    127
    
            </button>
    
    128
    
          </div>
    
    129
    
    130
    
          <div>
    
    131
    
            <form action="/auth/signout" method="post">
    
    132
    
              <button className="button block" type="submit">
    
    133
    
                Sign out
    
    134
    
              </button>
    
    135
    
            </form>
    
    136
    
          </div>
    
    137
    
        </div>
    
    138
    
      )
    
    139
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/account/account-form.tsx>)

Create an account page for the `AccountForm` component you created

app/account/page.tsx
[code]
    1
    
    import AccountForm from './account-form'
    
    2
    
    import { createClient } from '@/lib/supabase/server'
    
    3
    
    4
    
    export default async function Account() {
    
    5
    
      const supabase = await createClient()
    
    6
    
    7
    
      const { data: claimsData } = await supabase.auth.getClaims()
    
    8
    
    9
    
      return <AccountForm claims={claimsData?.claims ?? null} />
    
    10
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/account/page.tsx>)

### Sign out#

Create a route handler to handle the sign out from the server side, making sure to check if the user is logged in first.

app/auth/signout/route.ts
[code]
    1
    
    import { createClient } from '@/lib/supabase/server'
    
    2
    
    import { revalidatePath } from 'next/cache'
    
    3
    
    import { type NextRequest, NextResponse } from 'next/server'
    
    4
    
    5
    
    export async function POST(req: NextRequest) {
    
    6
    
      const supabase = await createClient()
    
    7
    
    8
    
      // Check if a user's logged in
    
    9
    
      const { data: claimsData } = await supabase.auth.getClaims()
    
    10
    
    11
    
      if (claimsData?.claims) {
    
    12
    
        await supabase.auth.signOut()
    
    13
    
      }
    
    14
    
    15
    
      revalidatePath('/', 'layout')
    
    16
    
      return NextResponse.redirect(new URL('/login', req.url), {
    
    17
    
        status: 302,
    
    18
    
      })
    
    19
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/auth/signout/route.ts>)

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Start by creating a new component:

app/account/avatar.tsx
[code]
    1
    
    'use client'
    
    2
    
    import React, { useEffect, useState } from 'react'
    
    3
    
    import { createClient } from '@/lib/supabase/client'
    
    4
    
    import Image from 'next/image'
    
    5
    
    6
    
    export default function Avatar({
    
    7
    
      uid,
    
    8
    
      url,
    
    9
    
      size,
    
    10
    
      onUpload,
    
    11
    
    }: {
    
    12
    
      uid: string | null
    
    13
    
      url: string | null
    
    14
    
      size: number
    
    15
    
      onUpload: (url: string) => void
    
    16
    
    }) {
    
    17
    
      const supabase = createClient()
    
    18
    
      const [avatarUrl, setAvatarUrl] = useState<string | null>(url)
    
    19
    
      const [uploading, setUploading] = useState(false)
    
    20
    
    21
    
      useEffect(() => {
    
    22
    
        async function downloadImage(path: string) {
    
    23
    
          try {
    
    24
    
            const { data, error } = await supabase.storage.from('avatars').download(path)
    
    25
    
            if (error) {
    
    26
    
              throw error
    
    27
    
            }
    
    28
    
    29
    
            const url = URL.createObjectURL(data)
    
    30
    
            setAvatarUrl(url)
    
    31
    
          } catch (error) {
    
    32
    
            console.log('Error downloading image: ', error)
    
    33
    
          }
    
    34
    
        }
    
    35
    
    36
    
        if (url) downloadImage(url)
    
    37
    
      }, [url, supabase])
    
    38
    
    39
    
      const uploadAvatar: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    
    40
    
        try {
    
    41
    
          setUploading(true)
    
    42
    
    43
    
          if (!event.target.files || event.target.files.length === 0) {
    
    44
    
            throw new Error('You must select an image to upload.')
    
    45
    
          }
    
    46
    
    47
    
          const file = event.target.files[0]
    
    48
    
          const fileExt = file.name.split('.').pop()
    
    49
    
          const filePath = `${uid}-${Math.random()}.${fileExt}`
    
    50
    
    51
    
          const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    
    52
    
    53
    
          if (uploadError) {
    
    54
    
            throw uploadError
    
    55
    
          }
    
    56
    
    57
    
          onUpload(filePath)
    
    58
    
        } catch (error) {
    
    59
    
          alert('Error uploading avatar!')
    
    60
    
        } finally {
    
    61
    
          setUploading(false)
    
    62
    
        }
    
    63
    
      }
    
    64
    
    65
    
      return (
    
    66
    
        <div>
    
    67
    
          {avatarUrl ? (
    
    68
    
            <Image
    
    69
    
              width={size}
    
    70
    
              height={size}
    
    71
    
              src={avatarUrl}
    
    72
    
              alt="Avatar"
    
    73
    
              className="avatar image"
    
    74
    
              style={{ height: size, width: size }}
    
    75
    
            />
    
    76
    
          ) : (
    
    77
    
            <div className="avatar no-image" style={{ height: size, width: size }} />
    
    78
    
          )}
    
    79
    
          <div style={{ width: size }}>
    
    80
    
            <label className="button primary block" htmlFor="single">
    
    81
    
              {uploading ? 'Uploading ...' : 'Upload'}
    
    82
    
            </label>
    
    83
    
            <input
    
    84
    
              style={{
    
    85
    
                visibility: 'hidden',
    
    86
    
                position: 'absolute',
    
    87
    
              }}
    
    88
    
              type="file"
    
    89
    
              id="single"
    
    90
    
              accept="image/*"
    
    91
    
              onChange={uploadAvatar}
    
    92
    
              disabled={uploading}
    
    93
    
            />
    
    94
    
          </div>
    
    95
    
        </div>
    
    96
    
      )
    
    97
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/account/avatar.tsx>)

### Update the account form#

With the Avatar component created, update `app/account/account-form.tsx` to include it:

app/account/account-form.tsx
[code]
    1
    
    'use client'
    
    2
    
    import { useCallback, useEffect, useState } from 'react'
    
    3
    
    import { createClient } from '@/lib/supabase/client'
    
    4
    
    import Avatar from './avatar'
    
    5
    
    6
    
    type Claims = { sub: string; email?: string; [key: string]: unknown }
    
    7
    
    8
    
    export default function AccountForm({ claims }: { claims: Claims | null }) {
    
    9
    
      const supabase = createClient()
    
    10
    
      const [loading, setLoading] = useState(true)
    
    11
    
      const [fullname, setFullname] = useState<string | null>(null)
    
    12
    
      const [username, setUsername] = useState<string | null>(null)
    
    13
    
      const [website, setWebsite] = useState<string | null>(null)
    
    14
    
      const [avatar_url, setAvatarUrl] = useState<string | null>(null)
    
    15
    
    16
    
      const getProfile = useCallback(async () => {
    
    17
    
        try {
    
    18
    
          if (!claims?.sub) {
    
    19
    
            setLoading(false)
    
    20
    
            return
    
    21
    
          }
    
    22
    
    23
    
          setLoading(true)
    
    24
    
    25
    
          const { data, error, status } = await supabase
    
    26
    
            .from('profiles')
    
    27
    
            .select(`full_name, username, website, avatar_url`)
    
    28
    
            .eq('id', claims.sub)
    
    29
    
            .single()
    
    30
    
    31
    
          if (error && status !== 406) {
    
    32
    
            console.log(error)
    
    33
    
            throw error
    
    34
    
          }
    
    35
    
    36
    
          if (data) {
    
    37
    
            setFullname(data.full_name)
    
    38
    
            setUsername(data.username)
    
    39
    
            setWebsite(data.website)
    
    40
    
            setAvatarUrl(data.avatar_url)
    
    41
    
          }
    
    42
    
        } catch (error) {
    
    43
    
          alert('Error loading user data!')
    
    44
    
        } finally {
    
    45
    
          setLoading(false)
    
    46
    
        }
    
    47
    
      }, [claims, supabase])
    
    48
    
    49
    
      useEffect(() => {
    
    50
    
        getProfile()
    
    51
    
      }, [claims, getProfile])
    
    52
    
    53
    
      async function updateProfile({
    
    54
    
        username,
    
    55
    
        website,
    
    56
    
        avatar_url,
    
    57
    
      }: {
    
    58
    
        username: string | null
    
    59
    
        fullname: string | null
    
    60
    
        website: string | null
    
    61
    
        avatar_url: string | null
    
    62
    
      }) {
    
    63
    
        try {
    
    64
    
          if (!claims?.sub) {
    
    65
    
            alert('You must be logged in to update your profile')
    
    66
    
            return
    
    67
    
          }
    
    68
    
    69
    
          setLoading(true)
    
    70
    
    71
    
          const { error } = await supabase.from('profiles').upsert({
    
    72
    
            id: claims.sub,
    
    73
    
            full_name: fullname,
    
    74
    
            username,
    
    75
    
            website,
    
    76
    
            avatar_url,
    
    77
    
            updated_at: new Date().toISOString(),
    
    78
    
          })
    
    79
    
          if (error) throw error
    
    80
    
          alert('Profile updated!')
    
    81
    
        } catch (error) {
    
    82
    
          alert('Error updating the data!')
    
    83
    
        } finally {
    
    84
    
          setLoading(false)
    
    85
    
        }
    
    86
    
      }
    
    87
    
    88
    
      return (
    
    89
    
        <div className="form-widget">
    
    90
    
          <Avatar
    
    91
    
            uid={claims?.sub ?? null}
    
    92
    
            url={avatar_url}
    
    93
    
            size={150}
    
    94
    
            onUpload={(url) => {
    
    95
    
              setAvatarUrl(url)
    
    96
    
              updateProfile({ fullname, username, website, avatar_url: url })
    
    97
    
            }}
    
    98
    
          />
    
    99
    
          <div>
    
    100
    
            <label htmlFor="email">Email</label>
    
    101
    
            <input id="email" type="text" value={claims?.email ?? ''} disabled />
    
    102
    
          </div>
    
    103
    
          <div>
    
    104
    
            <label htmlFor="fullName">Full Name</label>
    
    105
    
            <input
    
    106
    
              id="fullName"
    
    107
    
              type="text"
    
    108
    
              value={fullname || ''}
    
    109
    
              onChange={(e) => setFullname(e.target.value)}
    
    110
    
            />
    
    111
    
          </div>
    
    112
    
          <div>
    
    113
    
            <label htmlFor="username">Username</label>
    
    114
    
            <input
    
    115
    
              id="username"
    
    116
    
              type="text"
    
    117
    
              value={username || ''}
    
    118
    
              onChange={(e) => setUsername(e.target.value)}
    
    119
    
            />
    
    120
    
          </div>
    
    121
    
          <div>
    
    122
    
            <label htmlFor="website">Website</label>
    
    123
    
            <input
    
    124
    
              id="website"
    
    125
    
              type="url"
    
    126
    
              value={website || ''}
    
    127
    
              onChange={(e) => setWebsite(e.target.value)}
    
    128
    
            />
    
    129
    
          </div>
    
    130
    
    131
    
          <div>
    
    132
    
            <button
    
    133
    
              className="button primary block"
    
    134
    
              onClick={() => updateProfile({ fullname, username, website, avatar_url })}
    
    135
    
              disabled={loading || !claims?.sub}
    
    136
    
            >
    
    137
    
              {loading ? 'Loading ...' : 'Update'}
    
    138
    
            </button>
    
    139
    
          </div>
    
    140
    
    141
    
          <div>
    
    142
    
            <form action="/auth/signout" method="post">
    
    143
    
              <button className="button block" type="submit">
    
    144
    
                Sign out
    
    145
    
              </button>
    
    146
    
            </form>
    
    147
    
          </div>
    
    148
    
        </div>
    
    149
    
      )
    
    150
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/nextjs-user-management/app/account/account-form.tsx>)

### Launch#

With all the pages, route handlers, and components in place, run the following in a terminal window:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:3000/login](<http://localhost:3000/login>) and you should see the completed app.

When you enter your email and password, you will receive an email with the title **Confirm your email**. Congrats 🎉!!!

At this stage you have a fully functional application!

## See also#

  * See the complete [example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/nextjs-user-management>) and deploy it to Vercel
  * [Build a Twitter Clone with the Next.js App Router and Supabase - free egghead course](<https://egghead.io/courses/build-a-twitter-clone-with-the-next-js-app-router-and-supabase-19bebadb>)
  * Explore the [pre-built Auth components](</ui/docs/nextjs/password-based-auth>)
  * Explore the [Supabase Cache Helpers](<https://github.com/psteinroe/supabase-cache-helpers>)
  * See the [Next.js Subscription Payments Starter](<https://github.com/vercel/nextjs-subscription-payments>) template on GitHub