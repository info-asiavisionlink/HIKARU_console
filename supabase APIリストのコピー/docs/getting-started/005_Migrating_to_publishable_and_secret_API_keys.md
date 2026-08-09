---
タイトル: Migrating to publishable and secret API keys
URL: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
カテゴリ: getting-started
更新日: 2026-08-02
タグ: api, getting-started, keys, migrating, migrating-to-new-api-keys, publishable, secret
---

# Migrating to publishable and secret API keys

**URL:** https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** api, getting-started, keys, migrating, migrating-to-new-api-keys, publishable, secret

## 目次

- [Before you start#](#before-you-start)
- [Step 1: Create the new API keys#](#step-1-create-the-new-api-keys)
- [Step 2: Swap the publishable key in client code#](#step-2-swap-the-publishable-key-in-client-code)
- [Step 3: Swap the secret key in backend code#](#step-3-swap-the-secret-key-in-backend-code)
  - [Database Webhooks andpg_net#](#database-webhooks-and-pgnet)
- [Step 4: Update Edge Functions#](#step-4-update-edge-functions)
  - [Option 1: Read the new keys from the environment#](#option-1-read-the-new-keys-from-the-environment)
  - [Option 2: Adopt the @supabase/server SDK#](#option-2-adopt-the-supabaseserver-sdk)
- [Step 5: Verify nothing uses the legacy keys#](#step-5-verify-nothing-uses-the-legacy-keys)
- [Step 6: Deactivate the legacy keys#](#step-6-deactivate-the-legacy-keys)
- [Known limitations#](#known-limitations)
- [Next steps#](#next-steps)

## 概要

Move from legacy JWT-based anon and service_role keys to publishable and secret keys.

---

Changes to API keys

Supabase has changed the way keys work to improve project security and developer experience. You can [read the full announcement on GitHub](<https://github.com/orgs/supabase/discussions/29260>).

**They will be deprecated by the end of 2026, and you should now use the publishable (`sb_publishable_xxx`) and secret (`sb_secret_xxx`) keys instead**.

In most cases, you can get keys from [the Project's **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=&framework=>), but if you want a specific key, you can find them in the [**Settings > API Keys**](</dashboard/project/_/settings/api-keys/>) section of the Dashboard.

  * **For new keys** , open the **API Keys** tab, if you don't have a publishable key already, click **Create new API Keys** , and copy the value from the **Publishable key** section for client-side operations. For server-side operations, copy the value from the **Secret keys** section.
  * **For legacy keys** , copy the `anon` key for client-side operations and the `service_role` key for server-side operations from the **Legacy API Keys** tab.


This guide covers migrating an **existing project.** Both key types work simultaneously, so you can swap clients one at a time and deactivate the legacy keys only after nothing depends on them.

## Before you start#

The migration maps onto your existing keys:

Legacy key| Replace with| Used by  
---|---|---  
`anon`| Publishable key| Browsers, mobile and desktop apps, CLIs, public source  
`service_role`| Secret key| Servers, Edge Functions, workers, other backend code  
  
For a full explanation of each key type, read [the Understanding API keys guide](</docs/guides/getting-started/api-keys>).

## Step 1: Create the new API keys#

Open the [**Settings > API Keys**](</dashboard/project/_/settings/api-keys/>) section of the Dashboard and select the **Publishable and secret API keys** tab.

Older projects don't have these keys yet. If you see a **Create new API keys** button, your project is still on legacy keys only. Creating the new keys is safe. It adds a publishable key and a secret key alongside your existing `anon` and `service_role` keys. Your legacy keys keep working.

The new keys are created under the name `default`. You can add more keys with different names later, for example, one secret key per backend component, so you can rotate them independently. For an initial migration, the `default` publishable and secret keys are all you need.

## Step 2: Swap the publishable key in client code#

Anywhere you use the `anon` key in public code, switch to the publishable key. This includes web pages, mobile and desktop apps, and any CLI or script that ships to users.
[code] 
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient(
    
    4
    
      'https://your-project.supabase.co',
    
    5
    
      'sb_publishable_...' // was the anon key
    
    6
    
    )
[/code]

The publishable key carries the same low privileges as the `anon` key, so your [Row Level Security](</docs/guides/database/postgres/row-level-security>) policies behave the same. User authentication through Supabase Auth is unchanged. The user still signs in and gets their own JWT.

## Step 3: Swap the secret key in backend code#

Anywhere you use the `service_role` key on a server you control, switch to a secret key.
[code] 
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabaseAdmin = createClient(
    
    4
    
      'https://your-project.supabase.co',
    
    5
    
      'sb_secret_...' // was the service_role key
    
    6
    
    )
[/code]

Secret keys add protections the `service_role` key doesn't have. They return HTTP 401 if used in a browser (matched on the `User-Agent` header), and you can run a separate key per service so a single leak only forces one rotation.

Secret keys bypass Row Level Security and have full access to your data. Keep them on backends you control, out of source control, and out of client code.

### Database Webhooks and `pg_net`#

Calls made from Postgres with `pg_net`, including Database Webhooks, usually send the `service_role` key on the `Authorization: Bearer` header. The new secret keys aren't JWTs, so they're rejected there. Send the secret key on the `apikey` header instead.
[code] 
    1
    
    -- before
    
    2
    
    select net.http_post(
    
    3
    
      url := 'https://your-project.supabase.co/functions/v1/your-function',
    
    4
    
      headers := jsonb_build_object(
    
    5
    
        'Content-Type', 'application/json',
    
    6
    
        'Authorization', 'Bearer <service_role key>'
    
    7
    
      ),
    
    8
    
      body := jsonb_build_object('event', 'ping')
    
    9
    
    );
    
    10
    
    11
    
    -- after
    
    12
    
    select net.http_post(
    
    13
    
      url := 'https://your-project.supabase.co/functions/v1/your-function',
    
    14
    
      headers := jsonb_build_object(
    
    15
    
        'Content-Type', 'application/json',
    
    16
    
        'apikey', 'sb_secret_...'
    
    17
    
      ),
    
    18
    
      body := jsonb_build_object('event', 'ping')
    
    19
    
    );
[/code]

For Database Webhooks created in the Dashboard, edit each webhook's HTTP headers: remove the `Authorization` header that holds the key and add an `apikey` header with a secret key instead.

Don't hardcode a secret key in SQL or a webhook configuration, where it's stored in plain text. Store it in [Vault](</docs/guides/database/vault>) and read it at call time:
[code]
    1
    
    headers := jsonb_build_object(
    
    2
    
      'Content-Type', 'application/json',
    
    3
    
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    
    4
    
    )
[/code]

## Step 4: Update Edge Functions#

Edge Functions read their keys from environment variables. Supabase adds two new ones to your functions' environment, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`, alongside the legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Confirm they exist in the [**Edge Functions > Secrets**](</dashboard/project/_/functions/secrets>) section of the Dashboard before you start.

You have two options: a minimal change that swaps which variable you read, or a fuller upgrade to the [`@supabase/server`](<https://github.com/supabase/server>) SDK.

### Option 1: Read the new keys from the environment#

For most functions, the only change is how you read the key. The legacy variables held a plain string. The new ones hold a JSON object keyed by name, so you parse them and read the key by name. The key you created in step 1 is named `default`.
[code] 
    1
    
    // before
    
    2
    
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    3
    
    4
    
    // after
    
    5
    
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default']
[/code]

The publishable keys work the same way through `SUPABASE_PUBLISHABLE_KEYS`. Read [the Managing Secrets guide](</docs/guides/functions/secrets>) for more on environment variables in Edge Functions.

If you created more than one secret key in step 1, every key lives in the same `SUPABASE_SECRET_KEYS` object, each under its own name. Read a non-default key the same way:
[code] 
    1
    
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    
    2
    
    3
    
    const defaultKey = secretKeys['default']
    
    4
    
    const billingKey = secretKeys['billing'] // the secret key you named "billing"
[/code]

Send publishable and secret keys on the `apikey` header only. If you also pass the key on the `Authorization: Bearer` header, which many Supabase clients do by default, the platform tries to parse it as a JWT and rejects the request with `Invalid JWT`. The platform's built-in `verify_jwt` check only understands the legacy JWT-based keys, so set `verify_jwt = false` for these functions and authorize the request in your own code, or let the `@supabase/server` SDK do it for you (Option 2).
[code] 
    1
    
    [functions.my-function]
    
    2
    
    verify_jwt = false
[/code]

### Option 2: Adopt the @supabase/server SDK#

To get the most out of the new key model, migrate to the [`@supabase/server`](<https://github.com/supabase/server>) SDK. It removes the client-setup boilerplate every function repeats: reading keys from the environment, parsing the `Authorization` header, and initializing a user-scoped client and a separate admin client. You declare who can call the function, and get both clients ready to use on `ctx` (`ctx.supabase` respects Row Level Security, `ctx.supabaseAdmin` uses the secret key). This is the recommended approach for new functions.

Wrap your existing `Deno.serve` handler with `withSupabase` and declare an `auth` mode for who can call it. Keep `verify_jwt = false` so the SDK does the authorization.

For a function your users call from the client, use `auth: 'user'`. The SDK validates the user's session JWT and gives you a client scoped to their Row Level Security policies.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    Deno.serve(
    
    4
    
      withSupabase({ auth: 'user' }, async (_req, ctx) => {
    
    5
    
        // ctx.supabase is scoped to the authenticated user
    
    6
    
        return Response.json({ email: ctx.userClaims?.email })
    
    7
    
      })
    
    8
    
    )
[/code]

For a function called by your own backend, a worker, or `pg_net`, use `auth: 'secret'`. The SDK validates the secret key and gives you a client that bypasses Row Level Security.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    Deno.serve(
    
    4
    
      withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    
    5
    
        // ctx.supabaseAdmin is authenticated with a valid secret key
    
    6
    
        return Response.json({ ok: true })
    
    7
    
      })
    
    8
    
    )
[/code]

To accept a specific named key instead of `default`, add its name after the mode with a colon. For example, `auth: 'secret:billing'` validates the request against the secret key you named `billing`, and `auth: 'publishable:web'` against a publishable key named `web`.

`withSupabase` returns a standard request handler, so you can also export it as a `fetch` handler instead of passing it to `Deno.serve`:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    
    5
    
        // ctx.supabase is scoped to the authenticated user
    
    6
    
        return Response.json({ email: ctx.userClaims?.email })
    
    7
    
      }),
    
    8
    
    }
[/code]

`export default { fetch }` is equivalent to `Deno.serve(...)`: both define a request handler. The `fetch` style is portable across Edge Functions, Cloudflare Workers, and Bun, so prefer it if you want the same function to run in more than one environment. `Deno.serve` keeps working on Edge Functions, so you can leave it in place during a migration and switch later.

A good way to try this is to duplicate one of your functions and migrate the copy first. See [Securing Edge Functions](</docs/guides/functions/auth>) for every auth mode and use case, and [Authorization headers](</docs/guides/functions/auth-headers>) for how the headers work.

## Step 5: Verify nothing uses the legacy keys#

Before turning the legacy keys off, confirm nothing still depends on them. There's no automatic usage indicator, so this is a manual check. Go through every place that holds a Supabase key and make sure it now uses a publishable or secret key.

Don't forget callers that are easy to miss:

  * Mobile or desktop app versions already in users' hands.
  * CI/CD pipelines and deployment scripts.
  * Third-party integrations and webhooks.
  * Cron jobs, workers, and `pg_net` calls or Database Webhooks (see Database Webhooks and `pg_net`).


## Step 6: Deactivate the legacy keys#

Once you've confirmed nothing uses the legacy keys, deactivate them in the [**Settings > API Keys**](</dashboard/project/_/settings/api-keys/>) section of the Dashboard. You can re-activate them if you find a client you missed, so this step is reversible.

## Known limitations#

A few behaviors differ from the legacy JWT-based keys. Plan for them during the migration:

  * You can't send a publishable or secret key in the `Authorization: Bearer ...` header. Send it on the `apikey` header instead.
  * Edge Functions don't verify the `apikey` header for the new keys. Use `verify_jwt = false` and authorize in code, as shown in Step 4.
  * Public Realtime connections are limited to 24 hours unless the connection is upgraded with user-level authentication through Supabase Auth or a supported third-party auth provider.


## Next steps#

After migrating your keys, consider moving to the [JWT signing keys](</docs/guides/auth/signing-keys>) system as well. This is a separate, independent migration. The new publishable and secret keys aren't JWTs, so they no longer touch your project's JWT secret. But the access tokens Supabase Auth issues to your users are still signed by that shared secret. Signing keys replace it with rotatable keys you can change without downtime. Together, the two migrations get your whole project off the shared JWT secret.