---
タイトル: Shopify
URL: https://supabase.com/docs/guides/database/extensions/wrappers/shopify
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, shopify, wrappers
---

# Shopify

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/shopify
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, shopify, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Shopify Wrapper#](#enable-the-shopify-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Shopify#](#connecting-to-shopify)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [App#](#app)
  - [BusinessEntity#](#businessentity)
  - [Collection#](#collection)
  - [CustomerPaymentMethod#](#customerpaymentmethod)
  - [Customer#](#customer)
  - [DraftOrder#](#draftorder)
  - [Fulfillment#](#fulfillment)
  - [FulfillmentOrder#](#fulfillmentorder)
  - [InventoryLevel#](#inventorylevel)
  - [Location#](#location)
  - [Order#](#order)
  - [Product#](#product)
  - [ProductVariant#](#productvariant)
  - [Refund#](#refund)
  - [Return#](#return)
  - [Shop#](#shop)

## 概要

Searchdocs...

---

[Shopify](<https://shopify.com/>) is an e-commerce platform that provides businesses with the tools to create online stores, sell online and in person.

The Shopify Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read data from Shopify for use within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_shopify_fdw_v0.1.0/shopify_fdw.wasm`| `96ff21191d46f60cddca7ee456b6f6ddf206602d63b8a0e97243a2a8d1303166`| >=0.5.0  
  
## Preparation#

Before you can query Shopify, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Shopify Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Shopify Admin API access token in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Shopify API token>', -- Shopify API token
    
    4
    
      'Shopify',
    
    5
    
      'Shopify API token for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Shopify#

We need to provide Postgres with the credentials to access Shopify and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server shopify_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_shopify_fdw_v0.1.0/shopify_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:shopify-fdw',
    
    6
    
        fdw_package_version '0.1.0',
    
    7
    
        fdw_package_checksum '96ff21191d46f60cddca7ee456b6f6ddf206602d63b8a0e97243a2a8d1303166',
    
    8
    
        shop '<Shop_ID>',  -- Shop ID, e.g. teststore-0b5a
    
    9
    
        access_token_id '<key_ID>' -- The Key ID from above.
    
    10
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists shopify;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in Shopify, required.


Supported objects are listed below:

Object name  
---  
app  
businessEntities  
collections  
customerPaymentMethod  
customers  
draftOrders  
fulfillment  
fulfillmentOrders  
inventoryLevel  
locations  
orders  
productVariants  
products  
refund  
return  
shop  
storeCreditAccount  
  
## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Shopify.

For example, using below SQL can automatically create foreign tables in the `shopify` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema shopify from server shopify_server into shopify;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema shopify
    
    6
    
       limit to ("customers", "products")
    
    7
    
       from server shopify_server into shopify;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema shopify
    
    11
    
       except ("customers")
    
    12
    
       from server shopify_server into shopify;
[/code]

### App#

A Shopify application.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/app>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
app| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.app (
    
    2
    
      "apiKey" text,
    
    3
    
      "appStoreAppUrl" text,
    
    4
    
      "appStoreDeveloperUrl" text,
    
    5
    
      "availableAccessScopes" jsonb,
    
    6
    
      banner jsonb,
    
    7
    
      description text,
    
    8
    
      "developerName" text,
    
    9
    
      "developerType" text,
    
    10
    
      embedded bool,
    
    11
    
      "failedRequirements" jsonb,
    
    12
    
      features jsonb,
    
    13
    
      feedback jsonb,
    
    14
    
      handle text,
    
    15
    
      icon jsonb,
    
    16
    
      id text,
    
    17
    
      "installUrl" text,
    
    18
    
      installation jsonb,
    
    19
    
      "isPostPurchaseAppInUse" bool,
    
    20
    
      "optionalAccessScopes" jsonb,
    
    21
    
      "previouslyInstalled" bool,
    
    22
    
      "pricingDetails" text,
    
    23
    
      "pricingDetailsSummary" text,
    
    24
    
      "privacyPolicyUrl" text,
    
    25
    
      "publicCategory" text,
    
    26
    
      published bool,
    
    27
    
      "requestedAccessScopes" jsonb,
    
    28
    
      screenshots jsonb,
    
    29
    
      "shopifyDeveloped" bool,
    
    30
    
      title text,
    
    31
    
      "uninstallMessage" text,
    
    32
    
      "webhookApiVersion" text,
    
    33
    
      attrs jsonb
    
    34
    
    )
    
    35
    
      server shopify_server
    
    36
    
      options (
    
    37
    
        object 'app'
    
    38
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### BusinessEntity#

Represents a merchant's Business Entity.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/businessentity>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
businessEntities| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.businessEntities (
    
    2
    
      address jsonb,
    
    3
    
      archived bool,
    
    4
    
      "companyName" text,
    
    5
    
      "displayName" text,
    
    6
    
      id text,
    
    7
    
      "primary" bool,
    
    8
    
      "shopifyPaymentsAccount" jsonb,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server shopify_server
    
    12
    
      options (
    
    13
    
        object 'businessEntities'
    
    14
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Collection#

The Collection object represents a group of products that merchants can organize to make their stores easier to browse and help customers find related products.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/collection>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
collections| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.collections (
    
    2
    
      "availablePublicationsCount" jsonb,
    
    3
    
      description text,
    
    4
    
      "descriptionHtml" text,
    
    5
    
      events jsonb,
    
    6
    
      feedback jsonb,
    
    7
    
      handle text,
    
    8
    
      "hasProduct" bool,
    
    9
    
      id text,
    
    10
    
      image jsonb,
    
    11
    
      "legacyResourceId" bigint,
    
    12
    
      metafields jsonb,
    
    13
    
      products jsonb,
    
    14
    
      "productsCount" jsonb,
    
    15
    
      "publishedOnCurrentPublication" bool,
    
    16
    
      "publishedOnPublication" bool,
    
    17
    
      "resourcePublications" jsonb,
    
    18
    
      "resourcePublicationsCount" jsonb,
    
    19
    
      "resourcePublicationsV2" jsonb,
    
    20
    
      "ruleSet" jsonb,
    
    21
    
      seo jsonb,
    
    22
    
      "sortOrder" text,
    
    23
    
      "templateSuffix" text,
    
    24
    
      title text,
    
    25
    
      "unpublishedPublications" jsonb,
    
    26
    
      "updatedAt" timestamp,
    
    27
    
      attrs jsonb
    
    28
    
    )
    
    29
    
      server shopify_server
    
    30
    
      options (
    
    31
    
        object 'collections'
    
    32
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### CustomerPaymentMethod#

A customer's payment method.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/customerpaymentmethod>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
customerPaymentMethod| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.customerPaymentMethod (
    
    2
    
      customer jsonb,
    
    3
    
      id text,
    
    4
    
      instrument text,
    
    5
    
      "revokedAt" timestamp,
    
    6
    
      "revokedReason" text,
    
    7
    
      "subscriptionContracts" jsonb,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server shopify_server
    
    11
    
      options (
    
    12
    
        object 'customerPaymentMethod'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Query on this table must specify an value for `id` column


### Customer#

Represents information about a customer of the shop

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/customer>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
customers| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.customers (
    
    2
    
      addresses jsonb,
    
    3
    
      "addressesV2" jsonb,
    
    4
    
      "amountSpent" jsonb,
    
    5
    
      "canDelete" bool,
    
    6
    
      "companyContactProfiles" jsonb,
    
    7
    
      "createdAt" timestamp,
    
    8
    
      "dataSaleOptOut" bool,
    
    9
    
      "defaultAddress" jsonb,
    
    10
    
      "defaultEmailAddress" jsonb,
    
    11
    
      "defaultPhoneNumber" jsonb,
    
    12
    
      "displayName" text,
    
    13
    
      events jsonb,
    
    14
    
      "firstName" text,
    
    15
    
      id text,
    
    16
    
      image jsonb,
    
    17
    
      "lastName" text,
    
    18
    
      "lastOrder" jsonb,
    
    19
    
      "legacyResourceId" bigint,
    
    20
    
      "lifetimeDuration" text,
    
    21
    
      locale text,
    
    22
    
      mergeable jsonb,
    
    23
    
      metafields jsonb,
    
    24
    
      "multipassIdentifier" text,
    
    25
    
      note text,
    
    26
    
      "numberOfOrders" bigint,
    
    27
    
      orders jsonb,
    
    28
    
      "paymentMethods" jsonb,
    
    29
    
      "productSubscriberStatus" text,
    
    30
    
      state text,
    
    31
    
      "statistics" jsonb,
    
    32
    
      "storeCreditAccounts" jsonb,
    
    33
    
      "subscriptionContracts" jsonb,
    
    34
    
      tags text,
    
    35
    
      "taxExempt" bool,
    
    36
    
      "taxExemptions" text,
    
    37
    
      "updatedAt" timestamp,
    
    38
    
      "verifiedEmail" bool,
    
    39
    
      attrs jsonb
    
    40
    
    )
    
    41
    
      server shopify_server
    
    42
    
      options (
    
    43
    
        object 'customers'
    
    44
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### DraftOrder#

An order that a merchant creates on behalf of a customer.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/draftorder>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
draftOrders| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.draftorders (
    
    2
    
      "acceptAutomaticDiscounts" bool,
    
    3
    
      "allVariantPricesOverridden" bool,
    
    4
    
      "allowDiscountCodesInCheckout" bool,
    
    5
    
      "anyVariantPricesOverridden" bool,
    
    6
    
      "appliedDiscount" jsonb,
    
    7
    
      "billingAddress" jsonb,
    
    8
    
      "billingAddressMatchesShippingAddress" bool,
    
    9
    
      "completedAt" timestamp,
    
    10
    
      "createdAt" timestamp,
    
    11
    
      "currencyCode" text,
    
    12
    
      "customAttributes" jsonb,
    
    13
    
      customer jsonb,
    
    14
    
      "defaultCursor" text,
    
    15
    
      "discountCodes" jsonb,
    
    16
    
      email text,
    
    17
    
      events jsonb,
    
    18
    
      "hasTimelineComment" bool,
    
    19
    
      id text,
    
    20
    
      "invoiceEmailTemplateSubject" text,
    
    21
    
      "invoiceSentAt" timestamp,
    
    22
    
      "invoiceUrl" text,
    
    23
    
      "legacyResourceId" bigint,
    
    24
    
      "lineItems" jsonb,
    
    25
    
      "lineItemsSubtotalPrice" jsonb,
    
    26
    
      "localizedFields" jsonb,
    
    27
    
      metafields jsonb,
    
    28
    
      "name" text,
    
    29
    
      note2 text,
    
    30
    
      "order" jsonb,
    
    31
    
      "paymentTerms" jsonb,
    
    32
    
      phone text,
    
    33
    
      "platformDiscounts" jsonb,
    
    34
    
      "poNumber" text,
    
    35
    
      "presentmentCurrencyCode" text,
    
    36
    
      "purchasingEntity" text,
    
    37
    
      ready bool,
    
    38
    
      "reserveInventoryUntil" timestamp,
    
    39
    
      "shippingAddress" jsonb,
    
    40
    
      "shippingLine" jsonb,
    
    41
    
      status text,
    
    42
    
      "subtotalPriceSet" jsonb,
    
    43
    
      tags jsonb,
    
    44
    
      "taxExempt" bool,
    
    45
    
      "taxLines" jsonb,
    
    46
    
      "taxesIncluded" bool,
    
    47
    
      "totalDiscountsSet" jsonb,
    
    48
    
      "totalLineItemsPriceSet" jsonb,
    
    49
    
      "totalPriceSet" jsonb,
    
    50
    
      "totalQuantityOfLineItems" bigint,
    
    51
    
      "totalShippingPriceSet" jsonb,
    
    52
    
      "totalTaxSet" jsonb,
    
    53
    
      "totalWeight" bigint,
    
    54
    
      "transformerFingerprint" text,
    
    55
    
      "updatedAt" timestamp,
    
    56
    
      "visibleToCustomer" bool,
    
    57
    
      warnings jsonb,
    
    58
    
      attrs jsonb
    
    59
    
    )
    
    60
    
      server shopify_server
    
    61
    
      options (
    
    62
    
        object 'draftOrders'
    
    63
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Fulfillment#

Represents a fulfillment.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/fulfillment>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
fulfillment| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.fulfillment (
    
    2
    
      "createdAt" timestamp,
    
    3
    
      "deliveredAt" timestamp,
    
    4
    
      "displayStatus" text,
    
    5
    
      "estimatedDeliveryAt" timestamp,
    
    6
    
      events jsonb,
    
    7
    
      "fulfillmentLineItems" jsonb,
    
    8
    
      "fulfillmentOrders" jsonb,
    
    9
    
      id text,
    
    10
    
      "inTransitAt" timestamp,
    
    11
    
      "legacyResourceId" bigint,
    
    12
    
      "location" jsonb,
    
    13
    
      "name" text,
    
    14
    
      "order" jsonb,
    
    15
    
      "originAddress" jsonb,
    
    16
    
      "requiresShipping" bool,
    
    17
    
      service jsonb,
    
    18
    
      status text,
    
    19
    
      "totalQuantity" bigint,
    
    20
    
      "trackingInfo" jsonb,
    
    21
    
      "updatedAt" timestamp,
    
    22
    
      attrs jsonb
    
    23
    
    )
    
    24
    
      server shopify_server
    
    25
    
      options (
    
    26
    
        object 'fulfillment'
    
    27
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Query on this table must specify an value for `id` column


### FulfillmentOrder#

The FulfillmentOrder object represents either an item or a group of items in an Order that are expected to be fulfilled from the same location.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/fulfillmentorder>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
fulfillmentOrders| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.fulfillmentorders (
    
    2
    
      "assignedLocation" jsonb,
    
    3
    
      "channelId" text,
    
    4
    
      "createdAt" timestamp,
    
    5
    
      "deliveryMethod" jsonb,
    
    6
    
      destination jsonb,
    
    7
    
      "fulfillAt" timestamp,
    
    8
    
      "fulfillBy" timestamp,
    
    9
    
      "fulfillmentHolds" jsonb,
    
    10
    
      "fulfillmentOrdersForMerge" jsonb,
    
    11
    
      fulfillments jsonb,
    
    12
    
      id text,
    
    13
    
      "internationalDuties" jsonb,
    
    14
    
      "lineItems" jsonb,
    
    15
    
      "locationsForMove" jsonb,
    
    16
    
      "merchantRequests" jsonb,
    
    17
    
      "order" jsonb,
    
    18
    
      "orderId" text,
    
    19
    
      "orderName" text,
    
    20
    
      "orderProcessedAt" timestamp,
    
    21
    
      "requestStatus" text,
    
    22
    
      status text,
    
    23
    
      "supportedActions" jsonb,
    
    24
    
      "updatedAt" timestamp,
    
    25
    
      attrs jsonb
    
    26
    
    )
    
    27
    
      server shopify_server
    
    28
    
      options (
    
    29
    
        object 'fulfillmentOrders'
    
    30
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### InventoryLevel#

The quantities of an inventory item that are related to a specific location.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/inventorylevel>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
inventoryLevel| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.inventorylevel (
    
    2
    
      "canDeactivate" bool,
    
    3
    
      "createdAt" timestamp,
    
    4
    
      "deactivationAlert" text,
    
    5
    
      id text,
    
    6
    
      item jsonb,
    
    7
    
      "location" jsonb,
    
    8
    
      "scheduledChanges" jsonb,
    
    9
    
      "updatedAt" timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server shopify_server
    
    13
    
      options (
    
    14
    
        object 'inventoryLevel'
    
    15
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Query on this table must specify an value for `id` column


### Location#

Represents the location where the physical good resides.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/location>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
locations| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.locations (
    
    2
    
      activatable bool,
    
    3
    
      address jsonb,
    
    4
    
      "addressVerified" bool,
    
    5
    
      "createdAt" timestamp,
    
    6
    
      deactivatable bool,
    
    7
    
      "deactivatedAt" text,
    
    8
    
      deletable bool,
    
    9
    
      "fulfillmentService" jsonb,
    
    10
    
      "fulfillsOnlineOrders" bool,
    
    11
    
      "hasActiveInventory" bool,
    
    12
    
      "hasUnfulfilledOrders" bool,
    
    13
    
      id text,
    
    14
    
      "inventoryLevels" jsonb,
    
    15
    
      "isActive" bool,
    
    16
    
      "isFulfillmentService" bool,
    
    17
    
      "legacyResourceId" bigint,
    
    18
    
      "localPickupSettingsV2" jsonb,
    
    19
    
      metafields jsonb,
    
    20
    
      "name" text,
    
    21
    
      "shipsInventory" bool,
    
    22
    
      "suggestedAddresses" jsonb,
    
    23
    
      "updatedAt" timestamp,
    
    24
    
      attrs jsonb
    
    25
    
    )
    
    26
    
      server shopify_server
    
    27
    
      options (
    
    28
    
        object 'locations'
    
    29
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Order#

The Order object represents a customer's request to purchase one or more products from a store.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/order>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
orders| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.orders (
    
    2
    
      "additionalFees" jsonb,
    
    3
    
      agreements jsonb,
    
    4
    
      alerts jsonb,
    
    5
    
      app jsonb,
    
    6
    
      "billingAddress" jsonb,
    
    7
    
      "billingAddressMatchesShippingAddress" bool,
    
    8
    
      "canMarkAsPaid" bool,
    
    9
    
      "canNotifyCustomer" bool,
    
    10
    
      "cancelReason" text,
    
    11
    
      cancellation jsonb,
    
    12
    
      "cancelledAt" timestamp,
    
    13
    
      capturable bool,
    
    14
    
      "cartDiscountAmountSet" jsonb,
    
    15
    
      "channelInformation" jsonb,
    
    16
    
      "clientIp" text,
    
    17
    
      closed bool,
    
    18
    
      "closedAt" timestamp,
    
    19
    
      "confirmationNumber" text,
    
    20
    
      confirmed bool,
    
    21
    
      "createdAt" timestamp,
    
    22
    
      "currencyCode" text,
    
    23
    
      "currentCartDiscountAmountSet" jsonb,
    
    24
    
      "currentShippingPriceSet" jsonb,
    
    25
    
      "currentSubtotalLineItemsQuantity" bigint,
    
    26
    
      "currentSubtotalPriceSet" jsonb,
    
    27
    
      "currentTaxLines" jsonb,
    
    28
    
      "currentTotalAdditionalFeesSet" jsonb,
    
    29
    
      "currentTotalDiscountsSet" jsonb,
    
    30
    
      "currentTotalDutiesSet" jsonb,
    
    31
    
      "currentTotalPriceSet" jsonb,
    
    32
    
      "currentTotalTaxSet" jsonb,
    
    33
    
      "currentTotalWeight" bigint,
    
    34
    
      "customAttributes" jsonb,
    
    35
    
      customer jsonb,
    
    36
    
      "customerAcceptsMarketing" bool,
    
    37
    
      "customerJourneySummary" jsonb,
    
    38
    
      "customerLocale" text,
    
    39
    
      "discountApplications" jsonb,
    
    40
    
      "discountCode" text,
    
    41
    
      "discountCodes" jsonb,
    
    42
    
      "displayAddress" jsonb,
    
    43
    
      "displayFinancialStatus" text,
    
    44
    
      "displayFulfillmentStatus" text,
    
    45
    
      disputes jsonb,
    
    46
    
      "dutiesIncluded" bool,
    
    47
    
      edited bool,
    
    48
    
      email text,
    
    49
    
      "estimatedTaxes" bool,
    
    50
    
      events jsonb,
    
    51
    
      fulfillable bool,
    
    52
    
      "fulfillmentOrders" jsonb,
    
    53
    
      fulfillments jsonb,
    
    54
    
      "fulfillmentsCount" jsonb,
    
    55
    
      "fullyPaid" bool,
    
    56
    
      "hasTimelineComment" bool,
    
    57
    
      id text,
    
    58
    
      "legacyResourceId" bigint,
    
    59
    
      "lineItems" jsonb,
    
    60
    
      "localizedFields" jsonb,
    
    61
    
      "merchantBusinessEntity" jsonb,
    
    62
    
      "merchantEditable" bool,
    
    63
    
      "merchantEditableErrors" jsonb,
    
    64
    
      "merchantOfRecordApp" jsonb,
    
    65
    
      metafields jsonb,
    
    66
    
      "name" text,
    
    67
    
      "netPaymentSet" jsonb,
    
    68
    
      "nonFulfillableLineItems" jsonb,
    
    69
    
      note text,
    
    70
    
      "number" bigint,
    
    71
    
      "originalTotalAdditionalFeesSet" jsonb,
    
    72
    
      "originalTotalDutiesSet" jsonb,
    
    73
    
      "originalTotalPriceSet" jsonb,
    
    74
    
      "paymentCollectionDetails" jsonb,
    
    75
    
      "paymentGatewayNames" text,
    
    76
    
      "paymentTerms" jsonb,
    
    77
    
      phone text,
    
    78
    
      "poNumber" text,
    
    79
    
      "presentmentCurrencyCode" text,
    
    80
    
      "processedAt" timestamp,
    
    81
    
      "publication" jsonb,
    
    82
    
      "refundDiscrepancySet" jsonb,
    
    83
    
      refundable bool,
    
    84
    
      refunds jsonb,
    
    85
    
      "registeredSourceUrl" text,
    
    86
    
      "requiresShipping" bool,
    
    87
    
      restockable bool,
    
    88
    
      "retailLocation" jsonb,
    
    89
    
      "returnStatus" text,
    
    90
    
      "returns" jsonb,
    
    91
    
      risk jsonb,
    
    92
    
      "shippingAddress" jsonb,
    
    93
    
      "shippingLine" jsonb,
    
    94
    
      "shippingLines" jsonb,
    
    95
    
      "shopifyProtect" jsonb,
    
    96
    
      "sourceIdentifier" text,
    
    97
    
      "sourceName" text,
    
    98
    
      "staffMember" jsonb,
    
    99
    
      "statusPageUrl" text,
    
    100
    
      "subtotalLineItemsQuantity" bigint,
    
    101
    
      "subtotalPriceSet" jsonb,
    
    102
    
      "suggestedRefund" jsonb,
    
    103
    
      tags jsonb,
    
    104
    
      "taxExempt" bool,
    
    105
    
      "taxLines" jsonb,
    
    106
    
      "taxesIncluded" bool,
    
    107
    
      test bool,
    
    108
    
      "totalCapturableSet" jsonb,
    
    109
    
      "totalCashRoundingAdjustment" jsonb,
    
    110
    
      "totalDiscountsSet" jsonb,
    
    111
    
      "totalOutstandingSet" jsonb,
    
    112
    
      "totalPriceSet" jsonb,
    
    113
    
      "totalReceivedSet" jsonb,
    
    114
    
      "totalRefundedSet" jsonb,
    
    115
    
      "totalRefundedShippingSet" jsonb,
    
    116
    
      "totalShippingPriceSet" jsonb,
    
    117
    
      "totalTaxSet" jsonb,
    
    118
    
      "totalTipReceivedSet" jsonb,
    
    119
    
      "totalWeight" bigint,
    
    120
    
      transactions jsonb,
    
    121
    
      "transactionsCount" jsonb,
    
    122
    
      unpaid bool,
    
    123
    
      "updatedAt" timestamp,
    
    124
    
      attrs jsonb
    
    125
    
    )
    
    126
    
      server shopify_server
    
    127
    
      options (
    
    128
    
        object 'orders'
    
    129
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Product#

The Product object lets you manage products in a merchant’s store.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/product>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
products| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.products  (
    
    2
    
      "availablePublicationsCount" jsonb,
    
    3
    
      "bundleComponents" jsonb,
    
    4
    
      category jsonb,
    
    5
    
      collections jsonb,
    
    6
    
      "combinedListing" jsonb,
    
    7
    
      "combinedListingRole" text,
    
    8
    
      "compareAtPriceRange" jsonb,
    
    9
    
      "createdAt" timestamp,
    
    10
    
      "defaultCursor" text,
    
    11
    
      description text,
    
    12
    
      "descriptionHtml" text,
    
    13
    
      events jsonb,
    
    14
    
      "featuredMedia" jsonb,
    
    15
    
      feedback jsonb,
    
    16
    
      "giftCardTemplateSuffix" text,
    
    17
    
      handle text,
    
    18
    
      "hasOnlyDefaultVariant" bool,
    
    19
    
      "hasOutOfStockVariants" bool,
    
    20
    
      "hasVariantsThatRequiresComponents" bool,
    
    21
    
      id text,
    
    22
    
      "inCollection" bool,
    
    23
    
      "isGiftCard" bool,
    
    24
    
      "legacyResourceId" bigint,
    
    25
    
      media jsonb,
    
    26
    
      "mediaCount" jsonb,
    
    27
    
      metafields jsonb,
    
    28
    
      "onlineStorePreviewUrl" text,
    
    29
    
      "onlineStoreUrl" text,
    
    30
    
      "options" jsonb,
    
    31
    
      "priceRangeV2" jsonb,
    
    32
    
      "productComponents" jsonb,
    
    33
    
      "productComponentsCount" jsonb,
    
    34
    
      "productParents" jsonb,
    
    35
    
      "productType" text,
    
    36
    
      "publishedAt" timestamp,
    
    37
    
      "publishedInContext" bool,
    
    38
    
      "publishedOnCurrentPublication" bool,
    
    39
    
      "publishedOnPublication" bool,
    
    40
    
      "requiresSellingPlan" bool,
    
    41
    
      "resourcePublicationOnCurrentPublication" jsonb,
    
    42
    
      "resourcePublications" jsonb,
    
    43
    
      "resourcePublicationsCount" jsonb,
    
    44
    
      "resourcePublicationsV2" jsonb,
    
    45
    
      "sellingPlanGroups" jsonb,
    
    46
    
      "sellingPlanGroupsCount" jsonb,
    
    47
    
      seo jsonb,
    
    48
    
      status text,
    
    49
    
      tags jsonb,
    
    50
    
      "templateSuffix" text,
    
    51
    
      title text,
    
    52
    
      "totalInventory" bigint,
    
    53
    
      "tracksInventory" bool,
    
    54
    
      "unpublishedPublications" jsonb,
    
    55
    
      "updatedAt" timestamp,
    
    56
    
      variants jsonb,
    
    57
    
      "variantsCount" jsonb,
    
    58
    
      vendor text,
    
    59
    
      attrs jsonb
    
    60
    
    )
    
    61
    
      server shopify_server
    
    62
    
      options (
    
    63
    
        object 'products'
    
    64
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### ProductVariant#

The ProductVariant object represents a version of a product that comes in more than one option, such as size or color.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/productvariant>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
productVariants| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.productvariants (
    
    2
    
      "availableForSale" bool,
    
    3
    
      barcode text,
    
    4
    
      "compareAtPrice" text,
    
    5
    
      "createdAt" timestamp,
    
    6
    
      "defaultCursor" text,
    
    7
    
      "deliveryProfile" jsonb,
    
    8
    
      "displayName" text,
    
    9
    
      events jsonb,
    
    10
    
      id text,
    
    11
    
      image jsonb,
    
    12
    
      "inventoryItem" jsonb,
    
    13
    
      "inventoryPolicy" text,
    
    14
    
      "inventoryQuantity" bigint,
    
    15
    
      "legacyResourceId" bigint,
    
    16
    
      media jsonb,
    
    17
    
      metafields jsonb,
    
    18
    
      "position" bigint,
    
    19
    
      price numeric,
    
    20
    
      product jsonb,
    
    21
    
      "productParents" jsonb,
    
    22
    
      "productVariantComponents" jsonb,
    
    23
    
      "requiresComponents" bool,
    
    24
    
      "selectedOptions" jsonb,
    
    25
    
      "sellableOnlineQuantity" bigint,
    
    26
    
      "sellingPlanGroups" jsonb,
    
    27
    
      "sellingPlanGroupsCount" jsonb,
    
    28
    
      "showUnitPrice" bool,
    
    29
    
      sku text,
    
    30
    
      taxable bool,
    
    31
    
      title text,
    
    32
    
      "unitPrice" jsonb,
    
    33
    
      "unitPriceMeasurement" jsonb,
    
    34
    
      "updatedAt" timestamp,
    
    35
    
      attrs jsonb
    
    36
    
    )
    
    37
    
      server shopify_server
    
    38
    
      options (
    
    39
    
        object 'productVariants'
    
    40
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Refund#

The Refund object represents a financial record of money returned to a customer from an order.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/refund>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
refund| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.refund (
    
    2
    
      "createdAt" timestamp,
    
    3
    
      duties jsonb,
    
    4
    
      id text,
    
    5
    
      "legacyResourceId" bigint,
    
    6
    
      note text,
    
    7
    
      "order" jsonb,
    
    8
    
      "orderAdjustments" jsonb,
    
    9
    
      "refundLineItems" jsonb,
    
    10
    
      "refundShippingLines" jsonb,
    
    11
    
      "return" jsonb,
    
    12
    
      "staffMember" jsonb,
    
    13
    
      "totalRefundedSet" jsonb,
    
    14
    
      transactions jsonb,
    
    15
    
      "updatedAt" timestamp,
    
    16
    
      attrs jsonb
    
    17
    
    )
    
    18
    
      server shopify_server
    
    19
    
      options (
    
    20
    
        object 'refund'
    
    21
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Query on this table must specify an value for `id` column


### Return#

The Return object represents the intent of a buyer to ship one or more items from an order back to a merchant or a third-party fulfillment location.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/return>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
return| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.return (
    
    2
    
      "closedAt" timestamp,
    
    3
    
      "createdAt" timestamp,
    
    4
    
      decline jsonb,
    
    5
    
      "exchangeLineItems" jsonb,
    
    6
    
      id text,
    
    7
    
      "name" text,
    
    8
    
      "order" jsonb,
    
    9
    
      refunds jsonb,
    
    10
    
      "requestApprovedAt" timestamp,
    
    11
    
      "returnLineItems" jsonb,
    
    12
    
      "returnShippingFees" jsonb,
    
    13
    
      "reverseFulfillmentOrders" jsonb,
    
    14
    
      status text,
    
    15
    
      "totalQuantity" bigint,
    
    16
    
      attrs jsonb
    
    17
    
    )
    
    18
    
      server shopify_server
    
    19
    
      options (
    
    20
    
        object 'return'
    
    21
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Query on this table must specify an value for `id` column


### Shop#

Represents a collection of general settings and information about the shop.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/shop>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
shop| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.shop (
    
    2
    
      "accountOwner" jsonb,
    
    3
    
      alerts jsonb,
    
    4
    
      "allProductCategoriesList" jsonb,
    
    5
    
      "availableChannelApps" jsonb,
    
    6
    
      "billingAddress" jsonb,
    
    7
    
      "channelDefinitionsForInstalledChannels" jsonb,
    
    8
    
      "checkoutApiSupported" bool,
    
    9
    
      "contactEmail" text,
    
    10
    
      "countriesInShippingZones" jsonb,
    
    11
    
      "createdAt" timestamp,
    
    12
    
      "currencyCode" text,
    
    13
    
      "currencyFormats" jsonb,
    
    14
    
      "currencySettings" jsonb,
    
    15
    
      "customerAccounts" text,
    
    16
    
      "customerAccountsV2" jsonb,
    
    17
    
      "customerTags" jsonb,
    
    18
    
      description text,
    
    19
    
      "draftOrderTags" jsonb,
    
    20
    
      email text,
    
    21
    
      "enabledPresentmentCurrencies" text,
    
    22
    
      entitlements jsonb,
    
    23
    
      features jsonb,
    
    24
    
      "fulfillmentServices" jsonb,
    
    25
    
      "ianaTimezone" text,
    
    26
    
      id text,
    
    27
    
      "marketingSmsConsentEnabledAtCheckout" bool,
    
    28
    
      "merchantApprovalSignals" jsonb,
    
    29
    
      metafields jsonb,
    
    30
    
      "myshopifyDomain" text,
    
    31
    
      "name" text,
    
    32
    
      "navigationSettings" jsonb,
    
    33
    
      "orderNumberFormatPrefix" text,
    
    34
    
      "orderNumberFormatSuffix" text,
    
    35
    
      "orderTags" jsonb,
    
    36
    
      "paymentSettings" jsonb,
    
    37
    
      plan jsonb,
    
    38
    
      "primaryDomain" jsonb,
    
    39
    
      "resourceLimits" jsonb,
    
    40
    
      "richTextEditorUrl" text,
    
    41
    
      "searchFilters" jsonb,
    
    42
    
      "setupRequired" bool,
    
    43
    
      "shipsToCountries" json,
    
    44
    
      "shopOwnerName" text,
    
    45
    
      "shopPolicies" jsonb,
    
    46
    
      "storefrontAccessTokens" jsonb,
    
    47
    
      "taxShipping" bool,
    
    48
    
      "taxesIncluded" bool,
    
    49
    
      "timezoneAbbreviation" text,
    
    50
    
      "timezoneOffset" text,
    
    51
    
      "timezoneOffsetMinutes" bigint,
    
    52
    
      "transactionalSmsDisabled" bool,
    
    53
    
      "unitSystem" text,
    
    54
    
      "updatedAt" timestamp,
    
    55
    
      url text,
    
    56
    
      "weightUnit" text,
    
    57
    
      attrs jsonb
    
    58
    
    )
    
    59
    
      server shopify_server
    
    60
    
      options (
    
    61
    
        object 'shop'
    
    62
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### StoreCreditAccount#

A store credit account contains a monetary balance that can be redeemed at checkout for purchases in the shop.

Ref: [Shopify Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest/objects/storecreditaccount>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
storeCreditAccount| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table shopify.storeCreditAccount (
    
    2
    
      balance jsonb,
    
    3
    
      id text,
    
    4
    
      "owner" jsonb,
    
    5
    
      transactions jsonb,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server shopify_server
    
    9
    
      options (
    
    10
    
        object 'storeCreditAccount'
    
    11
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Query on this table must specify an value for `id` column


## Query Pushdown Support#

### `where` clause pushdown#

This FDW supports `where id = 'xxx'` clause pushdown for below objects:

  * collections
  * customerPaymentMethod
  * customers
  * draftOrders
  * fulfillment
  * fulfillmentOrders
  * inventoryLevel
  * locations
  * orders
  * productVariants
  * products
  * refund
  * return
  * storeCreditAccount


## Supported Data Types#

Postgres Data Type| Shopify Data Type  
---|---  
boolean| Boolean  
bigint| Number  
numeric| Number  
text| String  
timestamp| Time  
jsonb| Json  
  
The Shopify Amdin API uses JSON formatted data, please refer to [Shopify GraphQL Admin API Docs](<https://shopify.dev/docs/api/admin-graphql/latest>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Too many target columns in `SELECT` statement may exceed single query max cost limit imposed by Shopify
  * Some fields which require parameters to be specified are ignored
  * Large result sets may experience slower performance due to full data transfer requirement
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Below are some examples on how to use Shopify foreign tables.

### Basic example#

This example will create a foreign table inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table shopify.customers (
    
    2
    
      addresses jsonb,
    
    3
    
      "addressesV2" jsonb,
    
    4
    
      "amountSpent" jsonb,
    
    5
    
      "canDelete" bool,
    
    6
    
      "companyContactProfiles" jsonb,
    
    7
    
      "createdAt" timestamp,
    
    8
    
      "dataSaleOptOut" bool,
    
    9
    
      "defaultAddress" jsonb,
    
    10
    
      "defaultEmailAddress" jsonb,
    
    11
    
      "defaultPhoneNumber" jsonb,
    
    12
    
      "displayName" text,
    
    13
    
      events jsonb,
    
    14
    
      "firstName" text,
    
    15
    
      id text,
    
    16
    
      image jsonb,
    
    17
    
      "lastName" text,
    
    18
    
      "lastOrder" jsonb,
    
    19
    
      "legacyResourceId" bigint,
    
    20
    
      "lifetimeDuration" text,
    
    21
    
      locale text,
    
    22
    
      mergeable jsonb,
    
    23
    
      metafields jsonb,
    
    24
    
      "multipassIdentifier" text,
    
    25
    
      note text,
    
    26
    
      "numberOfOrders" bigint,
    
    27
    
      orders jsonb,
    
    28
    
      "paymentMethods" jsonb,
    
    29
    
      "productSubscriberStatus" text,
    
    30
    
      state text,
    
    31
    
      "statistics" jsonb,
    
    32
    
      "storeCreditAccounts" jsonb,
    
    33
    
      "subscriptionContracts" jsonb,
    
    34
    
      tags text,
    
    35
    
      "taxExempt" bool,
    
    36
    
      "taxExemptions" text,
    
    37
    
      "updatedAt" timestamp,
    
    38
    
      "verifiedEmail" bool,
    
    39
    
      attrs jsonb
    
    40
    
    )
    
    41
    
      server shopify_server
    
    42
    
      options (
    
    43
    
        object 'customers'
    
    44
    
      );
    
    45
    
    46
    
    -- query all customers
    
    47
    
    -- Note: limit the number of target columns in the query, otherwise it may
    
    48
    
    -- exceed single query max cost limit imposed by Shopify API
    
    49
    
    select
    
    50
    
      id,
    
    51
    
      "displayName",
    
    52
    
      "addressesV2",
    
    53
    
      "updatedAt"
    
    54
    
    from
    
    55
    
      shopify.customers;
[/code]

### Query A Single Object#

To query a single object, you can specify an value to `id` column in query condition. This condition can be pushed down to Shopify API to improve query performance, see the list of objects which support this feature.
[code] 
    1
    
    select
    
    2
    
      id,
    
    3
    
      "displayName",
    
    4
    
      "addressesV2",
    
    5
    
      "updatedAt"
    
    6
    
    from
    
    7
    
      shopify.customers
    
    8
    
    where
    
    9
    
      id = 'gid://shopify/Customer/9236781315159';
[/code]