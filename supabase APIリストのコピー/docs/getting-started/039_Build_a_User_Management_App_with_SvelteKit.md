---
タイトル: Build a User Management App with SvelteKit
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, sveltekit, tutorials, user, with, with-sveltekit
---

# Build a User Management App with SvelteKit

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, sveltekit, tutorials, user, with, with-sveltekit

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Svelte app#](#initialize-a-svelte-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Creating a Supabase client for SSR#](#creating-a-supabase-client-for-ssr)
  - [Set up a login page#](#set-up-a-login-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the account page#](#update-the-account-page)
  - [Launch!#](#launch)

## 概要

Learn how to use Supabase in your SvelteKit App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/sveltekit-user-management>).

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

Use the [SvelteKit Skeleton Project](<https://svelte.dev/docs/kit>) to initialize an app called `supabase-sveltekit` (for this tutorial, select "SvelteKit minimal" and use TypeScript):
[code] 
    1
    
    npx sv create supabase-sveltekit
    
    2
    
    cd supabase-sveltekit
    
    3
    
    npm install
[/code]

Then install the Supabase client library: [supabase-js](<https://github.com/supabase/supabase-js>)
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

And finally, save the environment variables in a `.env` file. All you need are the `PUBLIC_SUPABASE_URL` and the key that you copied earlier.

.env
[code]
    1
    
    PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
    
    2
    
    PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
[/code]

### App styling (optional)#

An optional step is to update the CSS file `src/styles.css` to make the app look nice. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/sveltekit-user-management/src/styles.css>).

### Creating a Supabase client for SSR#

The `ssr` package configures Supabase to use Cookies, which are required for server-side languages and frameworks.

Install the SSR package:
[code] 
    1
    
    npm install @supabase/ssr
[/code]

Creating a Supabase client with the `ssr` package automatically configures it to use Cookies. This means the user's session is available throughout the entire SvelteKit stack - page, layout, server, and hooks.

Add the code below to a `src/hooks.server.ts` file to initialize the client on the server:

src/hooks.server.ts
[code]
    1
    
    // src/hooks.server.ts
    
    2
    
    import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public'
    
    3
    
    import { createServerClient } from '@supabase/ssr'
    
    4
    
    import type { Handle } from '@sveltejs/kit'
    
    5
    
    6
    
    export const handle: Handle = async ({ event, resolve }) => {
    
    7
    
      event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    
    8
    
        cookies: {
    
    9
    
          getAll: () => event.cookies.getAll(),
    
    10
    
          /**
    
    11
    
           * Note: You have to add the `path` variable to the
    
    12
    
           * set and remove method due to sveltekit's cookie API
    
    13
    
           * requiring this to be set, setting the path to `/`
    
    14
    
           * will replicate previous/standard behaviour (https://kit.svelte.dev/docs/types#public-types-cookies)
    
    15
    
           */
    
    16
    
          setAll: (cookiesToSet, headers) => {
    
    17
    
            cookiesToSet.forEach(({ name, value, options }) => {
    
    18
    
              event.cookies.set(name, value, { ...options, path: '/' })
    
    19
    
            })
    
    20
    
            if (Object.keys(headers).length > 0) {
    
    21
    
              event.setHeaders(headers)
    
    22
    
            }
    
    23
    
          },
    
    24
    
        },
    
    25
    
      })
    
    26
    
    27
    
      return resolve(event, {
    
    28
    
        filterSerializedResponseHeaders(name: string) {
    
    29
    
          return name === 'content-range' || name === 'x-supabase-api-version'
    
    30
    
        },
    
    31
    
      })
    
    32
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/hooks.server.ts>)

Note that `auth.getSession` reads the auth token and the unencoded session data from the local storage medium. It _doesn't_ send a request back to the Supabase Auth server unless the local session is expired.

You should **never** trust the unencoded session data if you're writing server code, since it could be tampered with by the sender. If you need verified, trustworthy user data, call `auth.getUser` instead, which always makes a request to the Auth server to fetch trusted data.

As this tutorial uses TypeScript the compiler complains about `event.locals.supabase`. You can fix this by updating the `src/app.d.ts` with the content below:

