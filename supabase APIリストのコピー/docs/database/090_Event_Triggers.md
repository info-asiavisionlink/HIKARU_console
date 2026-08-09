---
タイトル: Event Triggers
URL: https://supabase.com/docs/guides/database/postgres/event-triggers
カテゴリ: database
更新日: 2026-08-02
タグ: database, event, event-triggers, postgres, triggers
---

# Event Triggers

**URL:** https://supabase.com/docs/guides/database/postgres/event-triggers
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, event, event-triggers, postgres, triggers

## 目次

- [Creating an event trigger#](#creating-an-event-trigger)
  - [Example trigger function - prevent dropping tables#](#example-trigger-function---prevent-dropping-tables)
  - [Example trigger function - auto enable Row Level Security#](#example-trigger-function---auto-enable-row-level-security)
  - [Event trigger Functions and firing events#](#event-trigger-functions-and-firing-events)
- [Disabling an event trigger#](#disabling-an-event-trigger)
- [Dropping an event trigger#](#dropping-an-event-trigger)
- [Resources#](#resources)

## 概要

Automatically execute SQL on database events.

---

In Postgres, an [event trigger](<https://www.postgresql.org/docs/current/event-triggers.html>) is similar to a [trigger](</docs/guides/database/postgres/triggers>), except that it is triggered by database level events (and is usually reserved for [superusers](</docs/guides/database/postgres/roles-superuser>))

With our `Supautils` extension (installed automatically for all Supabase projects), the `postgres` user has the ability to create and manage event triggers.

Some use cases for event triggers are:

  * Capturing Data Definition Language (DDL) changes - these are changes to your database schema (though the [pgAudit](</docs/guides/database/extensions/pgaudit>) extension provides a more complete solution)
  * Enforcing/monitoring/preventing actions - such as preventing tables from being dropped in Production or enforcing RLS on all new tables


The guide covers two example event triggers:

  1. Preventing accidental dropping of a table
  2. Automatically enabling Row Level Security on new tables in the `public` schema


## Creating an event trigger#

Only the `postgres` user can create event triggers, so make sure you are authenticated as them. As with triggers, event triggers consist of 2 parts

  1. A [Function](</docs/guides/database/functions>) which will be executed when the triggering event occurs
  2. The actual Event Trigger object, with parameters around when the trigger should be run


### Example trigger function - prevent dropping tables#

This example protects any table from being dropped. You can override it by temporarily disabling the event trigger: `ALTER EVENT TRIGGER dont_drop_trigger DISABLE;`
[code] 
    1
    
    -- Function
    
    2
    
    CREATE OR REPLACE FUNCTION dont_drop_function()
    
    3
    
      RETURNS event_trigger LANGUAGE plpgsql AS $$
    
    4
    
    DECLARE
    
    5
    
        obj record;
    
    6
    
        tbl_name text;
    
    7
    
    BEGIN
    
    8
    
        FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
    
    9
    
        LOOP
    
    10
    
            IF obj.object_type = 'table' THEN
    
    11
    
                RAISE EXCEPTION 'ERROR: All tables in this schema are protected and cannot be dropped';
    
    12
    
            END IF;
    
    13
    
        END LOOP;
    
    14
    
    END;
    
    15
    
    $$;
    
    16
    
    17
    
    -- Event trigger
    
    18
    
    CREATE EVENT TRIGGER dont_drop_trigger
    
    19
    
    ON sql_drop
    
    20
    
    EXECUTE FUNCTION dont_drop_function();
[/code]

### Example trigger function - auto enable Row Level Security#

See how to [auto enable RLS for new tables](</docs/guides/database/postgres/row-level-security#auto-enable-rls-for-new-tables>).

### Event trigger Functions and firing events#

Event triggers can be triggered on:

  * `ddl_command_start` \- occurs before a DDL command for almost all objects within a schema
  * `ddl_command_end` \- occurs after a DDL command for almost all objects within a schema
  * `sql_drop` \- occurs before `ddl_command_end` for any DDL commands that `DROP` a database object (note that altering a table can cause it to be dropped)
  * `table_rewrite` \- occurs before a table is rewritten using the `ALTER TABLE` command


Event triggers run for each DDL command specified above and can consume resources which may cause performance issues if not used carefully.

Within each event trigger, helper functions exist to view the objects being modified or the command being run. For example, our example calls `pg_event_trigger_dropped_objects()` to view the object(s) being dropped. For a more comprehensive overview of these functions, read the [official event trigger definition documentation](<https://www.postgresql.org/docs/current/event-trigger-definition.html>)

To view the matrix commands that cause an event trigger to fire, read the [official event trigger matrix documentation](<https://www.postgresql.org/docs/17/event-trigger-matrix.html>)

## Disabling an event trigger#

You can disable an event trigger using the `alter event trigger` command:
[code] 
    1
    
    ALTER EVENT TRIGGER dont_drop_trigger DISABLE;
[/code]

## Dropping an event trigger#

You can delete a trigger using the `drop event trigger` command:
[code] 
    1
    
    DROP EVENT TRIGGER dont_drop_trigger;
[/code]

## Resources#

  * Official Postgres Docs: [Event Trigger Behaviours](<https://www.postgresql.org/docs/current/event-trigger-definition.html>)
  * Official Postgres Docs: [Event Trigger Firing Matrix](<https://www.postgresql.org/docs/17/event-trigger-matrix.html>)
  * Supabase blog: [Postgres Event Triggers without superuser access](</blog/event-triggers-wo-superuser>)