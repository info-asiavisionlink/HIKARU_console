---
タイトル: JSON Web Token (JWT)
URL: https://supabase.com/docs/guides/auth/jwts
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, json, jwts, token
---

# JSON Web Token (JWT)

**URL:** https://supabase.com/docs/guides/auth/jwts
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, json, jwts, token

## 目次

- [Introduction#](#introduction)
- [Supabase and JWTs#](#supabase-and-jwts)
- [Using custom or third-party JWTs#](#using-custom-or-third-party-jwts)
- [Verifying a JWT from Supabase#](#verifying-a-jwt-from-supabase)
  - [Verifying with a shared secret signing key#](#verifying-with-a-shared-secret-signing-key)
- [Resources#](#resources)

## 概要

Information on how best to use JSON Web Tokens with Supabase

---

A [JSON Web Token](<https://jwt.io/introduction>) is a type of data structure, represented as a string, that usually contains identity and authorization information about a user. It encodes information about its lifetime and is signed with a cryptographic key to make it tamper-resistant.

Supabase Auth continuously issues a new JWT for each user session, for as long as the user remains signed in. Check the comprehensive guide on [Sessions](</docs/guides/auth/sessions>) to find out how you can tailor this process for your needs.

JWTs provide the foundation for [Row Level Security](</docs/guides/database/postgres/row-level-security>). Each Supabase product is able to securely decode and verify the validity of a JWT it receives before using Postgres policies and roles to authorize access to the project's data.

Supabase provides a comprehensive system of managing [JWT Signing Keys](</docs/guides/auth/signing-keys>) used to create and verify JSON Web Tokens.

## Introduction#

JWTs are strings that have the following structure:
[code] 
    1
    
    <header>.<payload>.<signature>
[/code]

Each part is a string of [Base64-URL](<https://en.wikipedia.org/wiki/Base64#Variants_summary_table>) encoded JSON, or bytes for the signature.

**Header**
[code] 
    1
    
    {
    
    2
    
      "typ": "JWT",
    
    3
    
      "alg": "<HS256 | ES256 | RS256>",
    
    4
    
      "kid": "<unique key identifier>"
    
    5
    
    }
[/code]

Gives some basic identifying information about the string, indicating its type `typ`, the cryptographic algorithm `alg` that can be used to verify the data, and optionally the unique key identifier that should be used when verifying it.

**Payload**
[code] 
    1
    
    {
    
    2
    
      "iss": "https://project_id.supabase.co/auth/v1",
    
    3
    
      "exp": 12345678,
    
    4
    
      "sub": "<user ID>",
    
    5
    
      "role": "authenticated",
    
    6
    
      "email": "someone@example.com",
    
    7
    
      "phone": "+15552368"
    
    8
    
      // ...
    
    9
    
    }
[/code]

Provides identifying information (called "claims") about the user (or other entity) that is represented by the token. Usually a JWT conveys information about what the user can access (then called Access Token) or who the user is (then called ID Token). You can use a [Custom Access Token Hook](</docs/guides/auth/auth-hooks/custom-access-token-hook>) to add, remove or change claims present in the token. A few claims are important:

Claim| Description  
---|---  
`iss`| Identifies the server which issued the token. If you append `/.well-known/jwks.json` to this URL you'll get access to the public keys with which you can verify the token.  
`exp`| Sets a time limit after which the token should not be trusted and is considered expired, even if it is properly signed.  
`sub`| Means _subject_ , is the unique ID of the user represented by the token.  
`role`| The Postgres role to use when applying Row Level Security policies.  
...| All other claims are useful for quick access to profile information without having to query the database or send a request to the Auth server.  
  
**Signature**

A [digital signature](<https://en.wikipedia.org/wiki/Digital_signature>) using a [shared secret](<https://en.wikipedia.org/wiki/HMAC>) or [public-key cryptography](<https://en.wikipedia.org/wiki/Public-key_cryptography>). The purpose of the signature is to verify the authenticity of the `<header>.<payload>` string without relying on database access, liveness or performance of the Auth server. To verify the signature avoid implementing the algorithms yourself and instead rely on `supabase.auth.getClaims()`, or other high-quality JWT verification libraries for your language.

## Supabase and JWTs#

Supabase creates JWTs in these cases for you:

  1. **When using Supabase Auth, an access token (JWT) is created for each user while they remain signed in**. These are short lived, so they are continuously issued as your user interacts with Supabase APIs.
  2. **On-the-fly when using publishable or secret API keys**. Each API key is transformed into a short-lived JWT that is then used to authorize access to your data. Accessing these short-lived tokens is generally not possible.


In addition to creating JWTs, Supabase can also accept JWTs from other authentication servers via the [Third-Party Auth](</docs/guides/auth/third-party/overview>) feature or ones that have been minted externally via an imported [JWT Signing Key](</docs/guides/auth/signing-keys>).

## Using custom or third-party JWTs#

The `supabase.auth.getClaims()` method is meant to be used only with JWTs issued by Supabase Auth. If you mint your own JWTs using a key you've imported, the verification may fail. We strongly recommend using a JWT verification library for your language to verify this type of JWT based on the claims you're adding in them.

Your Supabase project accepts a JWT in the `Authorization: Bearer <jwt>` header. If you're using the Supabase client library, it does this for you.

If you are already using Supabase Auth, when a user is signed in, their access token JWT is automatically managed and sent for you with every API call.

If you wish to send a JWT from a Third-Party Auth provider, or one you made yourself by using a JWT signing key you imported, you can pass it to the client library using the `accessToken` option.

TypeScriptFlutterSwift (iOS)KotlincURL
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient(
    
    4
    
      'https://<supabase-project>.supabase.co',
    
    5
    
      'SUPABASE_PUBLISHABLE_KEY',
    
    6
    
      {
    
    7
    
        accessToken: async () => {
    
    8
    
          return '<your JWT here>'
    
    9
    
        },
    
    10
    
      }
    
    11
    
    )
[/code]

In the past there was a recommendation to set custom headers on the Supabase client with the `Authorization` header including your custom JWT. This is no longer recommended as it's less flexible and causes confusion when combined with a user session from Supabase Auth.

## Verifying a JWT from Supabase#

If you're not able to use the Supabase client libraries, the following can be used to help you securely verify JWTs issued by Supabase.

Supabase Auth exposes a [JSON Web Key](<https://datatracker.ietf.org/doc/html/rfc7517>) Set URL for each Supabase project:
[code] 
    1
    
    GET https://project-id.supabase.co/auth/v1/.well-known/jwks.json
[/code]

Which responds with JWKS object containing one or more asymmetric [JWT signing keys](</docs/guides/auth/signing-keys>) (only their public keys). Be aware that this endpoint does not return any keys if you are not using asymmetric JWT signing keys.
[code] 
    1
    
    {
    
    2
    
      "keys": [
    
    3
    
        {
    
    4
    
          "kid": "<match with kid from JWT header>",
    
    5
    
          "alg": "<match with alg from JWT header>",
    
    6
    
          "kty": "<RSA|EC|OKP>",
    
    7
    
          "key_ops": ["verify"]
    
    8
    
          // public key fields
    
    9
    
        }
    
    10
    
      ]
    
    11
    
    }
[/code]

This endpoint is served directly from the Auth server, but is also additionally cached by the Supabase Edge for 10 minutes, significantly speeding up access to this data regardless of where you're performing the verification. It's important to be aware of the cache expiry time to prevent unintentionally rejecting valid user access tokens. We recommend waiting at least 20 minutes when creating a standby signing key, or revoking a previously used key.

Make sure that you do not cache this data for longer in your application, as it might make revocation difficult. If you do, make sure to provide a way to purge this cache when rotating signing keys to avoid unintentionally rejecting valid user access tokens.

Below is an example of how to use the [jose TypeScript JWT verification library](<https://github.com/panva/jose>) with Supabase JWTs:
[code] 
    1
    
    import { createRemoteJWKSet, jwtVerify } from 'jose'
    
    2
    
    3
    
    const PROJECT_JWKS = createRemoteJWKSet(
    
    4
    
      new URL('https://project-id.supabase.co/auth/v1/.well-known/jwks.json')
    
    5
    
    )
    
    6
    
    7
    
    /**
    
    8
    
     * Verifies the provided JWT against the project's JSON Web Key Set.
    
    9
    
     */
    
    10
    
    async function verifyProjectJWT(jwt: string) {
    
    11
    
      return jwtVerify(jwt, PROJECT_JWKS)
    
    12
    
    }
[/code]

### Verifying with a shared secret signing key#

If your project is using a shared secret (HS256) signing key, we recommend always verifying a user access token directly with the Auth server by sending a request like so:
[code] 
    1
    
    GET https://project-id.supabase.co/auth/v1/user
    
    2
    
    apikey: publishable key
    
    3
    
    Authorization: Bearer <JWT>
[/code]

If the server responds with HTTP 200 OK, the JWT is valid, otherwise it is not.

Because the Auth server runs only in your project's specified region and is not globally distributed, doing this check can be quite slow depending on where you're performing the check. Avoid doing checks like this from servers or functions running on the edge, and prefer routing to a server within the same geographical region as your project.

If you are using a shared secret (HS256) signing key, you may wish to verify using the shared secret. **We strongly recommend against this approach.**

There is almost no benefit from using a JWT signed with a shared secret. Although it's computationally more efficient and verification is simpler to code by hand, using this approach can expose your project's data to significant security vulnerabilities or weaknesses.

Consider the following:

  * Using a shared secret can make it more difficult to keep aligned with security compliance frameworks such as SOC2, PCI-DSS, ISO27000, HIPAA, etc.
  * A shared secret that is in the hands of a malicious actor can be used to impersonate your users, give them access to privileged actions or data.
  * It is difficult to detect or identify when or how a shared secret has been given to a malicious actor.
  * Consider who might have even accidental access to the shared secret: systems, staff, devices (and their disk encryption and vulnerability patch status).
  * A malicious actor can use a shared secret **far into the future** , so lacking current evidence of compromise does not mean your data is secure.
  * It can be very easy to accidentally leak the shared secret in publicly available source code such as in your website or frontend, mobile app package or other executable. This is especially true if you accidentally add the secret in environment variables prefixed with `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_` or other conventions by web frameworks.
  * Rotating shared secrets might require careful coordination to avoid downtime of your app.


Check the JWT verification libraries for your language on how to securely verify JWTs signed with a shared secret (HS256) signing key. We strongly recommend relying on the Auth server as described above, or switching to a different signing key based on public key cryptography (RSA, Elliptic Curves) instead.

## Resources#

  * JWT debugger: <https://jwt.io/>[](<https://jwt.io/>)
  * [JWT Signing Keys](</docs/guides/auth/signing-keys>)
  * [JWT Claims Reference](</docs/guides/auth/jwt-fields>) \- Complete reference for all JWT claims used by Supabase Auth
  * [API keys](</docs/guides/getting-started/api-keys>)