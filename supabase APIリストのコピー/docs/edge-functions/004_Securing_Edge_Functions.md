---
タイトル: Securing Edge Functions
URL: https://supabase.com/docs/guides/functions/auth
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: auth, edge, edge-functions, functions, securing
---

# Securing Edge Functions

**URL:** https://supabase.com/docs/guides/functions/auth
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** auth, edge, edge-functions, functions, securing

## 目次

- [Authenticated user calls#](#authenticated-user-calls)
- [Service-to-service calls#](#service-to-service-calls)
- [Public functions#](#public-functions)
- [External webhooks#](#external-webhooks)
- [Combining modes#](#combining-modes)
- [Custom error responses#](#custom-error-responses)
- [Environment variables#](#environment-variables)

## 概要

Authentication patterns for Supabase Edge Functions.

---

The `withSupabase` wrapper from [`@supabase/server`](<https://github.com/supabase/server>) verifies the caller's credentials against a declared `auth` mode and hands you a pre-configured Supabase client on `ctx`. The sections below show how to use it for each common auth scenario.

For how authorization headers and the `verify_jwt` platform check work under the hood, see [Authorization headers](</docs/guides/functions/auth-headers>).

Mode| Accepts  
---|---  
`'user'`| A valid user JWT on `Authorization`  
`'secret'`| A secret key on `apikey`  
`'publishable'`| A publishable key on `apikey`  
`'none'`| Any caller, no check (for signed webhooks)  
  
## Authenticated user calls#

Functions called by signed-in users — typically through `supabase.functions.invoke` from the client — send the user's session JWT on the `Authorization` header. Keep `verify_jwt = true` (the default) so the platform validates the JWT before your handler runs, then use `auth: 'user'` to get `ctx.supabase` already scoped to the caller's RLS policies.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    
    5
    
        const { supabase, supabaseAdmin, userClaims, jwtClaims, authMode } = ctx
    
    6
    
        // supabase       — RLS-scoped to the authenticated user
    
    7
    
        // supabaseAdmin  — bypasses RLS (service role)
    
    8
    
        // userClaims     — user identity from JWT (id, email, role)
    
    9
    
        // jwtClaims      — full JWT claims
    
    10
    
        // authMode       — which auth mode matched
    
    11
    
    12
    
        // your business logic goes here
    
    13
    
        return Response.json({ email: ctx.userClaims?.email })
    
    14
    
      }),
    
    15
    
    }
[/code]

## Service-to-service calls#

Cron jobs, workers, `pg_net`, or another Edge Function make calls with a secret key on the `apikey` header rather than a user JWT. Disable `verify_jwt` and use `auth: 'secret'` to validate the key against any secret key from your [dashboard](</dashboard/project/_/settings/api-keys>). You get `ctx.supabaseAdmin` for privileged work.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    
    5
    
        // your business logic. ctx.supabaseAdmin bypasses RLS
    
    6
    
        return Response.json({ ok: true })
    
    7
    
      }),
    
    8
    
    }
[/code]

To accept only one specific key, use `auth: 'secret:<name>'`. For example, `auth: 'secret:automations'` only accepts the secret key you named "automations" in the [**Settings > API keys**](</dashboard/project/_/settings/api-keys>) section of the Dashboard. The same syntax works for publishable keys (`auth: 'publishable:<name>'`).

![A secret key named "automations" listed under Secret keys in the Supabase dashboard.](/docs/img/guides/functions/secret-keys-automations.png)

## Public functions#

For a genuinely public function, like a health check, use `auth: 'none'` with `verify_jwt = false` so anonymous callers can reach the handler.
[code] 
    1
    
    [functions.health]
    
    2
    
    verify_jwt = false
[/code]
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'none' }, async () => {
    
    5
    
        // your business logic
    
    6
    
        return Response.json({ ok: true })
    
    7
    
      }),
    
    8
    
    }
[/code]

`auth: 'none'` skips every credential check — see the caution under External webhooks before using it on anything that reads or writes sensitive data.

## External webhooks#

External providers like Stripe or GitHub don't send Supabase credentials. They sign the request body with their own shared secret. Use `auth: 'none'` to skip the SDK's credential check, then verify the provider's signature inside the handler. Keep `verify_jwt = false`.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    import Stripe from 'npm:stripe'
    
    3
    
    4
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
    
    5
    
    6
    
    export default {
    
    7
    
      fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    
    8
    
        const signature = req.headers.get('stripe-signature') ?? ''
    
    9
    
        const body = await req.text()
    
    10
    
    11
    
        try {
    
    12
    
          stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
    
    13
    
        } catch {
    
    14
    
          return new Response('bad signature', { status: 400 })
    
    15
    
        }
    
    16
    
    17
    
        // your business logic. ctx.supabaseAdmin available for db work
    
    18
    
        return Response.json({ received: true })
    
    19
    
      }),
    
    20
    
    }
[/code]

`auth: 'none'` disables every credential check. Your handler is fully responsible for authenticating the caller. Never use it on an endpoint that reads or writes sensitive data without verifying the caller some other way.

## Combining modes#

Functions that answer both users and internal callers take an array on `auth`. Modes are tried in order. The first match wins, and `ctx.authMode` tells you which matched.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: ['user', 'secret'] }, async (req, ctx) => {
    
    5
    
        if (ctx.authMode === 'user') {
    
    6
    
          // your business logic for user calls. ctx.supabase is scoped to them
    
    7
    
          return Response.json({ ok: true })
    
    8
    
        }
    
    9
    
    10
    
        // your business logic for service calls. ctx.supabaseAdmin bypasses RLS
    
    11
    
        return Response.json({ ok: true })
    
    12
    
      }),
    
    13
    
    }
[/code]

## Custom error responses#

To shape the 401 response yourself, use `createSupabaseContext` instead of `withSupabase`. It returns a `{ data, error }` tuple so you stay in control.
[code] 
    1
    
    import { createSupabaseContext } from 'npm:@supabase/server'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: async (req: Request) => {
    
    5
    
        const { data: ctx, error } = await createSupabaseContext(req, { auth: 'user' })
    
    6
    
        if (error) {
    
    7
    
          return Response.json({ message: error.message, code: error.code }, { status: error.status })
    
    8
    
        }
    
    9
    
        return Response.json({ message: `hello ${ctx.userClaims?.email}` })
    
    10
    
      },
    
    11
    
    }
[/code]

## Environment variables#

`@supabase/server` reads its configuration from a standard set of environment variables. On the Supabase platform and in local development with the CLI, these are auto-provisioned.

Variable| What it is  
---|---  
`SUPABASE_URL`| Your project URL  
`SUPABASE_PUBLISHABLE_KEYS`| Named publishable keys as a JSON object  
`SUPABASE_SECRET_KEYS`| Named secret keys as a JSON object  
`SUPABASE_JWKS`| JSON Web Key Set used to verify user JWTs  
  
Local development with the CLI uses a single-key setup, which the SDK also accepts as a fallback: `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`.

The same zero-config experience is available on other runtimes. Install [`@supabase/server`](<https://github.com/supabase/server>) in your Node.js, Bun, Cloudflare Workers, or self-hosted Deno app and set the environment variables above. See the package's [environment variables guide](<https://github.com/supabase/server/blob/main/docs/environment-variables.md>) for the full reference.