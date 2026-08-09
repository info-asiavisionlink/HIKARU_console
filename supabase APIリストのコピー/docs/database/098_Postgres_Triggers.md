---
タイトル: Postgres Triggers
URL: https://supabase.com/docs/guides/database/postgres/triggers
カテゴリ: database
更新日: 2026-08-02
タグ: database, postgres, triggers
---

# Postgres Triggers

**URL:** https://supabase.com/docs/guides/database/postgres/triggers
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, postgres, triggers

## 目次

- [Creating a trigger#](#creating-a-trigger)
- [Trigger functions#](#trigger-functions)
  - [Example trigger function#](#example-trigger-function)
  - [Trigger variables#](#trigger-variables)
- [Types of triggers#](#types-of-triggers)
  - [Trigger before changes are made#](#trigger-before-changes-are-made)
  - [Trigger after changes are made#](#trigger-after-changes-are-made)
- [Execution frequency#](#execution-frequency)
- [Dropping a trigger#](#dropping-a-trigger)
- [Resources#](#resources)

## 概要

Automatically execute SQL on table events.

---

In Postgres, a trigger executes a set of actions automatically on table events such as INSERTs, UPDATEs, DELETEs, or TRUNCATE operations.

## Creating a trigger#

Creating triggers involve 2 parts:

  1. A [Function](</docs/guides/database/functions>) which will be executed (called the Trigger Function)
  2. The actual Trigger object, with parameters around when the trigger should be run.


An example of a trigger is:
[code] 
    1
    
    create trigger "trigger_name"
    
    2
    
    after insert on "table_name"
    
    3
    
    for each row
    
    4
    
    execute function trigger_function();
[/code]

## Trigger functions#

A trigger function is a user-defined [Function](</docs/guides/database/functions>) that Postgres executes when the trigger is fired.

### Example trigger function#

Here is an example that updates `salary_log` whenever an employee's salary is updated:
[code] 
    1
    
    -- Example: Update salary_log when salary is updated
    
    2
    
    create function update_salary_log()
    
    3
    
    returns trigger
    
    4
    
    language plpgsql
    
    5
    
    as $$
    
    6
    
    begin
    
    7
    
      insert into salary_log(employee_id, old_salary, new_salary)
    
    8
    
      values (new.id, old.salary, new.salary);
    
    9
    
      return new;
    
    10
    
    end;
    
    11
    
    $$;
    
    12
    
    13
    
    create trigger salary_update_trigger
    
    14
    
    after update on employees
    
    15
    
    for each row
    
    16
    
    execute function update_salary_log();
[/code]

### Trigger variables#

Trigger functions have access to several special variables that provide information about the context of the trigger event and the data being modified. In the example above you can see the values inserted into the salary log are `old.salary` and `new.salary` \- in this case `old` specifies the previous values and `new` specifies the updated values.

Here are some of the key variables and options available within trigger functions:

  * `TG_NAME`: The name of the trigger being fired.
  * `TG_WHEN`: The timing of the trigger event (`BEFORE` or `AFTER`).
  * `TG_OP`: The operation that triggered the event (`INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE`).
  * `OLD`: A record variable holding the old row's data in `UPDATE` and `DELETE` triggers.
  * `NEW`: A record variable holding the new row's data in `UPDATE` and `INSERT` triggers.
  * `TG_LEVEL`: The trigger level (`ROW` or `STATEMENT`), indicating whether the trigger is row-level or statement-level.
  * `TG_RELID`: The object ID of the table on which the trigger is being fired.
  * `TG_TABLE_NAME`: The name of the table on which the trigger is being fired.
  * `TG_TABLE_SCHEMA`: The schema of the table on which the trigger is being fired.
  * `TG_ARGV`: An array of string arguments provided when creating the trigger.
  * `TG_NARGS`: The number of arguments in the `TG_ARGV` array.


## Types of triggers#

There are two types of trigger, `BEFORE` and `AFTER`:

### Trigger before changes are made#

Executes before the triggering event.
[code] 
    1
    
    create trigger before_insert_trigger
    
    2
    
    before insert on orders
    
    3
    
    for each row
    
    4
    
    execute function before_insert_function();
[/code]

### Trigger after changes are made#

Executes after the triggering event.
[code] 
    1
    
    create trigger after_delete_trigger
    
    2
    
    after delete on customers
    
    3
    
    for each row
    
    4
    
    execute function after_delete_function();
[/code]

## Execution frequency#

There are two options available for executing triggers:

  * `for each row`: specifies that the trigger function should be executed once for each affected row.
  * `for each statement`: the trigger is executed once for the entire operation (for example, once on insert). This can be more efficient than `for each row` when dealing with multiple rows affected by a single SQL statement, as they allow you to perform calculations or updates on groups of rows at once.


## Dropping a trigger#

You can delete a trigger using the `drop trigger` command:
[code] 
    1
    
    drop trigger "trigger_name" on "table_name";
[/code]

If your trigger is inside a restricted schema, you won't be able to drop it due to permission restrictions. In those cases, you can drop the function it depends on instead using the CASCADE clause to automatically remove all triggers that call it:
[code] 
    1
    
    drop function if exists restricted_schema.function_name() cascade;
[/code]

Make sure you take a backup of the function before removing it in case you're planning to recreate it later.

## Resources#

  * Official Postgres Docs: [Triggers](<https://www.postgresql.org/docs/current/triggers.html>)
  * Official Postgres Docs: [Overview of Trigger Behavior](<https://www.postgresql.org/docs/current/trigger-definition.html>)
  * Official Postgres Docs: [CREATE TRIGGER](<https://www.postgresql.org/docs/current/sql-createtrigger.html>)