src/app.d.ts
[code]
    1
    
    import type { SupabaseClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    import type { Database } from './database.types'
    
    4
    
    5
    
    // See https://kit.svelte.dev/docs/types#app
    
    6
    
    // for information about these interfaces
    
    7
    
    declare global {
    
    8
    
      namespace App {
    
    9
    
        // interface Error {}
    
    10
    
        interface Locals {
    
    11
    
          supabase: SupabaseClient<Database>
    
    12
    
        }
    
    13
    
        // interface PageState {}
    
    14
    
        // interface Platform {}
    
    15
    
      }
    
    16
    
    }
    
    17
    
    18
    
    export {}
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/app.d.ts>)

Create a new `src/routes/+layout.server.ts` file to handle the session on the server-side.

src/routes/+layout.server.ts
[code]
    1
    
    // src/routes/+layout.server.ts
    
    2
    
    import type { LayoutServerLoad } from './$types'
    
    3
    
    4
    
    export const load: LayoutServerLoad = async ({ cookies }) => {
    
    5
    
      return {
    
    6
    
        cookies: cookies.getAll(),
    
    7
    
      }
    
    8
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/+layout.server.ts>)

Start the dev server (`npm run dev`) to generate the `./$types` files we are referencing in our project.

Create a new `src/routes/+layout.ts` file to handle the session and the `supabase` object on the client-side.

src/routes/+layout.ts
[code]
    1
    
    // src/routes/+layout.ts
    
    2
    
    import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
    
    3
    
    import type { LayoutLoad } from './$types'
    
    4
    
    import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr'
    
    5
    
    6
    
    export const load: LayoutLoad = async ({ fetch, data, depends }) => {
    
    7
    
      depends('supabase:auth')
    
    8
    
    9
    
      const supabase = isBrowser()
    
    10
    
        ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    
    11
    
            global: {
    
    12
    
              fetch,
    
    13
    
            },
    
    14
    
          })
    
    15
    
        : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    
    16
    
            global: {
    
    17
    
              fetch,
    
    18
    
            },
    
    19
    
            cookies: {
    
    20
    
              getAll() {
    
    21
    
                return data.cookies
    
    22
    
              },
    
    23
    
            },
    
    24
    
          })
    
    25
    
    26
    
      /**
    
    27
    
       * `getClaims` validates the JWT signature locally (for asymmetric keys) once
    
    28
    
       * the relevant signing keys are available or cached, and returns the decoded
    
    29
    
       * claims. While an initial or periodic network request may be required to
    
    30
    
       * fetch or refresh keys, this is both faster and safer than `getSession`,
    
    31
    
       * which does not validate the JWT.
    
    32
    
       */
    
    33
    
      const { data: claimsData, error } = await supabase.auth.getClaims()
    
    34
    
      const claims = error ? null : claimsData?.claims
    
    35
    
    36
    
      return { supabase, claims }
    
    37
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/+layout.ts>)

Create `src/routes/+layout.svelte`:

src/routes/+layout.svelte
[code]
    1
    
    <!-- src/routes/+layout.svelte -->
    
    2
    
    <script lang="ts">
    
    3
    
    	import '../styles.css'
    
    4
    
    	import { invalidate } from '$app/navigation'
    
    5
    
    	import { onMount } from 'svelte'
    
    6
    
    7
    
    	let { data, children } = $props()
    
    8
    
    	let { supabase, claims } = $derived(data)
    
    9
    
    10
    
    	onMount(() => {
    
    11
    
    		const { data } = supabase.auth.onAuthStateChange((event, _session) => {
    
    12
    
    			if (_session?.expires_at !== claims?.exp) {
    
    13
    
    				invalidate('supabase:auth')
    
    14
    
    			}
    
    15
    
    		})
    
    16
    
    17
    
    		return () => data.subscription.unsubscribe()
    
    18
    
    	})
    
    19
    
    </script>
    
    20
    
    21
    
    <svelte:head>
    
    22
    
    	<title>User Management</title>
    
    23
    
    </svelte:head>
    
    24
    
    25
    
    <div class="container" style="padding: 50px 0 100px 0">
    
    26
    
    	{@render children()}
    
    27
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/+layout.svelte>)

### Set up a login page#

Create a magic link login/signup page for your application by updating the `routes/+page.svelte` file:

