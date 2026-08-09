---
タイトル: MFA Verification Hook
URL: https://supabase.com/docs/guides/auth/auth-hooks/mfa-verification-hook
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-hooks, hook, mfa-verification-hook, verification
---

# MFA Verification Hook

**URL:** https://supabase.com/docs/guides/auth/auth-hooks/mfa-verification-hook
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-hooks, hook, mfa-verification-hook, verification

## 目次

（目次なし）

## 概要

Searchdocs...

---

You can add additional checks to the [Supabase MFA implementation](</docs/guides/auth/auth-mfa>) with hooks. For example, you can:

  * Limit the number of verification attempts performed over a period of time.
  * Sign out users who have too many invalid verification attempts.
  * Count, rate limit, or ban sign-ins.


**Inputs**

Supabase Auth will send a payload containing these fields to your hook:

Field| Type| Description  
---|---|---  
`factor_id`| `string`| Unique identifier for the MFA factor being verified  
`factor_type`| `string`| `totp` or `phone`  
`user_id`| `string`| Unique identifier for the user  
`valid`| `boolean`| Whether the verification attempt was valid. For TOTP, this means that the six digit code was correct (true) or incorrect (false).  
  
JSONJSON Schema
[code]
    1
    
    {
    
    2
    
      "factor_id": "6eab6a69-7766-48bf-95d8-bd8f606894db",
    
    3
    
      "user_id": "3919cb6e-4215-4478-a960-6d3454326cec",
    
    4
    
      "valid": true
    
    5
    
    }
[/code]

**Outputs**

Return this if your hook processed the input without errors.

Field| Type| Description  
---|---|---  
`decision`| `string`| The decision on whether to allow authentication to move forward. Use `reject` to deny the verification attempt and log the user out of all active sessions. Use `continue` to use the default Supabase Auth behavior.  
`message`| `string`| The message to show the user if the decision was `reject`.
[code] 
    1  
      
    {
    
    2
    
      "decision": "reject",
    
    3
    
      "message": "You have exceeded maximum number of MFA attempts."
    
    4
    
    }
[/code]

SQL

Limit failed MFA verification attempts

Your company requires that a user can input an incorrect MFA Verification code no more than once every 2 seconds.

Create a table to record the last time a user had an incorrect MFA verification attempt for a factor.
[code]
    1
    
    create table public.mfa_failed_verification_attempts (
    
    2
    
      user_id uuid not null,
    
    3
    
      factor_id uuid not null,
    
    4
    
      last_failed_at timestamp not null default now(),
    
    5
    
      primary key (user_id, factor_id)
    
    6
    
    );
[/code]

Create a hook to read and write information to this table. For example:
[code]
    1
    
    create function public.hook_mfa_verification_attempt(event jsonb)
    
    2
    
      returns jsonb
    
    3
    
      language plpgsql
    
    4
    
    as $$
    
    5
    
      declare
    
    6
    
        last_failed_at timestamp;
    
    7
    
      begin
    
    8
    
        if event->'valid' is true then
    
    9
    
          -- code is valid, accept it
    
    10
    
          return jsonb_build_object('decision', 'continue');
    
    11
    
        end if;
    
    12
    
    13
    
        select last_failed_at into last_failed_at
    
    14
    
          from public.mfa_failed_verification_attempts
    
    15
    
          where
    
    16
    
            user_id = event->'user_id'
    
    17
    
              and
    
    18
    
            factor_id = event->'factor_id';
    
    19
    
    20
    
        if last_failed_at is not null and now() - last_failed_at < interval '2 seconds' then
    
    21
    
          -- last attempt was done too quickly
    
    22
    
          return jsonb_build_object(
    
    23
    
            'error', jsonb_build_object(
    
    24
    
              'http_code', 429,
    
    25
    
              'message',   'Please wait a moment before trying again.'
    
    26
    
            )
    
    27
    
          );
    
    28
    
        end if;
    
    29
    
    30
    
        -- record this failed attempt
    
    31
    
        insert into public.mfa_failed_verification_attempts
    
    32
    
          (
    
    33
    
            user_id,
    
    34
    
            factor_id,
    
    35
    
            last_failed_at
    
    36
    
          )
    
    37
    
          values
    
    38
    
          (
    
    39
    
            event->'user_id',
    
    40
    
            event->'factor_id',
    
    41
    
            now()
    
    42
    
          )
    
    43
    
          on conflict do update
    
    44
    
            set last_failed_at = now();
    
    45
    
    46
    
        -- finally let Supabase Auth do the default behavior for a failed attempt
    
    47
    
        return jsonb_build_object('decision', 'continue');
    
    48
    
      end;
    
    49
    
    $$;
    
    50
    
    51
    
    -- Assign appropriate permissions and revoke access
    
    52
    
    grant all
    
    53
    
      on table public.mfa_failed_verification_attempts
    
    54
    
      to supabase_auth_admin;
    
    55
    
    56
    
    revoke all
    
    57
    
      on table public.mfa_failed_verification_attempts
    
    58
    
      from authenticated, anon, public;
[/code]