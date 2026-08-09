---
タイトル: Integrating with Supabase Storage
URL: https://supabase.com/docs/guides/functions/storage-caching
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, functions, integrating, storage, storage-caching, supabase, with
---

# Integrating with Supabase Storage

**URL:** https://supabase.com/docs/guides/functions/storage-caching
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, functions, integrating, storage, storage-caching, supabase, with

## 目次

- [Basic file operations#](#basic-file-operations)
- [Cache-first pattern#](#cache-first-pattern)

## 概要

Integrate Edge Functions with Supabase Storage.

---

Edge Functions work seamlessly with [Supabase Storage](</docs/guides/storage>). This allows you to:

  * Upload generated content directly from your functions
  * Implement cache-first patterns for better performance
  * Serve files with built-in CDN capabilities


* * *

## Basic file operations#

Use the Supabase client to upload files directly from your Edge Functions. You'll need the secret key for server-side storage operations:
[code] 
    1
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    2
    
    3
    
    const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    
    4
    
    5
    
    Deno.serve(async (req) => {
    
    6
    
      const supabaseAdmin = createClient(
    
    7
    
        Deno.env.get('SUPABASE_URL')!,
    
    8
    
        // If you want to use a different api key, change 'default' to your preferred key name
    
    9
    
        SUPABASE_SECRET_KEYS['default']
    
    10
    
      )
    
    11
    
    12
    
      // Generate your content
    
    13
    
      const fileContent = await generateImage()
    
    14
    
    15
    
      // Upload to storage
    
    16
    
      const { data, error } = await supabaseAdmin.storage
    
    17
    
        .from('images')
    
    18
    
        .upload(`generated/${filename}.png`, fileContent.body!, {
    
    19
    
          contentType: 'image/png',
    
    20
    
          cacheControl: '3600',
    
    21
    
          upsert: false,
    
    22
    
        })
    
    23
    
    24
    
      if (error) {
    
    25
    
        throw error
    
    26
    
      }
    
    27
    
    28
    
      return new Response(JSON.stringify({ path: data.path }))
    
    29
    
    })
[/code]

Always use one of the `SUPABASE_SECRET_KEYS` for server-side operations. Never expose this key in client-side code!

* * *

## Cache-first pattern#

Check storage before generating new content to improve performance:
[code] 
    1
    
    const STORAGE_URL = 'https://your-project.supabase.co/storage/v1/object/public/images'
    
    2
    
    3
    
    Deno.serve(async (req) => {
    
    4
    
      const url = new URL(req.url)
    
    5
    
      const username = url.searchParams.get('username')
    
    6
    
    7
    
      try {
    
    8
    
        // Try to get existing file from storage first
    
    9
    
        const storageResponse = await fetch(`${STORAGE_URL}/avatars/${username}.png`)
    
    10
    
    11
    
        if (storageResponse.ok) {
    
    12
    
          // File exists in storage, return it directly
    
    13
    
          return storageResponse
    
    14
    
        }
    
    15
    
    16
    
        // File doesn't exist, generate it
    
    17
    
        const generatedImage = await generateAvatar(username)
    
    18
    
    19
    
        // Upload to storage for future requests
    
    20
    
        const { error } = await supabaseAdmin.storage
    
    21
    
          .from('images')
    
    22
    
          .upload(`avatars/${username}.png`, generatedImage.body!, {
    
    23
    
            contentType: 'image/png',
    
    24
    
            cacheControl: '86400', // Cache for 24 hours
    
    25
    
          })
    
    26
    
    27
    
        if (error) {
    
    28
    
          console.error('Upload failed:', error)
    
    29
    
        }
    
    30
    
    31
    
        return generatedImage
    
    32
    
      } catch (error) {
    
    33
    
        return new Response('Error processing request', { status: 500 })
    
    34
    
      }
    
    35
    
    })
[/code]