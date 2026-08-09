---
タイトル: Passkey authentication
URL: https://supabase.com/docs/guides/auth/passkeys
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, authentication, passkey, passkeys
---

# Passkey authentication

**URL:** https://supabase.com/docs/guides/auth/passkeys
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, authentication, passkey, passkeys

## 目次

- [How does it work?#](#how-does-it-work)
- [Enable passkey authentication#](#enable-passkey-authentication)
  - [Dashboard#](#dashboard)
  - [CLI#](#cli)
  - [Management API#](#management-api)
- [Enable in the client#](#enable-in-the-client)
- [Register a passkey#](#register-a-passkey)
- [Sign in with a passkey#](#sign-in-with-a-passkey)
- [Two-step API#](#two-step-api)
- [Manage passkeys#](#manage-passkeys)
- [Admin API#](#admin-api)
- [Error codes#](#error-codes)
- [Limitations#](#limitations)

## 概要

Allow users to sign in with passkeys (WebAuthn)

---

[Passkeys](<https://fidoalliance.org/passkeys/>) are a passwordless credential built on the [WebAuthn](<https://www.w3.org/TR/webauthn-3/>) standard. The user proves possession of a private key stored on their device (or password manager) using biometrics, a PIN, or a hardware security key. The matching public key is registered with Supabase Auth and used to verify future sign-ins. Passkeys are phishing-resistant and remove the need to manage shared secrets.

Experimental

Passkey support is experimental. The API may change without notice. You must explicitly opt-in when creating the Supabase client. See Enable in the client.

**Requires`@supabase/supabase-js` v2.105.0 and later, `supabase_flutter` v2.15.0 and later, or `supabase-swift` v2.48.0 and later.** Upgrade your client library to use passkey authentication.

## How does it work?#

Each sign-in or registration is a WebAuthn ceremony with three steps:

  1. **Options** : the client requests a challenge from Supabase Auth.
  2. **Ceremony** : the platform's passkey API (`navigator.credentials.create()` / `get()` on web, or a passkey plugin on iOS, Android, and macOS) prompts the user for biometrics or a security key.
  3. **Verify** : the signed response is sent back to Supabase Auth, which validates the challenge and either stores the new credential or issues a session.


Supabase Auth uses [discoverable credentials](<https://www.w3.org/TR/webauthn-3/#discoverable-credential>) for sign-in. The user does not need to provide an email, phone, or username — the authenticator resolves the account from the credential it stores.

Registering a passkey requires an existing, confirmed, non-anonymous user. Sign-in works for any user that has previously registered a passkey, provided their email or phone is confirmed and the account is not banned.

## Enable passkey authentication#

### Dashboard#

Open the [Passkeys settings](</dashboard/project/_/auth/passkeys>) from the **Authentication → Passkeys** section of the Dashboard, turn on **Enable Passkey authentication** , and fill in the WebAuthn [relying party](<https://www.w3.org/TR/webauthn-3/#relying-party>) details:

  * **Relying Party Display Name** : a human-readable name for your application shown during the passkey prompt (for example, "My App").
  * **Relying Party ID** : the bare domain name for your application (for example, "example.com"). Do not include a scheme, port, or path. This determines which passkeys can be used.
  * **Relying Party Origins** : comma-separated list of allowed origins (for example "<https://example.com,https://app.example.com>[](<https://example.com,https://app.example.com>)"). Up to 5 origins.
    * HTTPS is required except for loopback addresses ("localhost", "127.0.0.1", "[::1]").
    * Each origin's hostname must match or be a subdomain of the Relying Party ID.
    * Android native apps can use an app origin of the form `android:apk-key-hash:<base64url SHA-256 of the signing certificate>`.


The dashboard pre-fills these from your project's Site URL and project name. Adjust them if your production app is served from a different domain.

Changing the Relying Party ID invalidates existing passkeys

Passkeys are cryptographically bound to the Relying Party (RP) ID they were registered against. Changing the RP ID makes every existing passkey unusable for sign-in, and users will need to register a new one. Pick the RP ID carefully before users start enrolling, and keep it stable once they do.

### CLI#

Add the following to `supabase/config.toml`:
[code] 
    1
    
    [auth.passkey]
    
    2
    
    enabled = true
    
    3
    
    4
    
    [auth.webauthn]
    
    5
    
    rp_display_name = "My App"
    
    6
    
    rp_id = "example.com"
    
    7
    
    rp_origins = ["https://example.com", "https://app.example.com"]
[/code]

The `[auth.webauthn]` section is required when `auth.passkey.enabled` is `true`.

### Management API#

You can also configure passkeys via the [Management API](</docs/reference/api/introduction>):
[code] 
    1
    
    # Get your access token from https://supabase.com/dashboard/account/tokens
    
    2
    
    export SUPABASE_ACCESS_TOKEN="your-access-token"
    
    3
    
    export PROJECT_REF="your-project-ref"
    
    4
    
    5
    
    # Read the current passkey configuration
    
    6
    
    curl -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    7
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    8
    
      | jq '{passkey_enabled, webauthn_rp_id, webauthn_rp_display_name, webauthn_rp_origins}'
    
    9
    
    10
    
    # Enable passkeys and set the WebAuthn relying party
    
    11
    
    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    12
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    13
    
      -H "Content-Type: application/json" \
    
    14
    
      -d '{
    
    15
    
        "passkey_enabled": true,
    
    16
    
        "webauthn_rp_display_name": "My App",
    
    17
    
        "webauthn_rp_id": "example.com",
    
    18
    
        "webauthn_rp_origins": "https://example.com,https://app.example.com"
    
    19
    
      }'
[/code]

## Enable in the client#

Experimental

Passkey support is currently experimental and requires explicit opt-in as the API may change without notice.

JavaScriptDartSwift
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
    
    4
    
      auth: {
    
    5
    
        experimental: { passkey: true },
    
    6
    
      },
    
    7
    
    })
[/code]

## Register a passkey#

A user must be signed in before they can register a passkey. Typically, you call this from a security settings page, or directly after sign-up.

`auth.registerPasskey()` runs the full WebAuthn ceremony. It fetches a challenge, invokes the platform passkey API, and verifies the response with Supabase Auth.

JavaScriptDartSwift
[code]
    1
    
    const { data, error } = await supabase.auth.registerPasskey()
    
    2
    
    3
    
    if (error) {
    
    4
    
      // User cancelled, browser doesn't support WebAuthn, or verification failed
    
    5
    
      console.error(error)
    
    6
    
    } else {
    
    7
    
      console.log('Registered passkey', data.id)
    
    8
    
    }
[/code]

The returned passkey contains the new credential's metadata:
[code] 
    1
    
    {
    
    2
    
      id: string             // UUID — use this to update or delete the passkey
    
    3
    
      friendly_name?: string // Derived from the authenticator's AAGUID
    
    4
    
      created_at: string
    
    5
    
    }
[/code]

A friendly name is automatically derived from the authenticator's Authenticator Attestation GUID (AAGUID). For example, `iCloud Keychain`, `Google Password Manager`, `1Password`. Users can rename their passkey afterwards — see Manage passkeys.

See the `registerPasskey` reference ([JavaScript](</docs/reference/javascript/auth-registerpasskey>) · [Dart](</docs/reference/dart/auth-registerpasskey>) · [Swift](</docs/reference/swift/auth-registerpasskey>)) for the full API.

## Sign in with a passkey#

`auth.signInWithPasskey()` runs the full discoverable-credential authentication ceremony. The user picks an account from the authenticator's UI — your app does not need to ask for an email or phone number upfront.

JavaScriptDartSwift
[code]
    1
    
    const { data, error } = await supabase.auth.signInWithPasskey()
    
    2
    
    3
    
    if (error) {
    
    4
    
      console.error(error)
    
    5
    
    } else {
    
    6
    
      // data.session and data.user are set; the client also dispatches a SIGNED_IN event
    
    7
    
      console.log('Signed in as', data.user?.email)
    
    8
    
    }
[/code]

See the `signInWithPasskey` reference ([JavaScript](</docs/reference/javascript/auth-signinwithpasskey>) · [Dart](</docs/reference/dart/auth-signinwithpasskey>) · [Swift](</docs/reference/swift/auth-signinwithpasskey>)) for the full API.

## Two-step API#

For native flows, custom UI, or full control over the WebAuthn ceremony, use the lower-level `auth.passkey` namespace. Each operation is split into "start" and "verify".

JavaScriptDartSwift

Registration:
[code]
    1
    
    const { data: options } = await supabase.auth.passkey.startRegistration()
    
    2
    
    // Run the WebAuthn ceremony yourself (e.g.: using a native WebAuthn library)
    
    3
    
    const credential = await runRegistrationCeremony(options.options)
    
    4
    
    await supabase.auth.passkey.verifyRegistration({
    
    5
    
      challengeId: options.challenge_id,
    
    6
    
      credential,
    
    7
    
    })
[/code]

Authentication:
[code]
    1
    
    const { data: options } = await supabase.auth.passkey.startAuthentication()
    
    2
    
    // Run the WebAuthn ceremony yourself (e.g.: using a native WebAuthn library)
    
    3
    
    const credential = await runAuthenticationCeremony(options.options)
    
    4
    
    const { data } = await supabase.auth.passkey.verifyAuthentication({
    
    5
    
      challengeId: options.challenge_id,
    
    6
    
      credential,
    
    7
    
    })
[/code]

The `options` field returned from the start methods matches the [WebAuthn `PublicKeyCredentialCreationOptions`](<https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialcreationoptions>) and [`PublicKeyCredentialRequestOptions`](<https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptions>) shapes (with `ArrayBuffer` fields encoded as base64url).

See the `auth.passkey` reference ([JavaScript](</docs/reference/javascript/auth-passkey-api>) · [Dart](</docs/reference/dart/auth-passkey-api>) · [Swift](</docs/reference/swift/auth-passkey-api>)) for the full API.

## Manage passkeys#

List, rename, and delete the current user's passkeys:

JavaScriptDartSwift
[code]
    1
    
    // List
    
    2
    
    const { data: passkeys } = await supabase.auth.passkey.list()
    
    3
    
    // [{ id, friendly_name, created_at, last_used_at? }, ...]
    
    4
    
    5
    
    // Rename
    
    6
    
    await supabase.auth.passkey.update({
    
    7
    
      passkeyId: passkeys[0].id,
    
    8
    
      friendlyName: 'Work laptop',
    
    9
    
    })
    
    10
    
    11
    
    // Delete
    
    12
    
    await supabase.auth.passkey.delete({ passkeyId: passkeys[0].id })
[/code]

`friendlyName` is limited to 120 characters. `lastUsedAt` is updated each time the passkey is used to sign in.

See the `auth.passkey` reference ([JavaScript](</docs/reference/javascript/auth-passkey-api>) · [Dart](</docs/reference/dart/auth-passkey-api>) · [Swift](</docs/reference/swift/auth-passkey-api>)) for the full API.

## Admin API#

Server-side admin endpoints let you inspect and revoke a user's passkeys. These require the project's secret key and must only be called from a trusted server.

JavaScriptDart
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    
    4
    
      auth: { experimental: { passkey: true } },
    
    5
    
    })
    
    6
    
    7
    
    const { data } = await supabase.auth.admin.passkey.listPasskeys({ userId })
    
    8
    
    9
    
    await supabase.auth.admin.passkey.deletePasskey({ userId, passkeyId })
[/code]

See the `auth.admin.passkey` reference ([JavaScript](</docs/reference/javascript/auth-admin-passkey-api>) · [Dart](</docs/reference/dart/auth-admin-passkey-api>)) for the full API. The Swift SDK does not expose admin passkey methods.

## Error codes#

Code| Meaning  
---|---  
`passkey_disabled`| Passkey sign-in is not enabled for this project.  
`too_many_passkeys`| The user has reached the maximum number of passkeys allowed per account.  
`webauthn_credential_exists`| This authenticator has already been registered to the account.  
`webauthn_credential_not_found`| The credential in the assertion is not registered with Supabase Auth.  
`webauthn_challenge_not_found`| The challenge ID is unknown or has already been consumed.  
`webauthn_challenge_expired`| The challenge expired before the client returned a credential.  
`webauthn_verification_failed`| The signature, attestation, or assertion did not validate against the challenge.  
  
In addition, `signInWithPasskey()` returns the usual sign-in failure modes: `email_not_confirmed`, `phone_not_confirmed`, and `user_banned`.

## Limitations#

  * SSO users cannot register passkeys.
  * Anonymous users cannot register passkeys — link an email or phone first.