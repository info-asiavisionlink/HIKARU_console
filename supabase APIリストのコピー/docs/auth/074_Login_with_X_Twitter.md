---
タイトル: Login with X / Twitter
URL: https://supabase.com/docs/guides/auth/social-login/auth-twitter
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-twitter, login, social-login, twitter, with
---

# Login with X / Twitter

**URL:** https://supabase.com/docs/guides/auth/social-login/auth-twitter
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-twitter, login, social-login, twitter, with

## 目次

- [Overview#](#overview)
- [Access your X developer account#](#access-your-x-developer-account)
- [Find your callback URL#](#find-your-callback-url)
- [Create an X OAuth app#](#create-an-x-oauth-app)
- [Enter your X credentials into your Supabase project#](#enter-your-x-credentials-into-your-supabase-project)
- [Add login code to your client app#](#add-login-code-to-your-client-app)
- [Resources#](#resources)

## 概要

Add X / Twitter OAuth to your Supabase project

---

To enable X / Twitter Auth for your project, you need to set up an X OAuth 2.0 application and add the application credentials in the Supabase Dashboard.

## Overview#

We recommend using the **X / Twitter (OAuth 2.0)** provider. The legacy **Twitter (OAuth 1.0a)** provider will be deprecated in future releases.

Setting up X / Twitter logins for your application consists of 3 parts:

  * Create and configure an X Project and App on the [X Developer Dashboard](<https://developer.x.com/en/portal/dashboard>).
  * Add your X OAuth 2.0 `Client ID` and `Client Secret` to your [Supabase Project](</dashboard>).
  * Add the login code to your [Supabase JS Client App](<https://github.com/supabase/supabase-js>).


## Access your X developer account#

  * Go to [developer.x.com](<https://developer.x.com>).
  * Click on `Sign in` at the top right to log in.


## Find your callback URL#

The next step requires a callback URL, which looks like this: `https://<project-ref>.supabase.co/auth/v1/callback`

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * Click on the `Authentication` icon in the left sidebar
  * Click on [`Sign In / Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **X / Twitter (OAuth 2.0)** from the accordion list to expand and you'll find your **Callback URL** , you can click `Copy` to copy it to the clipboard


#### Local development#

When testing OAuth locally with the Supabase CLI, ensure your OAuth provider is configured with the local Supabase Auth callback URL:

<http://localhost:54321/auth/v1/callback>[](<http://localhost:54321/auth/v1/callback>)

If this callback URL is missing or misconfigured, OAuth sign-in may fail or not redirect correctly during local development.

See the [local development docs](</docs/guides/local-development>) for more details.

For testing OAuth locally with the Supabase CLI see the [local development docs](</docs/guides/local-development>).

## Create an X OAuth app#

  * Click `+ Create Project`.
    * Enter your project name, click `Next`.
    * Select your use case, click `Next`.
    * Enter a description for your project, click `Next`.
    * Enter a name for your app, click `Next`.
    * Copy and save your **API Key** and **API Secret Key** (these are used for OAuth 1.0a, which is being deprecated).
    * Click on `App settings` to proceed to next steps.
  * At the bottom, you will find `User authentication settings`. Click on `Set up`.
  * Under `User authentication settings`, you can configure `App permissions`.
  * Make sure you turn ON `Request email from users`.
  * Select `Web App...` as the `Type of App`.
  * Under `App info` configure the following.
    * Enter your `Callback URL`. Check the **Find your callback URL** section above to learn how to obtain your callback URL.
    * Enter your `Website URL` (tip: try `http://127.0.0.1:port` or `http://www.localhost:port` during development)
    * Enter your `Terms of service URL`.
    * Enter your `Privacy policy URL`.
  * Click `Save`.
  * After saving, navigate to `Keys and tokens` on your App page.
    * Scroll to the bottom of the page and copy your **Client ID**.
    * Click the `Regenerate` button next to **Client Secret**.
    * In the confirmation modal, click `Yes, regenerate`.
    * Copy and save your **Client Secret**.


## Enter your X credentials into your Supabase project#

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * In the left sidebar, click the `Authentication` icon (near the top)
  * Click on [`Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **X / Twitter (OAuth 2.0)** from the accordion list to expand and turn **X / Twitter (OAuth 2.0) Enabled** to ON
  * Enter your **X / Twitter (OAuth 2.0) Client ID** and **X / Twitter (OAuth 2.0) Client Secret** saved in the previous step
  * Click `Save`


You can also configure the X / Twitter (OAuth 2.0) auth provider using the Management API:
[code] 
    1
    
    # Get your access token from https://supabase.com/dashboard/account/tokens
    
    2
    
    export SUPABASE_ACCESS_TOKEN="your-access-token"
    
    3
    
    export PROJECT_REF="your-project-ref"
    
    4
    
    5
    
    # Configure X / Twitter (OAuth 2.0) auth provider
    
    6
    
    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    7
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    8
    
      -H "Content-Type: application/json" \
    
    9
    
      -d '{
    
    10
    
        "external_x_enabled": true,
    
    11
    
        "external_x_client_id": "your-x-client-id",
    
    12
    
        "external_x_secret": "your-x-client-secret"
    
    13
    
      }'
[/code]

## Add login code to your client app#

JavaScriptFlutterSwiftKotlin

Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client>) for instructions on creating your Supabase client.

When your user signs in, call [`signInWithOAuth()`](</docs/reference/javascript/auth-signinwithoauth>) with `x` as the `provider`:
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    async function signInWithX() {
    
    7
    
      const { data, error } = await supabase.auth.signInWithOAuth({
    
    8
    
        provider: 'x',
    
    9
    
      })
    
    10
    
    }
[/code]

For a PKCE flow, for example in Server-Side Auth, you need an extra step to handle the code exchange. When calling `signInWithOAuth`, provide a `redirectTo` URL which points to a callback route. This redirect URL should be added to your [redirect allow list](</docs/guides/auth/redirect-urls>).

ClientServer

In the browser, `signInWithOAuth` automatically redirects to the OAuth provider's authentication endpoint, which then redirects to your endpoint.
[code]
    1
    
    import { createClient, type Provider } from '@supabase/supabase-js';
    
    2
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    3
    
    const provider = 'provider' as Provider
    
    4
    
    5
    
    // ---cut---
    
    6
    
    await supabase.auth.signInWithOAuth({
    
    7
    
      provider,
    
    8
    
      options: {
    
    9
    
        redirectTo: `http://example.com/auth/callback`,
    
    10
    
      },
    
    11
    
    })
[/code]

At the callback endpoint, handle the code exchange to save the user session.

Next.jsSvelteKitAstroRemixExpress

Create a new file at `app/auth/callback/route.ts` and populate with the following:

app/auth/callback/route.ts
[code]
    1
    
    import { NextResponse } from 'next/server'
    
    2
    
    3
    
    // The client you created from the Server-Side Auth instructions
    
    4
    
    import { createClient } from '@/utils/supabase/server'
    
    5
    
    6
    
    export async function GET(request: Request) {
    
    7
    
      const { searchParams, origin } = new URL(request.url)
    
    8
    
      const code = searchParams.get('code')
    
    9
    
      // if "next" is in param, use it as the redirect URL
    
    10
    
      let next = searchParams.get('next') ?? '/'
    
    11
    
      if (!next.startsWith('/')) {
    
    12
    
        // if "next" is not a relative URL, use the default
    
    13
    
        next = '/'
    
    14
    
      }
    
    15
    
    16
    
      if (code) {
    
    17
    
        const supabase = await createClient()
    
    18
    
        const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    19
    
        if (!error) {
    
    20
    
          const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
    
    21
    
          const isLocalEnv = process.env.NODE_ENV === 'development'
    
    22
    
          if (isLocalEnv) {
    
    23
    
            // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
    
    24
    
            return NextResponse.redirect(`${origin}${next}`)
    
    25
    
          } else if (forwardedHost) {
    
    26
    
            return NextResponse.redirect(`https://${forwardedHost}${next}`)
    
    27
    
          } else {
    
    28
    
            return NextResponse.redirect(`${origin}${next}`)
    
    29
    
          }
    
    30
    
        }
    
    31
    
      }
    
    32
    
    33
    
      // return the user to an error page with instructions
    
    34
    
      return NextResponse.redirect(`${origin}/auth/auth-code-error`)
    
    35
    
    }
[/code]

JavaScriptFlutterSwiftKotlin

When your user signs out, call [signOut()](</docs/reference/javascript/auth-signout>) to remove them from the browser session and any objects from localStorage:
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    async function signOut() {
    
    7
    
      const { error } = await supabase.auth.signOut()
    
    8
    
    }
[/code]

## Resources#

  * [Supabase - Get started for free](<https://supabase.com>)
  * [Supabase JS Client](<https://github.com/supabase/supabase-js>)
  * [X Developer Dashboard](<https://developer.x.com/en/portal/dashboard>)