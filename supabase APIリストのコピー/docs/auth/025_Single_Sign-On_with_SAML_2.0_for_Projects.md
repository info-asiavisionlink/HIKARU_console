---
タイトル: Single Sign-On with SAML 2.0 for Projects
URL: https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-sso-saml, enterprise-sso, projects, saml, sign, single, with
---

# Single Sign-On with SAML 2.0 for Projects

**URL:** https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-sso-saml, enterprise-sso, projects, saml, sign, single, with

## 目次

- [Prerequisites#](#prerequisites)
- [Terminology#](#terminology)
- [Important SAML 2.0 information#](#important-saml-20-information)
  - [User accounts and identities#](#user-accounts-and-identities)
  - [Row Level Security#](#row-level-security)
- [Managing SAML 2.0 connections#](#managing-saml-20-connections)
  - [Add a connection#](#add-a-connection)
  - [Understanding attribute mappings#](#understanding-attribute-mappings)
  - [Remove a connection#](#remove-a-connection)
  - [Update a connection#](#update-a-connection)
  - [Retrieving information about a connection#](#retrieving-information-about-a-connection)
- [Pricing#](#pricing)
- [Frequently asked questions#](#frequently-asked-questions)
  - [Publishing your application to an identity provider's marketplace#](#publishing-your-application-to-an-identity-providers-marketplace)
  - [Why do some users get: SAML assertion does not contain email address?#](#why-do-some-users-get-saml-assertion-does-not-contain-email-address)
  - [Accessing the private key used for SAML in your project#](#accessing-the-private-key-used-for-saml-in-your-project)
  - [Is multi-tenant SSO with SAML supported?#](#is-multi-tenant-sso-with-saml-supported)
  - [Is multi-subdomain SSO with SAML supported?#](#is-multi-subdomain-sso-with-saml-supported)
  - [Why doesn't IdP-initiated SAML flow work with PKCE, and what's the alternative?#](#why-doesnt-idp-initiated-saml-flow-work-with-pkce-and-whats-the-alternative)

## 概要

Use Single Sign-On (SSO) authentication on your project with SAML 2.0

---

Looking for guides on how to use Single Sign-On with the Supabase dashboard? Head on over to [Enable SSO for Your Organization](</docs/guides/platform/sso>).

Supabase Auth supports enterprise-level Single Sign-On (SSO) for any identity providers compatible with the SAML 2.0 protocol. This is a non-exclusive list of supported identity providers:

  * Google Workspaces (formerly known as G Suite)
  * Okta, Auth0
  * Microsoft Active Directory, Azure Active Directory, Microsoft Entra
  * PingIdentity
  * OneLogin


If you're having issues with identity provider software not on this list, [open a support ticket](</dashboard/support/new>).

## Prerequisites#

This guide requires the use of the [Supabase CLI](</docs/guides/local-development>). Make sure you're using version v1.46.4 or higher. You can use `supabase -v` to see the currently installed version. You can use the `supabase sso` [subcommands](</docs/reference/cli/supabase-sso>) to manage your project's configuration.

SAML 2.0 support is disabled by default on Supabase projects. You can configure this on the [Auth Providers](</dashboard/project/_/auth/providers>) page on your project.

Note that SAML 2.0 support is offered on plans Pro and above. Check the [Pricing](</pricing>) page for more information.

## Terminology#

The number of SAML and SSO acronyms can often be overwhelming. Here's a glossary which you can refer back to at any time:

  * **Identity Provider** , **IdP** , or **IDP** An identity provider is a service that manages user accounts at a company or organization. It can verify the identity of a user and exchange that information with your Supabase project and other applications. It acts as a single source of truth for user identities and access rights. Commonly used identity providers are: Microsoft Active Directory (Azure AD, Microsoft Entra), Okta, Google Workspaces (G Suite), PingIdentity, OneLogin, and many others. There are also self-hosted and on-prem versions of identity providers, and sometimes they are accessible only by having access to a company VPN or being in a specific building.
  * **Service Provider** , **SP** This is the software that is asking for user information from an identity provider. In Supabase, this is your project's Auth server.
  * **Assertion** An assertion is a statement issued by an identity provider that contains information about a user.
  * **`EntityID`** A globally unique ID (usually a URL) that identifies an Identity Provider or Service Provider across the world.
  * **`NameID`** A unique ID (usually an email address) that identifies a user at an Identity Provider.
  * **Metadata** An XML document that describes the features and configuration of an Identity Provider or Service Provider. It can be as a standalone document or as a URL. Usually (but not always) the `EntityID` is the URL at which you can access the Metadata.
  * **Certificate** Supabase Auth (the Service Provider) trusts assertions from an Identity Provider based on the signature attached to the assertion. The signature is verified according to the certificate present in the Metadata.
  * **Assertion Consumer Service (ACS) URL** This is one of the most important SAML URLs. It is the URL where Supabase Auth will accept assertions from an identity provider. Basically, once the identity provider verifies the user's identity it will redirect to this URL and the redirect request will contain the assertion.
  * **Binding (Redirect, POST, or Artifact)** This is a description of the way an identity provider communicates with Supabase Auth. When using the Redirect binding, the communication occurs using HTTP 301 redirects. When it's `POST`, it's using `POST` requests sent with `<form>` elements on a page. When using Artifact, it's using a more secure exchange over a Redirect or `POST`.
  * **`RelayState`** State used by Supabase Auth to hold information about a request to verify the identity of a user.


## Important SAML 2.0 information#

Below is information about your project's SAML 2.0 configuration which you can share with the company or organization that you're trying to on-board.

Name| Value  
---|---  
`EntityID`| `https://<project>.supabase.co/auth/v1/sso/saml/metadata`  
Metadata URL| `https://<project>.supabase.co/auth/v1/sso/saml/metadata`  
Metadata URL  
(download)| `https://<project>.supabase.co/auth/v1/sso/saml/metadata?download=true`  
ACS URL| `https://<project>.supabase.co/auth/v1/sso/saml/acs`  
SLO URL| `https://<project>.supabase.co/auth/v1/sso/slo`  
`NameID`| Required `emailAddress` or `persistent`  
  
Note that SLO (Single Logout) is not supported at this time with Supabase Auth as it is a rarely supported feature by identity providers. However, the URL is registered and advertised for when this does become available. SLO is a best-effort service, so we recommend considering [Session Timebox or Session Inactivity Timeout](</docs/guides/auth/sessions#limiting-session-lifetime-and-number-of-allowed-sessions-per-user>) instead to force your end-users to authenticate regularly.

Append `?download=true` to the Metadata URL to download the Metadata XML file. This is useful in cases where the identity provider requires a file.

Alternatively, you can use the `supabase sso info --project-ref <your-project>` [command](</docs/reference/cli/supabase-sso-info>) to get setup information for your project.

### User accounts and identities#

User accounts and identities created via SSO differ from regular (email, phone, password, social login...) accounts in these ways:

  * **No identity linking.** Each user account verified using an SSO identity provider are not legible for [identity linking](</docs/guides/auth/auth-identity-linking>) to existing user accounts for security reasons. That is, if a user `valid.email@supabase.io` had signed up with a password, and then uses their company SSO login with your project, there will be two `valid.email@supabase.io` user accounts in the system.
  * **Emails are not necessarily unique.** Given the behavior with no identity linking, email addresses are no longer a unique identifier for a user account. Always use the user's UUID to correctly reference user accounts.
  * **Sessions may have a maximum duration.** Depending on the configuration of the identity provider, a login session established with SSO may forcibly log out a user after a certain period of time.


### Row Level Security#

You can use information about the SSO identity provider in Row Level Security policies.

Here are some commonly used statements to extract SSO related information from the user's JWT:

  * `auth.jwt()#>>'{amr,0,method}'` Returns the name of the last method used to verify the identity of this user. With SAML SSO this is `sso/saml`.
  * `auth.jwt()#>>'{amr,0,provider}'` Returns the UUID of the SSO identity provider used by the user to sign-in.
  * `auth.jwt()#>>'{user_metadata,iss}'` Returns the identity provider's SAML 2.0 `EntityID`


If you use [Multi-Factor Authentication](</docs/guides/auth/auth-mfa>) with SSO, the `amr` array may have a different method at index `0`!

A common use case with SSO is to use the UUID of the identity provider as the identifier for the organization the user belongs to -- frequently known as a tenant. By associating the identity provider's UUID with your tenants, you can use restrictive RLS policies to scope down actions and data that a user is able to access.

For example, say you have a table like:
[code] 
    1
    
    create table organization_settings (
    
    2
    
      -- the organization's unique ID
    
    3
    
      id uuid not null primary key,
    
    4
    
      -- the organization's SSO identity provider
    
    5
    
      sso_provider_id uuid unique,
    
    6
    
      -- name of the organization
    
    7
    
      name text,
    
    8
    
      -- billing plan (paid, Free, Enterprise)
    
    9
    
      billing_plan text
    
    10
    
    );
[/code]

You can use the information present in the user's JWT to scope down which rows from this table the user can see, without doing any additional user management:
[code] 
    1
    
    CREATE POLICY "View organization settings."
    
    2
    
      ON organization_settings
    
    3
    
      AS RESTRICTIVE
    
    4
    
      USING (
    
    5
    
        sso_provider_id = (select auth.jwt()#>>'{amr,0,provider}')
    
    6
    
      );
[/code]

## Managing SAML 2.0 connections#

Once you've enabled SAML 2.0 support on your project via the [Auth Providers](</dashboard/project/_/auth/providers>) page in the dashboard, you can use the [Supabase CLI](</docs/reference/cli/supabase-sso>) to add, update, remove and view information about identity providers.

### Add a connection#

To establish a connection to a SAML 2.0 Identity Provider (IdP) you will need:

  * A SAML 2.0 Metadata XML file, or a SAML 2.0 Metadata URL pointing to an XML file
  * (Optional) Email domains that the organization's IdP uses
  * (Optional) Attribute mappings between the user properties of the IdP and the claims stored by Supabase Auth


You should obtain the SAML 2.0 Metadata XML file or URL from the organization whose IdP you wish to connect. Most SAML 2.0 Identity Providers support the Metadata URL standard, and we recommend using a URL if this is available.

Commonly used SAML 2.0 Identity Providers that support Metadata URLs:

  * Okta
  * Azure AD (Microsoft Entra)
  * PingIdentity


Commonly used SAML 2.0 Identity Providers that only support Metadata XML files:

  * Google Workspaces (G Suite)
  * Any self-hosted or on-prem identity provider behind a VPN


Once you've obtained the SAML 2.0 Metadata XML file or URL you can [establish a connection](</docs/reference/cli/supabase-sso-add>) with your project's Supabase Auth server by running:
[code] 
    1
    
    supabase sso add --type saml --project-ref <your-project> \
    
    2
    
      --metadata-url 'https://company.com/idp/saml/metadata' \
    
    3
    
      --domains company.com
[/code]

If you wish to use a Metadata XML file instead, you can use:
[code] 
    1
    
    supabase sso add --type saml --project-ref <your-project> \
    
    2
    
      --metadata-file /path/to/saml/metadata.xml \
    
    3
    
      --domains company.com
[/code]

This command will register a new identity provider with your project's Auth server. When successful, you will see the details of the provider such as it's SAML information and registered domains.

Note that only persons with write access to the project can register, update or remove identity providers.

Once you've added an identity provider, users who have access to it can sign in to your application. With SAML 2.0 there are two ways that users can sign in to your project:

  * By signing-in from your application's user interface, commonly known as **SP (Service Provider) Initiated Flow**
  * By clicking on an icon in the application menu on the company intranet or identity provider page, commonly known as **Identity Provider Initiated (IdP) Flow**


To initiate a sign-in request from your application's user interface (i.e. the SP Initiated Flow), you can use:

JavaScriptDartSwiftKotlin
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    supabase.auth.signInWithSSO({
    
    7
    
      domain: 'company.com',
    
    8
    
    })
[/code]

Calling [`signInWithSSO`](</docs/reference/javascript/auth-signinwithsso>) starts the sign-in process using the identity provider registered for the `company.com` domain name. It is not required that identity providers be assigned one or multiple domain names, in which case you can use the provider's unique ID instead.

### Understanding attribute mappings#

When a user signs in using the SAML 2.0 Single Sign-On protocol, an XML document called the SAML Assertion is exchanged between the identity provider and Supabase Auth.

This assertion contains information about the user's identity and other authentication information, such as:

  * Unique ID of the user (called `NameID` in SAML)
  * Email address
  * Name of the user
  * Department or organization
  * Other attributes present in the users directory managed by the identity provider


With exception of the unique user ID, SAML does not require any other attributes in the assertion. Identity providers can be configured so that only select user information is shared with your project.

Your project can be configured to recognize these attributes and map them into your project's database using a JSON structure. This process is called attribute mapping, and varies according to the configuration of the identity provider.

For example, the following JSON structure configures attribute mapping for the `email` and `first_name` user identity properties.
[code] 
    1
    
    {
    
    2
    
      "keys": {
    
    3
    
        "email": {
    
    4
    
          "name": "mail"
    
    5
    
        },
    
    6
    
        "first_name": {
    
    7
    
          "name": "givenName"
    
    8
    
        }
    
    9
    
      }
    
    10
    
    }
[/code]

When creating or updating an identity provider with the [Supabase CLI](</docs/guides/local-development>) you can include this JSON as a file with the `--attribute-mapping-file /path/to/attribute/mapping.json` flag.

For example, to change the attribute mappings to an existing provider you can use:
[code] 
    1
    
    supabase sso update <provider-uuid> --project-ref <your-project> \
    
    2
    
      --attribute-mapping-file /path/to/attribute/mapping.json
[/code]

Given a SAML 2.0 assertion that includes these attributes:
[code] 
    1
    
    <saml:AttributeStatement>
    
    2
    
      <!-- will be mapped to the email key -->
    
    3
    
      <saml:Attribute
    
    4
    
        Name="mail"
    
    5
    
        NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
    
    6
    
        >
    
    7
    
        <saml:AttributeValue xsi:type="xs:string">
    
    8
    
          valid.email@supabase.io
    
    9
    
        </saml:AttributeValue>
    
    10
    
      </saml:Attribute>
    
    11
    
    12
    
      <!-- will be mapped to the first_name key -->
    
    13
    
      <saml:Attribute
    
    14
    
        Name="givenName"
    
    15
    
        NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
    
    16
    
        >
    
    17
    
        <saml:AttributeValue xsi:type="xs:string">
    
    18
    
          Jane Doe
    
    19
    
        </saml:AttributeValue>
    
    20
    
      </saml:Attribute>
    
    21
    
    </saml:AttributeStatement>
[/code]

Will result in the following claims in the user's identity in the database and JWT:
[code] 
    1
    
    {
    
    2
    
      "email": "valid.email@supabase.io",
    
    3
    
      "custom_claims": {
    
    4
    
        "first_name": "Jane Doe"
    
    5
    
      }
    
    6
    
    }
[/code]

Supabase Auth does not require specifying attribute mappings if you only need access to the user's email. It will attempt to find an email attribute specified in the assertion. All other properties will not be automatically included, and it is those you need to map.

At this time it is not possible to have users without an email address, so SAML assertions without one will be rejected.

Most SAML 2.0 identity providers use Lightweight Directory Access Protocol (LDAP) attribute names. However, due to their variability and complexity operators of identity providers are able to customize both the `Name` and attribute value that is sent to Supabase Auth in an assertion. Refer to the identity provider's documentation and contact the operator for details on what attributes are mapped for your project.

**Accessing the stored attributes**

The stored attributes, once mapped, show up in the access token (a JWT) of the user. If you need to look these values up in the database, you can find them in the `auth.identities` table under the `identity_data` JSON column. Identities created for SSO providers have `sso:<uuid-of-provider>` in the `provider` column, while `id` contains the unique `NameID` of the user account.

Furthermore, you can find the same identity data under `raw_user_meta_data` inside `auth.users`.

**Advanced attribute mapping**

If the SAML assertion contains multiple values for a key, such as the groups that the user has access to, only the first one will be picked up. To change this behavior, mark the key as an array. For example this attribute mapping:
[code] 
    1
    
    {
    
    2
    
      "keys": {
    
    3
    
        "groups": {
    
    4
    
          "name": "groups",
    
    5
    
          "array": true
    
    6
    
        }
    
    7
    
      }
    
    8
    
    }
[/code]

Will result in the following claims:
[code] 
    1
    
    {
    
    2
    
      "groups": ["group-a", "group-b", "group-c"]
    
    3
    
    }
[/code]

You can also specify a default value for a key that may be missing in the SAML assertion.
[code] 
    1
    
    {
    
    2
    
      "keys": {
    
    3
    
        "custom_claim": {
    
    4
    
          "name": "custom_claim",
    
    5
    
          "default": 123
    
    6
    
        }
    
    7
    
      }
    
    8
    
    }
[/code]

Some SAML Assertions may expose the same attribute under different names for different users. In this case instead of specifying a single name to look up the value, you can specify multiple names. These will be looked at in-order until a value is found:
[code] 
    1
    
    {
    
    2
    
      "keys": {
    
    3
    
        "custom_claim": {
    
    4
    
          "names": ["first-look-for-this-attribute", "then-this-one"]
    
    5
    
        }
    
    6
    
      }
    
    7
    
    }
[/code]

### Remove a connection#

Once a connection to an identity provider is established, you can [remove it](</docs/reference/cli/supabase-sso-remove>) by running:
[code] 
    1
    
    supabase sso remove <provider-id> --project-ref <your-project>
[/code]

If successful, the details of the removed identity provider will be shown. All user accounts from that identity provider will be immediately logged out. User information will remain in the system, but it will no longer be possible for any of those accounts to be accessed in the future, even if you add the connection again.

A [list of all](</docs/reference/cli/supabase-sso-list>) registered identity providers can be displayed by running:
[code] 
    1
    
    supabase sso list --project-ref <your-project>
[/code]

### Update a connection#

You may wish to update settings about a connection to a SAML 2.0 identity provider.

Commonly this is necessary when:

  * Cryptographic keys are rotated or have expired
  * Metadata URL has changed, but is the same identity provider
  * Other SAML 2.0 Metadata attributes have changed, but it is still the same identity provider
  * You are updating the domains or attribute mapping


You can use this command to [update](</docs/reference/cli/supabase-sso-update>) the configuration of an identity provider:
[code] 
    1
    
    supabase sso update <provider-id> --project-ref <your-project>
[/code]

Use `--help` to see all available flags.

It is not possible to change the unique SAML identifier of the identity provider, known as `EntityID`. Everything else can be updated. If the SAML `EntityID` of your identity provider has changed, it is regarded as a new identity provider and you will have to register it like a new connection.

### Retrieving information about a connection#

You can always obtain a [list](</docs/reference/cli/supabase-sso-list>) of all registered providers using:
[code] 
    1
    
    supabase sso list --project-ref <your-project>
[/code]

This list will only include basic information about each provider. To see [all of the information](</docs/reference/cli/supabase-sso-show>) about a provider you can use:
[code] 
    1
    
    supabase sso show <provider-id> --project-ref <your-project>
[/code]

You can use the `-o json` flag to output the information as JSON, should you need to. Other formats may be supported, use `--help` to see all available options.

## Pricing#

$0.015 per SSO MAU. You are only charged for usage exceeding your subscription plan's quota.

For a detailed breakdown of how charges are calculated, refer to [Manage Monthly Active SSO Users usage](</docs/guides/platform/manage-your-usage/monthly-active-users-sso>).

## Frequently asked questions#

### Publishing your application to an identity provider's marketplace#

Many cloud-based identity providers offer a marketplace where you can register your application for easy on-boarding with customers. When you use Supabase Auth's SAML 2.0 support you can register your project in any one of these marketplaces.

Refer to the relevant documentation for each cloud-based identity provider on how you can do this. Some common marketplaces are:

  * [Okta Integration Network](<https://developer.okta.com/docs/guides/build-sso-integration/saml2/main/>)
  * [Azure Active Directory App Gallery](<https://learn.microsoft.com/en-us/azure/active-directory-b2c/publish-app-to-azure-ad-app-gallery>)
  * [Google Workspaces Pre-integrated SAML apps catalog](<https://support.google.com/a/table/9217027>)


### Why do some users get: SAML assertion does not contain email address?#

Identity providers do not have to send back and email address for the user, though they often do. Supabase Auth requires that an email address is present.

The following list of commonly used SAML attribute names is inspected, in order of appearance, to discover the email address in the assertion:

  * `urn:oid:0.9.2342.19200300.100.1.3`
  * `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`
  * `http://schemas.xmlsoap.org/claims/EmailAddress`
  * `mail`
  * `email`


Finally if there is no such attribute, it will use the SAML `NameID` value but only if the format is advertised as `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`.

Should you run into this problem, it is most likely a misconfiguration issue **on the identity provider side.** Instruct your contact at the company to map the user's email address to one of the above listed attribute names, typically `email`.

### Accessing the private key used for SAML in your project#

At this time it is not possible to extract the RSA private key used by your project's Supabase Auth server. This is done to keep the private key as secure as possible, given that SAML does not offer an easy way to rotate keys without disrupting service. (Use a SAML 2.0 Metadata URL whenever possible for this reason!)

If you really need access to the key, [open a support ticket](</dashboard/support/new>) and we'll try to support you as best as possible.

### Is multi-tenant SSO with SAML supported?#

Yes, Supabase supports multi-tenant Single Sign-On (SSO) using SAML 2.0. While the dashboard displays only one SAML field, you can set up multiple SAML connections using the Supabase CLI. Each connection is assigned a unique `sso_provider_id`, which is included in the user's JWT and can be used in Row Level Security (RLS) policies. You can configure custom attribute mappings for each connection to include tenant-specific information, such as roles. This setup allows you to implement multi-tenant SSO for multiple clients or organizations within a single application. For example, if you have an app with multiple clients using different Azure Active Directories, you can create separate SAML connections for each and use the `sso_provider_id` to manage access and apply appropriate security policies.

### Is multi-subdomain SSO with SAML supported?#

Yes, also referred to as [cross-origin authentication within the same site](<https://web.dev/articles/same-site-same-origin>). To redirect to a URL other than the [Site URL](</docs/guides/auth/redirect-urls>), following the SAML response from the IdP, the `redirectTo` option can be added to [`signInWithSSO`](</docs/reference/javascript/auth-signinwithsso>).
[code] 
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    const { data, error } = await supabase.auth.signInWithSSO({
    
    7
    
      domain: 'company.com',
    
    8
    
      options: {
    
    9
    
        redirectTo: `https://app.company.com/callback`,
    
    10
    
      },
    
    11
    
    })
[/code]

When redirecting to a URL other than the Site URL, a `/callback` endpoint is necessary to process the auth code from the IdP and exchange it for a session. This assumes the [Supabase SSR client](</docs/guides/auth/server-side/creating-a-client>) has already been configured.

SvelteKit
[code]
    1
    
    import { error, redirect } from '@sveltejs/kit'
    
    2
    
    3
    
    import type { RequestHandler } from './$types'
    
    4
    
    5
    
    export const GET: RequestHandler = async ({ url, locals }) => {
    
    6
    
      const code = url.searchParams.get('code')
    
    7
    
    8
    
      if (!code) {
    
    9
    
        error(400, 'No authorization code provided')
    
    10
    
      }
    
    11
    
    12
    
      const { error: tokenExchangeError } = await locals.supabase.auth.exchangeCodeForSession(code)
    
    13
    
    14
    
      if (tokenExchangeError) {
    
    15
    
        error(400, 'Failed to exchange authorization code for session')
    
    16
    
      }
    
    17
    
    18
    
      redirect(303, '/')
    
    19
    
    }
[/code]

### Why doesn't IdP-initiated SAML flow work with PKCE, and what's the alternative?#

Traditional IdP-initiated SAML flows aren't compatible with PKCE (Proof Key for Code Exchange) because PKCE requires a `code_challenge` and `code_verifier` that are generated when your application initiates the authentication flow. In IdP-initiated flows, Supabase receives an unsolicited response without this information, causing the code exchange step to fail.

To achieve the same user experience while maintaining PKCE security, you can implement a "bookmark app" approach:

Create an endpoint in your application (for example, `https://your-app.com/auth/saml-init`) that initiates the SAML flow using `signInWithSSO`. Then create a bookmark or linked application in your IdP that points to this endpoint. When users access the bookmark app, it triggers a secure SP-initiated flow.

This approach supports custom SAML assertions and lets you embed the link anywhere in your application.