src/routes/+page.svelte
[code]
    1
    
    <!-- src/routes/+page.svelte -->
    
    2
    
    <script lang="ts">
    
    3
    
    	import { enhance } from '$app/forms'
    
    4
    
    	import type { ActionData, SubmitFunction } from './$types.js'
    
    5
    
    6
    
    	interface Props {
    
    7
    
    		form: ActionData
    
    8
    
    	}
    
    9
    
    	let { form }: Props = $props()
    
    10
    
    11
    
    	let loading = $state(false)
    
    12
    
    13
    
    	const handleSubmit: SubmitFunction = () => {
    
    14
    
    		loading = true
    
    15
    
    		return async ({ update }) => {
    
    16
    
    			update()
    
    17
    
    			loading = false
    
    18
    
    		}
    
    19
    
    	}
    
    20
    
    </script>
    
    21
    
    22
    
    <svelte:head>
    
    23
    
    	<title>User Management</title>
    
    24
    
    </svelte:head>
    
    25
    
    26
    
    <form class="row flex flex-center" method="POST" use:enhance={handleSubmit}>
    
    27
    
    	<div class="col-6 form-widget">
    
    28
    
    		<h1 class="header">Supabase + SvelteKit</h1>
    
    29
    
    		<p class="description">Sign in via magic link with your email below</p>
    
    30
    
    		{#if form?.message !== undefined}
    
    31
    
    		<div class="success {form?.success ? '' : 'fail'}">
    
    32
    
    			{form?.message}
    
    33
    
    		</div>
    
    34
    
    		{/if}
    
    35
    
    		<div>
    
    36
    
    			<label for="email">Email address</label>
    
    37
    
    			<input 
    
    38
    
    				id="email" 
    
    39
    
    				name="email" 
    
    40
    
    				class="inputField" 
    
    41
    
    				type="email" 
    
    42
    
    				placeholder="Your email" 
    
    43
    
    				value={form?.email ?? ''} 
    
    44
    
    			/>
    
    45
    
    		</div>
    
    46
    
    		{#if form?.errors?.email}
    
    47
    
    		<span class="flex items-center text-sm error">
    
    48
    
    			{form?.errors?.email}
    
    49
    
    		</span>
    
    50
    
    		{/if}
    
    51
    
    		<div>
    
    52
    
    			<button class="button primary block">
    
    53
    
    				{ loading ? 'Loading' : 'Send magic link' }
    
    54
    
    			</button>
    
    55
    
    		</div>
    
    56
    
    	</div>
    
    57
    
    </form>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/+page.svelte>)

Create a `src/routes/+page.server.ts` file that handles the magic link form when submitted.

src/routes/+page.server.ts
[code]
    1
    
    // src/routes/+page.server.ts
    
    2
    
    import { fail, redirect } from '@sveltejs/kit'
    
    3
    
    import type { Actions, PageServerLoad } from './$types'
    
    4
    
    5
    
    export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
    
    6
    
      const { data, error } = await supabase.auth.getClaims()
    
    7
    
    8
    
      // if the user is already logged in return them to the account page
    
    9
    
      if (!error && data?.claims) {
    
    10
    
        redirect(303, '/account')
    
    11
    
      }
    
    12
    
    13
    
      return { url: url.origin }
    
    14
    
    }
    
    15
    
    16
    
    export const actions: Actions = {
    
    17
    
      default: async (event) => {
    
    18
    
        const {
    
    19
    
          url,
    
    20
    
          request,
    
    21
    
          locals: { supabase },
    
    22
    
        } = event
    
    23
    
        const formData = await request.formData()
    
    24
    
        const email = formData.get('email') as string
    
    25
    
        const validEmail = /^[\w-\.+]+@([\w-]+\.)+[\w-]{2,8}$/.test(email)
    
    26
    
    27
    
        if (!validEmail) {
    
    28
    
          return fail(400, { errors: { email: 'Please enter a valid email address' }, email })
    
    29
    
        }
    
    30
    
    31
    
        const { error } = await supabase.auth.signInWithOtp({ email })
    
    32
    
    33
    
        if (error) {
    
    34
    
          return fail(400, {
    
    35
    
            success: false,
    
    36
    
            email,
    
    37
    
            message: `There was an issue, Please contact support.`,
    
    38
    
          })
    
    39
    
        }
    
    40
    
    41
    
        return {
    
    42
    
          success: true,
    
    43
    
          message: 'Please check your email for a magic link to log into the website.',
    
    44
    
        }
    
    45
    
      },
    
    46
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/+page.server.ts>)

#### Email template#

Change the email template to support a server-side authentication flow.

