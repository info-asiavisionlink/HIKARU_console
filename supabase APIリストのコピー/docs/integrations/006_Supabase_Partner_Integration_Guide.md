---
タイトル: Supabase Partner Integration Guide
URL: https://supabase.com/docs/guides/integrations/partner-integration-guide
カテゴリ: integrations
更新日: 2026-08-02
タグ: guide, integration, integrations, partner, partner-integration-guide, supabase
---

# Supabase Partner Integration Guide

**URL:** https://supabase.com/docs/guides/integrations/partner-integration-guide
**カテゴリ:** integrations
**更新日:** 2026-08-02
**タグ:** guide, integration, integrations, partner, partner-integration-guide, supabase

## 目次

- [Method 1: Redirect#](#method-1-redirect)
  - [Step 1: Implement the redirect endpoint#](#step-1-implement-the-redirect-endpoint)
  - [Step 2: Share your endpoint with Supabase#](#step-2-share-your-endpoint-with-supabase)
- [Method 2: Signed redirect#](#method-2-signed-redirect)
  - [Step 1: Exchange public keys with Supabase#](#step-1-exchange-public-keys-with-supabase)
  - [Step 2: Implement the redirect record endpoint#](#step-2-implement-the-redirect-record-endpoint)
  - [Step 3: Implement the redirect handler endpoint#](#step-3-implement-the-redirect-handler-endpoint)
  - [Step 4: Share your details with Supabase#](#step-4-share-your-details-with-supabase)

## 概要

This guide explains how a Supabase partner can integrate with the Supabase platform via OAuth.

---

This guide assumes you have already followed [the Build a Supabase Integration guide](</docs/guides/integrations/build-a-supabase-oauth-integration>) and have a working OAuth client.

When a Supabase user clicks the **Install Integration** button in the Dashboard, they are redirected to your system to begin the OAuth flow. You can implement this redirect in one of two ways:

  * **Redirect** : Easier to build, but your system cannot verify that the incoming user was sent by Supabase.
  * **Signed redirect** : More work to build, but cryptographically verifies that the redirect originated from Supabase. **Recommended for production integrations.**


Pick the method that fits your security requirements, then follow the matching section below.

## Method 1: Redirect#

In this method, you implement a single `GET` endpoint. Supabase redirects the user to this endpoint when they click **Install Integration** , and your endpoint kicks off the OAuth flow.

Clicks "Install Integration" "Connect to Partner" Click Handler Page Redirect to Supabase Authorization Page Request Authorization Redirect to Consent Screen Display Consent Screen Gives Consent Submit User Consent Redirect to Partner With Authorization Code Submit Authorization Code Exchange Authorization Code for Token Return Token Request Management API Resources Return Resources Ok 200, OAuth Flow Complete Display "Integration Installed" Message User Browser Partner (OAuth Client) Supabase (OAuth Authorization Server/Protected Resource)

The user clicks **Install Integration** in the Supabase Dashboard, which routes them through the partner's click-handler page and on to the Supabase authorization page. Supabase shows a consent screen. Once the user consents, Supabase redirects back to the partner with an authorization code. The partner exchanges that code for a token, uses the token to request Management API resources, and finally shows the user an "Integration Installed" message.

### Step 1: Implement the redirect endpoint#

Expose a `GET` endpoint at any URL you control:
[code] 
    1
    
    GET https://<your-host>/<optional-path>?project_id=<supabase-project_ref>&organization_slug=<supabase-org-slug>
[/code]

Supabase will append the following query parameters to the URL when redirecting:

Param| Description  
---|---  
`project_id`| Supabase project ref of the project where the user clicked the **Install Integration** button.  
`organization_slug`| Supabase organization slug where the user clicked the **Install Integration** button.  
  
Save these parameters in your system. You can use them to fetch project or organization details, or to pre-select a project or organization in your UI once the OAuth flow is complete.

Your endpoint may ask the user to sign up, sign in, or perform other setup tasks on your website. Once those are complete, immediately [redirect to the Supabase authorization URL](</docs/guides/integrations/build-a-supabase-oauth-integration#redirecting-to-the-authorize-url>) without further user interaction. This starts the OAuth flow.

### Step 2: Share your endpoint with Supabase#

Send Supabase the URL of your endpoint so we can configure the **Install Integration** button to redirect there.

## Method 2: Signed redirect#

In this method, Supabase signs a JWT before redirecting the user. You verify the signature, generate a one-time redirect record, and return its URL to Supabase. Supabase then redirects the user to that URL. This guarantees that any redirect your system handles originated from Supabase.

You will implement two endpoints:

  1. A `POST` endpoint that validates the signed JWT and returns a unique redirect URL.
  2. A `GET` endpoint that handles the user once they are redirected to that URL.


Clicks "Install Integration" Request Redirect URL Generation Send Signed JWT Validate JWT Generate Unique Redirect URL Return Redirect URL Redirect to the Redirect URL Visit Redirect URL Validate Redirect Record Optional User Actions User Performs Optional Actions User Optional Actions Complete User Optional Actions Complete Redirect to Supabase Authorization Page Request Authorization Redirect to Consent Screen Display Consent Screen Gives Consent Submit User Consent Redirect to Partner With Authorization Code Submit Authorization Code Exchange Authorization Code for Token Return Token Request Management API Resources Return Resources Ok 200, OAuth Flow Complete Display "Integration Installed" Message User Browser Partner (OAuth Client) Supabase (OAuth Authorization Server/Protected Resource)

Walking through the sequence: when the user clicks **Install Integration** , Supabase sends the partner a signed JWT and asks it to generate a redirect URL. The partner validates the JWT, generates a unique redirect record and URL, and returns it. Supabase redirects the user to that URL; the partner validates the redirect record, optionally has the user complete extra steps, and then sends them to the Supabase authorization page. From there the flow matches Method 1: the user consents, Supabase returns an authorization code, the partner exchanges it for a token, requests Management API resources, and the integration completes.

### Step 1: Exchange public keys with Supabase#

Supabase generates two key-pairs, one for staging, one for production, and shares the public keys with you. Save both public keys and their key IDs in your system. The keys are PEM-encoded EC P-256.

Example:
[code] 
    1
    
    ===============Staging==================
    
    2
    
    3
    
    Key ID: pik_3038669348a3ea75dbaf0655
    
    4
    
    Public Key:
    
    5
    
    -----BEGIN PUBLIC KEY-----
    
    6
    
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnj3NmwrLPPH/3isvpS601ndQP9Mk
    
    7
    
    zqppdLDV9YfmoF4wavTyb9UTVE5pJ0fukpo5aOoNb4fBZgESsedIUoEn8Q==
    
    8
    
    -----END PUBLIC KEY-----
    
    9
    
    10
    
    ==============Production================
    
    11
    
    12
    
    Key ID: pik_89e80ddbca9df41b97e28986
    
    13
    
    Public Key:
    
    14
    
    -----BEGIN PUBLIC KEY-----
    
    15
    
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWCGhwtFWn4jpWZNeyZpTlaAdq/tD
    
    16
    
    /yBaN0gFPpS8LTFiCPFgnWKbVe3RfExXh7bEhcrEUdWycmYvwrNklWWHRA==
    
    17
    
    -----END PUBLIC KEY-----
[/code]

Look up the correct public key by the `kid` field in the JWT header.

Storing keys by ID enables zero-downtime key rotation. When Supabase rotates keys, we share new key-pairs and start signing JWTs with the new key ID. Your system picks the correct key based on `kid` without any code changes.

In future, we plan to publish keys at a `.../.well-known/jwks.json` URL and fully automate key rotation. For now this is done manually.

### Step 2: Implement the redirect record endpoint#

This endpoint receives the signed JWT from Supabase and returns a one-time redirect URL.

Host the endpoint at any URL and path you control. Do not require authentication on this endpoint, but apply rate limiting to prevent abuse.
[code] 
    1
    
    POST https://<your-api-host>/<your-api-path>
    
    2
    
    Content-Type: application/json
[/code]

#### Request body#
[code] 
    1
    
    {
    
    2
    
      "token": "<signed-jwt>"
    
    3
    
    }
[/code]

#### JWT fields#

The token is a JWT signed with the ES256 private key.

**Protected header (JOSE header)**

Field| Required| Description  
---|---|---  
`alg`| Yes| Always `ES256` — the only signing algorithm currently supported.  
`kid`| Yes| The key ID identifying the key pair. Use this to pick the correct public key when verifying the signature.  
  
**Payload (claims)**

Claim| Required| Description  
---|---|---  
`iss`| Yes| Always `supabase`.  
`aud`| Yes| A unique string identifying the audience of this JWT. Usually a URL.  
`iat`| Yes| Issued-at timestamp (seconds since epoch).  
`exp`| Yes| Expiry timestamp — at most 5 minutes after `iat`.  
`organization_slug`| No| The Supabase organization the user is connecting from. Use to pre-select the org during the OAuth consent screen.  
`project_id`| No| The Supabase project ref the user wants to connect. Use to pre-select a Supabase project in your UI.  
  
**Signature**

The header and claims are signed with the EC P-256 private key.

#### Validation#

When you receive a request:

  1. Read the `kid` field from the JWT header and look up the matching public key.
  2. Verify the JWT signature with that public key.
  3. Verify that `alg` is `ES256`.
  4. Verify that `iss` is `supabase`.
  5. Verify that `aud` matches the value you agreed with Supabase.
  6. Verify that the current time is between `iat` and `exp`.


If any check fails, return `401 Unauthorized`.

If validation succeeds, generate a UUID to identify this redirect record (also called an integration record), save it in your system with an expiry (typically 1 hour), and return it in the response. The expiry prevents records from accumulating and limits the window in which a leaked record can be used.

#### Response body#
[code] 
    1
    
    {
    
    2
    
      "integrationId": "<a unique uuid>",
    
    3
    
      "redirectUrl": "https://<your-api-host>/<your-api-path>/<integration-id>",
    
    4
    
      "expiresAt": "<timestamp>"
    
    5
    
    }
[/code]

Field| Description  
---|---  
`integrationId`| A UUID uniquely identifying the redirect record.  
`redirectUrl`| The URL the user will be redirected to. Must contain the `integrationId` somewhere in its path so you can retrieve the record on redirect.  
`expiresAt`| The time when the redirect record expires (typically 1 hour from creation). The user must begin the flow before this time.  
  
### Step 3: Implement the redirect handler endpoint#

This is the `GET` endpoint at the `redirectUrl` you returned in the previous step. The redirect record's UUID must be in its path.

When a user arrives at this endpoint:

  1. Extract the redirect record UUID from the URL path.
  2. Look it up in your system. If it doesn't exist or has expired, return `401 Unauthorized`.
  3. Optionally, walk the user through any setup required on your side — for example, signing up, signing in, or configuring your system so the integration will work.
  4. Redirect the user to the [Supabase authorization URL](</docs/guides/integrations/build-a-supabase-oauth-integration#redirecting-to-the-authorize-url>) to start the OAuth flow.


If you need the user to perform setup steps on your site, design the experience as a wizard that ends by redirecting to the Supabase authorization URL. This minimizes the chance of users getting distracted, navigating elsewhere on your site, and abandoning the OAuth flow.

### Step 4: Share your details with Supabase#

Send Supabase the following so we can configure the **Install Integration** button:

  * The URL of your redirect record endpoint (Step 2).
  * The URL pattern of your redirect handler endpoint (Step 3).
  * The `aud` claim value you want Supabase to send in the signed JWT.


Ask Supabase for the public keys and key IDs for the staging and production environments.