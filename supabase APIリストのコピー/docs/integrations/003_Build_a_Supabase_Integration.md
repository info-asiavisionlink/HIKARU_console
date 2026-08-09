---
タイトル: Build a Supabase Integration
URL: https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
カテゴリ: integrations
更新日: 2026-08-02
タグ: auth, build, build-a-supabase-oauth-integration, integration, integrations, supabase
---

# Build a Supabase Integration

**URL:** https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
**カテゴリ:** integrations
**更新日:** 2026-08-02
**タグ:** auth, build, build-a-supabase-oauth-integration, integration, integrations, supabase

## 目次

- [Create an OAuth app#](#create-an-oauth-app)
- [Show a "Connect Supabase" button#](#show-a-connect-supabase-button)
- [Implementing the OAuth 2.0 flow#](#implementing-the-oauth-20-flow)
  - [Redirecting to the authorize URL#](#redirecting-to-the-authorize-url)
  - [Handling the callback#](#handling-the-callback)
- [Refreshing an access token#](#refreshing-an-access-token)
- [Calling the Management API#](#calling-the-management-api)
  - [Use the JavaScript (TypeScript) SDK#](#use-the-javascript-typescript-sdk)
- [Integration recommendations#](#integration-recommendations)
  - [Store API keys in env variables#](#store-api-keys-in-env-variables)
  - [Pre-fill database connection details#](#pre-fill-database-connection-details)
  - [Create new projects#](#create-new-projects)
  - [Configure custom Auth SMTP#](#configure-custom-auth-smtp)
  - [Handling dynamic redirect URLs#](#handling-dynamic-redirect-urls)
- [Current limitations#](#current-limitations)

## 概要

Build a Supabase Integration using OAuth2 and the Management API.

---

Using OAuth2.0 you can retrieve an access and refresh token that grant your application full access to the [Management API](</docs/reference/api/introduction>) on behalf of the user.

## Create an OAuth app#

  1. In your organization's settings, navigate to the [**OAuth Apps**](</dashboard/org/_/apps>) tab.
  2. In the upper-right section of the page, click **Add application**.
  3. Fill in the required details and click **Confirm**.


## Show a "Connect Supabase" button#

In your user interface, add a "Connect Supabase" button to kick off the OAuth flow. Follow the design guidelines outlined in our [brand assets](</brand-assets>).

## Implementing the OAuth 2.0 flow#

Once you've published your OAuth App on Supabase, you can use the OAuth 2.0 protocol get authorization from Supabase users to manage their organizations and projects.

You can use your preferred OAuth2 client or follow the steps below. You can see an example implementation in TypeScript using Supabase Edge Functions [on our GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/connect-supabase>).

### Redirecting to the authorize URL#

Within your app's UI, redirect the user to [`https://api.supabase.com/v1/oauth/authorize`](<https://api.supabase.com/api/v1#tag/oauth/GET/v1/oauth/authorize>). Make sure to include all required query parameters such as:

  * `client_id`: Your client id from the app creation above.
  * `redirect_uri`: The URL where Supabase will redirect the user to after providing consent.
  * `response_type`: Set this to `code`.
  * `state`: Information about the state of your app. Note that `redirect_uri` and `state` together cannot exceed 4kB in size.
  * `organization_slug`: The slug of the organization you want to connect to. This is optional, but if provided, it will pre-select the organization for the user.
  * [Recommended] PKCE: We strongly recommend using the PKCE flow for increased security. Generate a random value before taking the user to the authorize endpoint. This value is called code verifier. Hash it with SHA256 and include it as the `code_challenge` parameter, while setting `code_challenge_method` to `S256`. In the next step, you would need to provide the code verifier to get the first access and refresh token.
  * [Deprecated] `scope`: Scopes are configured when you create your OAuth app. Read the [docs](</docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes>) for more details.


[code] 
    1
    
    router.get('/connect-supabase/login', async (ctx) => {
    
    2
    
      // Construct the URL for the authorization redirect and get a PKCE codeVerifier.
    
    3
    
      const { uri, codeVerifier } = await oauth2Client.code.getAuthorizationUri()
    
    4
    
      console.log(uri.toString())
    
    5
    
      // console.log: https://api.supabase.com/v1/oauth/authorize?response_type=code&client_id=7673bde9-be72-4d75-bd5e-b0dba2c49b38&redirect_uri=http%3A%2F%2Flocalhost%3A54321%2Ffunctions%2Fv1%2Fconnect-supabase%2Foauth2%2Fcallback&scope=all&code_challenge=jk06R69S1bH9dD4td8mS5kAEFmEbMP5P0YrmGNAUVE0&code_challenge_method=S256
    
    6
    
    7
    
      // Store the codeVerifier in the user session (cookie).
    
    8
    
      ctx.state.session.flash('codeVerifier', codeVerifier)
    
    9
    
    10
    
      // Redirect the user to the authorization endpoint.
    
    11
    
      ctx.response.redirect(uri)
    
    12
    
    })
[/code]

Find the full example on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/connect-supabase>).

### Handling the callback#

Once the user consents to providing API access to your OAuth App, Supabase will redirect the user to the `redirect_uri` provided in the previous step. The URL will contain these query parameters:

  * `code`: An authorization code you should exchange with Supabase to get the access and refresh token.
  * `state`: The value you provided in the previous step, to help you associate the request with the user. The `state` property returned here should be compared to the `state` you sent previously.


Exchange the authorization code for an access and refresh token by calling [`POST https://api.supabase.com/v1/oauth/token`](<https://api.supabase.com/api/v1#tag/oauth/POST/v1/oauth/token>) with the following query parameters as content-type `application/x-www-form-urlencoded`:

  * `grant_type`: The value `authorization_code`.
  * `code`: The `code` returned in the previous step.
  * `redirect_uri`: This must be exactly the same URL used in the first step.
  * (Recommended) `code_verifier`: If you used the PKCE flow in the first step, include the code verifier as `code_verifier`.


If your application need to support dynamically generated Redirect URLs, check out Handling Dynamic Redirect URLs section below.

As per OAuth2 spec, provide the client id and client secret as basic auth header:

  * `client_id`: The unique client ID identifying your OAuth App.
  * `client_secret`: The secret that authenticates your OAuth App to Supabase.


[code] 
    1
    
    router.get('/connect-supabase/oauth2/callback', async (ctx) => {
    
    2
    
      // Make sure the codeVerifier is present for the user's session.
    
    3
    
      const codeVerifier = ctx.state.session.get('codeVerifier') as string
    
    4
    
      if (!codeVerifier) throw new Error('No codeVerifier!')
    
    5
    
    6
    
      // Exchange the authorization code for an access token.
    
    7
    
      const tokens = await fetch(config.tokenUri, {
    
    8
    
        method: 'POST',
    
    9
    
        headers: {
    
    10
    
          'Content-Type': 'application/x-www-form-urlencoded',
    
    11
    
          Accept: 'application/json',
    
    12
    
          Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    
    13
    
        },
    
    14
    
        body: new URLSearchParams({
    
    15
    
          grant_type: 'authorization_code',
    
    16
    
          code: ctx.request.url.searchParams.get('code') || '',
    
    17
    
          redirect_uri: config.redirectUri,
    
    18
    
          code_verifier: codeVerifier,
    
    19
    
        }),
    
    20
    
      }).then((res) => res.json())
    
    21
    
      console.log('tokens', tokens)
    
    22
    
    23
    
      // Store the tokens in your DB for future use.
    
    24
    
    25
    
      ctx.response.body = 'Success'
    
    26
    
    })
[/code]

Find the full example on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/connect-supabase>).

## Refreshing an access token#

You can use the [`POST /v1/oauth/token`](<https://api.supabase.com/api/v1#tag/oauth/POST/v1/oauth/token>) endpoint to refresh an access token using the refresh token returned at the end of the previous section.

If the user has revoked access to your application, you will not be able to refresh a token. Furthermore, access tokens will stop working. Make sure you handle HTTP Unauthorized errors when calling any Supabase API.

## Calling the Management API#

Refer to [the Management API reference](</docs/reference/api/introduction#authentication>) to learn more about authentication with the Management API.

### Use the JavaScript (TypeScript) SDK#

For convenience, when working with JavaScript/TypeScript, you can use the [supabase-management-js](<https://github.com/supabase-community/supabase-management-js#supabase-management-js>) library.
[code] 
    1
    
    import { SupabaseManagementAPI } from 'supabase-management-js'
    
    2
    
    3
    
    const client = new SupabaseManagementAPI({ accessToken: '<access token>' })
[/code]

## Integration recommendations#

There are a couple common patterns you can consider adding to your integration that can facilitate a great user experience.

### Store API keys in env variables#

Some integrations, e.g. like [Cloudflare Workers](</partners/integrations/cloudflare-workers>) provide convenient access to the API URL and API keys to allow user to speed up development.

Using the management API, you can retrieve a project's API credentials using the [`/projects/{ref}/api-keys` endpoint](<https://api.supabase.com/api/v1#/projects/getProjectApiKeys>).

### Pre-fill database connection details#

If your integration directly connects to the project's database, you can pref-fill the Postgres connection details for the user, it follows this schema:
[code] 
    1
    
    postgresql://postgres:[DB-PASSWORD]@db.[REF].supabase.co:5432/postgres
[/code]

Note that you cannot retrieve the database password via the management API, so for the user's existing projects you will need to collect their database password in your UI.

### Create new projects#

Use the [`/v1/projects` endpoint](<https://api.supabase.com/api/v1#/projects/createProject>) to create a new project.

When creating a new project, you can either ask the user to provide a database password, or you can generate a secure password for them. In any case, make sure to securely store the database password on your end which will allow you to construct the Postgres URI.

### Configure custom Auth SMTP#

You can configure the user's [custom SMTP settings](</docs/guides/auth/auth-smtp>) using the [`/config/auth` endpoint](<https://api.supabase.com/api/v1#/projects%20config/updateV1AuthConfig>).

### Handling dynamic redirect URLs#

To handle multiple, dynamically generated redirect URLs within the same OAuth app, you can leverage the `state` query parameter. When starting the OAuth process, include the desired, encoded redirect URL in the `state` parameter. Once authorization is complete, we will sends the `state` value back to your app. You can then verify its integrity and extract the correct redirect URL, decoding it and redirecting the user to the correct URL.

## Current limitations#

Only some features are available until we roll out fine-grained access control. If you need full database access, you will need to prompt the user for their database password.