Before proceeding, change the email template to support sending a token hash:

  * Go to the [**Auth** > **Emails**](</dashboard/project/_/auth/templates>) page in the project dashboard.
  * Select the **Confirm signup** template.
  * Change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
  * Repeat the previous step for **Magic link** template.


Did you know?

You can also customize emails sent out to new users, including the email's looks, content, and query parameters. Check out the [settings of your project](</dashboard/project/_/auth/templates>).

#### Confirmation endpoint#

As this is a server-side rendering (SSR) environment, you need to create a server endpoint responsible for exchanging the `token_hash` for a session.

The following code snippet performs the following steps:

  * Retrieves the `token_hash` sent back from the Supabase Auth server using the `token_hash` query parameter.
  * Exchanges this `token_hash` for a session, which you store in storage (in this case, cookies).
  * Finally, redirect the user to the `account` page or the `error` page.


src/routes/auth/confirm/+server.ts
[code]
    1
    
    // src/routes/auth/confirm/+server.js
    
    2
    
    import type { EmailOtpType } from '@supabase/supabase-js'
    
    3
    
    import { redirect } from '@sveltejs/kit'
    
    4
    
    5
    
    import type { RequestHandler } from './$types'
    
    6
    
    7
    
    export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
    
    8
    
      const token_hash = url.searchParams.get('token_hash')
    
    9
    
      const type = url.searchParams.get('type') as EmailOtpType | null
    
    10
    
      const next = url.searchParams.get('next') ?? '/account'
    
    11
    
    12
    
      /**
    
    13
    
       * Clean up the redirect URL by deleting the Auth flow parameters.
    
    14
    
       *
    
    15
    
       * `next` is preserved for now, because it's needed in the error case.
    
    16
    
       */
    
    17
    
      const redirectTo = new URL(url)
    
    18
    
      redirectTo.pathname = next
    
    19
    
      redirectTo.searchParams.delete('token_hash')
    
    20
    
      redirectTo.searchParams.delete('type')
    
    21
    
    22
    
      if (token_hash && type) {
    
    23
    
        const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    
    24
    
        if (!error) {
    
    25
    
          redirectTo.searchParams.delete('next')
    
    26
    
          redirect(303, redirectTo)
    
    27
    
        }
    
    28
    
      }
    
    29
    
    30
    
      redirectTo.pathname = '/auth/error'
    
    31
    
      redirect(303, redirectTo)
    
    32
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/auth/confirm/+server.ts>)

#### Authentication error page#

If there is an error with confirming the token, redirect the user to an error page.

src/routes/auth/error/+page.svelte
[code]
    1
    
    <p>Login error</p>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/auth/error/+page.svelte>)

#### Account page#

After a user signs in, they need to be able to edit their profile details page. Create a new `src/routes/account/+page.svelte` file with the content below.

