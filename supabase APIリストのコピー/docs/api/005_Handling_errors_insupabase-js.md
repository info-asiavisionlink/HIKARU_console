---
タイトル: Handling errors insupabase-js
URL: https://supabase.com/docs/guides/api/handling-errors-in-supabase-js
カテゴリ: api
更新日: 2026-08-02
タグ: api, errors, handling, handling-errors-in-supabase-js, insupabase
---

# Handling errors insupabase-js

**URL:** https://supabase.com/docs/guides/api/handling-errors-in-supabase-js
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, errors, handling, handling-errors-in-supabase-js, insupabase

## 目次

- [Usage ofmessageandhintproperties#](#usage-of-message-and-hint-properties)
- [The recommended pattern#](#the-recommended-pattern)
- [ThePostgrestErrorfields, by usefulness#](#the-postgresterror-fields-by-usefulness)
- [Branch onerror.code, noterror.message#](#branch-on-errorcode--not-errormessage)
- [Errors from Auth, Storage, and Edge Functions#](#errors-from-auth-storage-and-edge-functions)
  - [Auth#](#auth)
  - [Storage#](#storage)
  - [Edge Functions#](#edge-functions)
  - [Realtime#](#realtime)
- [Related#](#related)

## 概要

Read `error.hint` first — Postgres often tells you the exact fix. Log the full error so you actually see it.

---

Every `supabase-js` call returns a `{ data, error }` pair instead of throwing. When something fails, the single most useful field on `error` is usually `hint` — Postgres returns the _fix_ , not only a description of the problem. Logging only `error.message` hides it.

## Usage of `message` and `hint` properties#

Consider a `42501` permission-denied error on a table where default `GRANT`s have been revoked from `anon`:
[code] 
    1
    
    message: "permission denied for table users"
    
    2
    
    hint:    "Grant the required privileges to the current role with: GRANT SELECT ON public.users TO anon;"
[/code]

The `message` exposes the error reason, and `hint` gives you the literal SQL statement to run in the dashboard SQL editor to fix it.

The same pattern shows up across many Postgres errors — missing column? `hint` suggests the column name you probably meant. Type mismatch? `hint` shows the expected type. Whenever Postgres knows the fix, it puts it in `hint`.

Log the full `error` object, not only `error.message`.

## The recommended pattern#

Read `{ data, error }` from the response, check `error`, log the whole object, and return early.
[code] 
    1
    
    const { data, error } = await supabase.from('users').select()
    
    2
    
    if (error) {
    
    3
    
      console.error(error)
    
    4
    
      return
    
    5
    
    }
[/code]

In the case of a permission-denied error, the response body will look like this:
[code] 
    1
    
    {
    
    2
    
      "error": {
    
    3
    
        "code": "42501",
    
    4
    
        "message": "permission denied for table users",
    
    5
    
        "details": null,
    
    6
    
        "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.users TO anon;"
    
    7
    
      },
    
    8
    
      "status": 401,
    
    9
    
      "statusText": "Unauthorized"
    
    10
    
    }
[/code]

`postgrest-js` passes the body through verbatim, so `error.hint` is the exact string Postgres produced. Treat it as the answer the database is giving you, not as a suggestion to file away.

## The `PostgrestError` fields, by usefulness#

Database calls (`select`, `insert`, `update`, `upsert`, `delete`, `rpc`) return a `PostgrestError` with four fields. Read them in roughly this order:

Field| Read it when  
---|---  
`hint`| Always check first. When Postgres includes one, it's the actionable fix (a `GRANT` to run, a column name, a type).  
`code`| When branching in code. Codes are stable across versions; `message` text isn't.  
`details`| When `hint` and `message` aren't enough. Often contains the offending value, key, or row.  
`message`| As the human summary. Useful in UI strings, less useful for debugging.  
  
A full list of PostgREST error codes is in the [Error Codes reference](</guides/api/rest/postgrest-error-codes>).

## Branch on `error.code`, not `error.message`#

`error.code` is more reliable than `error.message` for programmatic branching: messages change between Postgres and PostgREST versions, but codes are stable.
[code] 
    1
    
    const { data, error } = await supabase.from('users').select()
    
    2
    
    if (error) {
    
    3
    
      console.error(error)
    
    4
    
      if (error.code === '42501') {
    
    5
    
        // Permission denied. error.hint usually contains the GRANT to run.
    
    6
    
      }
    
    7
    
      return
    
    8
    
    }
[/code]

## Errors from Auth, Storage, and Edge Functions#

The same rule applies across the SDK — log the whole error object — but the shape differs by client.

### Auth#

`AuthError` exposes `error.code` (e.g. `'invalid_credentials'`, `'email_not_confirmed'`) and `error.status`. Branch on `code`; log the whole thing.
[code] 
    1
    
    const { data, error } = await supabase.auth.signInWithPassword({
    
    2
    
      email: 'example@email.com',
    
    3
    
      password: 'example-password',
    
    4
    
    })
    
    5
    
    if (error) {
    
    6
    
      console.error(error)
    
    7
    
      return
    
    8
    
    }
[/code]

### Storage#

`StorageError` exposes `error.statusCode` (HTTP status as a string) and a structured `error` name (e.g. `'Duplicate'`, `'NotFound'`).
[code] 
    1
    
    const { data, error } = await supabase.storage
    
    2
    
      .from('avatars')
    
    3
    
      .upload('public/avatar1.png', avatarFile)
    
    4
    
    if (error) {
    
    5
    
      console.error(error)
    
    6
    
      return
    
    7
    
    }
[/code]

### Edge Functions#

Functions errors arrive as one of three subclasses. Narrow with `instanceof`; for `FunctionsHttpError`, parse the body to get the function's own error payload.
[code] 
    1
    
    import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
    
    2
    
    3
    
    const { data, error } = await supabase.functions.invoke('hello')
    
    4
    
    if (error instanceof FunctionsHttpError) {
    
    5
    
      console.error('Function error', await error.context.json())
    
    6
    
    } else if (error) {
    
    7
    
      console.error(error)
    
    8
    
    }
[/code]

### Realtime#

The `subscribe()` callback receives a `status` and, on failure, an `err` argument. Log the whole `err` — its `cause` often holds the underlying reason.
[code] 
    1
    
    supabase.channel('room1').subscribe((status, err) => {
    
    2
    
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    
    3
    
        console.error(status, err)
    
    4
    
      }
    
    5
    
    })
[/code]

## Related#

  * [PostgREST Error Codes](</guides/api/rest/postgrest-error-codes>)
  * [Automatic retries with `supabase-js`](</guides/api/automatic-retries-in-supabase-js>)
  * [Securing your API](</guides/api/securing-your-api>)