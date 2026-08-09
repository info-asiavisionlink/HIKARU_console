---
タイトル: HubSpot
URL: https://supabase.com/docs/guides/database/extensions/wrappers/hubspot
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, hubspot, wrappers
---

# HubSpot

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/hubspot
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, hubspot, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the HubSpot Wrapper#](#enable-the-hubspot-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to HubSpot#](#connecting-to-hubspot)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Companies#](#companies)
  - [Contacts#](#contacts)
  - [Deals#](#deals)
  - [Feedback submissions#](#feedback-submissions)
  - [Goals#](#goals)
  - [Leads#](#leads)
  - [Deals#](#deals)
  - [Objects#](#objects)
  - [Partner clients#](#partner-clients)
  - [Products#](#products)
  - [Tickets#](#tickets)
- [Query Pushdown Support#](#query-pushdown-support)
  - [whereclause pushdown#](#where-clause-pushdown)
  - [limitclause pushdown#](#limit-clause-pushdown)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)

## 概要

Searchdocs...

---

You can enable the HubSpot wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/hubspot_wrapper/overview>)

[HubSpot](<https://www.hubspot.com/>) is a developer and marketer of software products for inbound marketing, sales, and customer service.

The HubSpot Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read data from your HubSpot for use within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_hubspot_fdw_v0.2.0/hubspot_fdw.wasm`| `223f0e8d7557bd24f51b58fb89dcd3c1431719105acca0754ce35dfd1139296a`| >=0.5.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_hubspot_fdw_v0.1.0/hubspot_fdw.wasm`| `2cbf39e9e28aa732a225db09b2186a2342c44697d4fa047652d358e292ba5521`| >=0.4.0  
  
## Preparation#

Before you can query HubSpot, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the HubSpot Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

About Authentication

HubSpot deprecated their legacy API Keys in November 2022. The `api_key` option in this wrapper accepts a **Private App Access Token** , which is HubSpot's recommended authentication method. See [HubSpot Private Apps](<https://developers.hubspot.com/docs/guides/apps/private-apps/overview>) for setup instructions.

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your HubSpot private apps access token in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<HubSpot access token>', -- HubSpot private apps access token
    
    4
    
      'hubspot',  -- secret name for api_key_name lookup
    
    5
    
      'HubSpot private apps access token for Wrappers'
    
    6
    
    );
[/code]

The secret name (e.g., `'hubspot'`) can be used with `api_key_name` for environment-agnostic configuration.

### Connecting to HubSpot#

We need to provide Postgres with the credentials to access HubSpot and any additional options. We can do this using the `create server` command:

With Vault (by ID)With Vault (by Name)Without Vault
[code]
    1
    
    create server hubspot_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_hubspot_fdw_v0.1.0/hubspot_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:hubspot-fdw',
    
    6
    
        fdw_package_version '0.1.0',
    
    7
    
        fdw_package_checksum '2cbf39e9e28aa732a225db09b2186a2342c44697d4fa047652d358e292ba5521',
    
    8
    
        api_url 'https://api.hubapi.com/crm/v3',  -- optional
    
    9
    
        api_key_id '<key_ID>' -- The Key ID from above.
    
    10
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists hubspot;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in HubSpot, required.


Supported objects are listed below:

Object name  
---  
`objects/companies`  
`objects/contacts`  
`objects/deals`  
`objects/feedback_submissions`  
`objects/goal_targets`  
`objects/leads`  
`objects/line_items`  
`objects/<objectType>`  
`objects/partner_clients`  
`objects/products`  
`objects/tickets`  
  
The `objectType` in `objects/<objectType>` must be substituted with an object type ID, e.g. a custom object `2-3508482`.

## Entities#

Below are all the entities supported by this FDW. Each entity must have `id`, `created_at`, `updated_at` and `attrs` columns, the other columns can be any properties defined on the corresponding HubSpot object. For example, if there is a custom property `user_id` defined on the `Contacts` object, the table DDL can be:
[code] 
    1
    
    create foreign table hubspot.contacts (
    
    2
    
      id text,
    
    3
    
      user_id text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server hubspot_server
    
    9
    
      options (
    
    10
    
        object 'objects/contacts'
    
    11
    
      );
[/code]

The column `user_id` is the custom property internal name, which can be found in the `Details` section of `Edit property` page on HubSpot `Settings` -> `Data Management` -> `Properties`.

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from HubSpot.

For example, using below SQL can automatically create foreign tables in the `hubspot` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema hubspot from server hubspot_server into hubspot;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema hubspot
    
    6
    
       limit to ("contact", "companies")
    
    7
    
       from server hubspot_server into hubspot;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema hubspot
    
    11
    
       except ("contacts")
    
    12
    
       from server hubspot_server into hubspot;
[/code]

The `objects` table will not be created by the `import foreign schema` statement.

### Companies#

This is object represents the companies and organizations that interact with your business.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/companies>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
companies| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.companies (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      domain text,
    
    5
    
      created_at timestamp,
    
    6
    
      updated_at timestamp,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server hubspot_server
    
    10
    
      options (
    
    11
    
        object 'objects/companies'
    
    12
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Contacts#

This is object represents the contacts.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/contacts>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
contacts| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.contacts (
    
    2
    
      id text,
    
    3
    
      email text,
    
    4
    
      firstname text,
    
    5
    
      lastname text,
    
    6
    
      created_at timestamp,
    
    7
    
      updated_at timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server hubspot_server
    
    11
    
      options (
    
    12
    
        object 'objects/contacts'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Deals#

This is object represents the transactions with contacts and/or companies.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/deals>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
deals| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.deals (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/deals'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Feedback submissions#

This is object represents the information submitted to your NPS, CSAT, CES, and custom feedback surveys.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/feedback-submissions>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
feedback_submissions| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.feedback_submissions (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/feedback_submissions'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Goals#

This is object represents the user-specific quotas for their sales and services teams based on templates provided by HubSpot.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/goals>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
goal_targets| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.goals (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/goal_targets'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Leads#

This is object represents the contacts or companies that are potential customers who have shown interest in your products or services.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/leads>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
leads| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.leads (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/leads'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Deals#

This is object represents the instances of products to deals and quotes.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/line-items>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
line_items| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.line_items (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/line_items'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Objects#

This is object represents the objects included in all accounts, such as contacts and companies, as well as for custom objects.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/objects>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
`<objectType>`| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.objects (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/<objectType>'  -- objectType can be a custom objec type id, e.g. `2-3508482`
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Partner clients#

This is object represents the customers that Solutions Partners have a sold or managed relationship with.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/partner-clients>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
partner_clients| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.partner_clients (
    
    2
    
      id text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server hubspot_server
    
    8
    
      options (
    
    9
    
        object 'objects/partner_clients'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Products#

This is object represents the collection of goods and services that your company offers.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/products>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
products| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.products (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server hubspot_server
    
    9
    
      options (
    
    10
    
        object 'objects/products'
    
    11
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


### Tickets#

This is object represents the customer service requests in your CRM.

Ref: [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/crm/objects/tickets>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
tickets| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table hubspot.tickets (
    
    2
    
      id text,
    
    3
    
      subject text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server hubspot_server
    
    9
    
      options (
    
    10
    
        object 'objects/tickets'
    
    11
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format


## Query Pushdown Support#

### `where` clause pushdown#

This FDW supports `where id = 'xxx'` clause pushdown for all entities. For example,
[code] 
    1
    
    select * from hubspot.contacts where id = '1504';
[/code]

### `limit` clause pushdown#

This FDW supports `limit` clause pushdown for all the entities. For example,
[code] 
    1
    
    select * from hubspot.contacts limit 200;
[/code]

## Supported Data Types#

Postgres Data Type| HubSpot Data Type  
---|---  
boolean| Boolean  
bigint| Number  
double precision| Number  
numeric| Number  
text| String  
timestamp| Time  
timestamptz| Time  
jsonb| Json  
  
The HubSpot API uses JSON formatted data, please refer to [HubSpot API docs](<https://developers.hubspot.com/docs/reference/api/overview>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Query pushdown support limited to 'id' columns only
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Below are some examples on how to use HubSpot foreign tables.

### Basic example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table hubspot.contacts (
    
    2
    
      id text,
    
    3
    
      email text,
    
    4
    
      firstname text,
    
    5
    
      lastname text,
    
    6
    
      created_at timestamp,
    
    7
    
      updated_at timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server hubspot_server
    
    11
    
      options (
    
    12
    
        object 'objects/contacts'
    
    13
    
      );
    
    14
    
    15
    
    -- query all contacts
    
    16
    
    select * from hubspot.contacts;
    
    17
    
    18
    
    -- query one contact
    
    19
    
    select * from hubspot.contacts
    
    20
    
    where id = '1501';
[/code]

`attrs` is a special column which stores all the object attributes in JSON format, you can extract any attributes needed from it. See more examples below.

### Query JSON attributes#
[code] 
    1
    
    -- extract `archived` flag
    
    2
    
    select attrs->>'archived' as is_archived
    
    3
    
    from hubspot.contacts
    
    4
    
    where id = '1501';
[/code]

### Query custom properties#
[code] 
    1
    
    -- suppose the Contacts object has a custom property 'user_id', we can
    
    2
    
    -- define it as a column in the foreign table
    
    3
    
    create foreign table hubspot.contacts (
    
    4
    
      id text,
    
    5
    
      email text,
    
    6
    
      firstname text,
    
    7
    
      lastname text,
    
    8
    
      user_id text,
    
    9
    
      created_at timestamp,
    
    10
    
      updated_at timestamp,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server hubspot_server
    
    14
    
      options (
    
    15
    
        object 'objects/contacts'
    
    16
    
      );
    
    17
    
    18
    
    select id, user_id from hubspot.contacts
    
    19
    
    where id = '1501';
[/code]

Note that the column `user_id` is the custom property internal name, not its display name. It can be found in the `Details` section of `Edit property` page on HubSpot `Settings` -> `Data Management` -> `Properties`.

### Query custom objects#

Suppose we have a HubSpot custom object `Projects` and its object type id is `2-3508482`. It also has a custom property `name`, we can define the foreign table and query it as below:
[code] 
    1
    
    create foreign table hubspot.custom_projects (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server hubspot_server
    
    9
    
      options (
    
    10
    
        object 'objects/2-3508482'
    
    11
    
      );
    
    12
    
    13
    
    select * from hubspot.custom_projects;
[/code]

Note that custom object type id `2-3508482` can be found in page URL on HubSpot `Settings` -> `Data Management` -> `Custom Objects`. For example,
[code] 
    1
    
    https://app.hubspot.com/sales-products-settings/17328329/object/2-3508482
[/code]