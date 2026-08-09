---
タイトル: CORS (Cross-Origin Resource Sharing) support for Invoking from the browser
URL: https://supabase.com/docs/guides/functions/cors
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: browser, cors, cross, edge-functions, from, functions, invoking, origin, resource, sharing, support
---

# CORS (Cross-Origin Resource Sharing) support for Invoking from the browser

**URL:** https://supabase.com/docs/guides/functions/cors
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** browser, cors, cross, edge-functions, from, functions, invoking, origin, resource, sharing, support

## 目次

- [Automatic CORS handling#](#automatic-cors-handling)
- [Manual CORS handling#](#manual-cors-handling)
  - [For versions before 2.95.0#](#for-versions-before-2950)

## 概要

Add CORS headers to invoke Edge Functions from the browser.

---

To invoke edge functions from the browser, you need to handle [CORS Preflight](<https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request>) requests.

## Automatic CORS handling#

The [`withSupabase`](</docs/guides/functions/auth>) wrapper handles CORS and preflight (`OPTIONS`) requests for you, so you don't add headers manually:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    5
    
        const { name } = await req.json()
    
    6
    
        return Response.json({ message: `Hello ${name}!` })
    
    7
    
      }),
    
    8
    
    }
[/code]

## Manual CORS handling#

If your function doesn't use `withSupabase`, add the headers yourself. See the [example on GitHub](<https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/browser-with-cors/index.ts>).

**For`@supabase/supabase-js` v2.95.0 and later:** Import CORS headers directly from the SDK to ensure they stay synchronized with any new headers added to the client libraries.

Import `corsHeaders` from `npm:@supabase/supabase-js@^2/cors` to automatically get all required headers:
[code] 
    1
    
    import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'
    
    2
    
    3
    
    console.log(`Function "browser-with-cors" up and running!`)
    
    4
    
    5
    
    export default {
    
    6
    
      fetch: async (req) => {
    
    7
    
        // Handle the CORS preflight request.
    
    8
    
        if (req.method === 'OPTIONS') {
    
    9
    
          return Response.json({ ok: true }, { headers: corsHeaders })
    
    10
    
        }
    
    11
    
    12
    
        try {
    
    13
    
          const { name } = await req.json()
    
    14
    
          return Response.json({ message: `Hello ${name}!` }, { headers: corsHeaders })
    
    15
    
        } catch (error) {
    
    16
    
          return Response.json({ error: error.message }, { status: 400, headers: corsHeaders })
    
    17
    
        }
    
    18
    
      },
    
    19
    
    }
[/code]

This approach ensures that when new headers are added to the Supabase SDK, your Edge Functions automatically include them, preventing CORS errors.

### For versions before 2.95.0#

If you're using `@supabase/supabase-js` before v2.95.0, you'll need to hardcode the CORS headers. Add a `cors.ts` file within a [`_shared` folder](</docs/guides/functions/development-environment#recommended-project-structure>):
[code] 
    1
    
    export const corsHeaders = {
    
    2
    
      'Access-Control-Allow-Origin': '*',
    
    3
    
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    
    4
    
    }
[/code]

Then import it in your function:
[code] 
    1
    
    import { corsHeaders } from '../_shared/cors.ts'
    
    2
    
    3
    
    // ... rest of your function code
[/code]