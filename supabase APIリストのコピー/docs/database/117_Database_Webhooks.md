---
タイトル: Database Webhooks
URL: https://supabase.com/docs/guides/database/webhooks
カテゴリ: database
更新日: 2026-08-02
タグ: database, webhooks
---

# Database Webhooks

**URL:** https://supabase.com/docs/guides/database/webhooks
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, webhooks

## 目次

- [Webhooks vs triggers#](#webhooks-vs-triggers)
- [Creating a webhook#](#creating-a-webhook)
- [Payload#](#payload)
- [Monitoring#](#monitoring)
- [Local development#](#local-development)
- [Resources#](#resources)

## 概要

Trigger external payloads on database events.

---

Database Webhooks allow you to send real-time data from your database to another system whenever a table event occurs.

You can hook into three table events: `INSERT`, `UPDATE`, and `DELETE`. All events are fired _after_ a database row is changed.

## Webhooks vs triggers#

Database Webhooks are very similar to triggers, and that's because Database Webhooks are a convenience wrapper around triggers using the [pg_net](</docs/guides/database/extensions/pg_net>) extension. This extension is asynchronous, and therefore will not block your database changes for long-running network requests.

This video demonstrates how you can create a new customer in Stripe each time a row is inserted into a `profiles` table:

## Creating a webhook#

  1. Create a new [Database Webhook](</dashboard/project/_/integrations/webhooks/overview>) in the Dashboard.
  2. Give your Webhook a name.
  3. Select the table you want to hook into.
  4. Select one or more events (table inserts, updates, or deletes) you want to hook into.


Since webhooks are database triggers, you can also create one from SQL statement directly.
[code] 
    1
    
    create trigger "my_webhook" after insert
    
    2
    
    on "public"."my_table" for each row
    
    3
    
    execute function "supabase_functions"."http_request"(
    
    4
    
      'http://host.docker.internal:3000',
    
    5
    
      'POST',
    
    6
    
      '{"Content-Type":"application/json"}',
    
    7
    
      '{}',
    
    8
    
      '1000'
    
    9
    
    );
[/code]

We currently support HTTP webhooks. These can be sent as `POST` or `GET` requests with a JSON payload.

## Payload#

The payload is automatically generated from the underlying table record:
[code] 
    1
    
    type InsertPayload = {
    
    2
    
      type: 'INSERT'
    
    3
    
      table: string
    
    4
    
      schema: string
    
    5
    
      record: TableRecord<T>
    
    6
    
      old_record: null
    
    7
    
    }
    
    8
    
    type UpdatePayload = {
    
    9
    
      type: 'UPDATE'
    
    10
    
      table: string
    
    11
    
      schema: string
    
    12
    
      record: TableRecord<T>
    
    13
    
      old_record: TableRecord<T>
    
    14
    
    }
    
    15
    
    type DeletePayload = {
    
    16
    
      type: 'DELETE'
    
    17
    
      table: string
    
    18
    
      schema: string
    
    19
    
      record: null
    
    20
    
      old_record: TableRecord<T>
    
    21
    
    }
[/code]

## Monitoring#

Logging history of webhook calls is available under the `net` schema of your database. For more info, see the [GitHub Repo](<https://github.com/supabase/pg_net>).

## Local development#

When using Database Webhooks on your local Supabase instance, you need to be aware that the Postgres database runs inside a Docker container. This means that `localhost` or `127.0.0.1` in your webhook URL will refer to the container itself, not your host machine where your application is running.

To target services running on your host machine, use `host.docker.internal`. If that doesn't work, you may need to use your machine's local IP address instead.

For example, if you want to trigger an edge function when a webhook fires, your webhook URL would be:
[code] 
    1
    
    http://host.docker.internal:54321/functions/v1/my-function-name
[/code]

If you're experiencing connection issues with webhooks locally, verify you're using the correct hostname instead of `localhost`.

## Resources#

  * [pg_net](</docs/guides/database/extensions/pg_net>): an async networking extension for Postgres