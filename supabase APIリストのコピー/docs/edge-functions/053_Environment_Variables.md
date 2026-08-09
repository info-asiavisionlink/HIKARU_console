---
タイトル: Environment Variables
URL: https://supabase.com/docs/guides/functions/secrets
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, environment, functions, secrets, variables
---

# Environment Variables

**URL:** https://supabase.com/docs/guides/functions/secrets
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, environment, functions, secrets, variables

## 目次

- [Default secrets#](#default-secrets)
- [Accessing environment variables#](#accessing-environment-variables)
  - [Local secrets#](#local-secrets)
  - [Production secrets#](#production-secrets)

## 概要

Managing secrets and environment variables.

---

## Default secrets#

Edge Functions have access to these secrets by default:

  * `SUPABASE_URL`: The API gateway for your Supabase project
  * `SUPABASE_DB_URL`: The URL for your Postgres database. You can use this to connect directly to your database
  * `SUPABASE_PUBLISHABLE_KEYS`: The `publishable` keys JSON dictionary for your Supabase API. This is safe to use in a browser when you have Row Level Security enabled
  * `SUPABASE_SECRET_KEYS`: The `secret` keys JSON dictionary for your Supabase API. This is safe to use in Edge Functions, but it should NEVER be used in a browser. This key will bypass Row Level Security
  * `SUPABASE_JWKS`: The JSON Web Key Set used to verify user JWTs. Same value served at `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`


Legacy keys:

  * `SUPABASE_ANON_KEY`: The `anon` key for your Supabase API. This is safe to use in a browser when you have Row Level Security enabled
  * `SUPABASE_SERVICE_ROLE_KEY`: The `service_role` key for your Supabase API. This is safe to use in Edge Functions, but it should NEVER be used in a browser. This key will bypass Row Level Security


In a hosted environment, functions have access to the following environment variables:

  * `SB_REGION`: The region function was invoked
  * `SB_EXECUTION_ID`: A UUID of function instance ([isolate](</docs/guides/functions/architecture#4-execution-mechanics-fast-and-isolated>))
  * `DENO_DEPLOYMENT_ID`: Version of the function code (`{project_ref}_{function_id}_{version}`)


* * *

## Accessing environment variables#

You can access environment variables using Deno's built-in handler, and passing it the name of the environment variable you’d like to access.
[code] 
    1
    
    Deno.env.get('NAME_OF_SECRET')
[/code]

For example, in a function:
[code] 
    1
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    2
    
    3
    
    const SUPABASE_PUBLISHABLE_KEYS = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    
    4
    
    5
    
    // For user-facing operations (respects RLS)
    
    6
    
    const supabase = createClient(
    
    7
    
      Deno.env.get('SUPABASE_URL')!,
    
    8
    
      // If you want to use a different api key, change 'default' to your preferred key name
    
    9
    
      SUPABASE_PUBLISHABLE_KEYS['default']
    
    10
    
    )
    
    11
    
    12
    
    const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    
    13
    
    // For admin operations (bypasses RLS)
    
    14
    
    const supabaseAdmin = createClient(
    
    15
    
      Deno.env.get('SUPABASE_URL')!,
    
    16
    
      // If you want to use a different api key, change 'default' to your preferred key name
    
    17
    
      SUPABASE_SECRET_KEYS['default']
    
    18
    
    )
[/code]

* * *

### Local secrets#

In development, you can load environment variables in two ways:

  1. Through an `.env` file placed at `supabase/functions/.env`, which is automatically loaded on `supabase start`
  2. Through the `--env-file` option for `supabase functions serve`. This allows you to use custom file names like `.env.local` to distinguish between different environments.


[code] 
    1
    
    supabase functions serve --env-file .env.local
[/code]

Never check your `.env` files into Git! Instead, add the path to this file to your `.gitignore`.

We can automatically access the secrets in our Edge Functions through Deno’s handler
[code] 
    1
    
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
[/code]

Now we can invoke our function locally. If you're using the default `.env` file at `supabase/functions/.env`, it's automatically loaded:
[code] 
    1
    
    supabase functions serve hello-world
[/code]

Or you can specify a custom `.env` file with the `--env-file` flag:
[code] 
    1
    
    supabase functions serve hello-world --env-file .env.local
[/code]

This is useful for managing different environments (development, staging, etc.).

* * *

### Production secrets#

You will also need to set secrets for your production Edge Functions. You can do this via the Dashboard or using the CLI.

**Using the Dashboard** :

  1. Visit [Edge Function Secrets Management](</dashboard/project/_/functions/secrets>) page in your Dashboard.
  2. Add the Key and Value for your secret and press Save

![Edge Functions Secrets Management](/docs/_next/image?url=%2Fdocs%2Fimg%2Fedge-functions-secrets--light.jpg&w=3840&q=75)

Note that you can paste multiple secrets at a time.

**Using the CLI**

You can create a `.env` file to help deploy your secrets to production
[code] 
    1
    
    # .env
    
    2
    
    STRIPE_SECRET_KEY=sk_live_...
[/code]

Never check your `.env` files into Git! Instead, add the path to this file to your `.gitignore`.

You can push all the secrets from the `.env` file to your remote project using `supabase secrets set`. This makes the environment visible in the dashboard as well.
[code] 
    1
    
    supabase secrets set --env-file .env
[/code]

Alternatively, this command also allows you to set production secrets individually rather than storing them in a `.env` file.
[code] 
    1
    
    supabase secrets set STRIPE_SECRET_KEY=sk_live_...
[/code]

To see all the secrets which you have set remotely, you can use `supabase secrets list`
[code] 
    1
    
    supabase secrets list
[/code]

You don't need to re-deploy after setting your secrets. They're available immediately in your functions.