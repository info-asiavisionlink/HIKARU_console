---
タイトル: Stripe
URL: https://supabase.com/docs/guides/database/extensions/wrappers/stripe
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, stripe, wrappers
---

# Stripe

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/stripe
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, stripe, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Stripe Wrapper#](#enable-the-stripe-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Stripe#](#connecting-to-stripe)
  - [Create a schema#](#create-a-schema)
- [Entities#](#entities)
  - [Accounts#](#accounts)
  - [Balance#](#balance)
  - [Balance Transactions#](#balance-transactions)
  - [Charges#](#charges)
  - [Checkout Sessions#](#checkout-sessions)
  - [Customers#](#customers)
  - [Disputes#](#disputes)
  - [Events#](#events)
  - [Files#](#files)
  - [File Links#](#file-links)
  - [Invoices#](#invoices)
  - [Mandates#](#mandates)
  - [Meters#](#meters)
  - [Payment Intents#](#payment-intents)
  - [Payouts#](#payouts)
  - [Prices#](#prices)
  - [Products#](#products)
  - [Refunds#](#refunds)

## 概要

Searchdocs...

---

You can enable the Stripe wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/stripe_wrapper/overview>)

[Stripe](<https://stripe.com>) is an API driven online payment processing utility.

The Stripe Wrapper allows you to read data from Stripe within your Postgres database.

## Preparation#

Before you can query Stripe, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Stripe Wrapper#

Enable the `stripe_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper stripe_wrapper
    
    2
    
      handler stripe_fdw_handler
    
    3
    
      validator stripe_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Stripe API key in Vault and retrieve the secret id (UUID) used for api_key_id
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Stripe API key>',
    
    4
    
      'stripe',                          -- key name, used for api_key_name option
    
    5
    
      'Stripe API key for Wrappers'      -- key description
    
    6
    
    );
[/code]

The `vault.create_secret` function returns the secret id (UUID) used for the `api_key_id` option. You can also retrieve this id later:
[code] 
    1
    
    select id as key_id from vault.secrets where name = 'stripe';
[/code]

### Connecting to Stripe#

We need to provide Postgres with the credentials to connect to Stripe, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault

You can connect using either `api_key_id` or `api_key_name` — only one is required. If both are provided, `api_key_id` takes precedence.

**Option 1: using`api_key_id`** (the UUID returned by `vault.create_secret`)
[code]
    1
    
    create server stripe_server
    
    2
    
      foreign data wrapper stripe_wrapper
    
    3
    
      options (
    
    4
    
        api_key_id '<key_id>',  -- UUID returned by vault.create_secret, or retrieved via: select id from vault.secrets where name = 'stripe'
    
    5
    
        api_url 'https://api.stripe.com/v1/',  -- Stripe API base URL, optional. Default is 'https://api.stripe.com/v1/'
    
    6
    
        api_version '2024-06-20'  -- Stripe API version, optional. Default is your Stripe account’s default API version.
    
    7
    
      );
[/code]

**Option 2: using`api_key_name`** (the name given to the secret, i.e. the second argument to `vault.create_secret`)
[code]
    1
    
    create server stripe_server
    
    2
    
      foreign data wrapper stripe_wrapper
    
    3
    
      options (
    
    4
    
        api_key_name 'stripe',  -- name used when creating the secret via vault.create_secret
    
    5
    
        api_url 'https://api.stripe.com/v1/',  -- Stripe API base URL, optional. Default is 'https://api.stripe.com/v1/'
    
    6
    
        api_version '2024-06-20'  -- Stripe API version, optional. Default is your Stripe account’s default API version.
    
    7
    
      );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists stripe;
[/code]

## Entities#

The Stripe Wrapper supports data read and modify from Stripe API.

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Accounts| ✅| ❌| ❌| ❌| ❌  
Balance| ✅| ❌| ❌| ❌| ❌  
Balance Transactions| ✅| ❌| ❌| ❌| ❌  
Charges| ✅| ❌| ❌| ❌| ❌  
Checkout Sessions| ✅| ❌| ❌| ❌| ❌  
Customers| ✅| ✅| ✅| ✅| ❌  
Disputes| ✅| ❌| ❌| ❌| ❌  
Events| ✅| ❌| ❌| ❌| ❌  
Files| ✅| ❌| ❌| ❌| ❌  
File Links| ✅| ❌| ❌| ❌| ❌  
Invoices| ✅| ❌| ❌| ❌| ❌  
Mandates| ✅| ❌| ❌| ❌| ❌  
Meters| ✅| ❌| ❌| ❌| ❌  
PaymentIntents| ✅| ❌| ❌| ❌| ❌  
Payouts| ✅| ❌| ❌| ❌| ❌  
Prices| ✅| ❌| ❌| ❌| ❌  
Products| ✅| ✅| ✅| ✅| ❌  
Refunds| ✅| ❌| ❌| ❌| ❌  
SetupAttempts| ✅| ❌| ❌| ❌| ❌  
SetupIntents| ✅| ❌| ❌| ❌| ❌  
Subscriptions| ✅| ✅| ✅| ✅| ❌  
Tokens| ✅| ❌| ❌| ❌| ❌  
Topups| ✅| ❌| ❌| ❌| ❌  
Transfers| ✅| ❌| ❌| ❌| ❌  
  
We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Stripe.

For example, using below SQL can automatically create foreign tables in the `stripe` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema stripe from server stripe_server into stripe;
    
    3
    
    4
    
    -- or, create "checkout_sessions", "customers" and "balance" tables only
    
    5
    
    import foreign schema stripe
    
    6
    
       limit to ("checkout_sessions", "customers", "balance")
    
    7
    
       from server stripe_server into stripe;
    
    8
    
    9
    
    -- or, create all foreign tables except "checkout_sessions" and "billing_meters"
    
    10
    
    import foreign schema stripe
    
    11
    
       except ("checkout_sessions", "billing_meters")
    
    12
    
       from server stripe_server into stripe;
[/code]

The full list of the foreign tables is below:

### Accounts#

This is an object representing a Stripe account.

Ref: [Stripe docs](<https://stripe.com/docs/api/accounts/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Accounts](<https://stripe.com/docs/api/accounts/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.accounts (
    
    2
    
      id text,
    
    3
    
      business_type text,
    
    4
    
      country text,
    
    5
    
      email text,
    
    6
    
      type text,
    
    7
    
      created timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server stripe_server
    
    11
    
      options (
    
    12
    
        object 'accounts'
    
    13
    
      );
[/code]

#### Notes#

  * While any column is allowed in a where clause, it is most efficient to filter by `id`
  * Use the `attrs` jsonb column to access additional account details


### Balance#

This is an object representing your Stripe account's current balance.

Ref: [Stripe docs](<https://stripe.com/docs/api/balance>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Balance](<https://stripe.com/docs/api/balance>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.balance (
    
    2
    
      balance_type text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server stripe_server
    
    8
    
      options (
    
    9
    
        object 'balance'
    
    10
    
      );
[/code]

#### Notes#

  * Balance is a read-only object that shows the current funds in your Stripe account
  * The balance is broken down by source types (e.g., card, bank account) and currencies
  * Use the `attrs` jsonb column to access additional balance details like pending amounts
  * While any column is allowed in a where clause, filtering options are limited as this is a singleton object


### Balance Transactions#

This is an object representing funds moving through your Stripe account. Balance transactions are created for every type of transaction that comes into or flows out of your Stripe account balance.

Ref: [Stripe docs](<https://stripe.com/docs/api/balance_transactions/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Balance Transactions](<https://stripe.com/docs/api/balance_transactions/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.balance_transactions (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      description text,
    
    6
    
      fee bigint,
    
    7
    
      net bigint,
    
    8
    
      status text,
    
    9
    
      type text,
    
    10
    
      created timestamp,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server stripe_server
    
    14
    
      options (
    
    15
    
        object 'balance_transactions'
    
    16
    
      );
[/code]

#### Notes#

  * Balance transactions are read-only records of all funds movement in your Stripe account
  * Each transaction includes amount, currency, fees, and net amount information
  * Use the `attrs` jsonb column to access additional transaction details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * type


### Charges#

This is an object representing a charge on a credit or debit card. You can retrieve and refund individual charges as well as list all charges. Charges are identified by a unique, random ID.

Ref: [Stripe docs](<https://stripe.com/docs/api/charges/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Charges](<https://stripe.com/docs/api/charges/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.charges (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      customer text,
    
    6
    
      description text,
    
    7
    
      invoice text,
    
    8
    
      payment_intent text,
    
    9
    
      status text,
    
    10
    
      created timestamp,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server stripe_server
    
    14
    
      options (
    
    15
    
        object 'charges'
    
    16
    
      );
[/code]

#### Notes#

  * Charges are read-only records of payment transactions in your Stripe account
  * Each charge includes amount, currency, customer, and payment status information
  * Use the `attrs` jsonb column to access additional charge details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * customer


### Checkout Sessions#

This is an object representing your customer's session as they pay for one-time purchases or subscriptions through Checkout or Payment Links. We recommend creating a new Session each time your customer attempts to pay.

Ref: [Stripe docs](<https://stripe.com/docs/api/checkout/sessions/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Checkout Sessions](<https://stripe.com/docs/api/checkout/sessions/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.checkout_sessions (
    
    2
    
      id text,
    
    3
    
      customer text,
    
    4
    
      payment_intent text,
    
    5
    
      subscription text,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server stripe_server
    
    9
    
      options (
    
    10
    
        object 'checkout/sessions',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
[/code]

#### Notes#

  * Checkout Sessions are read-only records of customer payment sessions in your Stripe account
  * Each session includes customer, payment intent, and subscription information
  * Use the `attrs` jsonb column to access additional session details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * customer
    * payment_intent
    * subscription


### Customers#

This is an object representing your Stripe customers. You can create, retrieve, update, and delete customers.

Ref: [Stripe docs](<https://stripe.com/docs/api/customers/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Customers](<https://stripe.com/docs/api/customers/list>)| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.customers (
    
    2
    
      id text,
    
    3
    
      email text,
    
    4
    
      name text,
    
    5
    
      description text,
    
    6
    
      created timestamp,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server stripe_server
    
    10
    
      options (
    
    11
    
        object 'customers',
    
    12
    
        rowid_column 'id'
    
    13
    
      );
[/code]

Example operations:
[code] 
    1
    
    -- create a new customer
    
    2
    
    insert into stripe.customers(email, name, description)
    
    3
    
    values ('jane@example.com', 'Jane Smith', 'Premium customer');
    
    4
    
    5
    
    -- update a customer
    
    6
    
    update stripe.customers
    
    7
    
    set name = 'Jane Doe'
    
    8
    
    where email = 'jane@example.com';
    
    9
    
    10
    
    -- delete a customer
    
    11
    
    delete from stripe.customers
    
    12
    
    where id = 'cus_xxx';
[/code]

#### Notes#

  * Customers can be created, retrieved, updated, and deleted through SQL operations
  * Each customer can have an email, name, and description
  * Use the `attrs` jsonb column to access additional customer details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * email


### Disputes#

This is an object representing a dispute that occurs when a customer questions your charge with their card issuer.

Ref: [Stripe docs](<https://stripe.com/docs/api/disputes/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Disputes](<https://stripe.com/docs/api/disputes/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.disputes (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      charge text,
    
    6
    
      payment_intent text,
    
    7
    
      reason text,
    
    8
    
      status text,
    
    9
    
      created timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server stripe_server
    
    13
    
      options (
    
    14
    
        object 'disputes'
    
    15
    
      );
[/code]

#### Notes#

  * Disputes are read-only records of customer payment disputes in your Stripe account
  * Each dispute includes amount, currency, charge, and payment intent information
  * Use the `attrs` jsonb column to access additional dispute details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * charge
    * payment_intent


### Events#

This is an object representing events that occur in your Stripe account, letting you know when something interesting happens.

Ref: [Stripe docs](<https://stripe.com/docs/api/events/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Events](<https://stripe.com/docs/api/events/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.events (
    
    2
    
      id text,
    
    3
    
      type text,
    
    4
    
      api_version text,
    
    5
    
      created timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server stripe_server
    
    9
    
      options (
    
    10
    
        object 'events'
    
    11
    
      );
[/code]

#### Notes#

  * Events are read-only records of activities in your Stripe account
  * Each event includes type, API version, and timestamp information
  * Use the `attrs` jsonb column to access additional event details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * type


### Files#

This is an object representing a file hosted on Stripe's servers.

Ref: [Stripe docs](<https://stripe.com/docs/api/files/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Files](<https://stripe.com/docs/api/files/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.files (
    
    2
    
      id text,
    
    3
    
      filename text,
    
    4
    
      purpose text,
    
    5
    
      title text,
    
    6
    
      size bigint,
    
    7
    
      type text,
    
    8
    
      url text,
    
    9
    
      created timestamp,
    
    10
    
      expires_at timestamp,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server stripe_server
    
    14
    
      options (
    
    15
    
        object 'files'
    
    16
    
      );
[/code]

#### Notes#

  * Files are read-only records of files hosted on Stripe's servers
  * Each file includes filename, purpose, size, type, and URL information
  * Files may have an expiration date specified in expires_at
  * Use the `attrs` jsonb column to access additional file details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * purpose


### File Links#

This is an object representing a link that can be used to share the contents of a `File` object with non-Stripe users.

Ref: [Stripe docs](<https://stripe.com/docs/api/file_links/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[File Links](<https://stripe.com/docs/api/file_links/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.file_links (
    
    2
    
      id text,
    
    3
    
      file text,
    
    4
    
      url text,
    
    5
    
      created timestamp,
    
    6
    
      expired bool,
    
    7
    
      expires_at timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server stripe_server
    
    11
    
      options (
    
    12
    
        object 'file_links'
    
    13
    
      );
[/code]

#### Notes#

  * File Links are read-only records that provide shareable access to Stripe files
  * Each link includes a reference to the file and a public URL
  * Links can be configured to expire at a specific time
  * Use the `expired` boolean to check if a link has expired
  * Use the `attrs` jsonb column to access additional link details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * file


### Invoices#

This is an object representing statements of amounts owed by a customer, which are either generated one-off or periodically from a subscription.

Ref: [Stripe docs](<https://stripe.com/docs/api/invoices/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Invoices](<https://stripe.com/docs/api/invoices/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.invoices (
    
    2
    
      id text,
    
    3
    
      customer text,
    
    4
    
      subscription text,
    
    5
    
      status text,
    
    6
    
      total bigint,
    
    7
    
      currency text,
    
    8
    
      period_start timestamp,
    
    9
    
      period_end timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server stripe_server
    
    13
    
      options (
    
    14
    
        object 'invoices'
    
    15
    
      );
[/code]

#### Notes#

  * Invoices are read-only records of amounts owed by customers
  * Each invoice includes customer, subscription, status, and amount information
  * Invoices track billing periods with period_start and period_end timestamps
  * Use the `attrs` jsonb column to access additional invoice details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * customer
    * status
    * subscription


### Mandates#

This is an object representing a record of the permission a customer has given you to debit their payment method.

Ref: [Stripe docs](<https://stripe.com/docs/api/mandates>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Mandates](<https://stripe.com/docs/api/mandates>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.mandates (
    
    2
    
      id text,
    
    3
    
      payment_method text,
    
    4
    
      status text,
    
    5
    
      type text,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server stripe_server
    
    9
    
      options (
    
    10
    
        object 'mandates'
    
    11
    
      );
[/code]

#### Notes#

  * Mandates are read-only records of customer payment permissions
  * Each mandate includes payment method, status, and type information
  * Use the `attrs` jsonb column to access additional mandate details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id


### Meters#

This is an object representing a billing meter that allows you to track usage of a particular event.

Ref: [Stripe docs](<https://docs.stripe.com/api/billing/meter>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Meters](<https://docs.stripe.com/api/billing/meter>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.billing_meter (
    
    2
    
      id text,
    
    3
    
      display_name text,
    
    4
    
      event_name text,
    
    5
    
      event_time_window text,
    
    6
    
      status text,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server stripe_server
    
    10
    
      options (
    
    11
    
        object 'billing/meters'
    
    12
    
      );
[/code]

#### Notes#

  * Meters are read-only records for tracking event usage in billing
  * Each meter includes display name, event name, and time window information
  * The status field indicates whether the meter is active
  * Use the `attrs` jsonb column to access additional meter details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id


### Payment Intents#

This is an object representing a guide through the process of collecting a payment from your customer.

Ref: [Stripe docs](<https://stripe.com/docs/api/payment_intents/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Payment Intents](<https://stripe.com/docs/api/payment_intents/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.payment_intents (
    
    2
    
      id text,
    
    3
    
      customer text,
    
    4
    
      amount bigint,
    
    5
    
      currency text,
    
    6
    
      payment_method text,
    
    7
    
      created timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server stripe_server
    
    11
    
      options (
    
    12
    
        object 'payment_intents'
    
    13
    
      );
[/code]

#### Notes#

  * Payment Intents are read-only records that guide the payment collection process
  * Each intent includes customer, amount, currency, and payment method information
  * The created timestamp tracks when the payment intent was initiated
  * Use the `attrs` jsonb column to access additional payment intent details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * customer


### Payouts#

This is an object representing funds received from Stripe or initiated payouts to a bank account or debit card of a connected Stripe account.

Ref: [Stripe docs](<https://stripe.com/docs/api/payouts/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Payouts](<https://stripe.com/docs/api/payouts/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.payouts (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      arrival_date timestamp,
    
    6
    
      description text,
    
    7
    
      statement_descriptor text,
    
    8
    
      status text,
    
    9
    
      created timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server stripe_server
    
    13
    
      options (
    
    14
    
        object 'payouts'
    
    15
    
      );
[/code]

#### Notes#

  * Payouts are read-only records of fund transfers
  * Each payout includes amount, currency, and status information
  * The arrival_date indicates when funds will be available
  * The statement_descriptor appears on your bank statement
  * Use the `attrs` jsonb column to access additional payout details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * status


### Prices#

This is an object representing pricing configurations for products to facilitate multiple currencies and pricing options.

Ref: [Stripe docs](<https://stripe.com/docs/api/prices/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Prices](<https://stripe.com/docs/api/prices/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.prices (
    
    2
    
      id text,
    
    3
    
      active bool,
    
    4
    
      currency text,
    
    5
    
      product text,
    
    6
    
      unit_amount bigint,
    
    7
    
      type text,
    
    8
    
      created timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server stripe_server
    
    12
    
      options (
    
    13
    
        object 'prices'
    
    14
    
      );
[/code]

#### Notes#

  * Prices are read-only records that define product pricing configurations
  * Each price includes currency, unit amount, and product reference
  * The active boolean indicates if the price can be used
  * The type field specifies the pricing model (e.g., one-time, recurring)
  * Use the `attrs` jsonb column to access additional price details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * active


### Products#

This is an object representing all products available in Stripe.

Ref: [Stripe docs](<https://stripe.com/docs/api/products/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Products](<https://stripe.com/docs/api/products/list>)| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.products (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      active bool,
    
    5
    
      default_price text,
    
    6
    
      description text,
    
    7
    
      created timestamp,
    
    8
    
      updated timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server stripe_server
    
    12
    
      options (
    
    13
    
        object 'products',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
[/code]

#### Notes#

  * Products can be created, read, updated, and deleted
  * Each product includes name, description, and active status
  * The default_price links to the product's default Price object
  * The updated timestamp tracks the last modification time
  * Use the `attrs` jsonb column to access additional product details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * active


### Refunds#

This is an object representing refunds for charges that have previously been created but not yet refunded.

Ref: [Stripe docs](<https://stripe.com/docs/api/refunds/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Refunds](<https://stripe.com/docs/api/refunds/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.refunds (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      charge text,
    
    6
    
      payment_intent text,
    
    7
    
      reason text,
    
    8
    
      status text,
    
    9
    
      created timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server stripe_server
    
    13
    
      options (
    
    14
    
        object 'refunds'
    
    15
    
      );
[/code]

#### Notes#

  * Refunds are read-only records of charge reversals
  * Each refund includes amount, currency, and status information
  * The charge and payment_intent fields link to the original transaction
  * The reason field provides context for the refund
  * Use the `attrs` jsonb column to access additional refund details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * charge
    * payment_intent


### SetupAttempts#

This is an object representing attempted confirmations of SetupIntents, tracking both successful and unsuccessful attempts.

Ref: [Stripe docs](<https://stripe.com/docs/api/setup_attempts/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[SetupAttempts](<https://stripe.com/docs/api/setup_attempts/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.setup_attempts (
    
    2
    
      id text,
    
    3
    
      application text,
    
    4
    
      customer text,
    
    5
    
      on_behalf_of text,
    
    6
    
      payment_method text,
    
    7
    
      setup_intent text,
    
    8
    
      status text,
    
    9
    
      usage text,
    
    10
    
      created timestamp,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server stripe_server
    
    14
    
      options (
    
    15
    
        object 'setup_attempts'
    
    16
    
      );
[/code]

#### Notes#

  * SetupAttempts are read-only records of payment setup confirmation attempts
  * Each attempt includes customer, payment method, and status information
  * The setup_intent field links to the associated SetupIntent
  * The usage field indicates the intended payment method usage
  * Use the `attrs` jsonb column to access additional attempt details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * setup_intent


### SetupIntents#

This is an object representing a guide through the process of setting up and saving customer payment credentials for future payments.

Ref: [Stripe docs](<https://stripe.com/docs/api/setup_intents/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[SetupIntents](<https://stripe.com/docs/api/setup_intents/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.setup_intents (
    
    2
    
      id text,
    
    3
    
      client_secret text,
    
    4
    
      customer text,
    
    5
    
      description text,
    
    6
    
      payment_method text,
    
    7
    
      status text,
    
    8
    
      usage text,
    
    9
    
      created timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server stripe_server
    
    13
    
      options (
    
    14
    
        object 'setup_intents'
    
    15
    
      );
[/code]

#### Notes#

  * SetupIntents are read-only records for saving customer payment credentials
  * Each intent includes customer, payment method, and status information
  * The client_secret is used for client-side confirmation
  * The usage field indicates how the payment method will be used
  * Use the `attrs` jsonb column to access additional intent details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * customer
    * payment_method


### Subscriptions#

This is an object representing customer recurring payment schedules.

Ref: [Stripe docs](<https://stripe.com/docs/api/subscriptions/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Subscriptions](<https://stripe.com/docs/api/subscriptions/list>)| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.subscriptions (
    
    2
    
      id text,
    
    3
    
      customer text,
    
    4
    
      currency text,
    
    5
    
      current_period_start timestamp,
    
    6
    
      current_period_end timestamp,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server stripe_server
    
    10
    
      options (
    
    11
    
        object 'subscriptions',
    
    12
    
        rowid_column 'id'
    
    13
    
      );
[/code]

#### Notes#

  * Subscriptions can be created, read, updated, and deleted
  * Each subscription includes customer and currency information
  * The current_period_start and current_period_end track billing cycles
  * The rowid_column option enables modification operations
  * Use the `attrs` jsonb column to access additional subscription details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * customer
    * price
    * status


### Tokens#

This is an object representing a secure way to collect sensitive card, bank account, or personally identifiable information (PII) from customers.

Ref: [Stripe docs](<https://stripe.com/docs/api/tokens>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Tokens](<https://stripe.com/docs/api/tokens>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.tokens (
    
    2
    
      id text,
    
    3
    
      type text,
    
    4
    
      client_ip text,
    
    5
    
      created timestamp,
    
    6
    
      livemode boolean,
    
    7
    
      used boolean,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server stripe_server
    
    11
    
      options (
    
    12
    
        object 'tokens'
    
    13
    
      );
[/code]

#### Notes#

  * Tokens are read-only, single-use objects for secure data collection
  * Each token includes type information (card, bank_account, pii, etc.)
  * The client_ip field records where the token was created
  * The used field indicates if the token has been used
  * Use the `attrs` jsonb column to access token details like card or bank information
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * type
    * used


### Top-ups#

This is an object representing a way to add funds to your Stripe balance.

Ref: [Stripe docs](<https://stripe.com/docs/api/topups/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Top-ups](<https://stripe.com/docs/api/topups/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.topups (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      description text,
    
    6
    
      status text,
    
    7
    
      created timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server stripe_server
    
    11
    
      options (
    
    12
    
        object 'topups'
    
    13
    
      );
[/code]

#### Notes#

  * Top-ups are read-only records of balance additions
  * Each top-up includes amount and currency information
  * The status field tracks the top-up state (e.g., succeeded, failed)
  * Use the `attrs` jsonb column to access additional top-up details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * status


### Transfers#

This is an object representing fund movements between Stripe accounts as part of Connect.

Ref: [Stripe docs](<https://stripe.com/docs/api/transfers/list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
[Transfers](<https://stripe.com/docs/api/transfers/list>)| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table stripe.transfers (
    
    2
    
      id text,
    
    3
    
      amount bigint,
    
    4
    
      currency text,
    
    5
    
      description text,
    
    6
    
      destination text,
    
    7
    
      created timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server stripe_server
    
    11
    
      options (
    
    12
    
        object 'transfers'
    
    13
    
      );
[/code]

#### Notes#

  * Transfers are read-only records of fund movements between accounts
  * Each transfer includes amount, currency, and destination information
  * The destination field identifies the receiving Stripe account
  * Use the `attrs` jsonb column to access additional transfer details
  * While any column is allowed in a where clause, it is most efficient to filter by:
    * id
    * destination


## Query Pushdown Support#

This FDW supports `where` clause pushdown. You can specify a filter in `where` clause and it will be passed to Stripe API call.

For example, this query
[code] 
    1
    
    select * from stripe.customers where id = 'cus_xxx';
[/code]

will be translated to a Stripe API call: `https://api.stripe.com/v1/customers/cus_xxx`.

For supported filter columns for each object, please check out foreign table documents above.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Webhook events and real-time updates are not supported
  * API version mismatches can cause unexpected data format issues
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Some examples on how to use Stripe foreign tables.

### Basic example#
[code] 
    1
    
    -- always limit records to reduce API calls to Stripe
    
    2
    
    select * from stripe.customers limit 10;
    
    3
    
    select * from stripe.invoices limit 10;
    
    4
    
    select * from stripe.subscriptions limit 10;
[/code]

### Query JSON attributes#
[code] 
    1
    
    -- extract account name for an invoice
    
    2
    
    select id, attrs->>'account_name' as account_name
    
    3
    
    from stripe.invoices where id = 'in_xxx';
    
    4
    
    5
    
    -- extract invoice line items for an invoice
    
    6
    
    select id, attrs#>'{lines,data}' as line_items
    
    7
    
    from stripe.invoices where id = 'in_xxx';
    
    8
    
    9
    
    -- extract subscription items for a subscription
    
    10
    
    select id, attrs#>'{items,data}' as items
    
    11
    
    from stripe.subscriptions where id = 'sub_xxx';
[/code]

### Data modify#
[code] 
    1
    
    -- insert
    
    2
    
    insert into stripe.customers(email,name,description)
    
    3
    
    values ('test@test.com', 'test name', null);
    
    4
    
    5
    
    -- update
    
    6
    
    update stripe.customers
    
    7
    
    set description='hello fdw'
    
    8
    
    where id = 'cus_xxx';
    
    9
    
    10
    
    update stripe.customers
    
    11
    
    set attrs='{"metadata[foo]": "bar"}'
    
    12
    
    where id = 'cus_xxx';
    
    13
    
    14
    
    -- delete
    
    15
    
    delete from stripe.customers
    
    16
    
    where id = 'cus_xxx';
[/code]

To insert into an object with sub-fields, we need to create the foreign table with column name exactly same as the API required. For example, to insert a `subscription` object we can define the foreign table following [the Stripe API docs](<https://docs.stripe.com/api/subscriptions/create>):
[code] 
    1
    
    -- create the subscription table for data insertion, the 'customer'
    
    2
    
    -- and 'items[0][price]' fields are required.
    
    3
    
    create foreign table stripe.subscriptions (
    
    4
    
      id text,
    
    5
    
      customer text,
    
    6
    
      "items[0][price]" text  -- column name will be used in API Post request
    
    7
    
    )
    
    8
    
      server stripe_server
    
    9
    
      options (
    
    10
    
        object 'subscriptions',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
[/code]

And then we can insert a subscription like below:
[code] 
    1
    
    insert into stripe.subscriptions(customer, "items[0][price]")
    
    2
    
    values ('cus_Na6dX7aXxi11N4', 'price_1MowQULkdIwHu7ixraBm864M');
[/code]

Note this foreign table is only for data insertion, it cannot be used in `select` statement.