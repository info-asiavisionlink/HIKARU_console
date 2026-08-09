---
タイトル: Login with Google
URL: https://supabase.com/docs/guides/auth/social-login/auth-google
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-google, google, login, social-login, with
---

# Login with Google

**URL:** https://supabase.com/docs/guides/auth/social-login/auth-google
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-google, google, login, social-login, with

## 目次

- [Prerequisites#](#prerequisites)
  - [Setup required scopes#](#setup-required-scopes)
  - [Setup consent screen branding#](#setup-consent-screen-branding)
- [Project setup#](#project-setup)
  - [Local development#](#local-development)
  - [Using the management API#](#using-the-management-api)
- [Signing users in#](#signing-users-in)
  - [Application code#](#application-code)
  - [Saving Google tokens#](#saving-google-tokens)
  - [Google pre-built#](#google-pre-built)
  - [One-tap with Next.js#](#one-tap-with-nextjs)

## 概要

Use Sign in with Google on the web, in native apps or with Chrome extensions

---

Supabase Auth supports [Sign in with Google for the web](<https://developers.google.com/identity/gsi/web/guides/overview>), native applications ([Android](<https://developer.android.com/identity/sign-in/credential-manager-siwg>), [macOS and iOS](<https://developers.google.com/identity/sign-in/ios/start-integrating>)), and [Chrome extensions](<https://cloud.google.com/identity-platform/docs/web/chrome-extension>).

You can use Sign in with Google in two ways:

  * By writing application code for the web, native applications or Chrome extensions
  * By using Google's pre-built solutions such as [personalized sign-in buttons](<https://developers.google.com/identity/gsi/web/guides/personalized-button>), [One Tap](<https://developers.google.com/identity/gsi/web/guides/features>) or [automatic sign-in](<https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out>)


## Prerequisites#

You need to do some setup to get started with Sign in with Google:

  * Prepare a Google Cloud project. Go to the [Google Cloud Platform](<https://console.cloud.google.com/home/dashboard>) and create a new project if necessary.
  * Use the [Google Auth Platform console](<https://console.cloud.google.com/auth/overview>) to register and set up your application's:
    * [**Audience**](<https://console.cloud.google.com/auth/audience>) by configuring which Google users are allowed to sign in to your application.
    * [**Data Access (Scopes)**](<https://console.cloud.google.com/auth/scopes>) define what your application can do with your user's Google data and APIs, such as access profile information or more.
    * [**Branding**](<https://console.cloud.google.com/auth/branding>) and [**Verification**](<https://console.cloud.google.com/auth/verification>) show a logo and name instead of the Supabase project ID in the consent screen, improving user retention. Brand verification may take a few business days.


### Setup required scopes#

Supabase Auth needs a few scopes granting access to profile data of your end users, which you have to configure in the [**Data Access (Scopes)**](<https://console.cloud.google.com/auth/scopes>) screen:

  * `openid` (add manually)
  * `.../auth/userinfo.email` (added by default)
  * `.../auth/userinfo.profile` (added by default)


If you add more scopes, especially those on the sensitive or restricted list your application might be subject to verification which may take a long time.

### Setup consent screen branding#

It's strongly recommended you set up a custom domain and optionally verify your brand information with Google, as this makes phishing attempts easier to spot by your users.

Google's consent screen is shown to users when they sign in. Optionally configure one of the following to improve the appearance of the screen, increasing the perception of trust by your users:

  1. Verify your application's brand (logo and name) by configuring it in the [Branding](<https://console.cloud.google.com/auth/branding>) section of the Google Auth Platform console. Brand verification is not automatic and may take a few business days.
  2. Set up a [custom domain for your project](</docs/guides/platform/custom-domains>) to present the user with a clear relationship to the website they clicked Sign in with Google on.
     * A good approach is to use `auth.example.com` or `api.example.com`, if your application is hosted on `example.com`.
     * If you don't set this up, users will see `<project-id>.supabase.co` which does not inspire trust and can make your application more susceptible to successful phishing attempts.


## Project setup#

To support Sign In with Google, you need to configure the Google provider for your Supabase project.

WebExpo React NativeFlutter (iOS and Android)Flutter (web, macOS, Windows, Linux)SwiftKotlin (Android and iOS)Chrome Extensions

Regardless of whether you use application code or Google's pre-built solutions to implement the sign in flow, you need to configure your project by obtaining a Client ID and Client Secret in the [Clients](<https://console.cloud.google.com/auth/clients>) section of the Google Auth Platform console:

  1. [Create a new OAuth client ID](<https://console.cloud.google.com/auth/clients/create>) and choose **Web application** for the application type.
  2. Under **Authorized JavaScript origins** add your application's URL. These should also be configured as the [Site URL or redirect configuration in your project](</docs/guides/auth/redirect-urls>).
     * If your app is hosted on `https://example.com/app` add `https://example.com`.
     * Add `http://localhost:<port>` while developing locally. Remember to remove this when your application [goes into production](</docs/guides/deployment/going-into-prod>).
  3. Under **Authorized redirect URIs** add your Supabase project's callback URL.
     * Access it from the [Google provider page on the Dashboard](</dashboard/project/_/auth/providers?provider=Google>).
     * For local development, use `http://127.0.0.1:54321/auth/v1/callback`.
  4. Click `Create` and make sure you save the Client ID and Client Secret.
     * Add these values to the [Google provider page on the Dashboard](</dashboard/project/_/auth/providers?provider=Google>).


### Local development#

To use the Google provider in local development:

  1. Add a new environment variable:
[code] 1
         
         SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="<client-secret>"
[/code]

  2. Configure the provider in `supabase/config.toml`:
[code] 1
         
         [auth.external.google]
         
         2
         
         enabled = true
         
         3
         
         client_id = "<client-id>"
         
         4
         
         secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
         
         5
         
         skip_nonce_check = false
[/code]


If you have multiple client IDs, such as one for Web, iOS and Android, concatenate all of the client IDs with a comma but make sure the web's client ID is first in the list.

### Using the management API#

Use the [PATCH `/v1/projects/{ref}/config/auth` Management API endpoint](</docs/reference/api/v1-update-auth-service-config>) to configure the project's Auth settings programmatically. For configuring the Google provider send these options:
[code] 
    1
    
    {
    
    2
    
      "external_google_enabled": true,
    
    3
    
      "external_google_client_id": "your-google-client-id",
    
    4
    
      "external_google_secret": "your-google-client-secret"
    
    5
    
    }
[/code]

## Signing users in#

WebExpo React NativeFlutter (iOS and Android)Flutter (web, macOS, Windows, Linux)Kotlin (Android)Kotlin (Multiplatform)Chrome Extensions

### Application code#

To use your own application code for the signin button, call the `signInWithOAuth` method (or the equivalent for your language).

Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client>) for instructions on creating your Supabase client.
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
    
    supabase.auth.signInWithOAuth({
    
    7
    
      provider: 'google',
    
    8
    
    })
[/code]

For an implicit flow, that's all you need to do. The user will be taken to Google's consent screen, and finally redirected to your app with an access and refresh token pair representing their session.

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

After a successful code exchange, the user's session will be saved to cookies.

### Saving Google tokens#

The tokens saved by your application are the Supabase Auth tokens. Your app might additionally need the Google OAuth 2.0 tokens to access Google services on the user's behalf.

On initial login, you can extract the `provider_token` from the session and store it in a secure storage medium. The session is available in the returned data from `signInWithOAuth` (implicit flow) and `exchangeCodeForSession` (PKCE flow).

Google does not send out a refresh token by default, so you will need to pass parameters like these to `signInWithOAuth()` in order to extract the `provider_refresh_token`:
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
    
    const { data, error } = await supabase.auth.signInWithOAuth({
    
    7
    
      provider: 'google',
    
    8
    
      options: {
    
    9
    
        queryParams: {
    
    10
    
          access_type: 'offline',
    
    11
    
          prompt: 'consent',
    
    12
    
        },
    
    13
    
      },
    
    14
    
    })
[/code]

### Google pre-built #

Most web apps and websites can use Google's [personalized sign-in buttons](<https://developers.google.com/identity/gsi/web/guides/personalized-button>), [One Tap](<https://developers.google.com/identity/gsi/web/guides/features>) or [automatic sign-in](<https://developers.google.com/identity/gsi/web/guides/automatic-sign-in-sign-out>) for the best user experience.

  1. Load the Google client library in your app by including the third-party script:
[code] 1
         
         <script src="https://accounts.google.com/gsi/client" async></script>
[/code]

  2. Use the [HTML Code Generator](<https://developers.google.com/identity/gsi/web/tools/configurator>) to customize the look, feel, features and behavior of the Sign in with Google button.

  3. Pick the _Swap to JavaScript callback_ option, and input the name of your callback function. This function will receive a [`CredentialResponse`](<https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse>) when sign in completes.

To make your app compatible with Chrome's third-party-cookie phase-out, make sure to set `data-use_fedcm_for_prompt` to `true`.

Your final HTML code might look something like this:
[code] 1
         
         <div
         
         2
         
           id="g_id_onload"
         
         3
         
           data-client_id="<client ID>"
         
         4
         
           data-context="signin"
         
         5
         
           data-ux_mode="popup"
         
         6
         
           data-callback="handleSignInWithGoogle"
         
         7
         
           data-nonce=""
         
         8
         
           data-auto_select="true"
         
         9
         
           data-itp_support="true"
         
         10
         
           data-use_fedcm_for_prompt="true"
         
         11
         
         ></div>
         
         12
         
         13
         
         <div
         
         14
         
           class="g_id_signin"
         
         15
         
           data-type="standard"
         
         16
         
           data-shape="pill"
         
         17
         
           data-theme="outline"
         
         18
         
           data-text="signin_with"
         
         19
         
           data-size="large"
         
         20
         
           data-logo_alignment="left"
         
         21
         
         ></div>
[/code]

  4. Create a `handleSignInWithGoogle` function that takes the `CredentialResponse` and passes the included token to Supabase. The function needs to be available in the global scope for Google's code to find it.
[code] 1
         
         async function handleSignInWithGoogle(response) {
         
         2
         
           const { data, error } = await supabase.auth.signInWithIdToken({
         
         3
         
             provider: 'google',
         
         4
         
             token: response.credential,
         
         5
         
           })
         
         6
         
         }
[/code]

  5. _(Optional)_ Configure a nonce. The use of a nonce is recommended for extra security, but optional. The nonce should be generated randomly each time, and it must be provided in both the `data-nonce` attribute of the HTML code and the options of the callback function.
[code] 1
         
         async function handleSignInWithGoogle(response) {
         
         2
         
           const { data, error } = await supabase.auth.signInWithIdToken({
         
         3
         
             provider: 'google',
         
         4
         
             token: response.credential,
         
         5
         
             nonce: '<NONCE>',
         
         6
         
           })
         
         7
         
         }
[/code]

Note that the nonce should be the same in both places, but because Supabase Auth expects the provider to hash it (SHA-256, hexadecimal representation), you need to provide a hashed version to Google and a non-hashed version to `signInWithIdToken`.

You can get both versions by using the in-built `crypto` library:
[code] 1
         
         // Adapted from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
         
         2
         
         3
         
         const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
         
         4
         
         const encoder = new TextEncoder()
         
         5
         
         const encodedNonce = encoder.encode(nonce)
         
         6
         
         crypto.subtle.digest('SHA-256', encodedNonce).then((hashBuffer) => {
         
         7
         
           const hashArray = Array.from(new Uint8Array(hashBuffer))
         
         8
         
           const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
         
         9
         
         })
         
         10
         
         11
         
         // Use 'hashedNonce' when making the authentication request to Google
         
         12
         
         // Use 'nonce' when invoking the supabase.auth.signInWithIdToken() method
[/code]


### One-tap with Next.js#

If you're integrating Google One-Tap with your Next.js application, you can refer to the example below to get started:
[code]
    1
    
    'use client'
    
    2
    
    3
    
    import type { accounts, CredentialResponse } from 'google-one-tap'
    
    4
    
    import { useRouter } from 'next/navigation'
    
    5
    
    import Script from 'next/script'
    
    6
    
    7
    
    import { createClient } from '@/utils/supabase/client'
    
    8
    
    9
    
    declare const google: { accounts: accounts }
    
    10
    
    11
    
    // generate nonce to use for google id token sign-in
    
    12
    
    const generateNonce = async (): Promise<string[]> => {
    
    13
    
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    
    14
    
      const encoder = new TextEncoder()
    
    15
    
      const encodedNonce = encoder.encode(nonce)
    
    16
    
      const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce)
    
    17
    
      const hashArray = Array.from(new Uint8Array(hashBuffer))
    
    18
    
      const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    
    19
    
    20
    
      return [nonce, hashedNonce]
    
    21
    
    }
    
    22
    
    23
    
    const OneTapComponent = () => {
    
    24
    
      const supabase = createClient()
    
    25
    
      const router = useRouter()
    
    26
    
    27
    
      const initializeGoogleOneTap = async () => {
    
    28
    
        console.log('Initializing Google One Tap')
    
    29
    
        const [nonce, hashedNonce] = await generateNonce()
    
    30
    
        console.log('Nonce: ', nonce, hashedNonce)
    
    31
    
    32
    
        // check if there's already an existing session before initializing the one-tap UI
    
    33
    
        const {
    
    34
    
          data: { claims },
    
    35
    
          error,
    
    36
    
        } = await supabase.auth.getClaims()
    
    37
    
        if (error) {
    
    38
    
          console.error('Error getting claims', error)
    
    39
    
        }
    
    40
    
        if (claims) {
    
    41
    
          router.push('/')
    
    42
    
          return
    
    43
    
        }
    
    44
    
    45
    
        /* global google */
    
    46
    
        google.accounts.id.initialize({
    
    47
    
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    
    48
    
          callback: async (response: CredentialResponse) => {
    
    49
    
            try {
    
    50
    
              // send id token returned in response.credential to supabase
    
    51
    
              const { data, error } = await supabase.auth.signInWithIdToken({
    
    52
    
                provider: 'google',
    
    53
    
                token: response.credential,
    
    54
    
                nonce,
    
    55
    
              })
    
    56
    
    57
    
              if (error) throw error
    
    58
    
              console.log('Session data: ', data)
    
    59
    
              console.log('Successfully logged in with Google One Tap')
    
    60
    
    61
    
              // redirect to protected page
    
    62
    
              router.push('/')
    
    63
    
            } catch (error) {
    
    64
    
              console.error('Error logging in with Google One Tap', error)
    
    65
    
            }
    
    66
    
          },
    
    67
    
          nonce: hashedNonce,
    
    68
    
          // with chrome's removal of third-party cookies, we need to use FedCM instead (https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
    
    69
    
          use_fedcm_for_prompt: true,
    
    70
    
        })
    
    71
    
        google.accounts.id.prompt() // Display the One Tap UI
    
    72
    
      }
    
    73
    
    74
    
      return <Script onReady={initializeGoogleOneTap} src="https://accounts.google.com/gsi/client" />
    
    75
    
    }
    
    76
    
    77
    
    export default OneTapComponent
[/code]