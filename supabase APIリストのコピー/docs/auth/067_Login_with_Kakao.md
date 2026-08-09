---
タイトル: Login with Kakao
URL: https://supabase.com/docs/guides/auth/social-login/auth-kakao
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-kakao, kakao, login, social-login, with
---

# Login with Kakao

**URL:** https://supabase.com/docs/guides/auth/social-login/auth-kakao
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-kakao, kakao, login, social-login, with

## 目次

- [Overview#](#overview)
- [Access your Kakao Developer account#](#access-your-kakao-developer-account)
- [Create and configure your app#](#create-and-configure-your-app)
- [Obtain a REST API key#](#obtain-a-rest-api-key)
- [Find your callback URL#](#find-your-callback-url)
- [Obtain a client secret#](#obtain-a-client-secret)
- [Additional configurations on Kakao Developers portal#](#additional-configurations-on-kakao-developers-portal)
- [Add your OAuth credentials to Supabase#](#add-your-oauth-credentials-to-supabase)
- [Add login code to your client app#](#add-login-code-to-your-client-app)
- [Using Kakao Login JS SDK#](#using-kakao-login-js-sdk)
  - [Configuration#](#configuration)
- [Resources#](#resources)

## 概要

Add Kakao OAuth to your Supabase project

---

To enable Kakao Auth for your project, you need to set up a Kakao OAuth application and add the application credentials to your Supabase Dashboard.

## Overview#

Kakao OAuth consists of six broad steps:

  * Create and configure your app in the [Kakao Developers Portal](<https://developers.kakao.com/changeLang?lang=en>).
  * Obtain a `REST API key` \- this serves as the `client_id`.
  * Obtain a `Kakao Login Client Secret code` \- this serves as the `client_secret`.
  * Configure additional settings in the Kakao Developers Portal.
  * Add your `client id` and `client secret` keys to your [Supabase Project](</dashboard>).
  * Add the login code to your [Supabase JS Client App](<https://github.com/supabase/supabase-js>).


## Access your Kakao Developer account#

  * Go to [Kakao Developers Portal](<https://developers.kakao.com/changeLang?lang=en>).
  * Click on **Login** at the top right to log in.


![Kakao Developers Portal](/docs/img/guides/auth-kakao/kakao-developers-page.png)

## Create and configure your app#

  * Go to **App**.
  * Click on **Create app** at the top.
  * Fill out your app information:
    * App icon.
    * App name.
    * Company name.
    * Category.
    * App primary domain.
  * Click **Save** at the bottom right.


## Obtain a REST API key#

This serves as the `client_id` when you make API calls to authenticate the user.

  * Go to **App**.
  * Click on your app.
  * Go to **App Settings** > **App** > **Platform Key**.
  * In the **Platform Key** section is `REST API key`. This will become your `client_id` later.


## Find your callback URL#

The next step requires a callback URL, which looks like this: `https://<project-ref>.supabase.co/auth/v1/callback`

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * Click on the `Authentication` icon in the left sidebar
  * Click on [`Sign In / Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **Kakao** from the accordion list to expand and you'll find your **Callback URL** , you can click `Copy` to copy it to the clipboard


#### Local development#

When testing OAuth locally with the Supabase CLI, ensure your OAuth provider is configured with the local Supabase Auth callback URL:

<http://localhost:54321/auth/v1/callback>[](<http://localhost:54321/auth/v1/callback>)

If this callback URL is missing or misconfigured, OAuth sign-in may fail or not redirect correctly during local development.

See the [local development docs](</docs/guides/local-development>) for more details.

For testing OAuth locally with the Supabase CLI see the [local development docs](</docs/guides/local-development>).

  * To add a callback URL on Kakao, go to **App Settings** > **App** > **Platform Key**.
  * Click on the REST API key you want to use.
  * In the edit page, enter your callback URL in the **Kakao Login Redirect URI** field.
  * Click **Save** in the bottom right.


## Obtain a client secret#

  * Go to **App Settings** > **App** > **Platform Key**.
  * Click on the REST API key you want to use.
  * Note the **Kakao Login Client Secret code**. This serves as a `client_secret` for your Supabase project.
  * Make sure you activate **Kakao Login Client Secret**.


## Additional configurations on Kakao Developers portal#

  * Go to **Product Settings** > **Kakao Login** > **General**.
  * Set **State** to "ON" in the **Usage settings** section to enable Kakao Login.
  * Go to **Product Settings** > **Kakao Login** > **Consent Items**.
  * Set the following scopes under the **Consent Items** :
    * account_email (optional)
    * profile_image
    * profile_nickname


If you don't need an email address (or `account_email` isn't available for your app), you can omit `account_email` and enable **Allow users without an email** in the Supabase Kakao provider settings.

![Kakao consent items configuration](/docs/img/guides/auth-kakao/kakao-developers-consent-items-set.png)

In the Kakao Developers Portal, the "account_email" consent item is only available for apps that are registered as "Biz App". To convert your app to a "Biz App", go to **App Settings** > **App** > **General** , and complete the required fields in the **Business Information** section.

## Add your OAuth credentials to Supabase#

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * In the left sidebar, click the `Authentication` icon (near the top)
  * Click on [`Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **Kakao** from the accordion list to expand and turn **Kakao Enabled** to ON
  * Enter your **Kakao Client ID** and **Kakao Client Secret** saved in the previous step
  * Click `Save`


If you did not request `account_email` in Kakao, enable **Allow users without an email** in the Kakao provider settings.

## Add login code to your client app#

JavaScriptFlutterKotlin

Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client>) for instructions on creating your Supabase client.

When your user signs in, call [`signInWithOAuth()`](</docs/reference/javascript/auth-signinwithoauth>) with `kakao` as the `provider`:
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
    
    async function signInWithKakao() {
    
    7
    
      const { data, error } = await supabase.auth.signInWithOAuth({
    
    8
    
        provider: 'kakao',
    
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
    
    async function signOut() {
    
    2
    
      const { error } = await supabase.auth.signOut()
    
    3
    
    }
[/code]

## Using Kakao Login JS SDK#

[Kakao Login JS SDK](<https://developers.kakao.com/docs/latest/en/kakaologin/js>) is an official Kakao SDK for authenticating Kakao users on websites.

Exchange the [authorization code returned by Kakao API](<https://developers.kakao.com/docs/latest/en/kakaologin/rest-api#request-code>) for an [ID Token](<https://developers.kakao.com/docs/latest/en/kakaologin/common#login-with-oidc>).

For example, this code shows a how to get ID Token:
[code] 
    1
    
    const requestUrl = new URL(request.url);
    
    2
    
    const code = requestUrl.searchParams.get('code');
    
    3
    
    4
    
    if (code) {
    
    5
    
      const res = await fetch('https://kauth.kakao.com/oauth/token', {
    
    6
    
        method: 'POST',
    
    7
    
        headers: {
    
    8
    
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    
    9
    
        },
    
    10
    
        body: new URLSearchParams({
    
    11
    
          grant_type: 'authorization_code',
    
    12
    
          client_id: '<CLIENT_ID>',
    
    13
    
          redirect_uri: '<url>/api/auth/kakao/oidc',
    
    14
    
          code,
    
    15
    
          client_secret: '<CLIENT_SECRET>',
    
    16
    
        }),
    
    17
    
      });
    
    18
    
    19
    
      const {id_token} = await res.json();
    
    20
    
    }
[/code]

Use the ID Token to sign in:
[code] 
    1
    
    const res = await auth.signInWithIdToken({
    
    2
    
      provider: 'kakao',
    
    3
    
      token: id_token,
    
    4
    
    });
[/code]

### Configuration#

  1. Set **State** to "ON" under [OpenID Connect Activation](<https://developers.kakao.com/docs/latest/en/kakaologin/prerequisite#kakao-login-oidc>) on the Kakao Developers portal.
  2. Add `openid` to [scope](<https://developers.kakao.com/docs/latest/en/kakaologin/prerequisite#scope>) along with the scope values you wish to obtain consent for.


## Resources#

  * [Kakao Developers Portal](<https://developers.kakao.com/changeLang?lang=en>).