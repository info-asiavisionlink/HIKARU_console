---
タイトル: Sentry integration
URL: https://supabase.com/docs/guides/monitoring-and-debugging/sentry-monitoring
カテゴリ: platform
更新日: 2026-08-02
タグ: integration, monitoring-and-debugging, platform, sentry, sentry-monitoring
---

# Sentry integration

**URL:** https://supabase.com/docs/guides/monitoring-and-debugging/sentry-monitoring
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** integration, monitoring-and-debugging, platform, sentry, sentry-monitoring

## 目次

- [Use#](#use)
- [Deduplicating spans#](#deduplicating-spans)
- [Configuration for Next.js#](#configuration-for-nextjs)

## 概要

Integrate Sentry to monitor errors from a Supabase client

---

You can use [Sentry](<https://sentry.io/welcome/>) to monitor errors thrown from a Supabase JavaScript client. Support for Supabase is built directly into the Sentry JavaScript SDK.

The integration instruments database queries and authentication calls made through `supabase-js`, creating spans for performance monitoring and capturing errors. It supports browser, Node, and edge environments.

The built-in integration requires Sentry JavaScript SDK **v9.14.0 or later**. If you're on an older SDK (including v7), use the community [`@supabase/sentry-js-integration`](<https://github.com/supabase-community/sentry-integration-js>) package instead, which the built-in integration is based on.

## Use#

There are two ways to enable the integration. Both take an initialized Supabase client instance.

Via Sentry.initVia instrumentSupabaseClient

Add `supabaseIntegration` to the `integrations` list when you initialize Sentry. Use this when your `Sentry.init` call and your Supabase client live in the same place.
[code]
    1
    
    import * as Sentry from '@sentry/browser'
    
    2
    
    import { createClient } from '@supabase/supabase-js'
    
    3
    
    4
    
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)
    
    5
    
    6
    
    Sentry.init({
    
    7
    
      dsn: SENTRY_DSN,
    
    8
    
      tracesSampleRate: 1.0,
    
    9
    
      integrations: [
    
    10
    
        Sentry.browserTracingIntegration(),
    
    11
    
        Sentry.supabaseIntegration({ supabaseClient }),
    
    12
    
      ],
    
    13
    
    })
[/code]

By default, query filters and mutation bodies are redacted from spans and breadcrumbs. To capture them, pass `sendOperationData: true` where you set up instrumentation (`Sentry.supabaseIntegration({ supabaseClient, sendOperationData: true })` or `Sentry.instrumentSupabaseClient(client, { sendOperationData: true })`), or enable `dataCollection: { userInfo: true }` in your `Sentry.init` options, which applies to every client in that runtime.

## Deduplicating spans#

Sentry's HTTP and Fetch tracing integrations are enabled by default in the Node and Next.js SDKs, so the underlying Supabase REST calls are traced as `http.client` spans in addition to the `db` spans from the Supabase integration. This is optional cleanup: if you'd rather not see both, skip the Supabase REST requests in your other integration.
[code] 
    1
    
    import * as Sentry from '@sentry/browser'
    
    2
    
    import { createClient } from '@supabase/supabase-js'
    
    3
    
    4
    
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)
    
    5
    
    6
    
    Sentry.init({
    
    7
    
      dsn: SENTRY_DSN,
    
    8
    
      tracesSampleRate: 1.0,
    
    9
    
      integrations: [
    
    10
    
        Sentry.supabaseIntegration({ supabaseClient }),
    
    11
    
    12
    
        // @sentry/browser
    
    13
    
        Sentry.browserTracingIntegration({
    
    14
    
          shouldCreateSpanForRequest: (url) => {
    
    15
    
            return !url.startsWith(`${SUPABASE_URL}/rest`)
    
    16
    
          },
    
    17
    
        }),
    
    18
    
    19
    
        // or @sentry/node (supabase-js uses fetch, so filter the Fetch integration)
    
    20
    
        Sentry.nativeNodeFetchIntegration({
    
    21
    
          ignoreOutgoingRequests: (url) => {
    
    22
    
            return url.startsWith(`${SUPABASE_URL}/rest`)
    
    23
    
          },
    
    24
    
        }),
    
    25
    
    26
    
        // or @sentry/nextjs for Proxy & Edge Functions
    
    27
    
        Sentry.winterCGFetchIntegration({
    
    28
    
          breadcrumbs: true,
    
    29
    
          shouldCreateSpanForRequest: (url) => {
    
    30
    
            return !url.startsWith(`${SUPABASE_URL}/rest`)
    
    31
    
          },
    
    32
    
        }),
    
    33
    
      ],
    
    34
    
    })
[/code]

## Configuration for Next.js#

Next.js runs Sentry across browser, server, and edge runtimes, and auth-aware setups (like `@supabase/ssr`) create a Supabase client per request. Since `instrumentSupabaseClient` patches database calls per runtime and auth calls per client instance, call it inside each of your client factories rather than on a single shared instance.

  1. Run through the [Sentry Next.js wizard](<https://docs.sentry.io/platforms/javascript/guides/nextjs/#install>) to set up the base Sentry configuration.

  2. Add `Sentry.instrumentSupabaseClient` to each factory. For example, the server client with `@supabase/ssr`:


[code] 
    1
    
    import * as Sentry from '@sentry/nextjs'
    
    2
    
    import { createServerClient } from '@supabase/ssr'
    
    3
    
    4
    
    export async function createClient() {
    
    5
    
      const client = createServerClient(/* your usual URL, key, and cookie config */)
    
    6
    
    7
    
      Sentry.instrumentSupabaseClient(client)
    
    8
    
      return client
    
    9
    
    }
[/code]

  3. Apply the same in your browser client using (`createBrowserClient`) and middleware client so every runtime is covered.

  4. To include query filters and mutation bodies, enable `dataCollection: { userInfo: true }` in each runtime's Sentry config, or pass `Sentry.instrumentSupabaseClient(client, { sendOperationData: true })` at the call site.

  5. Build and run your application (`npm run build && npm run start`). Supabase queries now appear as `db` spans in your Sentry traces.