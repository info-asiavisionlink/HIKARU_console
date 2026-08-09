---
タイトル: Image Manipulation
URL: https://supabase.com/docs/guides/functions/examples/image-manipulation
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, image, image-manipulation, manipulation
---

# Image Manipulation

**URL:** https://supabase.com/docs/guides/functions/examples/image-manipulation
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, image, image-manipulation, manipulation

## 目次

- [Prerequisites#](#prerequisites)
- [Create the Edge Function#](#create-the-edge-function)
- [Write the function#](#write-the-function)
- [Test it locally#](#test-it-locally)
- [Deploy to your hosted project#](#deploy-to-your-hosted-project)

## 概要

How to optimize and transform images using Edge Functions.

---

Supabase Storage has [out-of-the-box support](</docs/guides/storage/serving/image-transformations?queryGroups=language&language=js>) for the most common image transformations and optimizations you need. If you need to do anything custom beyond what Supabase Storage provides, you can use Edge Functions to write custom image manipulation scripts.

In this example, we will use [`magick-wasm`](<https://github.com/dlemstra/magick-wasm>) to perform image manipulations. `magick-wasm` is the WebAssembly port of the popular ImageMagick library and supports processing over 100 file formats.

Edge Functions currently doesn't support image processing libraries such as `Sharp`, which depend on native libraries. Only WASM-based libraries are supported.

## Prerequisites#

Make sure you have the latest version of the [Supabase CLI](</docs/guides/local-development/cli/getting-started#installing-the-supabase-cli>) installed.

## Create the Edge Function#

Create a new function locally:
[code] 
    1
    
    supabase functions new image-blur
[/code]

## Write the function#

In this example, we are implementing a function allowing users to upload an image and get a blurred thumbnail.

Here's the implementation in `index.ts` file:
[code] 
    1
    
    // This is an example showing how to use Magick WASM to do image manipulations in Edge Functions.
    
    2
    
    //
    
    3
    
    import { ImageMagick, initializeImageMagick, MagickFormat } from 'npm:@imagemagick/magick-wasm@^0'
    
    4
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    5
    
    6
    
    const wasmBytes = await Deno.readFile(
    
    7
    
      new URL('magick.wasm', import.meta.resolve('npm:@imagemagick/magick-wasm@^0'))
    
    8
    
    )
    
    9
    
    await initializeImageMagick(wasmBytes)
    
    10
    
    11
    
    // Authenticated endpoint, so deploy with verify_jwt = true.
    
    12
    
    export default {
    
    13
    
      fetch: withSupabase({ auth: 'user' }, async (req, _ctx) => {
    
    14
    
        const formData = await req.formData()
    
    15
    
        const file = formData.get('file')
    
    16
    
        if (!(file instanceof Blob)) {
    
    17
    
          return Response.json({ error: 'file is required' }, { status: 400 })
    
    18
    
        }
    
    19
    
        const content = await file.bytes()
    
    20
    
    21
    
        let result = ImageMagick.read(content, (img): Uint8Array => {
    
    22
    
          // resize the image
    
    23
    
          img.resize(500, 300)
    
    24
    
          // add a blur of 60x5
    
    25
    
          img.blur(60, 5)
    
    26
    
    27
    
          return img.write((data) => data)
    
    28
    
        })
    
    29
    
    30
    
        return new Response(Uint8Array.from(result), {
    
    31
    
          headers: { 'Content-Type': 'image/png' },
    
    32
    
        })
    
    33
    
      }),
    
    34
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/image-manipulation/index.ts>)

## Test it locally#

You can test the function locally by running:
[code] 
    1
    
    supabase start
    
    2
    
    supabase functions serve --no-verify-jwt
[/code]

Then, make a request using `curl` or your favorite API testing tool.
[code] 
    1
    
    curl --location '<http://localhost:54321/functions/v1/image-blur>' \\
    
    2
    
    --form 'file=@"/path/to/image.png"'
    
    3
    
    --output '/path/to/output.png'
[/code]

If you open the `output.png` file you will find a transformed version of your original image.

## Deploy to your hosted project#

Deploy the function to your Supabase project.
[code] 
    1
    
    supabase link
    
    2
    
    supabase functions deploy image-blur
[/code]

Hosted Edge Functions have [limits](</docs/guides/functions/limits>) on memory and CPU usage.

If you try to perform complex image processing or handle large images (> 5MB) your function may return a resource limit exceeded error.