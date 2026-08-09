---
タイトル: Handling Compressed Requests
URL: https://supabase.com/docs/guides/functions/compression
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: compressed, compression, edge-functions, functions, handling, requests
---

# Handling Compressed Requests

**URL:** https://supabase.com/docs/guides/functions/compression
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** compressed, compression, edge-functions, functions, handling, requests

## 目次

（目次なし）

## 概要

Handling Gzip compressed requests.

---

To decompress Gzip bodies, you can use `gunzipSync` from the `node:zlib` API to decompress and then read the body.
[code] 
    1
    
    import { gunzipSync } from 'node:zlib'
    
    2
    
    3
    
    Deno.serve(async (req) => {
    
    4
    
      try {
    
    5
    
        // Check if the request body is gzip compressed
    
    6
    
        const contentEncoding = req.headers.get('content-encoding')
    
    7
    
        if (contentEncoding !== 'gzip') {
    
    8
    
          return new Response('Request body is not gzip compressed', {
    
    9
    
            status: 400,
    
    10
    
          })
    
    11
    
        }
    
    12
    
    13
    
        // Read the compressed body
    
    14
    
        const compressedBody = await req.arrayBuffer()
    
    15
    
    16
    
        // Decompress the body
    
    17
    
        const decompressedBody = gunzipSync(new Uint8Array(compressedBody))
    
    18
    
    19
    
        // Convert the decompressed body to a string
    
    20
    
        const decompressedString = new TextDecoder().decode(decompressedBody)
    
    21
    
        const data = JSON.parse(decompressedString)
    
    22
    
    23
    
        // Process the decompressed body as needed
    
    24
    
        console.log(`Received: ${JSON.stringify(data)}`)
    
    25
    
    26
    
        return new Response('ok', {
    
    27
    
          headers: { 'Content-Type': 'text/plain' },
    
    28
    
        })
    
    29
    
      } catch (error) {
    
    30
    
        console.error('Error:', error)
    
    31
    
        return new Response('Error processing request', { status: 500 })
    
    32
    
      }
    
    33
    
    })
[/code]

Edge functions have a runtime memory limit of 150MB. Overly large compressed payloads may result in an out-of-memory error.