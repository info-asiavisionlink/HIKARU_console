---
タイトル: Token Security and Row Level Security
URL: https://supabase.com/docs/guides/auth/oauth-server/token-security
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, level, oauth-server, security, token, token-security
---

# Token Security and Row Level Security

**URL:** https://supabase.com/docs/guides/auth/oauth-server/token-security
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, level, oauth-server, security, token, token-security

## 目次

- [How OAuth tokens work with RLS#](#how-oauth-tokens-work-with-rls)
  - [Token structure#](#token-structure)
- [Extracting OAuth claims in RLS#](#extracting-oauth-claims-in-rls)
- [Common RLS patterns for OAuth#](#common-rls-patterns-for-oauth)
  - [Pattern 1: Grant specific client full access#](#pattern-1-grant-specific-client-full-access)
  - [Pattern 2: Grant multiple clients read-only access#](#pattern-2-grant-multiple-clients-read-only-access)
  - [Pattern 3: Restrict sensitive data from OAuth clients#](#pattern-3-restrict-sensitive-data-from-oauth-clients)
  - [Pattern 4: Client-specific data access#](#pattern-4-client-specific-data-access)
- [Real-world examples#](#real-world-examples)
  - [Example 1: Multi-platform application#](#example-1-multi-platform-application)
- [Custom access token hooks#](#custom-access-token-hooks)
  - [Customizing the audience claim#](#customizing-the-audience-claim)
  - [Adding client-specific claims#](#adding-client-specific-claims)
- [Security best practices#](#security-best-practices)
  - [1. Principle of least privilege#](#1-principle-of-least-privilege)
  - [2. Separate policies for OAuth clients#](#2-separate-policies-for-oauth-clients)
  - [3. Regularly audit OAuth clients#](#3-regularly-audit-oauth-clients)
- [Testing your policies#](#testing-your-policies)
- [Troubleshooting#](#troubleshooting)
  - [Policy not working for OAuth client#](#policy-not-working-for-oauth-client)
  - [Policy too permissive#](#policy-too-permissive)
  - [Can't differentiate between users and OAuth clients#](#cant-differentiate-between-users-and-oauth-clients)
- [Next steps#](#next-steps)

## 概要

Secure your data with Row Level Security policies for OAuth clients

---

When you enable OAuth 2.1 in your Supabase project, third-party applications can access user data on their behalf. Row Level Security (RLS) policies are crucial for controlling exactly what data each OAuth client can access.

**Scopes control OIDC data, not database access**

The OAuth scopes (`openid`, `email`, `profile`, `phone`) control what user information is included in ID tokens and returned by the UserInfo endpoint. They do **not** control access to your database tables or API endpoints.

Use RLS to define which OAuth clients can access which data, regardless of the scopes they requested.

## How OAuth tokens work with RLS#

OAuth access tokens issued by Supabase Auth are JWTs that include all standard Supabase claims plus OAuth-specific claims. This means your existing RLS policies continue to work, and you can add OAuth-specific logic to create granular access controls.

### Token structure#

Every OAuth access token includes:
[code] 
    1
    
    {
    
    2
    
      "sub": "user-uuid",
    
    3
    
      "role": "authenticated",
    
    4
    
      "aud": "authenticated",
    
    5
    
      "user_id": "user-uuid",
    
    6
    
      "email": "user@example.com",
    
    7
    
      "client_id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    
    8
    
      "aal": "aal1",
    
    9
    
      "amr": [{ "method": "password", "timestamp": 1735815600 }],
    
    10
    
      "session_id": "session-uuid",
    
    11
    
      "iss": "https://<project-ref>.supabase.co/auth/v1",
    
    12
    
      "iat": 1735815600,
    
    13
    
      "exp": 1735819200
    
    14
    
    }
[/code]

The key OAuth-specific claim is:

Claim| Description  
---|---  
`client_id`| Unique identifier of the OAuth client that obtained this token  
  
You can use this claim in RLS policies to grant different permissions to different clients.

## Extracting OAuth claims in RLS#

Use the `auth.jwt()` function to access token claims in your policies:
[code] 
    1
    
    -- Get the client ID from the token
    
    2
    
    (auth.jwt() ->> 'client_id')
    
    3
    
    4
    
    -- Check if the token is from an OAuth client
    
    5
    
    (auth.jwt() ->> 'client_id') IS NOT NULL
    
    6
    
    7
    
    -- Check if the token is from a specific client
    
    8
    
    (auth.jwt() ->> 'client_id') = 'mobile-app-client-id'
[/code]

## Common RLS patterns for OAuth#

### Pattern 1: Grant specific client full access#

Allow a specific OAuth client to access all user data:
[code] 
    1
    
    CREATE POLICY "Mobile app can access user data"
    
    2
    
    ON user_data FOR ALL
    
    3
    
    USING (
    
    4
    
      auth.uid() = user_id AND
    
    5
    
      (auth.jwt() ->> 'client_id') = 'mobile-app-client-id'
    
    6
    
    );
[/code]

### Pattern 2: Grant multiple clients read-only access#

Allow several OAuth clients to read data, but not modify it:
[code] 
    1
    
    CREATE POLICY "Third-party apps can read profiles"
    
    2
    
    ON profiles FOR SELECT
    
    3
    
    USING (
    
    4
    
      auth.uid() = user_id AND
    
    5
    
      (auth.jwt() ->> 'client_id') IN (
    
    6
    
        'analytics-client-id',
    
    7
    
        'reporting-client-id',
    
    8
    
        'dashboard-client-id'
    
    9
    
      )
    
    10
    
    );
[/code]

### Pattern 3: Restrict sensitive data from OAuth clients#

Prevent OAuth clients from accessing sensitive data:
[code] 
    1
    
    CREATE POLICY "OAuth clients cannot access payment info"
    
    2
    
    ON payment_methods FOR ALL
    
    3
    
    USING (
    
    4
    
      auth.uid() = user_id AND
    
    5
    
      (auth.jwt() ->> 'client_id') IS NULL  -- Only direct user sessions
    
    6
    
    );
[/code]

### Pattern 4: Client-specific data access#

Different clients access different subsets of data:
[code] 
    1
    
    -- Analytics client can only read aggregated data
    
    2
    
    CREATE POLICY "Analytics client reads summaries"
    
    3
    
    ON user_metrics FOR SELECT
    
    4
    
    USING (
    
    5
    
      auth.uid() = user_id AND
    
    6
    
      (auth.jwt() ->> 'client_id') = 'analytics-client-id'
    
    7
    
    );
    
    8
    
    9
    
    -- Admin client can read and modify all data
    
    10
    
    CREATE POLICY "Admin client full access"
    
    11
    
    ON user_data FOR ALL
    
    12
    
    USING (
    
    13
    
      auth.uid() = user_id AND
    
    14
    
      (auth.jwt() ->> 'client_id') = 'admin-client-id'
    
    15
    
    );
[/code]

## Real-world examples#

### Example 1: Multi-platform application#

You have a web app, mobile app, and third-party integrations:
[code] 
    1
    
    -- Web app: Full access
    
    2
    
    CREATE POLICY "Web app full access"
    
    3
    
    ON profiles FOR ALL
    
    4
    
    USING (
    
    5
    
      auth.uid() = user_id AND
    
    6
    
      (
    
    7
    
        (auth.jwt() ->> 'client_id') = 'web-app-client-id'
    
    8
    
        OR (auth.jwt() ->> 'client_id') IS NULL  -- Direct user sessions
    
    9
    
      )
    
    10
    
    );
    
    11
    
    12
    
    -- Mobile app: Read-only access to profiles
    
    13
    
    CREATE POLICY "Mobile app reads profiles"
    
    14
    
    ON profiles FOR SELECT
    
    15
    
    USING (
    
    16
    
      auth.uid() = user_id AND
    
    17
    
      (auth.jwt() ->> 'client_id') = 'mobile-app-client-id'
    
    18
    
    );
    
    19
    
    20
    
    -- Third-party integration: Limited data access
    
    21
    
    CREATE POLICY "Integration reads public data"
    
    22
    
    ON profiles FOR SELECT
    
    23
    
    USING (
    
    24
    
      auth.uid() = user_id AND
    
    25
    
      (auth.jwt() ->> 'client_id') = 'integration-client-id' AND
    
    26
    
      is_public = true
    
    27
    
    );
[/code]

## Custom access token hooks#

[Custom Access Token Hooks](</docs/guides/auth/auth-hooks/custom-access-token-hook>) work with OAuth tokens, allowing you to inject custom claims based on the OAuth client. This is particularly useful for customizing standard JWT claims like `audience` (`aud`) or adding client-specific metadata.

Custom Access Token Hooks are triggered for **all** token issuance. Use `client_id` or `authentication_method` (`oauth_provider/authorization_code` for OAuth flows) to differentiate OAuth from regular authentication.

### Customizing the audience claim#

A common use case is customizing the `audience` claim for different OAuth clients. This allows third-party services to validate that tokens were issued specifically for them:
[code] 
    1
    
    Deno.serve(async (req) => {
    
    2
    
      const { user, claims, client_id } = await req.json()
    
    3
    
    4
    
      // Customize audience based on OAuth client
    
    5
    
      if (client_id === 'mobile-app-client-id') {
    
    6
    
        return new Response(
    
    7
    
          JSON.stringify({
    
    8
    
            claims: {
    
    9
    
              aud: 'https://api.myapp.com',
    
    10
    
              app_version: '2.0.0',
    
    11
    
            },
    
    12
    
          }),
    
    13
    
          { headers: { 'Content-Type': 'application/json' } }
    
    14
    
        )
    
    15
    
      }
    
    16
    
    17
    
      if (client_id === 'analytics-partner-id') {
    
    18
    
        return new Response(
    
    19
    
          JSON.stringify({
    
    20
    
            claims: {
    
    21
    
              aud: 'https://analytics.partner.com',
    
    22
    
              access_level: 'read-only',
    
    23
    
            },
    
    24
    
          }),
    
    25
    
          { headers: { 'Content-Type': 'application/json' } }
    
    26
    
        )
    
    27
    
      }
    
    28
    
    29
    
      // Default audience for non-OAuth flows
    
    30
    
      return new Response(JSON.stringify({ claims: {} }), {
    
    31
    
        headers: { 'Content-Type': 'application/json' },
    
    32
    
      })
    
    33
    
    })
[/code]

The `audience` claim is especially important for:

  * **JWT validation by third parties** : Services can verify tokens were issued for their specific API
  * **Multi-tenant applications** : Different audiences for different client applications
  * **Compliance** : Meeting security requirements that mandate audience validation


### Adding client-specific claims#

You can also add custom claims and metadata based on the OAuth client:
[code] 
    1
    
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
    
    2
    
    3
    
    Deno.serve(async (req) => {
    
    4
    
      const { user, claims, client_id } = await req.json()
    
    5
    
    6
    
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!)
    
    7
    
    8
    
      // Add custom claims based on OAuth client
    
    9
    
      let customClaims = {}
    
    10
    
    11
    
      if (client_id === 'mobile-app-client-id') {
    
    12
    
        customClaims.aud = 'https://mobile.myapp.com'
    
    13
    
        customClaims.app_version = '2.0.0'
    
    14
    
        customClaims.platform = 'mobile'
    
    15
    
      } else if (client_id === 'analytics-client-id') {
    
    16
    
        customClaims.aud = 'https://analytics.myapp.com'
    
    17
    
        customClaims.read_only = true
    
    18
    
        customClaims.data_retention_days = 90
    
    19
    
      } else if (client_id?.startsWith('mcp-')) {
    
    20
    
        // MCP AI agents
    
    21
    
        const { data: agent } = await supabase
    
    22
    
          .from('approved_ai_agents')
    
    23
    
          .select('name, max_data_retention_days')
    
    24
    
          .eq('client_id', client_id)
    
    25
    
          .single()
    
    26
    
    27
    
        customClaims.aud = `https://mcp.myapp.com/${client_id}`
    
    28
    
        customClaims.ai_agent = true
    
    29
    
        customClaims.agent_name = agent?.name
    
    30
    
        customClaims.max_retention = agent?.max_data_retention_days
    
    31
    
      }
    
    32
    
    33
    
      return new Response(JSON.stringify({ claims: customClaims }), {
    
    34
    
        headers: { 'Content-Type': 'application/json' },
    
    35
    
      })
    
    36
    
    })
[/code]

Use these custom claims in RLS:
[code] 
    1
    
    -- Policy based on custom claims
    
    2
    
    CREATE POLICY "Read-only clients cannot modify"
    
    3
    
    ON user_data FOR UPDATE
    
    4
    
    USING (
    
    5
    
      auth.uid() = user_id AND
    
    6
    
      (auth.jwt() -> 'user_metadata' ->> 'read_only')::boolean IS NOT TRUE
    
    7
    
    );
    
    8
    
    9
    
    -- Policy based on audience claim
    
    10
    
    CREATE POLICY "Only specific audience can access"
    
    11
    
    ON api_data FOR SELECT
    
    12
    
    USING (
    
    13
    
      auth.uid() = user_id AND
    
    14
    
      (auth.jwt() ->> 'aud') IN (
    
    15
    
        'https://api.myapp.com',
    
    16
    
        'https://mobile.myapp.com'
    
    17
    
      )
    
    18
    
    );
[/code]

## Security best practices#

### 1\. Principle of least privilege#

Grant OAuth clients only the minimum permissions they need:
[code] 
    1
    
    -- Bad: Grant all access by default
    
    2
    
    CREATE POLICY "OAuth clients full access"
    
    3
    
    ON user_data FOR ALL
    
    4
    
    USING (auth.uid() = user_id);
    
    5
    
    6
    
    -- Good: Grant specific access per client
    
    7
    
    CREATE POLICY "Specific client specific access"
    
    8
    
    ON user_data FOR SELECT
    
    9
    
    USING (
    
    10
    
      auth.uid() = user_id AND
    
    11
    
      (auth.jwt() ->> 'client_id') = 'trusted-client-id'
    
    12
    
    );
[/code]

### 2\. Separate policies for OAuth clients#

Create dedicated policies for OAuth clients rather than mixing them with user policies:
[code] 
    1
    
    -- User access
    
    2
    
    CREATE POLICY "Users access their own data"
    
    3
    
    ON user_data FOR ALL
    
    4
    
    USING (
    
    5
    
      auth.uid() = user_id AND
    
    6
    
      (auth.jwt() ->> 'client_id') IS NULL
    
    7
    
    );
    
    8
    
    9
    
    -- OAuth client access (separate policy)
    
    10
    
    CREATE POLICY "OAuth clients limited access"
    
    11
    
    ON user_data FOR SELECT
    
    12
    
    USING (
    
    13
    
      auth.uid() = user_id AND
    
    14
    
      (auth.jwt() ->> 'client_id') IN ('client-1', 'client-2')
    
    15
    
    );
[/code]

### 3\. Regularly audit OAuth clients#

Track and review which clients have access:
[code] 
    1
    
    -- View all active OAuth clients
    
    2
    
    SELECT
    
    3
    
      oc.client_id,
    
    4
    
      oc.name,
    
    5
    
      oc.created_at,
    
    6
    
      COUNT(DISTINCT s.user_id) as active_users
    
    7
    
    FROM auth.oauth_clients oc
    
    8
    
    LEFT JOIN auth.sessions s ON s.client_id = oc.client_id
    
    9
    
    WHERE s.created_at > NOW() - INTERVAL '30 days'
    
    10
    
    GROUP BY oc.client_id, oc.name, oc.created_at;
[/code]

## Testing your policies#

Always test your RLS policies before deploying to production:
[code] 
    1
    
    -- Test as a specific OAuth client
    
    2
    
    SET request.jwt.claims = '{
    
    3
    
      "sub": "test-user-uuid",
    
    4
    
      "role": "authenticated",
    
    5
    
      "client_id": "test-client-id"
    
    6
    
    }';
    
    7
    
    8
    
    -- Test queries
    
    9
    
    SELECT * FROM user_data WHERE user_id = 'test-user-uuid';
    
    10
    
    11
    
    -- Reset
    
    12
    
    RESET request.jwt.claims;
[/code]

Or use the Supabase Dashboard's [RLS policy tester](</dashboard/project/_/database/policies>).

## Troubleshooting#

### Policy not working for OAuth client#

**Problem** : OAuth client can't access data despite having a valid token.

**Check** :

  1. Verify the policy includes the client's `client_id`
  2. Ensure RLS is enabled on the table
  3. Check for conflicting restrictive policies
  4. Test with secret key to isolate RLS issues


[code] 
    1
    
    -- Debug: See what client_id is in the token
    
    2
    
    SELECT auth.jwt() ->> 'client_id';
    
    3
    
    4
    
    -- Debug: Test without RLS
    
    5
    
    SET LOCAL role = service_role;
    
    6
    
    SELECT * FROM your_table;
[/code]

### Policy too permissive#

**Problem** : OAuth client has access to data it shouldn't.

**Solution** : Use `AS RESTRICTIVE` policies to add additional constraints:
[code] 
    1
    
    -- This policy runs in addition to permissive policies
    
    2
    
    CREATE POLICY "Restrict OAuth clients"
    
    3
    
    ON sensitive_data
    
    4
    
    AS RESTRICTIVE
    
    5
    
    FOR ALL
    
    6
    
    TO authenticated
    
    7
    
    USING (
    
    8
    
      -- OAuth clients cannot access this table at all
    
    9
    
      (auth.jwt() ->> 'client_id') IS NULL
    
    10
    
    );
[/code]

### Can't differentiate between users and OAuth clients#

**Problem** : Need to apply different logic for direct user sessions vs OAuth.

**Solution** : Check if `client_id` is present:
[code] 
    1
    
    -- Direct user sessions (no OAuth)
    
    2
    
    CREATE POLICY "Direct users full access"
    
    3
    
    ON user_data FOR ALL
    
    4
    
    USING (
    
    5
    
      auth.uid() = user_id AND
    
    6
    
      (auth.jwt() ->> 'client_id') IS NULL
    
    7
    
    );
    
    8
    
    9
    
    -- OAuth clients (limited access)
    
    10
    
    CREATE POLICY "OAuth clients read only"
    
    11
    
    ON user_data FOR SELECT
    
    12
    
    USING (
    
    13
    
      auth.uid() = user_id AND
    
    14
    
      (auth.jwt() ->> 'client_id') IS NOT NULL
    
    15
    
    );
[/code]

## Next steps#

  * [Learn about JWTs](</docs/guides/auth/jwts>) \- Deep dive into Supabase token structure
  * [Row Level Security](</docs/guides/database/postgres/row-level-security>) \- Complete RLS guide
  * [Custom Access Token Hooks](</docs/guides/auth/auth-hooks/custom-access-token-hook>) \- Inject custom claims
  * [OAuth flows](</docs/guides/auth/oauth-server/oauth-flows>) \- Understand token issuance