src/routes/account/+page.svelte
[code]
    1
    
    <script lang="ts">
    
    2
    
    	import { enhance } from '$app/forms';
    
    3
    
    	import type { SubmitFunction } from '@sveltejs/kit';
    
    4
    
    5
    
    	// ...
    
    6
    
    7
    
    	let { data, form } = $props()
    
    8
    
    	let { claims, supabase, profile } = $derived(data)
    
    9
    
    	let profileForm: HTMLFormElement
    
    10
    
    	let loading = $state(false)
    
    11
    
    	let fullName: string = profile?.full_name ?? ''
    
    12
    
    	let username: string = profile?.username ?? ''
    
    13
    
    	let website: string = profile?.website ?? ''
    
    14
    
    15
    
    	// ...
    
    16
    
    17
    
    	const handleSubmit: SubmitFunction = () => {
    
    18
    
    		loading = true
    
    19
    
    		return async ({ update }) => {
    
    20
    
    			loading = false
    
    21
    
    			update()
    
    22
    
    		}
    
    23
    
    	}
    
    24
    
    25
    
    	const handleSignOut: SubmitFunction = () => {
    
    26
    
    		loading = true
    
    27
    
    		return async ({ update }) => {
    
    28
    
    			loading = false
    
    29
    
    			update()
    
    30
    
    		}
    
    31
    
    	}
    
    32
    
    </script>
    
    33
    
    34
    
    <div class="form-widget">
    
    35
    
    	<form
    
    36
    
    		class="form-widget"
    
    37
    
    		method="post"
    
    38
    
    		action="?/update"
    
    39
    
    		use:enhance={handleSubmit}
    
    40
    
    		bind:this={profileForm}
    
    41
    
    42
    
    		// ...
    
    43
    
    44
    
    		<div>
    
    45
    
    			<label for="email">Email</label>
    
    46
    
    			<input id="email" type="text" value={claims?.email ?? ''} disabled />
    
    47
    
    		</div>
    
    48
    
    49
    
    		<div>
    
    50
    
    			<label for="fullName">Full Name</label>
    
    51
    
    			<input id="fullName" name="fullName" type="text" value={form?.fullName ?? fullName} />
    
    52
    
    		</div>
    
    53
    
    54
    
    		<div>
    
    55
    
    			<label for="username">Username</label>
    
    56
    
    			<input id="username" name="username" type="text" value={form?.username ?? username} />
    
    57
    
    		</div>
    
    58
    
    59
    
    		<div>
    
    60
    
    			<label for="website">Website</label>
    
    61
    
    			<input id="website" name="website" type="url" value={form?.website ?? website} />
    
    62
    
    		</div>
    
    63
    
    64
    
    		<div>
    
    65
    
    			<input
    
    66
    
    				type="submit"
    
    67
    
    				class="button block primary"
    
    68
    
    				value={loading ? 'Loading...' : 'Update'}
    
    69
    
    				disabled={loading}
    
    70
    
    			/>
    
    71
    
    		</div>
    
    72
    
    	</form>
    
    73
    
    74
    
    	<form method="post" action="?/signout" use:enhance={handleSignOut}>
    
    75
    
    		<div>
    
    76
    
    			<button class="button block" disabled={loading}>Sign Out</button>
    
    77
    
    		</div>
    
    78
    
    	</form>
    
    79
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/account/+page.svelte>)

Now, create the associated `src/routes/account/+page.server.ts` file that handles loading data from the server through the `load` function and handle all form actions through the `actions` object.

src/routes/account/+page.server.ts
[code]
    1
    
    import { fail, redirect } from '@sveltejs/kit'
    
    2
    
    import type { Actions, PageServerLoad } from './$types'
    
    3
    
    4
    
    export const load: PageServerLoad = async ({ locals: { supabase } }) => {
    
    5
    
      const { data: claimsData, error } = await supabase.auth.getClaims()
    
    6
    
    7
    
      if (error || !claimsData?.claims) {
    
    8
    
        redirect(303, '/')
    
    9
    
      }
    
    10
    
    11
    
      const { claims } = claimsData
    
    12
    
    13
    
      const { data: profile } = await supabase
    
    14
    
        .from('profiles')
    
    15
    
        .select(`username, full_name, website, avatar_url`)
    
    16
    
        .eq('id', claims.sub)
    
    17
    
        .single()
    
    18
    
    19
    
      return { claims, profile }
    
    20
    
    }
    
    21
    
    22
    
    export const actions: Actions = {
    
    23
    
      update: async ({ request, locals: { supabase } }) => {
    
    24
    
        const formData = await request.formData()
    
    25
    
        const fullName = formData.get('fullName') as string
    
    26
    
        const username = formData.get('username') as string
    
    27
    
        const website = formData.get('website') as string
    
    28
    
        const avatarUrl = formData.get('avatarUrl') as string
    
    29
    
    30
    
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    
    31
    
    32
    
        if (claimsError || !claimsData?.claims) {
    
    33
    
          return fail(401, { fullName, username, website, avatarUrl })
    
    34
    
        }
    
    35
    
    36
    
        const { error } = await supabase.from('profiles').upsert({
    
    37
    
          id: claimsData.claims.sub,
    
    38
    
          full_name: fullName,
    
    39
    
          username,
    
    40
    
          website,
    
    41
    
          avatar_url: avatarUrl,
    
    42
    
          updated_at: new Date(),
    
    43
    
        })
    
    44
    
    45
    
        if (error) {
    
    46
    
          return fail(500, {
    
    47
    
            fullName,
    
    48
    
            username,
    
    49
    
            website,
    
    50
    
            avatarUrl,
    
    51
    
          })
    
    52
    
        }
    
    53
    
    54
    
        return {
    
    55
    
          fullName,
    
    56
    
          username,
    
    57
    
          website,
    
    58
    
          avatarUrl,
    
    59
    
        }
    
    60
    
      },
    
    61
    
      signout: async ({ locals: { supabase } }) => {
    
    62
    
        await supabase.auth.signOut()
    
    63
    
        redirect(303, '/')
    
    64
    
      },
    
    65
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/account/+page.server.ts>)

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Start by creating a new component called `Avatar.svelte` in the `src/routes/account` directory:

