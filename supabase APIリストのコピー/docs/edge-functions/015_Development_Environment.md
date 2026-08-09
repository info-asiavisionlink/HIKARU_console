---
タイトル: Development Environment
URL: https://supabase.com/docs/guides/functions/development-environment
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: development, development-environment, edge-functions, environment, functions
---

# Development Environment

**URL:** https://supabase.com/docs/guides/functions/development-environment
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** development, development-environment, edge-functions, environment, functions

## 目次

- [Step 1: Install Deno CLI#](#step-1-install-deno-cli)
- [Step 2: Set up your editor#](#step-2-set-up-your-editor)
  - [VSCode/Cursor (recommended)#](#vscodecursor-recommended)
  - [Multi-root workspaces#](#multi-root-workspaces)
- [Recommended project structure#](#recommended-project-structure)
- [Essential CLI commands#](#essential-cli-commands)
  - [supabase start#](#supabase-start)
  - [supabase functions serve [function-name]#](#supabase-functions-serve-function-name)
  - [supabase functions deploy hello-world#](#supabase-functions-deploy-hello-world)

## 概要

Get the best Edge Functions experience with the right local developer environment.

---

Before getting started, make sure you have the Supabase CLI installed. Check out the [CLI installation guide](</docs/guides/local-development>) for installation methods and troubleshooting.

* * *

## Step 1: Install Deno CLI#

The Supabase CLI doesn't use the standard Deno CLI to serve functions locally. Instead, it uses its own Edge Runtime to keep the development and production environment consistent.

You can follow the [Deno guide](<https://deno.com/manual@v1.32.5/getting_started/setup_your_environment>) for setting up your development environment with your favorite editor/IDE.

The benefit of installing Deno separately is that you can use the Deno LSP to improve your editor's autocompletion, type checking, and testing. You can also use Deno's built-in tools such as `deno fmt`, `deno lint`, and `deno test`.

After installing, you should have Deno installed and available in your terminal. Verify with `deno --version`

* * *

## Step 2: Set up your editor#

Set up your editor environment for proper TypeScript support, autocompletion, and error detection.

### VSCode/Cursor (recommended)#

  1. **Install the Deno extension** from the VSCode marketplace

  2. **Option 1: Auto-generate (easiest)** When running `supabase init`, select `y` when prompted "Generate VS Code settings for Deno? [y/N]"

  3. **Option 2: Manual setup**

Create a `.vscode/settings.json` in your project root:
[code] 1
         
         {
         
         2
         
           "deno.enablePaths": ["./supabase/functions"],
         
         3
         
           "deno.importMap": "./supabase/functions/deno.json"
         
         4
         
         }
[/code]


This configuration enables the Deno language server only for the `supabase/functions` folder, while using VSCode's built-in JavaScript/TypeScript language server for all other files.

* * *

### Multi-root workspaces#

The standard `.vscode/settings.json` setup works perfectly for projects where your Edge Functions live alongside your main application code. However, you might need multi-root workspaces if your development setup involves:

  * **Multiple repositories:** Edge Functions in one repo, main app in another
  * **Microservices:** Several services you need to develop in parallel


For this development workflow, create `edge-functions.code-workspace`:
[code] 
    1
    
    {
    
    2
    
      "folders": [
    
    3
    
        {
    
    4
    
          "name": "project-root",
    
    5
    
          "path": "./"
    
    6
    
        },
    
    7
    
        {
    
    8
    
          "name": "test-client",
    
    9
    
          "path": "app"
    
    10
    
        },
    
    11
    
        {
    
    12
    
          "name": "supabase-functions",
    
    13
    
          "path": "supabase/functions"
    
    14
    
        }
    
    15
    
      ],
    
    16
    
      "settings": {
    
    17
    
        "files.exclude": {
    
    18
    
          "node_modules/": true,
    
    19
    
          "app/": true,
    
    20
    
          "supabase/functions/": true
    
    21
    
        },
    
    22
    
        "deno.importMap": "./supabase/functions/import_map.json"
    
    23
    
      }
    
    24
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/edge-functions.code-workspace>)

You can find the complete example on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions>).

* * *

## Recommended project structure#

It's recommended to organize your functions according to the following structure:
[code] 
    1
    
    └── supabase
    
    2
    
        ├── functions
    
    3
    
        │   ├── deno.json           # Top-level Deno configuration
    
    4
    
        │   ├── _shared             # Shared code (underscore prefix)
    
    5
    
        │   │   ├── supabaseAdmin.ts # Supabase client with SECRET key
    
    6
    
        │   │   ├── supabaseClient.ts # Supabase client with PUBLISHABLE key
    
    7
    
        │   │   └── cors.ts         # Reusable CORS headers
    
    8
    
        │   ├── function-one        # Use hyphens for function names
    
    9
    
        │   │   └── index.ts
    
    10
    
        │   └── function-two
    
    11
    
        │       └── index.ts
    
    12
    
        ├── tests
    
    13
    
        │   ├── function-one-test.ts
    
    14
    
        │   └── function-two-test.ts
    
    15
    
        ├── migrations
    
    16
    
        └── config.toml
[/code]

  * **Use "fat functions"**. Develop few, large functions by combining related functionality. This minimizes cold starts.
  * **Name functions with hyphens (`-`)**. This is the most URL-friendly approach
  * **Store shared code in`_shared`**. Store any shared code in a folder prefixed with an underscore (`_`).
  * **Separate tests**. Use a separate folder for [Unit Tests](</docs/guides/functions/unit-test>) that includes the name of the function followed by a `-test` suffix.


* * *

## Essential CLI commands#

Get familiar with the most commonly used CLI commands for developing and deploying Edge Functions.

### `supabase start`#

This command spins up your entire Supabase stack locally: database, auth, storage, and Edge Functions runtime. You're developing against the exact same environment you'll deploy to.

### `supabase functions serve [function-name]`#

Develop a specific function with hot reloading. Your functions run at `http://localhost:54321/functions/v1/[function-name]`. When you save your file, you’ll see the changes instantly without having to wait.

Alternatively, use `supabase functions serve` to serve all functions at once.

### `supabase functions deploy hello-world`#

Deploy the function when you’re ready