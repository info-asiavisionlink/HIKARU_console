---
タイトル: PKCE flow
URL: https://supabase.com/docs/guides/auth/sessions/pkce-flow
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, flow, pkce, pkce-flow, sessions
---

# PKCE flow

**URL:** https://supabase.com/docs/guides/auth/sessions/pkce-flow
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, flow, pkce, pkce-flow, sessions

## 目次

- [How it works#](#how-it-works)
- [Limitations#](#limitations)
- [Resources#](#resources)

## 概要

About authenticating with PKCE flow.

---

The Proof Key for Code Exchange (PKCE) flow is one of two ways that a user can authenticate and your app can receive the necessary access and refresh tokens.

The flow is an implementation detail handled for you by Supabase Auth, but understanding the difference between PKCE and [implicit flow](</docs/guides/auth/sessions/implicit-flow>) is important for understanding the difference between client-only and server-side auth.

## How it works#

After a successful verification, the user is redirected to your app with a URL that looks like this:
[code] 
    1
    
    https://yourapp.com/...?code=<...>
[/code]

The `code` parameter is commonly known as the Auth Code and can be exchanged for an access token by calling `exchangeCodeForSession(code)`.

For security purposes, the code has a validity of 5 minutes and can only be exchanged for an access token once. You will need to restart the authentication flow from scratch if you wish to obtain a new access token.

As the flow is run server side, `localStorage` may not be available. You may configure the client library to use a custom storage adapter and an alternate backing storage such as cookies by setting the `storage` option to an object with the following methods:
[code] 
    1
    
    import { type SupportedStorage } from '@supabase/supabase-js';
    
    2
    
    const supportsLocalStorage = () => true
    
    3
    
    4
    
    // ---cut---
    
    5
    
    const customStorageAdapter: SupportedStorage = {
    
    6
    
        getItem: (key) => {
    
    7
    
        if (!supportsLocalStorage()) {
    
    8
    
            // Configure alternate storage
    
    9
    
            return null
    
    10
    
        }
    
    11
    
        return globalThis.localStorage.getItem(key)
    
    12
    
        },
    
    13
    
        setItem: (key, value) => {
    
    14
    
        if (!supportsLocalStorage()) {
    
    15
    
            // Configure alternate storage here
    
    16
    
            return
    
    17
    
        }
    
    18
    
        globalThis.localStorage.setItem(key, value)
    
    19
    
        },
    
    20
    
        removeItem: (key) => {
    
    21
    
        if (!supportsLocalStorage()) {
    
    22
    
            // Configure alternate storage here
    
    23
    
            return
    
    24
    
        }
    
    25
    
        globalThis.localStorage.removeItem(key)
    
    26
    
        },
    
    27
    
    }
[/code]

You may also configure the client library to automatically exchange it for a session after a successful redirect. This can be done by setting the `detectSessionInUrl` option to `true`.

Putting it all together, your client library initialization may look like this:
[code] 
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    // ---cut---
    
    4
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...', {
    
    5
    
      // ...
    
    6
    
      auth: {
    
    7
    
        // ...
    
    8
    
        detectSessionInUrl: true,
    
    9
    
        flowType: 'pkce',
    
    10
    
        storage: {
    
    11
    
          getItem: () => Promise.resolve('FETCHED_TOKEN'),
    
    12
    
          setItem: () => {},
    
    13
    
          removeItem: () => {},
    
    14
    
        },
    
    15
    
      },
    
    16
    
      // ...
    
    17
    
    })
[/code]

## Limitations#

Behind the scenes, the code exchange requires a code verifier. Both the code in the URL and the code verifier are sent back to the Auth server for a successful exchange.

The code verifier is created and stored locally when the Auth flow is first initiated. That means the code exchange must be initiated on the same browser and device where the flow was started.

## Resources#

  * [OAuth 2.0 guide](<https://oauth.net/2/pkce/>) to PKCE flow