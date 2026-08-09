---
タイトル: Login with Facebook
URL: https://supabase.com/docs/guides/auth/social-login/auth-facebook
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-facebook, facebook, login, social-login, with
---

# Login with Facebook

**URL:** https://supabase.com/docs/guides/auth/social-login/auth-facebook
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-facebook, facebook, login, social-login, with

## 目次

- [Overview#](#overview)
- [Access your Facebook Developer account#](#access-your-facebook-developer-account)
- [Create a Facebook app#](#create-a-facebook-app)
- [Set up Facebook login for your Facebook app#](#set-up-facebook-login-for-your-facebook-app)
- [Configure email permissions (required)#](#configure-email-permissions-required)
- [Copy your Facebook app ID and secret#](#copy-your-facebook-app-id-and-secret)
- [Enter your Facebook app ID and secret into your Supabase project#](#enter-your-facebook-app-id-and-secret-into-your-supabase-project)
- [Add login code to your client app#](#add-login-code-to-your-client-app)
- [Testing your integration#](#testing-your-integration)
- [Going live with app review#](#going-live-with-app-review)
- [Troubleshooting#](#troubleshooting)
  - ["App not setup" error#](#app-not-setup-error)
  - [User's email not returned#](#users-email-not-returned)
  - ["Redirect URI mismatch" error#](#redirect-uri-mismatch-error)
  - [Login works in development but not production#](#login-works-in-development-but-not-production)
- [Resources#](#resources)

## 概要

Add Facebook OAuth to your Supabase project

---

To enable Facebook Auth for your project, you need to set up a Facebook OAuth application and add the application credentials to your Supabase Dashboard.

## Overview#

Setting up Facebook logins for your application consists of 4 parts:

  * Create and configure a Facebook Application on the [Facebook Developers Site](<https://developers.facebook.com>)
  * **Configure email permissions** in your Facebook app (required for Supabase Auth)
  * Add your Facebook keys to your [Supabase Project](</dashboard>)
  * Add the login code to your [Supabase JS Client App](<https://github.com/supabase/supabase-js>)


## Access your Facebook Developer account#

  * Go to [developers.facebook.com](<https://developers.facebook.com>).
  * Click on `Log In` at the top right to log in.


![Facebook Developer Portal.](/docs/img/guides/auth-facebook/facebook-portal.png)

## Create a Facebook app#

  * Click on `My Apps` at the top right.
  * Click `Create App` near the top right.
  * Select your app type and click `Continue`.
  * Fill in your app information, then click `Create App`.
  * This should bring you to the screen: `Add Products to Your App`. (Alternatively you can click on `Add Product` in the left sidebar to get to this screen.)


The next step requires a callback URL, which looks like this: `https://<project-ref>.supabase.co/auth/v1/callback`

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * Click on the `Authentication` icon in the left sidebar
  * Click on [`Sign In / Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **Facebook** from the accordion list to expand and you'll find your **Callback URL** , you can click `Copy` to copy it to the clipboard


#### Local development#

When testing OAuth locally with the Supabase CLI, ensure your OAuth provider is configured with the local Supabase Auth callback URL:

<http://localhost:54321/auth/v1/callback>[](<http://localhost:54321/auth/v1/callback>)

If this callback URL is missing or misconfigured, OAuth sign-in may fail or not redirect correctly during local development.

See the [local development docs](</docs/guides/local-development>) for more details.

For testing OAuth locally with the Supabase CLI see the [local development docs](</docs/guides/local-development>).

## Set up Facebook login for your Facebook app#

From the `Add Products to your App` screen:

  * Click **Setup** under **Facebook Login**
  * Skip the Quickstart screen. Instead, in the left sidebar, click **Settings** under **Facebook Login**
  * Enter your callback URI under **Valid OAuth Redirect URIs** on the **Facebook Login Settings** page
  * Click **Save Changes** at the bottom right


Your callback URI follows this pattern: `https://<project-ref>.supabase.co/auth/v1/callback`

You can find your project's callback URI in the [Supabase Dashboard](</dashboard/project/_/auth/providers>) under **Authentication > Providers > Facebook**.

## Configure email permissions (required)#

This step is **required** for Supabase Auth to work correctly. Without email permissions, Facebook will not return the user's email address, which may cause authentication failures or incomplete user profiles.

You must configure the email permission in your Facebook app's Use Cases:

  1. In your Facebook app dashboard, click **Use Cases** under `Build Your App`
  2. Find **Authentication and Account Creation** and click the **Edit** button on the right
  3. Verify that both `public_profile` and `email` show status **Ready for testing**
  4. If `email` is not listed, click the **Add** button next to it


You can verify the permissions are set correctly by checking that both `public_profile` and `email` appear with a green check mark or "Ready for testing" status.

## Copy your Facebook app ID and secret#

  * Click `Settings / Basic` in the left sidebar
  * Copy your App ID from the top of the `Basic Settings` page
  * Under `App Secret` click `Show` then copy your secret
  * Make sure all required fields are completed on this screen.


## Enter your Facebook app ID and secret into your Supabase project#

  * Go to your [Supabase Project Dashboard](</dashboard>)
  * In the left sidebar, click the `Authentication` icon (near the top)
  * Click on [`Providers`](</dashboard/project/_/auth/providers>) under the Configuration section
  * Click on **Facebook** from the accordion list to expand and turn **Facebook Enabled** to ON
  * Enter your **Facebook Client ID** and **Facebook Client Secret** saved in the previous step
  * Click `Save`


You can also configure the Facebook auth provider using the Management API:
[code] 
    1
    
    # Get your access token from https://supabase.com/dashboard/account/tokens
    
    2
    
    export SUPABASE_ACCESS_TOKEN="your-access-token"
    
    3
    
    export PROJECT_REF="your-project-ref"
    
    4
    
    5
    
    # Configure Facebook auth provider
    
    6
    
    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    7
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    8
    
      -H "Content-Type: application/json" \
    
    9
    
      -d '{
    
    10
    
        "external_facebook_enabled": true,
    
    11
    
        "external_facebook_client_id": "your-facebook-app-id",
    
    12
    
        "external_facebook_secret": "your-facebook-app-secret"
    
    13
    
      }'
[/code]

## Add login code to your client app#

JavaScriptFlutterSwiftKotlin

Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](</docs/guides/auth/server-side/creating-a-client>) for instructions on creating your Supabase client.

When your user signs in, call [`signInWithOAuth()`](</docs/reference/javascript/auth-signinwithoauth>) with `facebook` as the `provider`:
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
    
    async function signInWithFacebook() {
    
    7
    
      const { data, error } = await supabase.auth.signInWithOAuth({
    
    8
    
        provider: 'facebook',
    
    9
    
      })
    
    10
    
    11
    
      if (error) {
    
    12
    
        console.error('Error signing in with Facebook:', error.message)
    
    13
    
        return
    
    14
    
      }
    
    15
    
    16
    
      // The user will be redirected to Facebook for authentication
    
    17
    
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
    
    9
    
      if (error) {
    
    10
    
        console.error('Error signing out:', error.message)
    
    11
    
        return
    
    12
    
      }
    
    13
    
    14
    
      // User has been signed out
    
    15
    
    }
[/code]

## Testing your integration#

Facebook apps start in **Development** mode, which has the following limitations:

  * Only users with a role on the app (administrators, developers, testers) can authenticate
  * Other users will see an "App Not Setup" error when trying to log in


To add test users:

  1. Go to [developers.facebook.com](<https://developers.facebook.com>) and select your app
  2. Navigate to **App Roles > Roles**
  3. Add users as Testers, Developers, or Administrators
  4. Users must accept the invitation from their Facebook notification settings


Development mode is sufficient for local development and testing. You only need to submit for App Review when you're ready to allow any Facebook user to authenticate with your app.

## Going live with app review#

Before your app can be used by the general public, you need to complete Facebook's App Review process:

  1. **Complete App Settings** : In your Facebook app's **Settings > Basic**, fill in all required fields including:

     * App Icon
     * Privacy Policy URL
     * Terms of Service URL (if applicable)
     * App Domain
  2. **Request Permissions** : Navigate to **App Review > Permissions and Features** and request the permissions you need:

     * `public_profile` \- Usually pre-approved
     * `email` \- Requires verification that your app needs email access
  3. **Submit for Review** : Click **Submit for Review** and provide:

     * Detailed instructions for how Facebook reviewers should test your login flow
     * A screencast video demonstrating the Facebook Login feature
     * Explanation of how user data will be used
  4. **Wait for Approval** : Facebook typically reviews apps within 1-5 business days


If you only need basic authentication (name and profile picture), you may not need full App Review. Apps requesting only `public_profile` and `email` with the "Authenticate and request data from users with Facebook Login" use case can often go live without a detailed review.

For more details, see the [Facebook App Review documentation](<https://developers.facebook.com/docs/app-review/>).

## Troubleshooting#

### "App not setup" error#

This error occurs when a user without a role on your app tries to log in while the app is in Development mode.

**Solution** : Either add the user as a tester in your Facebook app settings, or complete the App Review process to make your app available to all users.

### User's email not returned#

Facebook only returns the email address if:

  * The user has a confirmed email on their Facebook account
  * Your app has been granted the `email` permission
  * The `email` permission is marked as "Ready for testing" in **Use Cases > Authentication and Account Creation**


**Solution** : Check that the `email` permission is properly configured in your Facebook app's Use Cases settings.

### "Redirect URI mismatch" error#

This error indicates the callback URL configured in Facebook doesn't match the one used during authentication.

**Solution** : Verify that the **Valid OAuth Redirect URIs** in your Facebook app settings exactly matches `https://<project-ref>.supabase.co/auth/v1/callback`. Make sure there are no trailing slashes or typos.

### Login works in development but not production#

If login works locally but fails in production, check:

  * Your production URL is added to **Valid OAuth Redirect URIs** in Facebook
  * The App ID and Secret in your Supabase dashboard match your Facebook app
  * Your Facebook app is in **Live** mode (not Development mode)


## Resources#

  * [Supabase - Get started for free](<https://supabase.com>)
  * [Supabase JS Client](<https://github.com/supabase/supabase-js>)
  * [Facebook Developers Dashboard](<https://developers.facebook.com/>)