---
タイトル: Database Functions
URL: https://supabase.com/docs/guides/database/functions
カテゴリ: database
更新日: 2026-08-02
タグ: database, functions
---

# Database Functions

**URL:** https://supabase.com/docs/guides/database/functions
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, functions

## 目次

- [Quick demo#](#quick-demo)
- [Getting started#](#getting-started)
- [Basic functions#](#simple-functions)
- [Returning data sets#](#returning-data-sets)
- [Passing parameters#](#passing-parameters)
- [Suggestions#](#suggestions)
  - [Database Functions vs Edge Functions#](#database-functions-vs-edge-functions)
  - [Securitydefinervsinvoker#](#security-definer-vs-invoker)
  - [Function privileges#](#function-privileges)
  - [Debugging functions#](#debugging-functions)
- [Resources#](#resources)
- [Deep dive#](#deep-dive)
  - [Create Database Functions#](#create-database-functions)
  - [Call Database Functions using JavaScript#](#call-database-functions-using-javascript)
  - [Using Database Functions to call an external API#](#using-database-functions-to-call-an-external-api)

## 概要

Creating and using Postgres functions.

---

Postgres has built-in support for [SQL functions](<https://www.postgresql.org/docs/current/sql-createfunction.html>). These functions live inside your database, and they can be [used with the API](<../../reference/javascript/rpc>).

## Quick demo#

## Getting started#

Supabase provides several options for creating database functions. You can use the Dashboard or create them directly using SQL. We provide a SQL editor within the Dashboard, or you can [connect](<../../guides/database/connecting-to-postgres>) to your database and run the SQL queries yourself.

  1. Go to the "SQL editor" section.
  2. Click "New Query".
  3. Enter the SQL to create or replace your Database function.
  4. Click "Run" or cmd+enter (ctrl+enter).


## Basic functions #

Create a basic database function that returns the string "hello world".
[code] 
    1
    
    create or replace function hello_world() -- 1
    
    2
    
    returns text -- 2
    
    3
    
    language sql -- 3
    
    4
    
    as $$  -- 4
    
    5
    
      select 'hello world';  -- 5
    
    6
    
    $$; --6
[/code]

Show/Hide Details

At it's most basic a function has the following parts:

  1. `create or replace function hello_world()`: The function declaration, where `hello_world` is the name of the function. You can use either `create` when creating a new function or `replace` when replacing an existing function. Or you can use `create or replace` together to handle either.
  2. `returns text`: The type of data that the function returns. If it returns nothing, you can `returns void`.
  3. `language sql`: The language used inside the function body. This can also be a procedural language: `plpgsql`, `plpython`, etc.
  4. `as $$`: The function wrapper. Anything enclosed inside the `$$` symbols will be part of the function body.
  5. `select 'hello world';`: A basic function body. The final `select` statement inside a function body will be returned if there are no statements following it.
  6. `$$;`: The closing symbols of the function wrapper.

  


When naming your functions, make the name of the function unique as overloaded functions are not supported.

After the Function is created, we have several ways of "executing" the function - either directly inside the database using SQL, or with one of the client libraries.

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select hello_world();
[/code]

## Returning data sets#

Database Functions can also return data sets from [Tables](<../../guides/database/tables>) or Views.

For example, if we had a database with some Star Wars data inside:

DataSQL

#### Planets
[code]
    1
    
    | id  | name     |
    
    2
    
    | --- | -------- |
    
    3
    
    | 1   | Tatooine |
    
    4
    
    | 2   | Alderaan |
    
    5
    
    | 3   | Kashyyyk |
[/code]

#### People
[code]
    1
    
    | id  | name             | planet_id |
    
    2
    
    | --- | ---------------- | --------- |
    
    3
    
    | 1   | Anakin Skywalker | 1         |
    
    4
    
    | 2   | Luke Skywalker   | 1         |
    
    5
    
    | 3   | Princess Leia    | 2         |
    
    6
    
    | 4   | Chewbacca        | 3         |
[/code]

We could create a function which returns all the planets:
[code] 
    1
    
    create or replace function get_planets()
    
    2
    
    returns setof planets
    
    3
    
    language sql
    
    4
    
    as $$
    
    5
    
      select * from planets;
    
    6
    
    $$;
[/code]

Because this function returns a table set, we can also apply filters and selectors. For example, if we only wanted the first planet:

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select *
    
    2
    
    from get_planets()
    
    3
    
    where id = 1;
[/code]

## Passing parameters#

Create a function to insert a new planet into the `planets` table and return the new ID. Note that this time we're using the `plpgsql` language.
[code] 
    1
    
    create or replace function add_planet(name text)
    
    2
    
    returns bigint
    
    3
    
    language plpgsql
    
    4
    
    as $$
    
    5
    
    declare
    
    6
    
      new_row bigint;
    
    7
    
    begin
    
    8
    
      insert into planets(name)
    
    9
    
      values (add_planet.name)
    
    10
    
      returning id into new_row;
    
    11
    
    12
    
      return new_row;
    
    13
    
    end;
    
    14
    
    $$;
[/code]

Once again, you can execute this function either inside your database using a `select` query, or with the client libraries:

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select * from add_planet('Jakku');
[/code]

## Suggestions#

### Database Functions vs Edge Functions#

For data-intensive operations, use Database Functions, which are executed within your database and can be called remotely using the [REST and GraphQL API](<../api>).

For use-cases which require low-latency, use [Edge Functions](<../../guides/functions>), which are globally-distributed and can be written in Typescript.

### Security `definer` vs `invoker`#

Postgres allows you to specify whether you want the function to be executed as the user _calling_ the function (`invoker`), or as the _creator_ of the function (`definer`). For example:
[code] 
    1
    
    create function hello_world()
    
    2
    
    returns text
    
    3
    
    language plpgsql
    
    4
    
    security definer set search_path = ''
    
    5
    
    as $$
    
    6
    
    begin
    
    7
    
      return 'hello world';
    
    8
    
    end;
    
    9
    
    $$;
[/code]

It is best practice to use `security invoker` (which is also the default). If you ever use `security definer`, you _must_ set the `search_path`. If you use an empty search path (`search_path = ''`), you must explicitly state the schema for every relation in the function body (e.g. `from public.table`). This limits the potential damage if you allow access to schemas which the user executing the function should not have.

### Function privileges#

By default, database functions can be executed by any role. There are two main ways to restrict this:

  1. On a case-by-case basis. Specifically revoke permissions for functions you want to protect. Execution needs to be revoked for both `public` and the role you're restricting:
[code] 1
         
         revoke execute on function public.hello_world from public;
         
         2
         
         revoke execute on function public.hello_world from anon;
[/code]

  2. Restrict function execution by default. Specifically _grant_ access when you want a function to be executable by a specific role.

To restrict all existing functions, revoke execution permissions from both `public` _and_ the role you want to restrict:
[code] 1
         
         revoke execute on all functions in schema public from public;
         
         2
         
         revoke execute on all functions in schema public from anon, authenticated;
[/code]

To restrict all new functions, change the default privileges for both `public` _and_ the role you want to restrict:
[code] 1
         
         alter default privileges in schema public revoke execute on functions from public;
         
         2
         
         alter default privileges in schema public revoke execute on functions from anon, authenticated;
[/code]

You can then regrant permissions for a specific function to a specific role:
[code] 1
         
         grant execute on function public.hello_world to authenticated;
[/code]


### Debugging functions#

You can add logs to help you debug functions. This is especially recommended for complex functions.

Good targets to log include:

  * Values of (non-sensitive) variables
  * Returned results from queries


#### General logging#

To create custom logs in the [Dashboard's Postgres Logs](</dashboard/project/_/logs/postgres-logs>), you can use the `raise` keyword. By default, there are 3 observed severity levels:

  * `log`
  * `warning`
  * `exception` (error level)


[code] 
    1
    
    create function logging_example(
    
    2
    
      log_message text,
    
    3
    
      warning_message text,
    
    4
    
      error_message text
    
    5
    
    )
    
    6
    
    returns void
    
    7
    
    language plpgsql
    
    8
    
    as $$
    
    9
    
    begin
    
    10
    
      raise log 'logging message: %', log_message;
    
    11
    
      raise warning 'logging warning: %', warning_message;
    
    12
    
    13
    
      -- immediately ends function and reverts transaction
    
    14
    
      raise exception 'logging error: %', error_message;
    
    15
    
    end;
    
    16
    
    $$;
    
    17
    
    18
    
    select logging_example('LOGGED MESSAGE', 'WARNING MESSAGE', 'ERROR MESSAGE');
[/code]

#### Error handling#

You can create custom errors with the `raise exception` keywords.

A common pattern is to throw an error when a variable doesn't meet a condition:
[code] 
    1
    
    create or replace function error_if_null(some_val text)
    
    2
    
    returns text
    
    3
    
    language plpgsql
    
    4
    
    as $$
    
    5
    
    begin
    
    6
    
      -- error if some_val is null
    
    7
    
      if some_val is null then
    
    8
    
        raise exception 'some_val should not be NULL';
    
    9
    
      end if;
    
    10
    
      -- return some_val if it is not null
    
    11
    
      return some_val;
    
    12
    
    end;
    
    13
    
    $$;
    
    14
    
    15
    
    select error_if_null(null);
[/code]

Value checking is common, so Postgres provides a shorthand: the `assert` keyword. It uses the following format:
[code] 
    1
    
    -- throw error when condition is false
    
    2
    
    assert <some condition>, 'message';
[/code]

Below is an example
[code] 
    1
    
    create function assert_example(name text)
    
    2
    
    returns uuid
    
    3
    
    language plpgsql
    
    4
    
    as $$
    
    5
    
    declare
    
    6
    
      student_id uuid;
    
    7
    
    begin
    
    8
    
      -- save a user's id into the user_id variable
    
    9
    
      select
    
    10
    
        id into student_id
    
    11
    
      from attendance_table
    
    12
    
      where student = name;
    
    13
    
    14
    
      -- throw an error if the student_id is null
    
    15
    
      assert student_id is not null, 'assert_example() ERROR: student not found';
    
    16
    
    17
    
      -- otherwise, return the user's id
    
    18
    
      return student_id;
    
    19
    
    end;
    
    20
    
    $$;
    
    21
    
    22
    
    select assert_example('Harry Potter');
[/code]

Error messages can also be captured and modified with the `exception` keyword:
[code] 
    1
    
    create function error_example()
    
    2
    
    returns void
    
    3
    
    language plpgsql
    
    4
    
    as $$
    
    5
    
    begin
    
    6
    
      -- fails: cannot read from nonexistent table
    
    7
    
      select * from table_that_does_not_exist;
    
    8
    
    9
    
      exception
    
    10
    
          when others then
    
    11
    
              raise exception 'An error occurred in function <function name>: %', sqlerrm;
    
    12
    
    end;
    
    13
    
    $$;
[/code]

#### Advanced logging#

For more complex functions or complicated debugging, try logging:

  * Formatted variables
  * Individual rows
  * Start and end of function calls


[code] 
    1
    
    create or replace function advanced_example(num int default 10)
    
    2
    
    returns text
    
    3
    
    language plpgsql
    
    4
    
    as $$
    
    5
    
    declare
    
    6
    
        var1 int := 20;
    
    7
    
        var2 text;
    
    8
    
    begin
    
    9
    
        -- Logging start of function
    
    10
    
        raise log 'logging start of function call: (%)', (select now());
    
    11
    
    12
    
        -- Logging a variable from a SELECT query
    
    13
    
        select
    
    14
    
          col_1 into var1
    
    15
    
        from some_table
    
    16
    
        limit 1;
    
    17
    
        raise log 'logging a variable (%)', var1;
    
    18
    
    19
    
        -- It is also possible to avoid using variables, by returning the values of your query to the log
    
    20
    
        raise log 'logging a query with a single return value(%)', (select col_1 from some_table limit 1);
    
    21
    
    22
    
        -- If necessary, you can even log an entire row as JSON
    
    23
    
        raise log 'logging an entire row as JSON (%)', (select to_jsonb(some_table.*) from some_table limit 1);
    
    24
    
    25
    
        -- When using INSERT or UPDATE, the new value(s) can be returned
    
    26
    
        -- into a variable.
    
    27
    
        -- When using DELETE, the deleted value(s) can be returned.
    
    28
    
        -- All three operations use "RETURNING value(s) INTO variable(s)" syntax
    
    29
    
        insert into some_table (col_2)
    
    30
    
        values ('new val')
    
    31
    
        returning col_2 into var2;
    
    32
    
    33
    
        raise log 'logging a value from an INSERT (%)', var2;
    
    34
    
    35
    
        return var1 || ',' || var2;
    
    36
    
    exception
    
    37
    
        -- Handle exceptions here if needed
    
    38
    
        when others then
    
    39
    
            raise exception 'An error occurred in function <advanced_example>: %', sqlerrm;
    
    40
    
    end;
    
    41
    
    $$;
    
    42
    
    43
    
    select advanced_example();
[/code]

## Resources#

  * Official Client libraries: [JavaScript](<../../reference/javascript/rpc>) and [Flutter](<../../reference/dart/rpc>)
  * Community client libraries: [github.com/supabase-community](<https://github.com/supabase-community>)
  * Postgres Official Docs: [Chapter 9. Functions and Operators](<https://www.postgresql.org/docs/current/functions.html>)
  * Postgres Reference: [CREATE FUNCTION](<https://www.postgresql.org/docs/9.1/sql-createfunction.html>)


## Deep dive#

### Create Database Functions#

### Call Database Functions using JavaScript#

### Using Database Functions to call an external API#