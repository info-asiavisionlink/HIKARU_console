---
タイトル: Scopes for your OAuth App
URL: https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes
カテゴリ: integrations
更新日: 2026-08-02
タグ: auth, build-a-supabase-oauth-integration, integrations, oauth, oauth-scopes, scopes, your
---

# Scopes for your OAuth App

**URL:** https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes
**カテゴリ:** integrations
**更新日:** 2026-08-02
**タグ:** auth, build-a-supabase-oauth-integration, integrations, oauth, oauth-scopes, scopes, your

## 目次

- [Available scopes#](#available-scopes)

## 概要

Scopes let you specify the level of access your integration needs

---

Scopes are only available for OAuth apps. Check out [our guide](</docs/guides/integrations/build-a-supabase-oauth-integration>) to learn how to build an OAuth app integration.

Scopes restrict access to the specific [Supabase Management API endpoints](</docs/reference/api/introduction>) for OAuth tokens. All scopes can be specified as read and/or write.

Scopes are set when you [create an OAuth app](</docs/guides/integrations/build-a-supabase-oauth-integration#create-an-oauth-app>) in the Supabase Dashboard.

You can update scopes of your OAuth app at any time, but existing OAuth app users will need to re-authorize your app via the [OAuth flow](</docs/guides/integrations/build-a-supabase-oauth-integration#implementing-the-oauth-20-flow>) to apply the new scopes.

## Available scopes#

Name| Type| Description  
---|---|---  
`Auth`| `Read`| Retrieve a project's auth configuration  
Retrieve a project's SAML SSO providers  
`Auth`| `Write`| Update a project's auth configuration  
Create, update, or delete a project's SAML SSO providers  
`Database`| `Read`| Retrieve the database configuration  
Retrieve the pooler configuration  
Retrieve SQL snippets  
Check if the database is in read-only mode  
Retrieve a database's SSL enforcement configuration  
Retrieve a database's schema typescript types  
`Database`| `Write`| Create a SQL query  
Enable database webhooks on the project  
Update the project's database configuration  
Update the pooler configuration  
Update a database's SSL enforcement configuration  
Disable read-only mode for 15mins  
Create a PITR backup for a database  
`Domains`| `Read`| Retrieve the custom domains for a project  
Retrieve the vanity subdomain configuration for a project  
`Domains`| `Write`| Activate, initialize, reverify, or delete the custom domain for a project  
Activate, delete or check the availability of a vanity subdomain for a project  
`Edge Functions`| `Read`| Retrieve information about a project's edge functions  
`Edge Functions`| `Write`| Create, update, or delete an edge function  
`Environment`| `Read`| Retrieve branches in a project  
`Environment`| `Write`| Create, update, or delete a branch  
`Organizations`| `Read`| Retrieve an organization's metadata  
Retrieve all members in an organization  
`Organizations`| `Write`| N/A  
`Projects`| `Read`| Retrieve a project's metadata  
Check if a project's database is eligible for upgrade  
Retrieve a project's network restrictions  
Retrieve a project's network bans  
`Projects`| `Write`| Create a project  
Upgrade a project's database  
Remove a project's network bans  
Update a project's network restrictions  
`Rest`| `Read`| Retrieve a project's PostgREST configuration  
`Rest`| `Write`| Update a project's PostgREST configuration  
`Secrets`| `Read`| Retrieve a project's API keys  
Retrieve a project's secrets  
Retrieve a project's pgsodium config  
`Secrets`| `Write`| Create or update a project's secrets  
Update a project's pgsodium configuration  
`Storage`| `Read`| Retrieve a project's storage buckets.  
| |