---
タイトル: plpgsql_check: PL/pgSQL Linter
URL: https://supabase.com/docs/guides/database/extensions/plpgsql_check
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, linter, pgsql, plpgsql_check, sql
---

# plpgsql_check: PL/pgSQL Linter

**URL:** https://supabase.com/docs/guides/database/extensions/plpgsql_check
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, linter, pgsql, plpgsql_check, sql

## 目次

- [Enable the extension#](#enable-the-extension)
- [API#](#api)
- [Usage#](#usage)
- [Resources#](#resources)

## 概要

Lint PL/pgSQL code

---

[plpgsql_check](<https://github.com/okbob/plpgsql_check>) is a Postgres extension that lints plpgsql for syntax, semantic and other related issues. The tool helps developers to identify and correct errors before executing the code. plpgsql_check is most useful for developers who are working with large or complex SQL codebases, as it can help identify and resolve issues early in the development cycle.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "plpgsql_check" and enable the extension.


## API#

  * [`plpgsql_check_function( ... )`](<https://github.com/okbob/plpgsql_check#active-mode>): Scans a function for errors.


`plpgsql_check_function` is highly customizable. For a complete list of available arguments see [the docs](<https://github.com/okbob/plpgsql_check#arguments>)

## Usage#

To demonstrate `plpgsql_check` we can create a function with a known error. In this case we create a function `some_func`, that references a non-existent column `place.created_at`.
[code] 
    1
    
    create table place(
    
    2
    
      x float,
    
    3
    
      y float
    
    4
    
    );
    
    5
    
    6
    
    create or replace function public.some_func()
    
    7
    
      returns void
    
    8
    
      language plpgsql
    
    9
    
    as $$
    
    10
    
    declare
    
    11
    
      rec record;
    
    12
    
    begin
    
    13
    
      for rec in select * from place
    
    14
    
      loop
    
    15
    
        -- Bug: There is no column `created_at` on table `place`
    
    16
    
        raise notice '%', rec.created_at;
    
    17
    
      end loop;
    
    18
    
    end;
    
    19
    
    $$;
[/code]

Note that executing the function would not catch the invalid reference error because the `loop` does not execute if no rows are present in the table.
[code] 
    1
    
    select public.some_func();
    
    2
    
      some_func
    
    3
    
     ───────────
    
    4
    
    5
    
     (1 row)
[/code]

Now we can use plpgsql_check's `plpgsql_check_function` function to identify the known error.
[code] 
    1
    
    select plpgsql_check_function('public.some_func()');
    
    2
    
    3
    
                       plpgsql_check_function
    
    4
    
    ------------------------------------------------------------
    
    5
    
     error:42703:8:RAISE:record "rec" has no field "created_at"
    
    6
    
     Context: SQL expression "rec.created_at"
[/code]

## Resources#

  * Official [`plpgsql_check` documentation](<https://github.com/okbob/plpgsql_check>)