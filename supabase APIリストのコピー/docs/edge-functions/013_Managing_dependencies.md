---
タイトル: Managing dependencies
URL: https://supabase.com/docs/guides/functions/dependencies
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: dependencies, edge-functions, functions, managing
---

# Managing dependencies

**URL:** https://supabase.com/docs/guides/functions/dependencies
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** dependencies, edge-functions, functions, managing

## 目次

- [Importing dependencies#](#importing-dependencies)
  - [Usingdeno.json(recommended)#](#using-denojson-recommended)
  - [Using import maps (legacy)#](#using-import-maps-legacy)
- [Private NPM packages#](#private-npm-packages)
- [Using a custom NPM registry#](#using-a-custom-npm-registry)
- [Importing types#](#importing-types)

## 概要

Managing packages and dependencies.

---

## Importing dependencies#

Supabase Edge Functions support several ways to import dependencies:

  * JavaScript modules from npm (<https://docs.deno.com/examples/npm/>[](<https://docs.deno.com/examples/npm/>))
  * Built-in [Node APIs](<https://docs.deno.com/runtime/manual/node/compatibility>)
  * Modules published to [JSR](<https://jsr.io/>) or [deno.land/x](<https://deno.land/x>)


[code] 
    1
    
    // NPM packages (recommended)
    
    2
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    3
    
    4
    
    // Node.js built-ins
    
    5
    
    import process from 'node:process'
    
    6
    
    7
    
    // JSR modules (Deno's registry)
    
    8
    
    import path from 'jsr:@std/path@1.0.8'
[/code]

### Using `deno.json` (recommended)#

Each function should have its own `deno.json` file to manage dependencies and configure Deno-specific settings. This ensures proper isolation between functions and is the recommended approach for deployment. When you update the dependencies for one function, it won't accidentally break another function that needs different versions.
[code] 
    1
    
    {
    
    2
    
      "imports": {
    
    3
    
        "supabase": "npm:@supabase/supabase-js@2",
    
    4
    
        "lodash": "https://cdn.skypack.dev/lodash"
    
    5
    
      }
    
    6
    
    }
[/code]

You can add this file directly to the function’s own directory:
[code] 
    1
    
    └── supabase
    
    2
    
        ├── functions
    
    3
    
        │   ├── function-one
    
    4
    
        │   │   ├── index.ts
    
    5
    
        │   │   └── deno.json    # Function-specific Deno configuration
    
    6
    
        │   └── function-two
    
    7
    
        │       ├── index.ts
    
    8
    
        │       └── deno.json    # Function-specific Deno configuration
    
    9
    
        └── config.toml
[/code]

It's possible to use a global `deno.json` in the `/supabase/functions` directory for local development, but this approach is not recommended for deployment. Each function should maintain its own configuration to ensure proper isolation and dependency management.

### Using import maps (legacy)#

Import Maps are a legacy way to manage dependencies, similar to a `package.json` file. While still supported, we recommend using `deno.json`. If both exist, `deno.json` takes precedence.

Each function should have its own `import_map.json` file for proper isolation:
[code] 
    1
    
    # /function-one/import_map.json
    
    2
    
    {
    
    3
    
      "imports": {
    
    4
    
        "lodash": "https://cdn.skypack.dev/lodash"
    
    5
    
      }
    
    6
    
    }
[/code]

This JSON file should be located within the function’s own directory:
[code] 
    1
    
    └── supabase
    
    2
    
        ├── functions
    
    3
    
        │   ├── function-one
    
    4
    
        │   │   ├── index.ts
    
    5
    
        │   │   └── import_map.json    # Function-specific import map
[/code]

It's possible to use a global `import_map.json` in the `/supabase/functions` directory for local development, but this approach is not recommended for deployment. Each function should maintain its own configuration to ensure proper isolation and dependency management.

If you’re using import maps with VSCode, update your `.vscode/settings.json` to point to your function-specific import map:
[code] 
    1
    
    {
    
    2
    
      "deno.enable": true,
    
    3
    
      "deno.unstable": ["bare-node-builtins", "byonm"],
    
    4
    
      "deno.importMap": "./supabase/functions/function-one/import_map.json"
    
    5
    
    }
[/code]

You can override the default import map location using the `--import-map <string>` flag with serve and deploy commands, or by setting the `import_map` property in your `config.toml` file:
[code] 
    1
    
    [functions.my-function]
    
    2
    
    import_map = "./supabase/functions/function-one/import_map.json"
[/code]

* * *

## Private NPM packages#

To use private npm packages, create a `.npmrc` file within your function’s own directory.

This feature requires Supabase CLI version 1.207.9 or higher.
[code] 
    1
    
    └── supabase
    
    2
    
        └── functions
    
    3
    
            └── my-function
    
    4
    
                ├── index.ts
    
    5
    
                ├── deno.json
    
    6
    
                └── .npmrc       # Function-specific npm configuration
[/code]

It's possible to use a global `.npmrc` in the `/supabase/functions` directory for local development, but this approach is not recommended for deployment. Each function should maintain its own configuration to ensure proper isolation and dependency management.

Add your registry details in the `.npmrc` file. Follow [this guide](<https://docs.npmjs.com/cli/v10/configuring-npm/npmrc>) to learn more about the syntax of npmrc files.
[code] 
    1
    
    # /my-function/.npmrc
    
    2
    
    @myorg:registry=https://npm.registryhost.com
    
    3
    
    //npm.registryhost.com/:_authToken=VALID_AUTH_TOKEN
[/code]

After configuring your `.npmrc`, you can import the private package in your function code:
[code] 
    1
    
    import package from 'npm:@myorg/private-package@v1.0.1'
[/code]

* * *

## Using a custom NPM registry#

This feature requires Supabase CLI version 2.2.8 or higher.

Some organizations require a custom NPM registry for security and compliance purposes. In such cases, you can specify the custom NPM registry to use via `NPM_CONFIG_REGISTRY` environment variable.

You can define it in the project's `.env` file or directly specify it when running the deploy command:
[code] 
    1
    
    NPM_CONFIG_REGISTRY=https://custom-registry/ supabase functions deploy my-function
[/code]

* * *

## Importing types#

If your [environment is set up properly](</docs/guides/functions/development-environment>) and the module you're importing is exporting types, the import will have types and autocompletion support.

Some npm packages may not ship out of the box types and you may need to import them from a separate package. You can specify their types with a `@deno-types` directive:
[code] 
    1
    
    // @deno-types="npm:@types/express@^4.17"
    
    2
    
    import express from 'npm:express@^4.17'
[/code]

To include types for built-in Node APIs, add the following line to the top of your imports:
[code] 
    1
    
    /// <reference types="npm:@types/node" />
[/code]