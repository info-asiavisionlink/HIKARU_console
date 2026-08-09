---
タイトル: Auth Hooks
URL: https://supabase.com/docs/guides/auth/auth-hooks
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-hooks, hooks
---

# Auth Hooks

**URL:** https://supabase.com/docs/guides/auth/auth-hooks
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-hooks, hooks

## 目次

- [What is a hook#](#what-is-a-hook)
- [Security model#](#security-model)
- [Using Hooks#](#using-hooks)
  - [Developing#](#developing)
  - [Deploying#](#deploying)
  - [Error handling#](#error-handling)
- [Available Hooks#](#available-hooks)

## 概要

Use HTTP or Postgres Functions to customize your authentication flow

---

## What is a hook#

A hook is an endpoint that allows you to alter the default Supabase Auth flow at specific execution points. Developers can use hooks to add custom behavior that's not supported natively.

Hooks help you:

  * Track the origin of user signups by adding metadata
  * Improve security by adding additional checks to password and multi-factor authentication
  * Support legacy systems by integrating with identity credentials from external authentication systems
  * Add additional custom claims to your JWT
  * Send authentication emails or SMS messages through a custom provider


The following hooks are available:

Hook| Available on Plan  
---|---  
[Before User Created](</docs/guides/auth/auth-hooks/before-user-created-hook>)| Free, Pro  
[Custom Access Token](</docs/guides/auth/auth-hooks/custom-access-token-hook>)| Free, Pro  
[Send SMS](</docs/guides/auth/auth-hooks/send-sms-hook>)| Free, Pro  
[Send Email](</docs/guides/auth/auth-hooks/send-email-hook>)| Free, Pro  
[MFA Verification Attempt](</docs/guides/auth/auth-hooks/mfa-verification-hook>)| Teams and Enterprise  
[Password Verification Attempt](</docs/guides/auth/auth-hooks/password-verification-hook>)| Teams and Enterprise  
  
Supabase supports 2 ways to [configure a hook](</dashboard/project/_/auth/hooks>) in your project:

Postgres FunctionHTTP Endpoint

A [Postgres function](</docs/guides/database/functions>) can be configured as a hook. The function should take in a single argument -- the event of type JSONB -- and return a JSONB object. Since the Postgres function runs on your database, the request does not leave your project's instance.

## Security model#

Sign the payload and grant permissions selectively in order to guard the integrity of the payload.

SQLHTTP

When you configure a Postgres function as a hook, Supabase will automatically apply the following grants to the function for these reasons:

  * Allow the `supabase_auth_admin` role to execute the function. The `supabase_auth_admin` role is the Postgres role that is used by Supabase Auth to make requests to your database.
  * Revoke permissions from other roles (e.g. `anon`, `authenticated`, `public`) to ensure the function is not accessible by Supabase Data APIs.


[code]
    1
    
    -- Grant access to function to supabase_auth_admin
    
    2
    
    grant execute
    
    3
    
      on function public.custom_access_token_hook
    
    4
    
      to supabase_auth_admin;
    
    5
    
    6
    
    -- Grant access to schema to supabase_auth_admin
    
    7
    
    grant usage on schema public to supabase_auth_admin;
    
    8
    
    9
    
    -- Revoke function permissions from authenticated, anon and public
    
    10
    
    revoke execute
    
    11
    
      on function public.custom_access_token_hook
    
    12
    
      from authenticated, anon, public;
[/code]

You will need to alter your row-level security (RLS) policies to allow the `supabase_auth_admin` role to access tables that you have RLS policies on. You can read more about RLS policies [here](</docs/guides/database/postgres/row-level-security>).

Alternatively, you can create your Postgres function via the dashboard with the `security definer` tag. The `security definer` tag specifies that the function is to be executed with the privileges of the user that owns it.

Currently, functions created via the dashboard take on the `postgres` role. Read more about the `security definer` tag [in our database guide](</docs/guides/database/functions#security-definer-vs-invoker>)

## Using Hooks#

### Developing#

Let us develop a Hook locally and then deploy it to the cloud. As a recap, here’s a list of available Hooks

Hook| Suggested Function Name| When it is called| What it Does  
---|---|---|---  
Send SMS| `send_sms`| Each time an SMS is sent| Allows you to customize message content and SMS Provider  
Send Email| `send_email`| Each time an Email is sent| Allows you to customize message content and Email Provider  
Custom Access Token| `custom_access_token`| Each time a new JWT is created| Returns the claims you wish to be present in the JWT.  
MFA Verification Attempt| `mfa_verification_attempt`| Each time a user tries to verify an MFA factor.| Returns a decision on whether to reject the attempt and future ones, or to allow the user to keep trying.  
Password Verification Attempt| `password_verification_attempt`| Each time a user tries to sign in with a password.| Return a decision whether to allow the user to reject the attempt, or to allow the user to keep trying.  
  
Edit `config.toml` to set up the Auth Hook locally.

The hook name used in the `config.toml` must correspond to one of the available Hooks listed above. For example, the Send SMS hook would be configured as: `[auth.hook.send_sms]`

SQLHTTP

Modify the `auth.hook.<hook_name>` field and set `uri` to a value of `pg-functions://postgres/<schema>/<function_name>`
[code]
    1
    
    [auth.hook.<hook_name>]
    
    2
    
    enabled = true
    
    3
    
    uri = "pg-functions://...."
[/code]

You need to assign additional permissions so that Supabase Auth can access the hook as well as the tables it interacts with.

The `supabase_auth_admin` role does not have permissions to the `public` schema. You need to grant the role permission to execute your hook:
[code]
    1
    
    grant execute
    
    2
    
      on function public.custom_access_token_hook
    
    3
    
      to supabase_auth_admin;
[/code]

You also need to grant usage to `supabase_auth_admin`:
[code]
    1
    
    grant usage on schema public to supabase_auth_admin;
[/code]

Also revoke permissions from the `authenticated` and `anon` roles to ensure the function is not accessible by Supabase Serverless APIs.
[code]
    1
    
    revoke execute
    
    2
    
      on function public.custom_access_token_hook
    
    3
    
      from authenticated, anon;
[/code]

For security, we recommend against the use the `security definer` tag. The `security definer` tag specifies that the function is to be executed with the privileges of the user that owns it. When a function is created via the Supabase dashboard with the tag, it will have the extensive permissions of the `postgres` role which make it easier for undesirable actions to occur.

We recommend that you do not use any tag and explicitly grant permissions to `supabase_auth_admin` as described above.

Read more about `security definer` tag [in our database guide](</docs/guides/database/functions#security-definer-vs-invoker>).

Once done, save your Auth Hook as a migration in order to version the Auth Hook and share it with other team members. Run [`supabase migration new`](</docs/reference/cli/supabase-migration-new>) to create a migration.

If you're using the Supabase SQL Editor, there's an issue when using the `?` (_Does the string exist as a top-level key within the JSON value?_) operator. Use a direct connection to the database if you need to use it when defining a function.

Here is an example hook signature:
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
    
      -- Insert variables here
    
    7
    
    begin
    
    8
    
      -- Insert logic here
    
    9
    
      return event;
    
    10
    
    end;
    
    11
    
    $$;
[/code]

You can visit `SQL Editor > Templates` for hook templates.

### Deploying#

In the dashboard, navigate to [`Authentication > Hooks`](</dashboard/project/_/auth/hooks>) and select the appropriate function type (SQL or HTTP) from the dropdown menu.

### Error handling#

You should return an error when facing a runtime error. Runtime errors are specific to your application and arise from specific business rules rather than programmer errors.

Runtime errors could happen when:

  * The user does not have appropriate permissions
  * The event payload received does not have required claims.
  * The user has performed an action which violates a business rule.
  * The email or phone provider used in the webhook returned an error.


SQLHTTP

The error is a JSON object and has the following properties:

  * `error` An object that contains information about the error.
    * `http_code` A number indicating the HTTP code to be returned. If not set, the code is HTTP 500 Internal Server Error.
    * `message` A message to be returned in the HTTP response. Required.


Here's an example:
[code]
    1
    
    {
    
    2
    
      "error": {
    
    3
    
        "http_code": 429,
    
    4
    
        "message": "You can only verify a factor once every 10 seconds."
    
    5
    
      }
    
    6
    
    }
[/code]

Errors returned from a Postgres Hook are not retry-able. When an error is returned, the error is propagated from the hook to Supabase Auth and translated into an HTTP error which is returned to your application. Supabase Auth will only take into account the error and disregard the rest of the payload.

Outside of runtime errors, both HTTP Hooks and Postgres Hooks return timeout errors. Postgres Hooks have 2 seconds to complete processing while HTTP Hooks should complete in 5 seconds. Both HTTP Hooks and Postgres Hooks are run in a transaction do limit the duration of execution to avoid delays in authentication process.

## Available Hooks#

Each Hook description contains an example JSON Schema which you can use in conjunction with [JSON Schema Faker](<https://json-schema-faker.js.org/>) in order to generate a mock payload. For HTTP Hooks, you can also use [the Standard Webhooks Testing Tool](<https://www.standardwebhooks.com/simulate>) to simulate a request.

[Custom Access TokenCustomize the access token issued by Supabase Auth](</docs/guides/auth/auth-hooks/custom-access-token-hook>)

[Send SMSUse a custom SMS provider to send authentication messages](</docs/guides/auth/auth-hooks/send-sms-hook>)

[Send EmailUse a custom email provider to send authentication messages](</docs/guides/auth/auth-hooks/send-email-hook>)

[MFA VerificationAdd additional checks to the MFA verification flow](</docs/guides/auth/auth-hooks/mfa-verification-hook>)

[Password verificationAdd additional checks to the password verification flow](</docs/guides/auth/auth-hooks/password-verification-hook>)