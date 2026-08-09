---
タイトル: plv8: JavaScript Language
URL: https://supabase.com/docs/guides/database/extensions/plv8
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, javascript, language, plv8
---

# plv8: JavaScript Language

**URL:** https://supabase.com/docs/guides/database/extensions/plv8
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, javascript, language, plv8

## 目次

- [Overview#](#overview)
- [Enable the extension#](#enable-the-extension)
- [Createplv8functions#](#create-plv8-functions)
- [Examples#](#examples)
  - [Scalar functions#](#scalar-functions)
  - [Executing SQL#](#executing-sql)
  - [Set-returning functions#](#set-returning-functions)
- [Resources#](#resources)

## 概要

JavaScript language for Postgres.

---

The `plv8` extension is deprecated in projects using Postgres 17. It continues to be supported in projects using Postgres 15, but will need to dropped before those projects are upgraded to Postgres 17. See the [Upgrading to Postgres 17 notes](</docs/guides/platform/upgrading#upgrading-to-postgres-17>) for more information.

The `plv8` extension allows you use JavaScript within Postgres.

## Overview#

While Postgres natively runs SQL, it can also run other procedural languages. `plv8` allows you to run JavaScript code - specifically any code that runs on the [V8 JavaScript engine](<https://v8.dev>).

It can be used for database functions, triggers, queries and more.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "plv8" and enable the extension.


## Create `plv8` functions#

Functions written in `plv8` are written like any other Postgres functions, only with the `language` identifier set to `plv8`.
[code] 
    1
    
    create or replace function function_name()
    
    2
    
    returns void as $$
    
    3
    
        // V8 JavaScript
    
    4
    
        // code
    
    5
    
        // here
    
    6
    
    $$ language plv8;
[/code]

You can call `plv8` functions like any other Postgres function:

SQLJavaScriptKotlin
[code]
    1
    
    select function_name();
[/code]

## Examples#

### Scalar functions#

A [scalar function](<https://plv8.github.io/#scalar-function-calls>) is anything that takes in some user input and returns a single result.
[code] 
    1
    
    create or replace function hello_world(name text)
    
    2
    
    returns text as $$
    
    3
    
    4
    
        let output = `Hello, ${name}!`;
    
    5
    
        return output;
    
    6
    
    7
    
    $$ language plv8;
[/code]

### Executing SQL#

You can execute SQL within `plv8` code using the [`plv8.execute` function](<https://plv8.github.io/#plv8-execute>).
[code] 
    1
    
    create or replace function update_user(id bigint, first_name text)
    
    2
    
    returns smallint as $$
    
    3
    
    4
    
        var num_affected = plv8.execute(
    
    5
    
            'update profiles set first_name = $1 where id = $2',
    
    6
    
            [first_name, id]
    
    7
    
        );
    
    8
    
    9
    
        return num_affected;
    
    10
    
    $$ language plv8;
[/code]

### Set-returning functions#

A [set-returning function](<https://plv8.github.io/#set-returning-function-calls>) is anything that returns a full set of results - for example, rows in a table.
[code] 
    1
    
    create or replace function get_messages()
    
    2
    
    returns setof messages as $$
    
    3
    
    4
    
        var json_result = plv8.execute(
    
    5
    
            'select * from messages'
    
    6
    
        );
    
    7
    
    8
    
        return json_result;
    
    9
    
    $$ language plv8;
    
    10
    
    11
    
    select * from get_messages();
[/code]

## Resources#

  * Official [`plv8` documentation](<https://plv8.github.io/>)
  * [plv8 GitHub Repository](<https://github.com/plv8/plv8>)