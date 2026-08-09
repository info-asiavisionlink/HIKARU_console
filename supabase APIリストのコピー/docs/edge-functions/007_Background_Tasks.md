---
タイトル: Background Tasks
URL: https://supabase.com/docs/guides/functions/background-tasks
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: background, background-tasks, edge-functions, functions, tasks
---

# Background Tasks

**URL:** https://supabase.com/docs/guides/functions/background-tasks
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** background, background-tasks, edge-functions, functions, tasks

## 目次

- [Overview#](#overview)
- [Handling errors#](#handling-errors)
- [Testing background tasks locally#](#testing-background-tasks-locally)

## 概要

How to run background tasks in an Edge Function outside of the request handler

---

Edge Function instances can process background tasks outside of the request handler. Background tasks are useful for asynchronous operations like uploading a file to Storage, updating a database, or sending events to a logging service. You can respond to the request immediately and leave the task running in the background.

This allows you to:

  * Respond to users while processing continues
  * Handle async operations without blocking the response


* * *

## Overview#

You can use `EdgeRuntime.waitUntil(promise)` to explicitly mark background tasks. The Function instance continues to run until the promise provided to `waitUntil` completes.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    // Mark the asyncLongRunningTask's returned promise as a background task.
    
    4
    
    // ⚠️ We are NOT using `await` because we don't want it to block!
    
    5
    
    EdgeRuntime.waitUntil(asyncLongRunningTask())
    
    6
    
    7
    
    export default {
    
    8
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    9
    
        return Response.json({ ok: true })
    
    10
    
      }),
    
    11
    
    }
[/code]

You can call `EdgeRuntime.waitUntil` in the request handler too. This will not block the request.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    5
    
        // Won't block the request, runs in background.
    
    6
    
        EdgeRuntime.waitUntil(asyncLongRunningTask())
    
    7
    
    8
    
        return Response.json({ ok: true })
    
    9
    
      }),
    
    10
    
    }
[/code]

You can listen to the `beforeunload` event handler to be notified when the Function is about to be shut down.
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    EdgeRuntime.waitUntil(asyncLongRunningTask())
    
    4
    
    5
    
    // Use beforeunload event handler to be notified when function is about to shutdown
    
    6
    
    addEventListener('beforeunload', (ev) => {
    
    7
    
      console.log('Function will be shutdown due to', ev.detail?.reason)
    
    8
    
      // Save state or log the current progress
    
    9
    
    })
    
    10
    
    11
    
    export default {
    
    12
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    13
    
        return Response.json({ ok: true })
    
    14
    
      }),
    
    15
    
    }
[/code]

## Handling errors#

We recommend using `try`/`catch` blocks within your background task function to handle errors.

You can also add an event listener to [`unhandledrejection`](<https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event>) to handle any promises without a rejection handler.
[code] 
    1
    
    addEventListener('unhandledrejection', (ev) => {
    
    2
    
      console.log('unhandledrejection', ev.reason)
    
    3
    
      ev.preventDefault()
    
    4
    
    })
[/code]

The maximum duration is capped based on the wall-clock, CPU, and memory limits. The function will shut down when it reaches one of these [limits](</docs/guides/functions/limits>).

* * *

## Testing background tasks locally#

When testing Edge Functions locally with Supabase CLI, the instances are terminated automatically after a request is completed. This will prevent background tasks from running to completion.

To prevent that, you can update the `supabase/config.toml` with the following settings:
[code] 
    1
    
    [edge_runtime]
    
    2
    
    policy = "per_worker"
[/code]