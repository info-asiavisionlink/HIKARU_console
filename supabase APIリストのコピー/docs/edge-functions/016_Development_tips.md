---
タイトル: Development tips
URL: https://supabase.com/docs/guides/functions/development-tips
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: development, development-tips, edge-functions, functions, tips
---

# Development tips

**URL:** https://supabase.com/docs/guides/functions/development-tips
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** development, development-tips, edge-functions, functions, tips

## 目次

- [Using HTTP methods#](#using-http-methods)
- [Naming Edge Functions#](#naming-edge-functions)
- [Organizing your Edge Functions#](#organizing-your-edge-functions)
- [Using config.toml#](#using-configtoml)
- [Not using TypeScript#](#not-using-typescript)
- [Error handling#](#error-handling)
- [Database Functions vs Edge Functions#](#database-functions-vs-edge-functions)

## 概要

Tips for getting started with Edge Functions.

---

Here are a few recommendations when you first start developing Edge Functions.

## Using HTTP methods#

Edge Functions support `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`. A Function can be designed to perform different actions based on a request's HTTP method. See the [example on building a RESTful service](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/restful-tasks>) to learn how to handle different HTTP methods in your Function.

HTML not supported

HTML content is not supported. `GET` requests that return `text/html` will be rewritten to `text/plain`.

## Naming Edge Functions#

We recommend using hyphens to name functions because hyphens are the most URL-friendly of all the naming conventions (snake_case, camelCase, PascalCase).

## Organizing your Edge Functions#

We recommend developing "fat functions". This means that you should develop few large functions, rather than many small functions. One common pattern when developing Functions is that you need to share code between two or more Functions. To do this, you can store any shared code in a folder prefixed with an underscore (`_`). We also recommend a separate folder for [Unit Tests](</docs/guides/functions/unit-test>) including the name of the function followed by a `-test` suffix. We recommend this folder structure:
[code] 
    1
    
    └── supabase
    
    2
    
        ├── functions
    
    3
    
        │   ├── import_map.json # A top-level import map to use across functions.
    
    4
    
        │   ├── _shared
    
    5
    
        │   │   ├── supabaseAdmin.ts # Supabase client with SECRET key.
    
    6
    
        │   │   └── supabaseClient.ts # Supabase client with PUBLISHABLE key.
    
    7
    
        │   │   └── cors.ts # Reusable CORS headers.
    
    8
    
        │   ├── function-one # Use hyphens to name functions.
    
    9
    
        │   │   └── index.ts
    
    10
    
        │   └── function-two
    
    11
    
        │   │   └── index.ts
    
    12
    
        │   └── tests
    
    13
    
        │       └── function-one-test.ts
    
    14
    
        │       └── function-two-test.ts
    
    15
    
        ├── migrations
    
    16
    
        └── config.toml
[/code]

## Using config.toml#

Individual function configuration like [JWT verification](</docs/guides/local-development/cli/config#functions.function_name.verify_jwt>) and [import map location](</docs/guides/local-development/cli/config#functions.function_name.import_map>) can be set via the `config.toml` file.
[code] 
    1
    
    [functions.hello-world]
    
    2
    
    verify_jwt = false
    
    3
    
    import_map = './import_map.json'
[/code]

## Not using TypeScript#

When you create a new Edge Function, it will use TypeScript by default. However, it is possible to write and deploy Edge Functions using pure JavaScript.

Save your Function as a JavaScript file (e.g. `index.js`) and then update the `supabase/config.toml` as follows:

`entrypoint` is available only in Supabase CLI version 1.215.0 or higher.
[code] 
    1
    
    [functions.hello-world]
    
    2
    
    # other entries
    
    3
    
    entrypoint = './functions/hello-world/index.js' # path must be relative to config.toml
[/code]

You can use any `.ts`, `.js`, `.tsx`, `.jsx` or `.mjs` file as the `entrypoint` for a Function.

## Error handling#

The `supabase-js` library provides several error types that you can use to handle errors that might occur when invoking Edge Functions:
[code] 
    1
    
    import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
    
    2
    
    3
    
    const { data, error } = await supabase.functions.invoke('hello', {
    
    4
    
      headers: { 'my-custom-header': 'my-custom-header-value' },
    
    5
    
      body: { foo: 'bar' },
    
    6
    
    })
    
    7
    
    8
    
    if (error instanceof FunctionsHttpError) {
    
    9
    
      const errorMessage = await error.context.json()
    
    10
    
      console.log('Function returned an error', errorMessage)
    
    11
    
    } else if (error instanceof FunctionsRelayError) {
    
    12
    
      console.log('Relay error:', error.message)
    
    13
    
    } else if (error instanceof FunctionsFetchError) {
    
    14
    
      console.log('Fetch error:', error.message)
    
    15
    
    }
[/code]

## Database Functions vs Edge Functions#

For data-intensive operations we recommend using [Database Functions](</docs/guides/database/functions>), which are executed within your database and can be called remotely using the [REST and GraphQL API](</docs/guides/api>).

For use-cases which require low-latency we recommend [Edge Functions](</docs/guides/functions>), which are globally-distributed and can be written in TypeScript.