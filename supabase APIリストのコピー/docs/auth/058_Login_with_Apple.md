---
タイトル: Login with Apple
URL: https://supabase.com/docs/guides/auth/social-login/auth-apple
カテゴリ: auth
更新日: 2026-08-02
タグ: apple, auth, auth-apple, login, social-login, with
---

# Login with Apple

**URL:** https://supabase.com/docs/guides/auth/social-login/auth-apple
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** apple, auth, auth-apple, login, social-login, with

## 目次

- [Overview#](#overview)
- [Using the OAuth flow for web#](#using-the-oauth-flow-for-web)
  - [Configuration#](#configuration-web-oauth)
- [Using sign in with Apple JS#](#using-sign-in-with-apple-js)
  - [Configuration#](#configuration-web-apple-js)

## 概要

Use Sign in with Apple with Supabase

---

Supabase Auth supports using [Sign in with Apple](<https://developer.apple.com/sign-in-with-apple/>) on the web and in native apps for iOS, macOS, watchOS or tvOS.

## Overview#

To support Sign in with Apple, you need to configure the [Apple provider in the Supabase dashboard](</dashboard/project/_/auth/providers>) for your project.

There are three general ways to use Sign in with Apple, depending on the application you're trying to build:

  * Sign in on the web or in web-based apps
    * Using an OAuth flow initiated by Supabase Auth using the [Sign in with Apple REST API](<https://developer.apple.com/documentation/signinwithapplerestapi>).
    * Using [Sign in with Apple JS](<https://developer.apple.com/documentation/signinwithapplejs/>) directly in the browser, usually suitable for websites.
  * Sign in natively inside iOS, macOS, watchOS or tvOS apps using [Apple's Authentication Services](<https://developer.apple.com/documentation/authenticationservices>)


In some cases you're able to use the OAuth flow within web-based native apps such as with [React Native](<https://reactnative.dev>), [Expo](<https://expo.dev>) or other similar frameworks. It is best practice to use native Sign in with Apple capabilities on those platforms instead.

When developing with Expo, you can test Sign in with Apple via the Expo Go app, in all other cases you will need to obtain an [Apple Developer](<https://developer.apple.com>) account to enable the capability.

Secret Key Rotation Required

If you're using the OAuth flow (web, Flutter web, Kotlin non-iOS platforms), Apple requires you to generate a new secret key every 6 months using the signing key (`.p8` file). This is a critical maintenance task that will cause authentication failures if missed.

  * Set a recurring calendar reminder for every 6 months to rotate your secret key
  * Store the `.p8` file securely - you'll need it for each rotation
  * If you lose the `.p8` file or it's compromised, immediately revoke it in the Apple Developer Console and create a new one
  * Consider automating this process if possible to prevent service disruptions


This requirement only applies if you're configuring OAuth settings (Services ID, signing key, etc.). Native-only implementations don't require secret key rotation.

Apple Does Not Provide Full Name in Identity Token

Apple's identity token does not include the user's full name in its claims. This means the Supabase Auth server cannot automatically populate the user's name metadata when users sign in with Apple.

  * Apple only provides the user's full name during the **first sign-in attempt** (when the user initially authorizes your app)
  * All subsequent sign-ins return `null` for the full name fields
  * The full name must be captured from Apple's native authentication response and manually saved using the `updateUser` method


**Recommended Approach:** After a successful Sign in with Apple, check if the full name is available in the authentication response, and if so, use the `updateUser` method to save it to the user's metadata:
[code]
    1
    
    // Example: Handling full name after successful sign in
    
    2
    
    if (credential.fullName) {
    
    3
    
      // Full name is only provided on first sign-in
    
    4
    
      await supabase.auth.updateUser({
    
    5
    
        data: {
    
    6
    
          full_name: `${credential.fullName.givenName} ${credential.fullName.familyName}`,
    
    7
    
          given_name: credential.fullName.givenName,
    
    8
    
          family_name: credential.fullName.familyName,
    
    9
    
        },
    
    10
    
      })
    
    11
    
    }
[/code]

If a user revokes your app's access and then re-authorizes it, Apple will provide the full name again as if it were a first sign-in.

The platform-specific examples below demonstrate how to implement this pattern for each SDK.

WebExpo React NativeFlutterSwiftKotlin

## Using the OAuth flow for web#

Sign in with Apple's OAuth flow is designed for web or browser based sign in methods. It can be used on web-based apps as well as websites, though some users can benefit by using Sign in with Apple JS directly.

Behind the scenes, Supabase Auth uses the [REST APIs](<https://developer.apple.com/documentation/signinwithapplerestapi>) provided by Apple.

Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client>) for instructions on creating your Supabase client.

To initiate sign in, you can use the `signInWithOAuth()` method from the Supabase JavaScript library:
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    3
    
    4
    
    // ---cut---
    
    5
    
    supabase.auth.signInWithOAuth({
    
    6
    
      provider: 'apple',
    
    7
    
    })
[/code]

This call takes the user to Apple's consent screen. Once the flow ends, the user's profile information is exchanged and validated with Supabase Auth before it redirects back to your web application with an access and refresh token representing the user's session.

Full Name Not Available in OAuth Flow

When using the OAuth flow, the user's full name is not accessible from Apple's response. Apple only provides the full name through native authentication methods (Sign in with Apple JS, or native iOS/macOS SDKs) during the first sign-in.

If you need to collect user names, consider:

  * Using Sign in with Apple JS instead (see below)
  * Collecting the name through a separate onboarding form
  * Using a profiles table to store user information


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

### Configuration #

You will require the following information:

  1. Your Apple Developer account's **Team ID** , which is an alphanumeric string of 10 characters that uniquely identifies the developer of the app. It's often accessible in the upper right-side menu on the Apple Developer Console.
  2. Register email sources for _Sign in with Apple for Email Communication_ which can be found in the [Services](<https://developer.apple.com/account/resources/services/list>) section of the Apple Developer Console. This enables Apple to send relay emails through your domain when users choose to hide their email addresses.
  3. An **App ID** which uniquely identifies the app you are building. You can create a new App ID from the [Identifiers](<https://developer.apple.com/account/resources/identifiers/list/bundleId>) section in the Apple Developer Console (use the filter menu in the upper right side to see all App IDs). These usually are a reverse domain name string, for example `com.example.app`. Make sure you configure Sign in with Apple once you create an App ID in the Capabilities list. At this time Supabase Auth does not support Server-to-Server notification endpoints, so you should leave that setting blank. (In the past App IDs were referred to as _bundle IDs._)
  4. A **Services ID** which uniquely identifies the web services provided by the app you registered in the previous step. You can create a new Services ID from the [Identifiers](<https://developer.apple.com/account/resources/identifiers/list/serviceId>) section in the Apple Developer Console (use the filter menu in the upper right side to see all Services IDs). These usually are a reverse domain name string, for example `com.example.app.web`.
  5. Configure Website URLs for the newly created **Services ID**. The web domain you should use is the domain your Supabase project is hosted on. This is usually `<project-id>.supabase.co` while the redirect URL is `https://<project-id>.supabase.co/auth/v1/callback`.
  6. Create a signing **Key** in the [Keys](<https://developer.apple.com/account/resources/authkeys/list>) section of the Apple Developer Console. You can use this key to generate a secret key using the tool below, which is added to your Supabase project's Auth configuration. Make sure you safely store the `AuthKey_XXXXXXXXXX.p8` file. If you ever lose access to it, or make it public accidentally, revoke it from the Apple Developer Console and create a new one immediately.
  7. Finally, add the information you configured above to the [Apple provider configuration in the Supabase dashboard](</dashboard/project/_/auth/providers>). If your project also uses native Sign in with Apple (for example on iOS, Expo, or Flutter), list this Services ID as the **first** entry in the _Client IDs_ field. Supabase uses the first client ID in the list for the web `signInWithOAuth` flow, while the native `signInWithIdToken` flow accepts any client ID in the list as a valid token audience, regardless of order. If a native App ID comes before the Services ID, native sign-in keeps working but web sign-in is rejected by Apple.


You can also configure the Apple auth provider using the Management API:
[code]
    1
    
    # Get your access token from https://supabase.com/dashboard/account/tokens
    
    2
    
    export SUPABASE_ACCESS_TOKEN="your-access-token"
    
    3
    
    export PROJECT_REF="your-project-ref"
    
    4
    
    5
    
    # Configure Apple auth provider
    
    6
    
    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    7
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    8
    
      -H "Content-Type: application/json" \
    
    9
    
      -d '{
    
    10
    
        "external_apple_enabled": true,
    
    11
    
        "external_apple_client_id": "your-services-id",
    
    12
    
        "external_apple_secret": "your-generated-secret-key"
    
    13
    
      }'
[/code]

Use this tool to generate a new Apple client secret. No keys leave your browser! Be aware that this tool does not currently work in Safari, so use Firefox or a Chrome-based browser instead.

## Using sign in with Apple JS#

[Sign in with Apple JS](<https://developer.apple.com/documentation/signinwithapplejs/>) is an official Apple framework for authenticating Apple users on websites. Although it can be used in web-based apps, those use cases will benefit more with the OAuth flow described above. We recommend using this method on classic websites only.

You can use the `signInWithIdToken()` method from the Supabase JavaScript library on the website to obtain an access and refresh token once the user has given consent using Sign in with Apple JS:
[code]
    1
    
    async function signIn() {
    
    2
    
      try {
    
    3
    
        // Generate a nonce for security
    
    4
    
        const nonce = crypto.randomUUID() // or use your preferred nonce generation method
    
    5
    
    6
    
        const data = await AppleID.auth.signIn()
    
    7
    
    8
    
        const { data: authData, error } = await supabase.auth.signInWithIdToken({
    
    9
    
          provider: 'apple',
    
    10
    
          token: data.id_token,
    
    11
    
          nonce: nonce,
    
    12
    
        })
    
    13
    
    14
    
        if (error) {
    
    15
    
          throw error
    
    16
    
        }
    
    17
    
    18
    
        // Apple only provides the user's name on the first sign-in
    
    19
    
        // The user object contains name information from Apple's response
    
    20
    
        if (data.user && data.user.name) {
    
    21
    
          const fullName = [
    
    22
    
            data.user.name.firstName,
    
    23
    
            data.user.name.middleName,
    
    24
    
            data.user.name.lastName
    
    25
    
          ].filter(Boolean).join(' ')
    
    26
    
    27
    
          // Save the name to user metadata for future use
    
    28
    
          await supabase.auth.updateUser({
    
    29
    
            data: {
    
    30
    
              full_name: fullName,
    
    31
    
              given_name: data.user.name.firstName,
    
    32
    
              family_name: data.user.name.lastName,
    
    33
    
            }
    
    34
    
          })
    
    35
    
        }
    
    36
    
      } catch (error) {
    
    37
    
        console.error('Apple sign in failed:', error)
    
    38
    
        // Handle sign-in errors appropriately
    
    39
    
      }
    
    40
    
    }
[/code]

Alternatively, you can use the `AppleIDSignInOnSuccess` event with the `usePopup` option:
[code]
    1
    
    // Generate and store nonce for verification
    
    2
    
    const nonce = crypto.randomUUID()
    
    3
    
    4
    
    // Initialize Apple ID with nonce
    
    5
    
    AppleID.auth.init({
    
    6
    
      clientId: 'your-services-id',
    
    7
    
      scope: 'name email',
    
    8
    
      redirectURI: 'https://your-domain.com/auth/callback',
    
    9
    
      usePopup: true,
    
    10
    
      nonce: nonce,
    
    11
    
    })
    
    12
    
    13
    
    // Listen for authorization success
    
    14
    
    document.addEventListener('AppleIDSignInOnSuccess', async (event) => {
    
    15
    
      try {
    
    16
    
        const { data: authData, error } = await supabase.auth.signInWithIdToken({
    
    17
    
          provider: 'apple',
    
    18
    
          token: event.detail.authorization.id_token,
    
    19
    
          nonce: nonce,
    
    20
    
        })
    
    21
    
    22
    
        if (error) {
    
    23
    
          throw error
    
    24
    
        }
    
    25
    
    26
    
        // Apple only provides the user's name on the first sign-in
    
    27
    
        if (event.detail.user && event.detail.user.name) {
    
    28
    
          const fullName = [
    
    29
    
            event.detail.user.name.firstName,
    
    30
    
            event.detail.user.name.middleName,
    
    31
    
            event.detail.user.name.lastName
    
    32
    
          ].filter(Boolean).join(' ')
    
    33
    
    34
    
          // Save the name to user metadata for future use
    
    35
    
          await supabase.auth.updateUser({
    
    36
    
            data: {
    
    37
    
              full_name: fullName,
    
    38
    
              given_name: event.detail.user.name.firstName,
    
    39
    
              family_name: event.detail.user.name.lastName,
    
    40
    
            }
    
    41
    
          })
    
    42
    
        }
    
    43
    
      } catch (error) {
    
    44
    
        console.error('Apple sign in failed:', error)
    
    45
    
      }
    
    46
    
    })
[/code]

Make sure you request the scope `name email` when initializing the library, as shown in the example above.

### Configuration #

To use Sign in with Apple JS you need to configure these options:

  1. Have an **App ID** which uniquely identifies the app you are building. You can create a new App ID from the [Identifiers](<https://developer.apple.com/account/resources/identifiers/list/bundleId>) section in the Apple Developer Console (use the filter menu in the upper right side to see all App IDs). These usually are a reverse domain name string, for example `com.example.app`. Make sure you configure Sign in with Apple for the App ID you created or already have, in the Capabilities list. At this time Supabase Auth does not support Server-to-Server notification endpoints, so you should leave that setting blank. (In the past App IDs were referred to as _bundle IDs._)
  2. Obtain a **Services ID** attached to the App ID that uniquely identifies the website. Use this value as the client ID when initializing Sign in with Apple JS. You can create a new Services ID from the [Identifiers](<https://developer.apple.com/account/resources/identifiers/list/serviceId>) section in the Apple Developer Console (use the filter menu in the upper right side to see all Services IDs). These usually are a reverse domain name string, for example `com.example.app.website`.
  3. Configure Website URLs for the newly created **Services ID**. The web domain you should use is the domain your website is hosted on. The redirect URL must also point to a page on your website that will receive the callback from Apple.
  4. Register the Services ID you created to your project's [Apple provider configuration in the Supabase dashboard](</dashboard/project/_/auth/providers>) under _Client IDs_.


If you're using Sign in with Apple JS you do not need to configure the OAuth settings.