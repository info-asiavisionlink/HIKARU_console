---
タイトル: Signing out
URL: https://supabase.com/docs/guides/auth/signout
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, signing, signout
---

# Signing out

**URL:** https://supabase.com/docs/guides/auth/signout
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, signing, signout

## 目次

- [Sign out and scopes#](#sign-out-and-scopes)

## 概要

Signing out a user

---

Signing out a user works the same way no matter what method they used to sign in.

Call the sign out method from the client library. It removes the active session and clears Auth data from the storage medium.

JavaScriptDartSwiftKotlinPython
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    async function signOut() {
    
    7
    
      const { error } = await supabase.auth.signOut()
    
    8
    
    }
[/code]

## Sign out and scopes#

Supabase Auth allows you to specify three different scopes for when a user invokes the [sign out API](</docs/reference/javascript/auth-signout>) in your application:

  * `global` (default) when all sessions active for the user are terminated.
  * `local` which only terminates the current session for the user but keep sessions on other devices or browsers active.
  * `others` to terminate all but the current session for the user.


You can invoke these by providing the `scope` option:

JavaScriptDartKotlin
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    // defaults to the global scope
    
    7
    
    await supabase.auth.signOut()
    
    8
    
    9
    
    // sign out from the current session only
    
    10
    
    await supabase.auth.signOut({ scope: 'local' })
[/code]

Upon sign out, all refresh tokens and potentially other database objects related to the affected sessions are destroyed and the client library removes the session stored in the local storage medium.

Access Tokens of revoked sessions remain valid until their expiry time, encoded in the `exp` claim. The user won't be immediately logged out and will only be logged out when the Access Token expires.