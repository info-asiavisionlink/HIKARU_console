---
タイトル: Login with Zoom
URL: https://supabase.com/docs/guides/auth/social-login/auth-zoom
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-zoom, login, social-login, with, zoom
---

# Login with Zoom

**URL:** https://supabase.com/docs/guides/auth/social-login/auth-zoom
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-zoom, login, social-login, with, zoom

## 目次

- [Overview#](#overview)
- [Access your Zoom Developer account#](#access-your-zoom-developer-account)
- [Find your callback URL#](#find-your-callback-url)
- [Create a Zoom OAuth app#](#create-a-zoom-oauth-app)
- [Enter your Zoom credentials into your Supabase project#](#enter-your-zoom-credentials-into-your-supabase-project)
- [Add login code to your client app#](#add-login-code-to-your-client-app)
- [Resources#](#resources)

## 概要

Add Zoom OAuth to your Supabase project

---

To enable Zoom Auth for your project, you need to set up a Zoom OAuth application and add the application credentials to your Supabase Dashboard.

## Overview#

Setting up Zoom logins for your application consists of 3 parts:

  * Create and configure a Zoom OAuth App on [Zoom App Marketplace](<https://marketplace.zoom.us/>)
  * Add your Zoom OAuth keys to your [Supabase Project](</dashboard>)
  * Add the login code to your [Supabase JS Client App](<https://github.com/supabase/supabase-js>)


## Access your Zoom Developer account#

  * Go to [marketplace.zoom.us](<https://marketplace.zoom.us/>).
  * Click on `Sign In` at the top right to log in.


![Zoom Developer Portal.](/docs/img/guides/auth-zoom/zoom-portal.png)

## Find your callback URL#

The next step requires a callback URL, which looks like this: `https://<project-ref>.supabase.co/auth/v1/callback`

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * Click on the `Authentication` icon in the left sidebar
  * Click on [`Sign In / Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **Zoom** from the accordion list to expand and you'll find your **Callback URL** , you can click `Copy` to copy it to the clipboard


#### Local development#

When testing OAuth locally with the Supabase CLI, ensure your OAuth provider is configured with the local Supabase Auth callback URL:

<http://localhost:54321/auth/v1/callback>[](<http://localhost:54321/auth/v1/callback>)

If this callback URL is missing or misconfigured, OAuth sign-in may fail or not redirect correctly during local development.

See the [local development docs](</docs/guides/local-development>) for more details.

For testing OAuth locally with the Supabase CLI see the [local development docs](</docs/guides/local-development>).

## Create a Zoom OAuth app#

  * Go to [marketplace.zoom.us](<https://marketplace.zoom.us/>).
  * Click on `Sign In` at the top right to log in.
  * Click `Build App` (from the dropdown Develop)
  * In the OAuth card, click `Create`
  * Type the name of your app
  * Choose app type
  * Click `Create`


Under `App credentials`

  * Copy and save your `Client ID`.
  * Copy and save your `Client secret`.
  * Add your `Callback URL` in the OAuth allow list.


Under `Redirect URL for OAuth`

  * Paste your `Callback URL`


Under `Scopes`

  * Click on `Add scopes`
  * Click on `User`
  * Choose `user:read`
  * Click `Done`
  * Click `Continue`


## Enter your Zoom credentials into your Supabase project#

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * In the left sidebar, click the `Authentication` icon (near the top)
  * Click on [`Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **Zoom** from the accordion list to expand and turn **Zoom Enabled** to ON
  * Enter your **Zoom Client ID** and **Zoom Client Secret** saved in the previous step
  * Click `Save`


You can also configure the Zoom auth provider using the Management API:
[code] 
    1
    
    # Get your access token from https://supabase.com/dashboard/account/tokens
    
    2
    
    export SUPABASE_ACCESS_TOKEN="your-access-token"
    
    3
    
    export PROJECT_REF="your-project-ref"
    
    4
    
    5
    
    # Configure Zoom auth provider
    
    6
    
    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    7
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    8
    
      -H "Content-Type: application/json" \
    
    9
    
      -d '{
    
    10
    
        "external_zoom_enabled": true,
    
    11
    
        "external_zoom_client_id": "your-zoom-client-id",
    
    12
    
        "external_zoom_secret": "your-zoom-client-secret"
    
    13
    
      }'
[/code]

## Add login code to your client app#

JavaScriptFlutterKotlin

Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client>) for instructions on creating your Supabase client.

When your user signs in, call [`signInWithOAuth()`](</docs/reference/javascript/auth-signinwithoauth>) with `zoom` as the `provider`:
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
    
    async function signInWithZoom() {
    
    7
    
      const { data, error } = await supabase.auth.signInWithOAuth({
    
    8
    
        provider: 'zoom',
    
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

JavaScriptFlutterKotlin

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
  * [Zoom App Marketplace](<https://marketplace.zoom.us/>)