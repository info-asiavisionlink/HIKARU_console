---
タイトル: Using Wasm modules
URL: https://supabase.com/docs/guides/functions/wasm
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, functions, modules, using, wasm
---

# Using Wasm modules

**URL:** https://supabase.com/docs/guides/functions/wasm
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, functions, modules, using, wasm

## 目次

- [Writing a Wasm module#](#writing-a-wasm-module)
- [Calling the Wasm module from the Edge Function#](#calling-the-wasm-module-from-the-edge-function)
- [Bundle and deploy#](#bundle-and-deploy)

## 概要

How to use WebAssembly in Edge Functions.

---

Edge Functions supports running [WebAssembly (Wasm)](<https://developer.mozilla.org/en-US/docs/WebAssembly>) modules. WebAssembly is useful if you want to optimize code that's slower to run in JavaScript or require low-level manipulation.

This allows you to:

  * Optimize performance-critical code beyond JavaScript capabilities
  * Port existing libraries from other languages (C, C++, Rust) to JavaScript
  * Access low-level system operations not available in JavaScript


For example, libraries like [magick-wasm](</docs/guides/functions/examples/image-manipulation>) port existing C libraries to WebAssembly for complex image processing.

* * *

## Writing a Wasm module#

You can use different languages and SDKs to write Wasm modules. For this tutorial, we will write a basic Wasm module in Rust that adds two numbers.

Follow this [guide on writing Wasm modules in Rust](<https://developer.mozilla.org/en-US/docs/WebAssembly/Rust_to_Wasm>) to setup your dev environment.

1

Create a new Edge Function

Create a new Edge Function called `wasm-add`
[code]
    1
    
    supabase functions new wasm-add
[/code]

2

Create a new Cargo project

Create a new Cargo project for the Wasm module inside the function's directory:
[code]
    1
    
    cd supabase/functions/wasm-add
    
    2
    
    cargo new --lib add-wasm
[/code]

3

Add the Wasm module code

Add the following code to `add-wasm/src/lib.rs`.
[code]
    1
    
    use wasm_bindgen::prelude::*;
    
    2
    
    3
    
    #[wasm_bindgen]
    
    4
    
    pub fn add(a: u32, b: u32) -> u32 {
    
    5
    
        a + b
    
    6
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/wasm-modules/add-wasm/src/lib.rs>)

4

Update the Cargo.toml file

Update the `add-wasm/Cargo.toml` to include the `wasm-bindgen` dependency.
[code]
    1
    
    [package]
    
    2
    
    name = "add-wasm"
    
    3
    
    version = "0.1.0"
    
    4
    
    description = "A simple wasm module that adds two numbers"
    
    5
    
    license = "MIT/Apache-2.0"
    
    6
    
    edition = "2021"
    
    7
    
    8
    
    [lib]
    
    9
    
    crate-type = ["cdylib"]
    
    10
    
    11
    
    [dependencies]
    
    12
    
    wasm-bindgen = "0.2"
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/wasm-modules/add-wasm/Cargo.toml>)

5

Build the Wasm module

Build the package by running:
[code]
    1
    
    wasm-pack build --target deno
[/code]

This will produce a Wasm binary file inside `add-wasm/pkg` directory.

* * *

## Calling the Wasm module from the Edge Function#

Update your Edge Function to call the add function from the Wasm module:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    import { add } from './add-wasm/pkg/add_wasm.js'
    
    4
    
    5
    
    // Authenticated endpoint, so deploy with verify_jwt = true.
    
    6
    
    export default {
    
    7
    
      fetch: withSupabase({ auth: 'user' }, async (req) => {
    
    8
    
        const { a, b } = await req.json()
    
    9
    
        return Response.json({ result: add(a, b) })
    
    10
    
      }),
    
    11
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/wasm-modules/index.ts>)

Supabase Edge Functions currently use Deno 1.46. From [Deno 2.1, importing Wasm modules](<https://deno.com/blog/v2.1>) will require even less boilerplate code.

* * *

## Bundle and deploy#

Before deploying, ensure the Wasm module is bundled with your function by defining it in `supabase/config.toml`:

  * You will need update Supabase CLI to 2.7.0 or higher for the `static_files` support.
  * Static files cannot be deployed using the `--use-api` API flag. You need to build them with [Docker on the CLI](</docs/guides/functions/quickstart#step-6-deploy-to-production>).


[code] 
    1
    
    [functions.wasm-add]
    
    2
    
    static_files = [ "./functions/wasm-add/add-wasm/pkg/*"]
[/code]

Deploy the function by running:
[code] 
    1
    
    supabase functions deploy wasm-add
[/code]