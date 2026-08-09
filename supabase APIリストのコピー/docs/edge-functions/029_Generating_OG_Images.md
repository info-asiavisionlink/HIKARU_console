---
タイトル: Generating OG Images
URL: https://supabase.com/docs/guides/functions/examples/og-image
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, generating, images, og-image
---

# Generating OG Images

**URL:** https://supabase.com/docs/guides/functions/examples/og-image
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, generating, images, og-image

## 目次

- [Code#](#code)

## 概要

Generate Open Graph images with Deno and Supabase Edge Functions.

---

Generate Open Graph images with Deno and Supabase Edge Functions. [View on GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/opengraph>).

## Code#

Create a `handler.tsx` file to construct the OG image in React:
[code] 
    1
    
    import { ImageResponse } from 'npm:@vercel/og@^0'
    
    2
    
    import React from 'npm:react@^19'
    
    3
    
    4
    
    export default function handler(req: Request) {
    
    5
    
      return new ImageResponse(
    
    6
    
        <div
    
    7
    
          style={{
    
    8
    
            width: '100%',
    
    9
    
            height: '100%',
    
    10
    
            display: 'flex',
    
    11
    
            alignItems: 'center',
    
    12
    
            justifyContent: 'center',
    
    13
    
            fontSize: 128,
    
    14
    
            background: 'lavender',
    
    15
    
          }}
    
    16
    
        >
    
    17
    
          Hello OG Image!
    
    18
    
        </div>
    
    19
    
      )
    
    20
    
    }
[/code]

Create an `index.ts` file to execute the handler on incoming requests:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    import handler from './handler.tsx'
    
    4
    
    5
    
    console.log('Hello from og-image Function!')
    
    6
    
    7
    
    // Public image endpoint, so deploy with --no-verify-jwt.
    
    8
    
    export default { fetch: withSupabase({ auth: 'none' }, handler) }
[/code]