src/routes/account/Avatar.svelte
[code]
    1
    
    <!-- src/routes/account/Avatar.svelte -->
    
    2
    
    <script lang="ts">
    
    3
    
    	import type { SupabaseClient } from '@supabase/supabase-js'
    
    4
    
    5
    
    	interface Props {
    
    6
    
    		size?: number
    
    7
    
    		url?: string
    
    8
    
    		supabase: SupabaseClient
    
    9
    
    		onupload?: () => void
    
    10
    
    	}
    
    11
    
    	let { size = 10, url = $bindable(), supabase, onupload }: Props = $props()
    
    12
    
    13
    
    	let avatarUrl: string | null = $state(null)
    
    14
    
    	let uploading = $state(false)
    
    15
    
    	let files: FileList = $state()
    
    16
    
    17
    
    	const downloadImage = async (path: string) => {
    
    18
    
    		try {
    
    19
    
    			const { data, error } = await supabase.storage.from('avatars').download(path)
    
    20
    
    21
    
    			if (error) {
    
    22
    
    				throw error
    
    23
    
    			}
    
    24
    
    25
    
    			const url = URL.createObjectURL(data)
    
    26
    
    			avatarUrl = url
    
    27
    
    		} catch (error) {
    
    28
    
    			if (error instanceof Error) {
    
    29
    
    				console.log('Error downloading image: ', error.message)
    
    30
    
    			}
    
    31
    
    		}
    
    32
    
    	}
    
    33
    
    34
    
    	const uploadAvatar = async () => {
    
    35
    
    		try {
    
    36
    
    			uploading = true
    
    37
    
    38
    
    			if (!files || files.length === 0) {
    
    39
    
    				throw new Error('You must select an image to upload.')
    
    40
    
    			}
    
    41
    
    42
    
    			const file = files[0]
    
    43
    
    			const fileExt = file.name.split('.').pop()
    
    44
    
    			const filePath = `${Math.random()}.${fileExt}`
    
    45
    
    46
    
    			const { error } = await supabase.storage.from('avatars').upload(filePath, file)
    
    47
    
    48
    
    			if (error) {
    
    49
    
    				throw error
    
    50
    
    			}
    
    51
    
    52
    
    			url = filePath
    
    53
    
    			setTimeout(() => {
    
    54
    
    				onupload?.()
    
    55
    
    			}, 100)
    
    56
    
    		} catch (error) {
    
    57
    
    			if (error instanceof Error) {
    
    58
    
    				alert(error.message)
    
    59
    
    			}
    
    60
    
    		} finally {
    
    61
    
    			uploading = false
    
    62
    
    		}
    
    63
    
    	}
    
    64
    
    65
    
    	$effect(() => {
    
    66
    
    		if (url) downloadImage(url)
    
    67
    
    	})
    
    68
    
    </script>
    
    69
    
    70
    
    <div>
    
    71
    
    	{#if avatarUrl}
    
    72
    
    		<img
    
    73
    
    			src={avatarUrl}
    
    74
    
    			alt={avatarUrl ? 'Avatar' : 'No image'}
    
    75
    
    			class="avatar image"
    
    76
    
    			style="height: {size}em; width: {size}em;"
    
    77
    
    		/>
    
    78
    
    	{:else}
    
    79
    
    		<div class="avatar no-image" style="height: {size}em; width: {size}em;"></div>
    
    80
    
    	{/if}
    
    81
    
    	<input type="hidden" name="avatarUrl" value={url} />
    
    82
    
    83
    
    	<div style="width: {size}em;">
    
    84
    
    		<label class="button primary block" for="single">
    
    85
    
    			{uploading ? 'Uploading ...' : 'Upload'}
    
    86
    
    		</label>
    
    87
    
    		<input
    
    88
    
    			style="visibility: hidden; position:absolute;"
    
    89
    
    			type="file"
    
    90
    
    			id="single"
    
    91
    
    			accept="image/*"
    
    92
    
    			bind:files
    
    93
    
    			onchange={uploadAvatar}
    
    94
    
    			disabled={uploading}
    
    95
    
    		/>
    
    96
    
    	</div>
    
    97
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/account/Avatar.svelte>)

