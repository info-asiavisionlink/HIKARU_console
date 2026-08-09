---
タイトル: Custom Access Token Hook
URL: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
カテゴリ: auth
更新日: 2026-08-02
タグ: access, auth, auth-hooks, custom, custom-access-token-hook, hook, token
---

# Custom Access Token Hook

**URL:** https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** access, auth, auth-hooks, custom, custom-access-token-hook, hook, token

## 目次

（目次なし）

## 概要

Customize the access token issued by Supabase Auth

---

The custom access token hook runs before a token is issued and allows you to add additional claims based on the authentication method used.

Claims returned must conform to our specification. Supabase Auth will check for these claims after the hook is run and return an error if they are not present.

These are the fields currently available on an access token:

Required Claims: `iss`, `aud`, `exp`, `iat`, `sub`, `role`, `aal`, `session_id`, `email`, `phone`, `is_anonymous`

Optional Claims: `jti`, `nbf`, `app_metadata`, `user_metadata`, `amr`,

**Inputs**

Field| Type| Description  
---|---|---  
`user_id`| `string`| Unique identifier for the user attempting to sign in.  
`claims`| `object`| Claims which are included in the access token.  
`authentication_method`| `string`| The authentication method used to request the access token. Possible values include: `oauth`, `password`, `otp`, `totp`, `recovery`, `invite`, `sso/saml`, `magiclink`, `email/signup`, `email_change`, `token_refresh`, `oauth_provider/authorization_code`, `anonymous`.  
  
JSONJSON Schema
[code]
    1
    
    {
    
    2
    
      "user_id": "8ccaa7af-909f-44e7-84cb-67cdccb56be6",
    
    3
    
      "claims": {
    
    4
    
        "aud": "authenticated",
    
    5
    
        "exp": 1715690221,
    
    6
    
        "iat": 1715686621,
    
    7
    
        "sub": "8ccaa7af-909f-44e7-84cb-67cdccb56be6",
    
    8
    
        "email": "",
    
    9
    
        "phone": "",
    
    10
    
        "app_metadata": {},
    
    11
    
        "user_metadata": {},
    
    12
    
        "role": "authenticated",
    
    13
    
        "aal": "aal1",
    
    14
    
        "amr": [ { "method": "anonymous", "timestamp": 1715686621 } ],
    
    15
    
        "session_id": "4b938a09-5372-4177-a314-cfa292099ea2",
    
    16
    
        "is_anonymous": true,
    
    17
    
        "client_id": "oauth-client-id-if-oauth-flow"
    
    18
    
      },
    
    19
    
      "authentication_method": "anonymous"
    
    20
    
    }
[/code]

**Outputs**

Return these only if your hook processed the input without errors.

Field| Type| Description  
---|---|---  
`claims`| `object`| The updated claims after the hook has been run.  
  
SQLHTTP

Minimal JWTAdd admin roleRestrict access to SSO users

Sometimes the size of the JWT can be a problem especially if you're using a [Server-Side Rendering framework](</docs/guides/auth/server-side>). Common situations where the JWT can get too large include:

  * The user has a particularly large name, email address or phone number
  * The default JWT has too many claims coming from OAuth providers
  * A large avatar URL is included


To lower the size of the JWT you can define a Custom Access Token hook like the one below which will instruct the Auth server to issue a JWT with only the listed claims. Check the documentation above on what JWT claims must be present and cannot be removed.

Refer to the [Postgres JSON functions](<https://www.postgresql.org/docs/current/functions-json.html>) on how to manipulate `jsonb` objects.
[code]
    1
    
    create or replace function public.custom_access_token_hook(event jsonb)
    
    2
    
    returns jsonb
    
    3
    
    language plpgsql
    
    4
    
    as $$
    
    5
    
      declare
    
    6
    
        original_claims jsonb;
    
    7
    
        new_claims jsonb;
    
    8
    
        claim text;
    
    9
    
      begin
    
    10
    
        original_claims = event->'claims';
    
    11
    
        new_claims = '{}'::jsonb;
    
    12
    
    13
    
        foreach claim in array array[
    
    14
    
          -- add claims you want to keep here
    
    15
    
          'iss',
    
    16
    
          'aud',
    
    17
    
          'exp',
    
    18
    
          'iat',
    
    19
    
          'sub',
    
    20
    
          'role',
    
    21
    
          'aal',
    
    22
    
          'session_id',
    
    23
    
          'email',
    
    24
    
          'phone',
    
    25
    
          'is_anonymous'
    
    26
    
       ] loop
    
    27
    
          if original_claims ? claim then
    
    28
    
            -- original_claims contains one of the listed claims, set it on new_claims
    
    29
    
            new_claims = jsonb_set(new_claims, array[claim], original_claims->claim);
    
    30
    
          end if;
    
    31
    
        end loop;
    
    32
    
    33
    
        return jsonb_build_object('claims', new_claims);
    
    34
    
      end
    
    35
    
    $$;
[/code]