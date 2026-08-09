---
タイトル: Getting Started with OAuth 2.1 Server
URL: https://supabase.com/docs/guides/auth/oauth-server/getting-started
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, edge, getting, getting-started, oauth, oauth-server, server, started, with
---

# Getting Started with OAuth 2.1 Server

**URL:** https://supabase.com/docs/guides/auth/oauth-server/getting-started
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, edge, getting, getting-started, oauth, oauth-server, server, started, with

## 目次

- [Prerequisites#](#prerequisites)
- [Overview#](#overview)
- [Enable OAuth 2.1 server#](#enable-oauth-21-server)
- [Configure your authorization path#](#configure-your-authorization-path)
- [Build your authorization UI#](#build-your-authorization-ui)
  - [Example authorization UI#](#example-authorization-ui)
  - [Summary of the methods#](#summary-of-the-methods)
  - [How it works#](#how-it-works)
- [Register an OAuth client#](#register-an-oauth-client)
  - [Token endpoint authentication method#](#token-endpoint-authentication-method)
- [Customizing tokens (optional)#](#customizing-tokens-optional)
  - [Common use cases#](#common-use-cases)
- [Redirect URI configuration#](#redirect-uri-configuration)
  - [Best practices#](#best-practices)
- [Next steps#](#next-steps)

## 概要

Learn how to enable OAuth 2.1 and register client applications in your Supabase project

---

This guide will walk you through setting up your Supabase project as an OAuth 2.1 identity provider, from enabling the feature to registering your first client application.

## Prerequisites#

Before you begin, make sure you have:

  * A Supabase project (create one at [supabase.com](<https://supabase.com>))
  * Admin access to your project
  * (Optional) [Supabase CLI](</docs/guides/local-development>) v2.54.11 or higher for local development


## Overview#

Setting up OAuth 2.1 in your Supabase project involves these steps:

  1. Enable OAuth 2.1 server capabilities in your project
  2. Configure your authorization path
  3. Build your authorization UI (frontend)
  4. Register OAuth client applications


Testing OAuth flows is often easier on a Supabase project since it's already accessible on the web, no tunnel or additional configuration needed.

## Enable OAuth 2.1 server#

OAuth 2.1 server is currently in beta and free to use during the beta period on all Supabase plans.

CloudCLI

  1. Go to your project dashboard
  2. Navigate to **Authentication** > **OAuth Server** in the sidebar
  3. Enable OAuth 2.1 server capabilities


Once enabled, your project will expose the necessary OAuth endpoints:

CloudCLI

Endpoint| URL  
---|---  
**Authorization endpoint**| `https://<project-ref>.supabase.co/auth/v1/oauth/authorize`  
**Token endpoint**| `https://<project-ref>.supabase.co/auth/v1/oauth/token`  
**JWKS endpoint**| `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`  
**Discovery endpoint**| `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`  
**OIDC discovery**| `https://<project-ref>.supabase.co/auth/v1/.well-known/openid-configuration`  
  
**Use asymmetric JWT signing keys for better security**

By default, Supabase uses HS256 (symmetric) for signing JWTs. For OAuth use cases, we recommend migrating to asymmetric algorithms like RS256 or ES256. Asymmetric keys are more scalable and secure because:

  * OAuth clients can validate JWTs using the public key from your JWKS endpoint
  * No need to share your JWT secret with third-party applications
  * More resilient architecture for distributed systems


Learn more about [configuring JWT signing keys](</docs/guides/auth/signing-keys>).

**Note:** If you plan to use OpenID Connect ID tokens (by requesting the `openid` scope), asymmetric signing algorithms are **required**. ID token generation will fail with HS256.

## Configure your authorization path#

Before registering clients, you need to configure where your authorization UI will live.

  1. In your project dashboard, navigate to **Authentication** > **OAuth Server**
  2. Set the **Authorization Path** (e.g., `/oauth/consent`)


The authorization path is combined with your Site URL (configured in **Authentication** > **URL Configuration**) to create the full authorization endpoint URL.

Your authorization UI will be at the combined Site URL + Authorization Path. For example:

  * Site URL: `https://example.com` (from **Authentication** > **URL Configuration**)
  * Authorization Path: `/oauth/consent` (from **OAuth Server** settings)
  * Your authorization UI: `https://example.com/oauth/consent`


When OAuth clients initiate the authorization flow, Supabase Auth will redirect users to this URL with an `authorization_id` query parameter. You'll use [Supabase JavaScript library OAuth methods](<https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts#L2159-L2163>) to handle the authorization:

  * `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` \- Retrieve client and authorization details
  * `supabase.auth.oauth.approveAuthorization(authorization_id)` \- Approve the authorization request
  * `supabase.auth.oauth.denyAuthorization(authorization_id)` \- Deny the authorization request


## Build your authorization UI#

This is where you build the **frontend** for your authorization flow. When third-party apps initiate OAuth, users will be redirected to your authorization path (configured in the previous step) with an `authorization_id` query parameter.

Your authorization UI should:

  1. **Extract authorization_id** \- Get the `authorization_id` from the URL query parameters
  2. **Authenticate the user** \- If not already logged in, redirect to your login page (preserving the authorization_id)
  3. **Retrieve authorization details** \- Use `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` to get client information including requested scopes
  4. **Display consent screen** \- Show the user what app is requesting access and what scopes/permissions are being requested
  5. **Handle user decision** \- Call either `approveAuthorization(authorization_id)` or `denyAuthorization(authorization_id)` based on user choice


The authorization details include a `scope` field (singular) containing a space-separated string of scopes requested by the client (e.g., `"openid email profile"`). You should display these scopes to the user so they understand what information will be shared.

This is a **frontend implementation**. You're building the UI that displays the consent screen and handles user interactions. The actual OAuth token generation is handled by Supabase Auth after you call the approve/deny methods.

### Example authorization UI#

Here's how to build a minimal authorization page at your configured path (e.g., `/oauth/consent`):

Next.jsReact (SPA)

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.
[code]
    1
    
    // app/oauth/consent/page.tsx
    
    2
    
    import { createServerClient } from '@supabase/ssr'
    
    3
    
    import { cookies } from 'next/headers'
    
    4
    
    import { redirect } from 'next/navigation'
    
    5
    
    6
    
    export default async function ConsentPage({
    
    7
    
      searchParams,
    
    8
    
    }: {
    
    9
    
      searchParams: { authorization_id?: string }
    
    10
    
    }) {
    
    11
    
      const authorizationId = (await searchParams).authorization_id
    
    12
    
    13
    
      if (!authorizationId) {
    
    14
    
        return <div>Error: Missing authorization_id</div>
    
    15
    
      }
    
    16
    
    17
    
      const supabase = createServerClient(
    
    18
    
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    
    19
    
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    
    20
    
        {
    
    21
    
          cookies: {
    
    22
    
            getAll: async () => (await cookies()).getAll(),
    
    23
    
            setAll: async (cookiesToSet, _headers) => {
    
    24
    
              const cookieStore = await cookies()
    
    25
    
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
    
    26
    
            },
    
    27
    
          },
    
    28
    
        }
    
    29
    
      )
    
    30
    
    31
    
      // Check if user is authenticated
    
    32
    
      const { data } = await supabase.auth.getClaims()
    
    33
    
      const claims = data?.claims
    
    34
    
    35
    
      if (!claims) {
    
    36
    
        // Redirect to login, preserving authorization_id
    
    37
    
        redirect(`/login?redirect=/oauth/consent?authorization_id=${authorizationId}`)
    
    38
    
      }
    
    39
    
    40
    
      // Get authorization details using the authorization_id
    
    41
    
      const { data: authDetails, error } =
    
    42
    
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    
    43
    
    44
    
      if (error || !authDetails) {
    
    45
    
        return <div>Error: {error?.message || 'Invalid authorization request'}</div>
    
    46
    
      }
    
    47
    
    48
    
      // if no authorization_id returned, user has previously consented, redirect them
    
    49
    
      if (!('authorization_id' in authDetails)) {
    
    50
    
        redirect(authDetails['redirect_url'])
    
    51
    
      }
    
    52
    
    53
    
      return (
    
    54
    
        <div>
    
    55
    
          <h1>Authorize {authDetails.client.name}</h1>
    
    56
    
          <p>This application wants to access your account.</p>
    
    57
    
    58
    
          <div>
    
    59
    
            <p>
    
    60
    
              <strong>Client:</strong> {authDetails.client.name}
    
    61
    
            </p>
    
    62
    
            <p>
    
    63
    
              <strong>Redirect URI:</strong> {authDetails.redirect_uri}
    
    64
    
            </p>
    
    65
    
            {authDetails.scope && authDetails.scope.trim() && (
    
    66
    
              <div>
    
    67
    
                <strong>Requested permissions:</strong>
    
    68
    
                <ul>
    
    69
    
                  {authDetails.scope.split(' ').map((scopeItem) => (
    
    70
    
                    <li key={scopeItem}>{scopeItem}</li>
    
    71
    
                  ))}
    
    72
    
                </ul>
    
    73
    
              </div>
    
    74
    
            )}
    
    75
    
          </div>
    
    76
    
    77
    
          <form action="/api/oauth/decision" method="POST">
    
    78
    
            <input type="hidden" name="authorization_id" value={authorizationId} />
    
    79
    
            <button type="submit" name="decision" value="approve">
    
    80
    
              Approve
    
    81
    
            </button>
    
    82
    
            <button type="submit" name="decision" value="deny">
    
    83
    
              Deny
    
    84
    
            </button>
    
    85
    
          </form>
    
    86
    
        </div>
    
    87
    
      )
    
    88
    
    }
[/code]
[code]
    1
    
    // app/api/oauth/decision/route.ts
    
    2
    
    import { createServerClient } from '@supabase/ssr'
    
    3
    
    import { cookies } from 'next/headers'
    
    4
    
    import { NextResponse } from 'next/server'
    
    5
    
    6
    
    export async function POST(request: Request) {
    
    7
    
      const formData = await request.formData()
    
    8
    
      const decision = formData.get('decision')
    
    9
    
      const authorizationId = formData.get('authorization_id') as string
    
    10
    
    11
    
      if (!authorizationId) {
    
    12
    
        return NextResponse.json({ error: 'Missing authorization_id' }, { status: 400 })
    
    13
    
      }
    
    14
    
    15
    
      const supabase = createServerClient(
    
    16
    
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    
    17
    
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    
    18
    
        {
    
    19
    
          cookies: {
    
    20
    
            getAll: async () => (await cookies()).getAll(),
    
    21
    
            setAll: async (cookiesToSet, _headers) => {
    
    22
    
              const cookieStore = await cookies()
    
    23
    
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
    
    24
    
            },
    
    25
    
          },
    
    26
    
        }
    
    27
    
      )
    
    28
    
    29
    
      if (decision === 'approve') {
    
    30
    
        const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId)
    
    31
    
    32
    
        if (error) {
    
    33
    
          return NextResponse.json({ error: error.message }, { status: 400 })
    
    34
    
        }
    
    35
    
    36
    
        // Redirect back to the client with authorization code
    
    37
    
        return NextResponse.redirect(data.redirect_url)
    
    38
    
      } else {
    
    39
    
        const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId)
    
    40
    
    41
    
        if (error) {
    
    42
    
          return NextResponse.json({ error: error.message }, { status: 400 })
    
    43
    
        }
    
    44
    
    45
    
        // Redirect back to the client with error
    
    46
    
        return NextResponse.redirect(data.redirect_url)
    
    47
    
      }
    
    48
    
    }
[/code]

### How it works#

  1. **User navigates to your authorization path** \- When a third-party app initiates OAuth, Supabase Auth redirects the user to your configured authorization path (e.g., `https://example.com/oauth/consent?authorization_id=<id>`)
  2. **Extract authorization_id** \- Your page extracts the `authorization_id` from the URL query parameters
  3. **Check authentication** \- Your page checks if the user is logged in, redirecting to login if not (preserving the authorization_id)
  4. **Retrieve details** \- Call `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` to get information about the requesting client
  5. **Show consent screen** \- Display a UI asking the user to approve or deny access
  6. **Handle decision** \- When the user clicks approve/deny:
     * Call `supabase.auth.oauth.approveAuthorization(authorization_id)` or `denyAuthorization(authorization_id)`
     * These methods handle all OAuth logic internally (generating authorization codes, etc.)
     * They return a `redirect_url` URL
  7. **Redirect back** \- Redirect the user to the `redirect_url` URL, which sends them back to the third-party app with either an authorization code (approved) or error (denied)


## Register an OAuth client#

Before third-party applications can use your project as an identity provider, you need to register them as OAuth clients.

DashboardProgrammatically

  1. Go to **Authentication** > **OAuth Apps** (under the **Manage** section)
  2. Click **Add a new client**
  3. Enter the client details:
     * **Client name** : A friendly name for your application
     * **Redirect URIs** : One or more URLs where users will be redirected after authorization
     * **Client type** : Choose between:
       * **Public** \- For mobile and single-page apps (no client secret)
       * **Confidential** \- For server-side apps (includes client secret)
  4. Click **Create**


You'll receive:

  * **Client ID** : A unique identifier for the client
  * **Client Secret** (for confidential clients): A secret key for authenticating the client


Store the client secret securely. It will only be shown once. If you lose it, you can regenerate a new one from the **OAuth Apps** page.

### Token endpoint authentication method#

When a client exchanges an authorization code or refreshes a token, it must authenticate with the token endpoint. The `token_endpoint_auth_method` controls how this authentication happens:

Method| Description| Used by  
---|---|---  
`none`| No client authentication. Only `client_id` is sent in the request body.| Public clients (required)  
`client_secret_basic`| Client credentials sent via HTTP Basic auth (`Authorization: Basic <base64(client_id:client_secret)>`). **This is the default for confidential clients.**|  Confidential clients  
`client_secret_post`| Client credentials sent in the request body (`client_id` and `client_secret` as form parameters).| Confidential clients  
  
**Defaults:** Public clients default to `none`. Confidential clients default to `client_secret_basic` (per [RFC 7591](<https://datatracker.ietf.org/doc/html/rfc7591#section-2>)).

**Constraints:** Public clients must use `none`. Confidential clients cannot use `none`.

You can set this when registering a client via the dashboard or programmatically. See [OAuth Flows](</docs/guides/auth/oauth-server/oauth-flows#step-5-token-exchange>) for examples of each method in action.

## Customizing tokens (optional)#

By default, OAuth access tokens include standard claims like `user_id`, `role`, and `client_id`. If you need to customize tokens—for example, to set a specific `audience` claim for third-party validation or add client-specific metadata—use [Custom Access Token Hooks](</docs/guides/auth/auth-hooks/custom-access-token-hook>).

Custom Access Token Hooks are triggered for all token issuance, including OAuth flows. You can use the `client_id` parameter to customize tokens based on which OAuth client is requesting them.

### Common use cases#

  * **Customize`audience` claim**: Set the `aud` claim to the third-party API endpoint for proper JWT validation
  * **Add client-specific permissions** : Include custom claims based on which OAuth client is requesting access
  * **Implement dynamic scopes** : Add metadata that RLS policies can use for fine-grained access control


For more examples, see [Token Security & RLS](</docs/guides/auth/oauth-server/token-security#custom-access-token-hooks>).

## Redirect URI configuration#

Redirect URIs are critical for OAuth security. Supabase Auth will only redirect to URIs that are explicitly registered with the client.

**Not to be confused with general redirect URLs**

This section is about **OAuth client redirect URIs** \- where to send users after they authorize third-party apps to access your Supabase project. This is different from the general [Redirect URLs](</docs/guides/auth/redirect-urls>) setting, which controls where to send users after they sign in TO your app using social providers.

**Exact matches only - No wildcards or patterns**

OAuth client redirect URIs require exact, complete URL matches. Unlike general redirect URLs (which support wildcards), OAuth client redirect URIs do NOT support wildcards, patterns, or partial URLs. You must register the full, exact callback URL.

### Best practices#

  * **Use HTTPS in production** \- Always use HTTPS for redirect URIs in production
  * **Register exact, complete URLs** \- Each redirect URI must be the full URL including protocol, domain, path, and port if needed
  * **Use separate OAuth clients per environment** \- Create separate OAuth clients for development, staging, and production. This provides better security isolation, allows independent secret rotation, and improves auditability. If you need to use the same client across environments, you can register multiple redirect URIs, but separate clients are recommended.


## Next steps#

Now that you've registered your first OAuth client, you're ready to:

  * [Understand OAuth flows](</docs/guides/auth/oauth-server/oauth-flows>) \- Learn how the authorization code and refresh token flows work
  * [Implement MCP authentication](</docs/guides/auth/oauth-server/mcp-authentication>) \- Enable AI agent authentication
  * [Secure with RLS](</docs/guides/auth/oauth-server/token-security>) \- Control data access for OAuth clients