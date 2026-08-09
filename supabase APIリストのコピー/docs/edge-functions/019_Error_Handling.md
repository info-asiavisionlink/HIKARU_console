---
タイトル: Error Handling
URL: https://supabase.com/docs/guides/functions/error-handling
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, error, error-handling, functions, handling
---

# Error Handling

**URL:** https://supabase.com/docs/guides/functions/error-handling
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, error, error-handling, functions, handling

## 目次

- [Error handling#](#error-handling)
- [Client-side error handling#](#client-side-error-handling)
- [Error monitoring#](#error-monitoring)

## 概要

Learn how to handle errors in your Edge Functions.

---

## Error handling#

Implementing the right error responses and client-side handling helps with debugging and makes your functions much easier to maintain in production.

Within your Edge Functions, return proper HTTP status codes and error messages:
[code] 
    1
    
    Deno.serve(async (req) => {
    
    2
    
      try {
    
    3
    
        // Your function logic here
    
    4
    
        const result = await processRequest(req)
    
    5
    
        return new Response(JSON.stringify(result), {
    
    6
    
          headers: { 'Content-Type': 'application/json' },
    
    7
    
          status: 200,
    
    8
    
        })
    
    9
    
      } catch (error) {
    
    10
    
        console.error('Function error:', error)
    
    11
    
        return new Response(JSON.stringify({ error: error.message }), {
    
    12
    
          headers: { 'Content-Type': 'application/json' },
    
    13
    
          status: 500,
    
    14
    
        })
    
    15
    
      }
    
    16
    
    })
[/code]

**Best practices for function errors:**

  * Use the right HTTP status code for each situation. Return `400` for bad user input, 404 when something doesn't exist, 500 for server errors, etc. This helps with debugging and lets client apps handle different error types appropriately.
  * Include helpful error messages in the response body
  * Log errors to the console for debugging (visible in the Logs tab)


* * *

## Client-side error handling#

Within your client-side code, an Edge Function can throw three types of errors:

  * **`FunctionsHttpError`** : Your function executed but returned an error (4xx/5xx status)
  * **`FunctionsRelayError`** : Network issue between client and Supabase
  * **`FunctionsFetchError`** : Function couldn't be reached at all


[code] 
    1
    
    import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'
    
    2
    
    3
    
    const { data, error } = await supabase.functions.invoke('hello', {
    
    4
    
      headers: { 'my-custom-header': 'my-custom-header-value' },
    
    5
    
      body: { foo: 'bar' },
    
    6
    
    })
    
    7
    
    8
    
    if (error instanceof FunctionsHttpError) {
    
    9
    
      const errorMessage = await error.context.json()
    
    10
    
      console.log('Function returned an error', errorMessage)
    
    11
    
    } else if (error instanceof FunctionsRelayError) {
    
    12
    
      console.log('Relay error:', error.message)
    
    13
    
    } else if (error instanceof FunctionsFetchError) {
    
    14
    
      console.log('Fetch error:', error.message)
    
    15
    
    }
[/code]

Make sure to handle the errors properly. Functions that fail silently are hard to debug, functions with clear error messages get fixed fast.

* * *

## Error monitoring#

You can see the production error logs in the Logs tab of your Supabase Dashboard.

![Function invocations.](/docs/img/guides/functions/function-logs.png)

For more information on Logging, check out [this guide](</docs/guides/functions/logging>).