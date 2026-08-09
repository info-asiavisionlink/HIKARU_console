---
タイトル: Function Configuration
URL: https://supabase.com/docs/guides/functions/function-configuration
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: configuration, edge-functions, function, function-configuration, functions
---

# Function Configuration

**URL:** https://supabase.com/docs/guides/functions/function-configuration
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** configuration, edge-functions, function, function-configuration, functions

## 目次

- [Configuration#](#configuration)
- [Skipping authorization checks#](#skipping-authorization-checks)
- [Custom entrypoints#](#custom-entrypoints)

## 概要

Learn how to configure your functions in Supabase.

---

## Configuration#

By default, all your Edge Functions have the same settings. In real applications, however, you might need different behaviors between functions.

For example:

  * **Stripe webhooks** need to be publicly accessible (Stripe doesn't have your user tokens)
  * **User profile APIs** should require authentication
  * **Some functions** might need special dependencies or different file types


To enable these per-function rules, create `supabase/config.toml` in your project root:
[code] 
    1
    
    # Disables authentication for the Stripe webhook.
    
    2
    
    [functions.stripe-webhook]
    
    3
    
    verify_jwt = false
    
    4
    
    5
    
    # Custom dependencies for this specific function
    
    6
    
    [functions.image-processor]
    
    7
    
    import_map = './functions/image-processor/import_map.json'
    
    8
    
    9
    
    # Custom entrypoint for legacy function using JavaScript
    
    10
    
    [functions.legacy-processor]
    
    11
    
    entrypoint = './functions/legacy-processor/index.js
[/code]

This configuration tell Supabase that the `stripe-webhook` function doesn't require a valid JWT, the `image-processor` function uses a custom import map, and `legacy-processor` uses a custom entrypoint.

You set these rules once and never worry about them again. Deploy your functions knowing that the security and behavior is exactly what each endpoint needs.

To see more general `config.toml` options, check out [this guide](</docs/guides/local-development/managing-config>).

* * *

## Skipping authorization checks#

By default, Edge Functions require a valid JWT in the authorization header. If you want to use Edge Functions without Authorization checks (commonly used for Stripe webhooks), you can configure this in your `config.toml`:
[code] 
    1
    
    [functions.stripe-webhook]
    
    2
    
    verify_jwt = false
[/code]

You can also pass the `--no-verify-jwt` flag when serving your Edge Functions locally:
[code] 
    1
    
    supabase functions serve hello-world --no-verify-jwt
[/code]

Be careful when using this flag, as it will allow anyone to invoke your Edge Function without a valid JWT. The Supabase client libraries automatically handle authorization.

* * *

## Custom entrypoints#

`entrypoint` is available only in Supabase CLI version 1.215.0 or higher.

When you create a new Edge Function, it will use TypeScript by default. However, it is possible to write and deploy Edge Functions using pure JavaScript.

Save your Function as a JavaScript file (e.g. `index.js`) update the `supabase/config.toml` :
[code] 
    1
    
    [functions.hello-world]
    
    2
    
    entrypoint = './index.js' # path must be relative to config.toml
[/code]

You can use any `.ts`, `.js`, `.tsx`, `.jsx` or `.mjs` file as the entrypoint for a Function.