---
タイトル: Passwordless email logins
URL: https://supabase.com/docs/guides/auth/auth-email-passwordless
カテゴリ: auth
更新日: 2026-08-02
タグ: ai, auth, auth-email-passwordless, email, logins, passwordless
---

# Passwordless email logins

**URL:** https://supabase.com/docs/guides/auth/auth-email-passwordless
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** ai, auth, auth-email-passwordless, email, logins, passwordless

## 目次

- [With Magic Link#](#with-magic-link)
  - [Enabling Magic Link#](#enabling-magic-link)
  - [Signing in with Magic Link#](#signing-in-with-magic-link)
- [With OTP#](#with-otp)
  - [Enabling email OTP#](#enabling-email-otp)
  - [Signing in with email OTP#](#signing-in-with-email-otp)

## 概要

Email logins using Magic Links or One-Time Passwords (OTPs)

---

Supabase Auth provides several passwordless login methods. Passwordless logins allow users to sign in without a password, by clicking a confirmation link or entering a verification code.

Passwordless login can:

  * Improve the user experience by not requiring users to create and remember a password
  * Increase security by reducing the risk of password-related security breaches
  * Reduce support burden of dealing with password resets and other password-related flows


Supabase Auth offers two passwordless login methods that use the user's email address:

  * Magic Link
  * OTP


## With Magic Link#

Magic Links are a form of passwordless login where users click on a link sent to their email address to log in to their accounts. Magic Links only work with email addresses and are one-time use only.

### Enabling Magic Link#

Email authentication methods, including Magic Links, are enabled by default.

Configure the Site URL and any additional redirect URLs. These are the only URLs that are allowed as redirect destinations after the user clicks a Magic Link. You can change the URLs on the [URL Configuration page](</dashboard/project/_/auth/url-configuration>) for hosted projects, in the `config.toml` [file](</docs/guides/local-development/cli/config#auth.additional_redirect_urls>) for local development, or in the `.env` configuration file for [self-hosted Supabase](</docs/guides/self-hosting/docker>).

By default, a user can only request a magic link once every 60 seconds and they expire after 1 hour.

### Signing in with Magic Link#

Call the "sign in with OTP" method from the client library.

Though the method is labelled "OTP", it sends a Magic Link by default. The two methods differ only in the content of the confirmation email sent to the user.

If the user hasn't signed up yet, they are automatically signed up by default. To prevent this, set the `shouldCreateUser` option to `false`.

JavaScriptExpo React NativeDartSwiftKotlinPython
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
    
    async function signInWithEmail() {
    
    7
    
      const { data, error } = await supabase.auth.signInWithOtp({
    
    8
    
        email: 'valid.email@supabase.io',
    
    9
    
        options: {
    
    10
    
          // set this to false if you do not want the user to be automatically signed up
    
    11
    
          shouldCreateUser: false,
    
    12
    
          emailRedirectTo: 'https://example.com/welcome',
    
    13
    
        },
    
    14
    
      })
    
    15
    
    }
[/code]

That's it for the implicit flow.

If you're using PKCE flow, edit the Magic Link [email template](</docs/guides/auth/auth-email-templates>) to send a token hash:
[code] 
    1
    
    <h2>Sign in to your account</h2>
    
    2
    
    3
    
    <p>Use this link to sign in to your account:</p>
    
    4
    
    <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
[/code]

At the `/auth/confirm` endpoint, exchange the hash for the session:
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
    
    const { error } = await supabase.auth.verifyOtp({
    
    7
    
      token_hash: 'hash',
    
    8
    
      type: 'email',
    
    9
    
    })
[/code]

## With OTP#

Email one-time passwords (OTP) are a form of passwordless login where users key in a six digit code sent to their email address to log in to their accounts.

### Enabling email OTP#

Email authentication methods, including Email OTPs, are enabled by default.

Email OTPs share an implementation with Magic Links. To send an OTP instead of a Magic Link, alter the **Magic Link** [email template](</dashboard/project/_/auth/templates/magic-link-or-otp>). Refer to the [Email Templates guide](</docs/guides/auth/auth-email-templates>) for more information.

Modify the template to include the `{{ .Token }}` variable, for example:
[code] 
    1
    
    <h2>One time login code</h2>
    
    2
    
    3
    
    <p>Please enter this code: {{ .Token }}</p>
[/code]

By default, a user can only request an OTP once every 60 seconds, and they expire after 1 hour. This is configurable via **Authentication > Sign In / Providers > Auth Providers > Email > Email OTP expiration**. An expiry duration of more than 86,400 seconds (one day) is strongly discouraged and can only be set via the [Management API](</docs/reference/api/v1-update-auth-service-config>). Make sure to read the [security recommendations](</docs/guides/deployment/going-into-prod#security>) before going into production.

The **Email OTP Expiration** setting also governs the validity of Magic Links and other email links, including confirmation, password recovery, email change, and [invitation](</docs/guides/auth/users#inviting-users>) links.

### Signing in with email OTP#

#### Step 1: Send the user an OTP code#

Get the user's email and call the "sign in with OTP" method from your client library.

If the user hasn't signed up yet, they are automatically signed up by default. To prevent this, set the `shouldCreateUser` option to `false`.

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
    
    const { data, error } = await supabase.auth.signInWithOtp({
    
    7
    
      email: 'valid.email@supabase.io',
    
    8
    
      options: {
    
    9
    
        // set this to false if you do not want the user to be automatically signed up
    
    10
    
        shouldCreateUser: false,
    
    11
    
      },
    
    12
    
    })
[/code]

If the request is successful, you receive a response with `error: null` and a `data` object where both `user` and `session` are null. Let the user know to check their email inbox.
[code] 
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "user": null,
    
    4
    
        "session": null
    
    5
    
      },
    
    6
    
      "error": null
    
    7
    
    }
[/code]

#### Step 2: Verify the OTP to create a session#

Provide an input field for the user to enter their one-time code.

Call the "verify OTP" method from your client library with the user's email address, the code, and a type of `email`:

JavaScriptSwiftKotlinPython
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
    
    const {
    
    7
    
      data: { session },
    
    8
    
      error,
    
    9
    
    } = await supabase.auth.verifyOtp({
    
    10
    
      email: 'email@example.com',
    
    11
    
      token: '123456',
    
    12
    
      type: 'email',
    
    13
    
    })
[/code]

If successful, the user is now logged in, and you receive a valid session that looks like:
[code] 
    1
    
    {
    
    2
    
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNjI3MjkxNTc3LCJzdWIiOiJmYTA2NTQ1Zi1kYmI1LTQxY2EtYjk1NC1kOGUyOTg4YzcxOTEiLCJlbWFpbCI6IiIsInBob25lIjoiNjU4NzUyMjAyOSIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6InBob25lIn0sInVzZXJfbWV0YWRhdGEiOnt9LCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.1BqRi0NbS_yr1f6hnr4q3s1ylMR3c1vkiJ4e_N55dhM",
    
    3
    
      "token_type": "bearer",
    
    4
    
      "expires_in": 3600,
    
    5
    
      "refresh_token": "LSp8LglPPvf0DxGMSj-vaQ",
    
    6
    
      "user": {...}
    
    7
    
    }
[/code]