---
タイトル: Creating a Supabase client for SSR
URL: https://supabase.com/docs/guides/auth/server-side/creating-a-client
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, cli, client, creating, creating-a-client, server-side, supabase
---

# Creating a Supabase client for SSR

**URL:** https://supabase.com/docs/guides/auth/server-side/creating-a-client
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, cli, client, creating, creating-a-client, server-side, supabase

## 目次

- [Install#](#install)
- [Set environment variables#](#set-environment-variables)
  - [Get API details#](#get-api-details)
- [Create a client#](#create-a-client)
  - [Summary of the methods#](#summary-of-the-methods)
  - [Write utility functions to create Supabase clients#](#write-utility-functions-to-create-supabase-clients)
  - [Summary of the methods#](#summary-of-the-methods)
  - What does the `cookies` object do?
  - Do I need to create a new client for every route?
  - [Hook up proxy#](#hook-up-proxy)
  - [Summary of the methods#](#summary-of-the-methods)
- [Congratulations#](#congratulations)
- [Caching considerations#](#caching-considerations)
- [Next steps#](#next-steps)

## 概要

Configure your Supabase client to use cookies

---

To use Server-Side Rendering (SSR) with Supabase, you need to configure your Supabase client to use cookies. The `@supabase/ssr` package helps you do this for JavaScript/TypeScript applications.

## Install#

Install the `@supabase/supabase-js` and `@supabase/ssr` helper packages:

npmyarnpnpm
[code]
    1
    
    npm install @supabase/supabase-js @supabase/ssr
[/code]

## Set environment variables#

Create a `.env.local` file in the project root directory. In the file, set the project's Supabase URL and Key:

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nextjs>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

Next.jsSvelteKitAstroRemixNuxtReact RouterExpressHonoTanStack Start
[code]
    1
    
    NEXT_PUBLIC_SUPABASE_URL=supabase_project_url
    
    2
    
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
[/code]

## Create a client#

You need setup code to configure a Supabase client to use cookies. Once you have the utility code, you can use the `createClient` utility functions to get a properly configured Supabase client.

Use the browser client in code that runs on the browser, and the server client in code that runs on the server.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

Next.jsSvelteKitAstroRemixNuxtReact RouterExpressHonoTanStack Start

### Write utility functions to create Supabase clients#

To access Supabase from a Next.js app, you need 2 types of Supabase clients:

  1. **Client Component client** \- To access Supabase from Client Components, which run in the browser.
  2. **Server Component client** \- To access Supabase from Server Components, Server Actions, and Route Handlers, which run only on the server.


Since Next.js Server Components can't write cookies, you need a [Proxy](<https://nextjs.org/docs/app/getting-started/proxy>) to refresh expired Auth tokens and store them.

The Proxy is responsible for:

  1. Refreshing the Auth token by calling `supabase.auth.getClaims()`.
  2. Passing the refreshed Auth token to Server Components, so they don't attempt to refresh the same token themselves. This is accomplished with `request.cookies.set`.
  3. Passing the refreshed Auth token to the browser, so it replaces the old token. This is accomplished with `response.cookies.set`.


The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

### What does the `cookies` object do?

### Do I need to create a new client for every route?

Create a `lib/supabase` folder at the root of your project, or inside the `./src` folder if you are using one, with a file for each type of client. Then copy the lib utility functions for each client type.

lib/supabase/client.tslib/supabase/server.ts
[code]
    1
    
    import { createBrowserClient } from '@supabase/ssr'
    
    2
    
    3
    
    export function createClient() {
    
    4
    
      return createBrowserClient(
    
    5
    
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    
    6
    
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    
    7
    
      )
    
    8
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/nextjs/lib/supabase/client.ts>)

### Hook up proxy#

The code adds a [matcher](<https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher>) so the Proxy doesn't run on routes that don't access Supabase.

Be careful when protecting pages. The server gets the user session from the cookies, which can be spoofed by anyone.

Always use `supabase.auth.getClaims()` to protect pages and user data.

_Never_ trust `supabase.auth.getSession()` inside server code such as Proxy. It isn't guaranteed to revalidate the Auth token.

It's safe to trust `getClaims()` because it validates the JWT signature against the project's published public keys every time.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

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
    
      return await updateSession(request)
    
    6
    
    }
    
    7
    
    8
    
    export const config = {
    
    9
    
      matcher: [
    
    10
    
        /*
    
    11
    
         * Match all request paths except for the ones starting with:
    
    12
    
         * - _next/static (static files)
    
    13
    
         * - _next/image (image optimization files)
    
    14
    
         * - favicon.ico (favicon file)
    
    15
    
         * Feel free to modify this pattern to include more paths.
    
    16
    
         */
    
    17
    
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    
    18
    
      ],
    
    19
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/nextjs/proxy.ts>)

## Congratulations#

You're done! To recap, you've successfully:

  * Called Supabase from a Server Action.
  * Called Supabase from a Server Component.
  * Set up a Supabase client utility to call Supabase from a Client Component. You can use this if you need to call Supabase from a Client Component, for example to set up a realtime subscription.
  * Set up Proxy to automatically refresh the Supabase Auth session.


You can now use any Supabase features from your client or server code!

## Caching considerations#

If your app uses ISR (Incremental Static Regeneration) or is deployed behind a CDN, caching of HTTP responses can cause users to receive another user's session. When a session is refreshed, the new token is written to the response via `Set-Cookie`. If that response is cached and served to a different user, that user will be signed in as the wrong person.

See the [advanced Auth server-side rendering guide](</docs/guides/auth/server-side/advanced-guide#can-i-use-server-side-rendering-with-a-cdn-or-cache>) for details and framework-specific examples.

## Next steps#

  * Implement [Authentication using Email and Password](</docs/guides/auth/passwords>)
  * Implement [Authentication using OAuth](</docs/guides/auth/social-login>)
  * [Learn more about SSR](</docs/guides/auth/server-side/advanced-guide>)