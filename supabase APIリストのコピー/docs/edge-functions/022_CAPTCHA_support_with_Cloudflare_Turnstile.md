---
タイトル: CAPTCHA support with Cloudflare Turnstile
URL: https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: captcha, cloudflare, cloudflare-turnstile, edge-functions, examples, functions, support, turnstile, with
---

# CAPTCHA support with Cloudflare Turnstile

**URL:** https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** captcha, cloudflare, cloudflare-turnstile, edge-functions, examples, functions, support, turnstile, with

## 目次

- [Setup#](#setup)
- [Code#](#code)
- [Deploy the server-side validation Edge Functions#](#deploy-the-server-side-validation-edge-functions)
- [Invoke the function from your site#](#invoke-the-function-from-your-site)

## 概要

Protecting Forms with Cloudflare Turnstile.

---

[Cloudflare Turnstile](<https://www.cloudflare.com/application-services/products/turnstile/>) is a friendly, free CAPTCHA replacement, and it works seamlessly with Supabase Edge Functions to protect your forms. [View on GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/cloudflare-turnstile>).

## Setup#

  * Follow these steps to set up a new site: <https://developers.cloudflare.com/turnstile/get-started/>[](<https://developers.cloudflare.com/turnstile/get-started/>)
  * Add the Cloudflare Turnstile widget to your site: <https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/>[](<https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/>)


## Code#

Create a new function in your project:
[code] 
    1
    
    supabase functions new cloudflare-turnstile
[/code]

And add the code to the `index.ts` file:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    console.log('Hello from Cloudflare Trunstile!')
    
    4
    
    5
    
    function ips(req: Request) {
    
    6
    
      return req.headers.get('x-forwarded-for')?.split(/\s*,\s*/)
    
    7
    
    }
    
    8
    
    9
    
    // `withSupabase` handles CORS and preflight requests for you.
    
    10
    
    export default {
    
    11
    
      fetch: withSupabase({ auth: 'none' }, async (req) => {
    
    12
    
        const { token } = await req.json()
    
    13
    
        const clientIps = ips(req) || ['']
    
    14
    
        const ip = clientIps[0]
    
    15
    
    16
    
        // Validate the token by calling the
    
    17
    
        // "/siteverify" API endpoint.
    
    18
    
        let formData = new FormData()
    
    19
    
        formData.append('secret', Deno.env.get('CLOUDFLARE_SECRET_KEY') ?? '')
    
    20
    
        formData.append('response', token)
    
    21
    
        formData.append('remoteip', ip)
    
    22
    
    23
    
        const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    
    24
    
        const result = await fetch(url, {
    
    25
    
          body: formData,
    
    26
    
          method: 'POST',
    
    27
    
        })
    
    28
    
    29
    
        const outcome = await result.json()
    
    30
    
        console.log(outcome)
    
    31
    
        if (outcome.success) {
    
    32
    
          return Response.json({ success: true })
    
    33
    
        }
    
    34
    
        return Response.json({ success: false })
    
    35
    
      }),
    
    36
    
    }
[/code]

## Deploy the server-side validation Edge Functions#

  * <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>[](<https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>)


[code] 
    1
    
    supabase functions deploy cloudflare-turnstile --no-verify-jwt
    
    2
    
    supabase secrets set CLOUDFLARE_SECRET_KEY=your_secret_key
[/code]

## Invoke the function from your site#
[code] 
    1
    
    const { data, error } = await supabase.functions.invoke('cloudflare-turnstile', {
    
    2
    
      body: { token },
    
    3
    
    })
[/code]