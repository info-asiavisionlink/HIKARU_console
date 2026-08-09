---
タイトル: Error codes
URL: https://supabase.com/docs/guides/functions/error-codes
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: codes, edge-functions, error, error-codes, functions
---

# Error codes

**URL:** https://supabase.com/docs/guides/functions/error-codes
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** codes, edge-functions, error, error-codes, functions

## 目次

- [Bad Implementation Errors#](#bad-implementation-errors)
  - [EDGE_FUNCTION_ERROR#](#edgefunctionerror)
  - [IDLE_TIMEOUT#](#idletimeout)
  - [WORKER_RESOURCE_LIMIT, WORKER_LIMIT#](#workerresourcelimit-workerlimit)
  - [WORKER_ERROR#](#workererror)
  - [INVALID_RESPONSE_STATUS_CODE#](#invalidresponsestatuscode)
- [Authentication Errors#](#authentication-errors)
  - [UNAUTHORIZED_NO_AUTH_HEADER#](#unauthorizednoauthheader)
  - [UNAUTHORIZED_ASYMMETRIC_JWT#](#unauthorizedasymmetricjwt)
  - [UNAUTHORIZED_LEGACY_JWT#](#unauthorizedlegacyjwt)
  - [UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM#](#unauthorizedunsupportedtokenalgorithm)
  - [UNAUTHORIZED_INVALID_JWT_FORMAT#](#unauthorizedinvalidjwtformat)
- [Request Errors#](#request-errors)
  - [RATE_LIMIT_EXCEEDED#](#ratelimitexceeded)
  - [INVALID_URL#](#invalidurl)
- [Server Errors#](#server-errors)
  - [NOT_FOUND#](#notfound)
  - [BOOT_ERROR#](#booterror)
  - [LOAD_FUNCTION_ERROR#](#loadfunctionerror)
  - [LOAD_FUNCTION_METADATA_ERROR#](#loadfunctionmetadataerror)
  - [LOAD_FUNCTION_INVALID_ENTRYPOINT_PATH_ERROR#](#loadfunctioninvalidentrypointpatherror)

## 概要

Edge Functions can return the following error codes.

---

When an Edge Function request fails, the response includes a `sb-error-code` header that identifies the specific error. You can inspect this header in your HTTP client or application code to detect and handle errors programmatically.
[code] 
    1
    
    const response = await fetch('<your-function-url>')
    
    2
    
    3
    
    if (!response.ok) {
    
    4
    
      const errorCode = response.headers.get('sb-error-code')
    
    5
    
      console.error('Edge Function error:', errorCode)
    
    6
    
    }
[/code]

## Bad Implementation Errors#

These errors are caused by issues in your function's code or logic which requires updating its implementation.

### EDGE_FUNCTION_ERROR#

**Cause:** Your Edge Function is throwing an unhandled error or resulting a 5XX code.
[code] 
    1
    
    // ...
    
    2
    
    3
    
    function process() {
    
    4
    
      throw new Error('Some unhandled error')
    
    5
    
    }
    
    6
    
    7
    
    export default {
    
    8
    
      fetch: withSupabase({ auth: 'none' }, async () => {
    
    9
    
        process()
    
    10
    
    11
    
        return new Response()
    
    12
    
      }),
    
    13
    
    }
[/code]

**Solution:**

  * Ensure you are catching errors in your code logic with try-catch blocks.


[code] 
    1
    
    function process() {
    
    2
    
      throw new Error('Some unhandled error')
    
    3
    
    }
    
    4
    
    5
    
    // ...
    
    6
    
    7
    
    try {
    
    8
    
      process()
    
    9
    
      return new Response()
    
    10
    
    } catch (e) {
    
    11
    
      console.error('Process fail:', e)
    
    12
    
      return new Response(null, { status: 500 })
    
    13
    
    }
[/code]

### IDLE_TIMEOUT#

**Cause:** Your Edge Function did not respond within the [request timeout limit](</docs/guides/functions/limits>).

**Common causes:**

  * Long-running database queries
  * Slow external API calls
  * Infinite loops or blocking operations


**Solution:**

  * Optimize slow operations
  * Add timeout handling to external requests
  * Consider breaking large operations into smaller chunks


### WORKER_RESOURCE_LIMIT, WORKER_LIMIT#

**Cause:** Your Edge Function execution was stopped due to exceeding resource limits. Edge Function logs should indicate which [resource limit](</docs/guides/functions/limits>) was exceeded.

**Common causes:**

  * Memory usage exceeded available limits
  * CPU time exceeded execution quotas
  * Too many concurrent operations


**Solution:** Check your Edge Function logs to see which resource limit was exceeded, then optimize your function accordingly.

### WORKER_ERROR#

**Cause:** Your Edge Function threw an uncaught exception.
[code] 
    1
    
    // ...
    
    2
    
    3
    
    function initSomething() {
    
    4
    
      throw new Error('Some unhandled error')
    
    5
    
    }
    
    6
    
    7
    
    initSomething() // Error threw outside request handler
    
    8
    
    9
    
    export default {
    
    10
    
      fetch: withSupabase({ auth: 'none' }, async () => {
    
    11
    
        return new Response()
    
    12
    
      }),
    
    13
    
    }
[/code]

**Common causes:**

  * Unhandled JavaScript errors in your function code, outside request handler
  * Missing error handling for async operations
  * Invalid JSON parsing


**Solution:** Check your Edge Function logs to identify the specific error and add proper error handling to your code.

### INVALID_RESPONSE_STATUS_CODE#

**Cause:** Your Edge Function is returning an invalid HTTP status code — not equal to `101` and outside the range `[200, 599]`

**Common causes:**

  * Proxying an external service that returns an invalid HTTP status code


[code] 
    1
    
    // ...
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'none' }, async (req) => {
    
    5
    
        // Fails in case this proxied server return a status >599
    
    6
    
        return fetch('https://some-server-to-proxy', {
    
    7
    
          method: req.method,
    
    8
    
          headers: req.headers,
    
    9
    
          body: req.body,
    
    10
    
        })
    
    11
    
      }),
    
    12
    
    }
[/code]

**Solution:**

  * Ensure you are returning a valid HTTP status code
  * For proxy endpoints, do not return the `fetch()` result directly; instead return a new `Response` wrapped in a try-catch block


[code] 
    1
    
    // ...
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'none' }, async (req) => {
    
    5
    
        try {
    
    6
    
          const res = await fetch('https://some-server-to-proxy', {
    
    7
    
            method: req.method,
    
    8
    
            headers: req.headers,
    
    9
    
            body: req.body,
    
    10
    
          })
    
    11
    
    12
    
          // Creating a 'new Response()' ensures contructor checks
    
    13
    
          return new Response(await res.body, {
    
    14
    
            headers: res.headers,
    
    15
    
            status: res.status,
    
    16
    
            statusText: res.statusText,
    
    17
    
          })
    
    18
    
        } catch (e) {
    
    19
    
          console.error('Proxy Error', e)
    
    20
    
          return new Response(null, { status: 502 })
    
    21
    
        }
    
    22
    
      }),
    
    23
    
    }
[/code]

## Authentication Errors#

These errors occur when the request contains a missing, malformed, or unsupported JWT token. Fixing them requires ensuring your requests include a valid authorization header, or disabling JWT verification for public endpoints. For further information, see [Authorization headers](</docs/guides/functions/auth-headers>) and [Securing Edge Functions](</guides/functions/auth>).

### UNAUTHORIZED_NO_AUTH_HEADER#

**Cause:** The Edge Function has JWT verification enabled, but the request is missing the `Authorization` or `apikey` header.

**Solution:**

  * Ensure you are passing a valid JWT token in the `Authorization` header
  * Check that you are sending an API key in the `apikey` header
  * For webhooks or public endpoints, consider disabling JWT verification


### UNAUTHORIZED_ASYMMETRIC_JWT#

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header contains an invalid asymmetric `ES256 | RS256` token.

**Solution:**

  * Ensure you are passing a valid user JWT token in the `Authorization` header
  * Check that your token has not expired


### UNAUTHORIZED_LEGACY_JWT#

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header contains an invalid legacy `HS256` token.

**Solution:**

  * Ensure you are passing a valid legacy JWT token in the `Authorization` header
  * Check that your token has not expired
  * Verify that the legacy JWT secret has not been revoked or disabled


### UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM#

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header does not contain an `ES256 | RS256 | HS256` token.

**Solution:**

  * Ensure you are passing a valid Supabase-issued JWT token in the `Authorization` header


### UNAUTHORIZED_INVALID_JWT_FORMAT#

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header does not follow the `Bearer <JWT Token>` format.

**Solution:**

  * Check that you are passing `Bearer <JWT Token>` in the `Authorization` header
  * Ensure you are sending an API key in the `apikey` header instead of `Authorization`
  * For webhooks or public endpoints, consider disabling JWT verification


## Request Errors#

These errors indicate issues with the request itself, which typically require changing how the function is called.

### RATE_LIMIT_EXCEEDED#

**Cause:** The platform detected [recursive or nested function call](</docs/guides/functions/recursive-functions>) behavior.

**Common causes:**

  * Multiple function-to-function calls
  * Recursive or circular calls


**Solution:**

  * Use the suggested retry window in seconds from the error message before calling your function again
  * Ensure you are not performing unnecessary individual calls; use batch operations where possible
  * Delegate large workloads to queues instead of recursively calling other Edge Functions


### INVALID_URL#

**Cause:** The platform rejected a malformed URL.

**Solution:**

  * Ensure you are calling with a valid [formatted URL](<https://developer.mozilla.org/en-US/docs/Web/API/URL/URL>)


* * *

## Server Errors#

These errors indicate issues with function loading, execution, or the underlying platform.

### NOT_FOUND#

**Cause:** The Edge Function metadata or files were not found or are missing in the specific region.

**Solution:** Try redeploying your function and wait a few minutes to make sure all regions have been updated.

### BOOT_ERROR#

**Cause:** Your Edge Function failed to start.

**Common causes:**

  * Syntax errors preventing the function from loading
  * Import errors or missing dependencies
  * Invalid function configuration


**Solution:** Check your Edge Function logs and also verify that your function code can be executed locally with `supabase functions serve`.

### LOAD_FUNCTION_ERROR#

**Cause:** The platform was unable to load your function metadata or files.

**Solution:**

  * Try calling your function again after a short delay
  * If the problem persists, contact support


### LOAD_FUNCTION_METADATA_ERROR#

**Cause:** The platform could not fetch your function metadata, possibly due to external cache issues.

**Solution:**

  * Wait a few minutes before calling your function again
  * If the problem persists, contact support


### LOAD_FUNCTION_INVALID_ENTRYPOINT_PATH_ERROR#

**Cause:** Your Edge Function metadata is broken or contains an invalid entrypoint.

**Solution:**

  * Try redeploying your function
  * If the problem persists, contact support