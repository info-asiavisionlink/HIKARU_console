---
タイトル: Monitoring with Sentry
URL: https://supabase.com/docs/guides/functions/examples/sentry-monitoring
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, monitoring, sentry, sentry-monitoring, with
---

# Monitoring with Sentry

**URL:** https://supabase.com/docs/guides/functions/examples/sentry-monitoring
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, monitoring, sentry, sentry-monitoring, with

## 目次

- [Prerequisites#](#prerequisites)
- [1. Create Supabase function#](#1-create-supabase-function)
- [2. Add the Sentry Deno SDK#](#2-add-the-sentry-deno-sdk)
- [3. Deploy and test#](#3-deploy-and-test)
- [4. Try it yourself#](#4-try-it-yourself)
- [Working with scopes#](#working-with-scopes)

## 概要

Monitor Edge Functions with the Sentry Deno SDK.

---

Add the [Sentry Deno SDK](<https://docs.sentry.io/platforms/javascript/guides/deno/>) to your Supabase Edge Functions to track exceptions and get notified of errors or performance issues.

## Prerequisites#

  * [Create a Sentry account](<https://sentry.io/signup/>).
  * Make sure you have the latest version of the [Supabase CLI](</docs/guides/local-development/cli/getting-started#installing-the-supabase-cli>) installed.


## 1\. Create Supabase function#

Create a new function locally:
[code] 
    1
    
    supabase functions new sentryfied
[/code]

## 2\. Add the Sentry Deno SDK#

Handle exceptions within your function and send them to Sentry.
[code] 
    1
    
    import * as Sentry from 'npm:@sentry/deno@^8'
    
    2
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    3
    
    4
    
    Sentry.init({
    
    5
    
      // https://docs.sentry.io/product/sentry-basics/concepts/dsn-explainer/#where-to-find-your-dsn
    
    6
    
      dsn: Deno.env.get('SENTRY_DSN'),
    
    7
    
      defaultIntegrations: false,
    
    8
    
      // Performance Monitoring
    
    9
    
      tracesSampleRate: 1.0,
    
    10
    
      // Set sampling rate for profiling - this is relative to tracesSampleRate
    
    11
    
      profilesSampleRate: 1.0,
    
    12
    
    })
    
    13
    
    14
    
    // Set region and execution_id as custom tags
    
    15
    
    Sentry.setTag('region', Deno.env.get('SB_REGION'))
    
    16
    
    Sentry.setTag('execution_id', Deno.env.get('SB_EXECUTION_ID'))
    
    17
    
    18
    
    // Open endpoint for testing. In production, implement an authorization layer in the handler or switch the auth mode.
    
    19
    
    export default {
    
    20
    
      fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    
    21
    
        try {
    
    22
    
          const { name } = await req.json()
    
    23
    
          // This will throw, as `name` in our example call will be `undefined`
    
    24
    
          const data = {
    
    25
    
            message: `Hello ${name}!`,
    
    26
    
          }
    
    27
    
    28
    
          return Response.json(data)
    
    29
    
        } catch (e) {
    
    30
    
          Sentry.captureException(e)
    
    31
    
          // Flush Sentry before the running process closes
    
    32
    
          await Sentry.flush(2000)
    
    33
    
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
    
    34
    
        }
    
    35
    
      }),
    
    36
    
    }
[/code]

## 3\. Deploy and test#

Run function locally:
[code] 
    1
    
    supabase start
    
    2
    
    supabase functions serve --no-verify-jwt
[/code]

Test it: <http://localhost:54321/functions/v1/sentryfied>[](<http://localhost:54321/functions/v1/sentryfied>)

Deploy function to Supabase:
[code] 
    1
    
    supabase functions deploy sentryfied --no-verify-jwt
[/code]

## 4\. Try it yourself#

Find the complete example on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/sentryfied/index.ts>).

## Working with scopes#

Sentry Deno SDK currently do not support `Deno.serve` instrumentation, which means that there is no scope separation between requests. Because of that, when the Edge Functions runtime is reused between multiple requests, all globally captured breadcrumbs and contextual data will be shared, which is not the desired behavior. To work around this, all default integrations in the example code above are disabled, and you should be relying on [`withScope`](<https://docs.sentry.io/platforms/javascript/enriching-events/scopes/#using-withscope>) to encapsulate all Sentry SDK API calls, or [pass context directly](<https://docs.sentry.io/platforms/javascript/enriching-events/context/#passing-context-directly>) to the `captureException` or `captureMessage` calls.