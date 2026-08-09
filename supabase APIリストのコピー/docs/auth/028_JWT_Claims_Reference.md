---
タイトル: JWT Claims Reference
URL: https://supabase.com/docs/guides/auth/jwt-fields
カテゴリ: auth
更新日: 2026-08-02
タグ: ai, auth, claims, jwt-fields, reference
---

# JWT Claims Reference

**URL:** https://supabase.com/docs/guides/auth/jwt-fields
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** ai, auth, claims, jwt-fields, reference

## 目次

- [JWT structure overview#](#jwt-structure-overview)
- [Required claims#](#required-claims)
- [Optional claims#](#optional-claims)
- [Special claims#](#special-claims)
- [Field value constraints#](#field-value-constraints)
  - [Authenticator assurance level (aal)#](#authenticator-assurance-level--aal-)
  - [Role values (role)#](#role-values--role-)
  - [Audience values (aud)#](#audience-values--aud-)
  - [Authentication methods (amr.method)#](#authentication-methods--amrmethod-)
- [JWT examples#](#jwt-examples)
  - [Authenticated user token#](#authenticated-user-token)
  - [Anonymous user token#](#anonymous-user-token)
  - [Service role token#](#service-role-token)
- [Language-Specific considerations#](#language-specific-considerations)
  - [Rust#](#rust)
  - [TypeScript/JavaScript#](#typescriptjavascript)
  - [Python#](#python)
  - [Go#](#go)
- [Validation guidelines#](#validation-guidelines)
- [Security considerations#](#security-considerations)
- [Related documentation#](#related-documentation)

## 概要

Complete reference for claims appearing in JWTs created by Supabase Auth

---

This page provides a comprehensive reference for all JWT claims used in Supabase authentication tokens. This information is essential for server-side JWT validation and serialization, especially when implementing authentication in languages like Rust where field names like `ref` are reserved keywords.

## JWT structure overview#

Supabase JWTs follow the standard JWT structure with three parts:

  * **Header** : Contains algorithm and key information
  * **Payload** : Contains the claims (user data and metadata)
  * **Signature** : Cryptographic signature for verification


The payload contains various claims that provide user identity, authentication level, and authorization information.

## Required claims#

These claims are always present in Supabase JWTs and cannot be removed:

Field| Type| Description| Example  
---|---|---|---  
`iss`| `string`| **Issuer** \- The entity that issued the JWT| `"https://project-ref.supabase.co/auth/v1"`  
`aud`| `string | string[]`| **Audience** \- The intended recipient of the JWT| `"authenticated"` or `"anon"`  
`exp`| `number`| **Expiration Time** \- Unix timestamp when the token expires| `1640995200`  
`iat`| `number`| **Issued At** \- Unix timestamp when the token was issued| `1640991600`  
`sub`| `string`| **Subject** \- The user ID (UUID)| `"123e4567-e89b-12d3-a456-426614174000"`  
`role`| `string`| **Role** \- User's role in the system| `"authenticated"`, `"anon"`, `"service_role"`  
`aal`| `string`| **Authenticator Assurance Level** \- Authentication strength| `"aal1"`, `"aal2"`  
`session_id`| `string`| **Session ID** \- Unique session identifier| `"session-uuid"`  
`email`| `string`| **Email** \- User's email address| `"user@example.com"`  
`phone`| `string`| **Phone** \- User's phone number| `"+1234567890"`  
`is_anonymous`| `boolean`| **Anonymous Flag** \- Whether the user is anonymous| `false`  
  
## Optional claims#

These claims may be present depending on the authentication context:

Field| Type| Description| Example  
---|---|---|---  
`jti`| `string`| **JWT ID** \- Unique identifier for the JWT| `"jwt-uuid"`  
`nbf`| `number`| **Not Before** \- Unix timestamp before which the token is invalid| `1640991600`  
`app_metadata`| `object`| **App Metadata** \- Application-specific user data| `{"provider": "email"}`  
`user_metadata`| `object`| **User Metadata** \- User-specific data| `{"name": "John Doe"}`  
`amr`| `array`| **Authentication Methods Reference** \- List of authentication methods used| `[{"method": "password", "timestamp": 1640991600}]`  
  
## Special claims#

Field| Type| Description| Example| Context  
---|---|---|---|---  
`ref`| `string`| **Project Reference** \- Supabase project identifier| `"abcdefghijklmnopqrst"`| Anon/Service role tokens only  
  
## Field value constraints#

### Authenticator assurance level (`aal`)#

Value| Description  
---|---  
`"aal1"`| Single-factor authentication (password, OAuth, etc.)  
`"aal2"`| Multi-factor authentication (password + TOTP, etc.)  
  
### Role values (`role`)#

Value| Description| Use Case  
---|---|---  
`"anon"`| Anonymous user| Public access with RLS policies  
`"authenticated"`| Authenticated user| Standard user access  
`"service_role"`| Service role| Admin privileges (server-side only)  
  
### Audience values (`aud`)#

Value| Description  
---|---  
`"authenticated"`| For authenticated user tokens  
`"anon"`| For anonymous user tokens  
  
### Authentication methods (`amr.method`)#

Value| Description  
---|---  
`"oauth"`| OAuth provider authentication  
`"password"`| Email/password authentication  
`"otp"`| One-time password  
`"totp"`| Time-based one-time password  
`"recovery"`| Account recovery  
`"invite"`| Invitation-based signup  
`"sso/saml"`| SAML single sign-on  
`"magiclink"`| Magic link authentication  
`"email/signup"`| Email signup  
`"email_change"`| Email change  
`"token_refresh"`| Token refresh  
`"anonymous"`| Anonymous authentication  
  
## JWT examples#

### Authenticated user token#
[code] 
    1
    
    {
    
    2
    
      "aal": "aal1",
    
    3
    
      "amr": [
    
    4
    
        {
    
    5
    
          "method": "password",
    
    6
    
          "timestamp": 1640991600
    
    7
    
        }
    
    8
    
      ],
    
    9
    
      "app_metadata": {
    
    10
    
        "provider": "email",
    
    11
    
        "providers": ["email"]
    
    12
    
      },
    
    13
    
      "aud": "authenticated",
    
    14
    
      "email": "user@example.com",
    
    15
    
      "exp": 1640995200,
    
    16
    
      "iat": 1640991600,
    
    17
    
      "iss": "https://abcdefghijklmnopqrst.supabase.co/auth/v1",
    
    18
    
      "phone": "",
    
    19
    
      "role": "authenticated",
    
    20
    
      "session_id": "123e4567-e89b-12d3-a456-426614174000",
    
    21
    
      "sub": "123e4567-e89b-12d3-a456-426614174000",
    
    22
    
      "user_metadata": {
    
    23
    
        "name": "John Doe"
    
    24
    
      },
    
    25
    
      "is_anonymous": false
    
    26
    
    }
[/code]

### Anonymous user token#
[code] 
    1
    
    {
    
    2
    
      "iss": "supabase",
    
    3
    
      "ref": "abcdefghijklmnopqrst",
    
    4
    
      "role": "anon",
    
    5
    
      "iat": 1640991600,
    
    6
    
      "exp": 1640995200
    
    7
    
    }
[/code]

### Service role token#
[code] 
    1
    
    {
    
    2
    
      "iss": "supabase",
    
    3
    
      "ref": "abcdefghijklmnopqrst",
    
    4
    
      "role": "service_role",
    
    5
    
      "iat": 1640991600,
    
    6
    
      "exp": 1640995200
    
    7
    
    }
[/code]

## Language-Specific considerations#

### Rust#

In Rust, the `ref` field is a reserved keyword. When deserializing JWTs, you'll need to handle this:
[code] 
    1
    
    use serde::{Deserialize, Serialize};
    
    2
    
    3
    
    #[derive(Debug, Deserialize, Serialize)]
    
    4
    
    struct JwtClaims {
    
    5
    
        iss: String,
    
    6
    
        #[serde(rename = "ref")] // Handle reserved keyword
    
    7
    
        project_ref: Option<String>,
    
    8
    
        role: String,
    
    9
    
        iat: i64,
    
    10
    
        exp: i64,
    
    11
    
        // ... other claims
    
    12
    
    }
[/code]

### TypeScript/JavaScript#
[code] 
    1
    
    interface JwtClaims {
    
    2
    
      iss: string
    
    3
    
      aud: string | string[]
    
    4
    
      exp: number
    
    5
    
      iat: number
    
    6
    
      sub: string
    
    7
    
      role: string
    
    8
    
      aal: 'aal1' | 'aal2'
    
    9
    
      session_id: string
    
    10
    
      email: string
    
    11
    
      phone: string
    
    12
    
      is_anonymous: boolean
    
    13
    
      jti?: string
    
    14
    
      nbf?: number
    
    15
    
      app_metadata?: Record<string, any>
    
    16
    
      user_metadata?: Record<string, any>
    
    17
    
      amr?: Array<{
    
    18
    
        method: string
    
    19
    
        timestamp: number
    
    20
    
      }>
    
    21
    
      ref?: string // Only in anon/service role tokens
    
    22
    
    }
[/code]

### Python#
[code] 
    1
    
    from typing import Optional, Union, List, Dict, Any
    
    2
    
    from dataclasses import dataclass
    
    3
    
    4
    
    @dataclass
    
    5
    
    class AmrEntry:
    
    6
    
        method: str
    
    7
    
        timestamp: int
    
    8
    
    9
    
    @dataclass
    
    10
    
    class JwtClaims:
    
    11
    
        iss: str
    
    12
    
        aud: Union[str, List[str]]
    
    13
    
        exp: int
    
    14
    
        iat: int
    
    15
    
        sub: str
    
    16
    
        role: str
    
    17
    
        aal: str
    
    18
    
        session_id: str
    
    19
    
        email: str
    
    20
    
        phone: str
    
    21
    
        is_anonymous: bool
    
    22
    
        jti: Optional[str] = None
    
    23
    
        nbf: Optional[int] = None
    
    24
    
        app_metadata: Optional[Dict[str, Any]] = None
    
    25
    
        user_metadata: Optional[Dict[str, Any]] = None
    
    26
    
        amr: Optional[List[AmrEntry]] = None
    
    27
    
        ref: Optional[str] = None  # Only in anon/service role tokens
[/code]

### Go#
[code] 
    1
    
    type AmrEntry struct {
    
    2
    
        Method    string `json:"method"`
    
    3
    
        Timestamp int64  `json:"timestamp"`
    
    4
    
    }
    
    5
    
    6
    
    type JwtClaims struct {
    
    7
    
        Iss         string                 `json:"iss"`
    
    8
    
        Aud         interface{}            `json:"aud"` // string or []string
    
    9
    
        Exp         int64                  `json:"exp"`
    
    10
    
        Iat         int64                  `json:"iat"`
    
    11
    
        Sub         string                 `json:"sub"`
    
    12
    
        Role        string                 `json:"role"`
    
    13
    
        Aal         string                 `json:"aal"`
    
    14
    
        SessionID   string                 `json:"session_id"`
    
    15
    
        Email       string                 `json:"email"`
    
    16
    
        Phone       string                 `json:"phone"`
    
    17
    
        IsAnonymous bool                   `json:"is_anonymous"`
    
    18
    
        Jti         *string                `json:"jti,omitempty"`
    
    19
    
        Nbf         *int64                 `json:"nbf,omitempty"`
    
    20
    
        AppMetadata map[string]interface{} `json:"app_metadata,omitempty"`
    
    21
    
        UserMetadata map[string]interface{} `json:"user_metadata,omitempty"`
    
    22
    
        Amr         []AmrEntry             `json:"amr,omitempty"`
    
    23
    
        Ref         *string                `json:"ref,omitempty"` // Only in anon/service role tokens
    
    24
    
    }
[/code]

## Validation guidelines#

When implementing JWT validation on your server:

  1. **Check Required Fields** : Ensure all required claims are present
  2. **Validate Types** : Verify field types match expected types
  3. **Check Expiration** : Validate `exp` timestamp is in the future
  4. **Verify Issuer** : Ensure `iss` matches your Supabase project
  5. **Check Audience** : Validate `aud` matches expected audience
  6. **Handle Reserved Keywords** : Use field renaming for languages like Rust


## Security considerations#

  * **Always validate the JWT signature** before trusting any claims
  * **Never expose service role tokens** to client-side code
  * **Validate all claims** before trusting the JWT
  * **Check token expiration** on every request
  * **Use HTTPS** for all JWT transmission
  * **Rotate JWT secrets** regularly
  * **Implement proper error handling** for invalid tokens


## Related documentation#

  * [JWT Overview](</docs/guides/auth/jwts>)
  * [Custom Access Token Hooks](</docs/guides/auth/auth-hooks/custom-access-token-hook>)
  * [Row Level Security](</docs/guides/database/postgres/row-level-security>)
  * [Server-Side Auth](</docs/guides/auth/server-side>)