### Update the account page#

With the Avatar component created, update `src/routes/account/+page.svelte` to include it:

src/routes/account/+page.svelte
[code]
    1
    
    <script lang="ts">
    
    2
    
    	import { enhance } from '$app/forms';
    
    3
    
    	import type { SubmitFunction } from '@sveltejs/kit';
    
    4
    
        import Avatar from './Avatar.svelte'
    
    5
    
    6
    
    	let { data, form } = $props()
    
    7
    
    	let { claims, supabase, profile } = $derived(data)
    
    8
    
    	let profileForm: HTMLFormElement
    
    9
    
    	let loading = $state(false)
    
    10
    
    	let fullName: string = profile?.full_name ?? ''
    
    11
    
    	let username: string = profile?.username ?? ''
    
    12
    
    	let website: string = profile?.website ?? ''
    
    13
    
    	let avatarUrl: string = $state(profile?.avatar_url ?? '')
    
    14
    
    15
    
    	const handleSubmit: SubmitFunction = () => {
    
    16
    
    		loading = true
    
    17
    
    		return async ({ update }) => {
    
    18
    
    			loading = false
    
    19
    
    			update()
    
    20
    
    		}
    
    21
    
    	}
    
    22
    
    23
    
    	const handleSignOut: SubmitFunction = () => {
    
    24
    
    		loading = true
    
    25
    
    		return async ({ update }) => {
    
    26
    
    			loading = false
    
    27
    
    			update()
    
    28
    
    		}
    
    29
    
    	}
    
    30
    
    </script>
    
    31
    
    32
    
    <div class="form-widget">
    
    33
    
    	<form
    
    34
    
    		class="form-widget"
    
    35
    
    		method="post"
    
    36
    
    		action="?/update"
    
    37
    
    		use:enhance={handleSubmit}
    
    38
    
    		bind:this={profileForm}
    
    39
    
    	>
    
    40
    
            <Avatar
    
    41
    
                {supabase}
    
    42
    
                bind:url={avatarUrl}
    
    43
    
                size={10}
    
    44
    
                onupload={() => {
    
    45
    
                    profileForm.requestSubmit();
    
    46
    
                }}
    
    47
    
            />
    
    48
    
    		<input type="hidden" name="avatarUrl" value={avatarUrl} />
    
    49
    
    		<div>
    
    50
    
    			<label for="email">Email</label>
    
    51
    
    			<input id="email" type="text" value={claims?.email ?? ''} disabled />
    
    52
    
    		</div>
    
    53
    
    54
    
    		<div>
    
    55
    
    			<label for="fullName">Full Name</label>
    
    56
    
    			<input id="fullName" name="fullName" type="text" value={form?.fullName ?? fullName} />
    
    57
    
    		</div>
    
    58
    
    59
    
    		<div>
    
    60
    
    			<label for="username">Username</label>
    
    61
    
    			<input id="username" name="username" type="text" value={form?.username ?? username} />
    
    62
    
    		</div>
    
    63
    
    64
    
    		<div>
    
    65
    
    			<label for="website">Website</label>
    
    66
    
    			<input id="website" name="website" type="url" value={form?.website ?? website} />
    
    67
    
    		</div>
    
    68
    
    69
    
    		<div>
    
    70
    
    			<input
    
    71
    
    				type="submit"
    
    72
    
    				class="button block primary"
    
    73
    
    				value={loading ? 'Loading...' : 'Update'}
    
    74
    
    				disabled={loading}
    
    75
    
    			/>
    
    76
    
    		</div>
    
    77
    
    	</form>
    
    78
    
    79
    
    	<form method="post" action="?/signout" use:enhance={handleSignOut}>
    
    80
    
    		<div>
    
    81
    
    			<button class="button block" disabled={loading}>Sign Out</button>
    
    82
    
    		</div>
    
    83
    
    	</form>
    
    84
    
    </div>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/sveltekit-user-management/src/routes/account/+page.svelte>)

### Launch!#

With all the pages in place, run this command in a terminal:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:5173](<http://localhost:5173>) and you should see the completed app.

![Supabase Svelte](/docs/img/supabase-svelte-demo.png)

At this stage you have a fully functional application!