---
タイトル: Password Verification Hook
URL: https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-hooks, hook, password, password-verification-hook, verification
---

# Password Verification Hook

**URL:** https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-hooks, hook, password, password-verification-hook, verification

## 目次

（目次なし）

## 概要

Searchdocs...

---

Your company wishes to increase security beyond the requirements of the default password implementation in order to fulfill security or compliance requirements. You plan to track the status of a password sign-in attempt and take action via an email or a restriction on logins where necessary.

As this hook runs on unauthenticated requests, malicious users can abuse the hook by calling it multiple times. Pay extra care when using the hook as you can unintentionally block legitimate users from accessing your application.

Check if a password is valid prior to taking any additional action to ensure the user is legitimate. Where possible, send an email or notification instead of blocking the user.

**Inputs**

Field| Type| Description  
---|---|---  
`user_id`| `string`| Unique identifier for the user attempting to sign in. Correlate this to the `auth.users` table.  
`valid`| `boolean`| Whether the password verification attempt was valid.  
  
JSONJSON Schema
[code]
    1
    
    {
    
    2
    
      "user_id": "3919cb6e-4215-4478-a960-6d3454326cec",
    
    3
    
      "valid": true
    
    4
    
    }
[/code]

**Outputs**

Return these only if your hook processed the input without errors.

Field| Type| Description  
---|---|---  
`decision`| `string`| The decision on whether to allow authentication to move forward. Use `reject` to deny the verification attempt and log the user out of all active sessions. Use `continue` to use the default Supabase Auth behavior.  
`message`| `string`| The message to show the user if the decision was `reject`.  
`should_logout_user`| `boolean`| Whether to log out the user if a `reject` decision is issued. Has no effect when a `continue` decision is issued.
[code] 
    1  
      
    {
    
    2
    
      "decision": "reject",
    
    3
    
      "message": "You have exceeded maximum number of password sign-in attempts.",
    
    4
    
      "should_logout_user": "false"
    
    5
    
    }
[/code]

SQL

Limit failed password verification attemptsSend email notification on failed password attempts

As part of new security measures within the company, users can only input an incorrect password every 10 seconds and not more than that. You want to write a hook to enforce this.

Create a table to record each user's last incorrect password verification attempt.
[code]
    1
    
    create table public.password_failed_verification_attempts (
    
    2
    
      user_id uuid not null,
    
    3
    
      last_failed_at timestamp not null default now(),
    
    4
    
      primary key (user_id)
    
    5
    
    );
[/code]

Create a hook to read and write information to this table. For example:
[code]
    1
    
    create function public.hook_password_verification_attempt(event jsonb)
    
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
    
          -- password is valid, accept it
    
    10
    
          return jsonb_build_object('decision', 'continue');
    
    11
    
        end if;
    
    12
    
    13
    
        select last_failed_at into last_failed_at
    
    14
    
          from public.password_failed_verification_attempts
    
    15
    
          where
    
    16
    
            user_id = event->'user_id';
    
    17
    
    18
    
        if last_failed_at is not null and now() - last_failed_at < interval '10 seconds' then
    
    19
    
          -- last attempt was done too quickly
    
    20
    
          return jsonb_build_object(
    
    21
    
            'error', jsonb_build_object(
    
    22
    
              'http_code', 429,
    
    23
    
              'message',   'Please wait a moment before trying again.'
    
    24
    
            )
    
    25
    
          );
    
    26
    
        end if;
    
    27
    
    28
    
        -- record this failed attempt
    
    29
    
        insert into public.password_failed_verification_attempts
    
    30
    
          (
    
    31
    
            user_id,
    
    32
    
            last_failed_at
    
    33
    
          )
    
    34
    
          values
    
    35
    
          (
    
    36
    
            event->'user_id',
    
    37
    
            now()
    
    38
    
          )
    
    39
    
          on conflict do update
    
    40
    
            set last_failed_at = now();
    
    41
    
    42
    
        -- finally let Supabase Auth do the default behavior for a failed attempt
    
    43
    
        return jsonb_build_object('decision', 'continue');
    
    44
    
      end;
    
    45
    
    $$;
    
    46
    
    47
    
    -- Assign appropriate permissions
    
    48
    
    grant all
    
    49
    
      on table public.password_failed_verification_attempts
    
    50
    
      to supabase_auth_admin;
    
    51
    
    52
    
    revoke all
    
    53
    
      on table public.password_failed_verification_attempts
    
    54
    
      from authenticated, anon, public;
[/code]