---
タイトル: pgTAP: Unit Testing
URL: https://supabase.com/docs/guides/database/extensions/pgtap
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, pgtap, testing, unit
---

# pgTAP: Unit Testing

**URL:** https://supabase.com/docs/guides/database/extensions/pgtap
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, pgtap, testing, unit

## 目次

- [Overview#](#overview)
- [Enable the extension#](#enable-the-extension)
- [Testing tables#](#testing-tables)
- [Testing columns#](#testing-columns)
- [Testing RLS policies#](#testing-rls-policies)
- [Testing functions#](#testing-functions)
- [Resources#](#resources)

## 概要

Unit testing in Postgres.

---

`pgTAP` is a unit testing extension for Postgres.

## Overview#

This section covers basic concepts:

  * Unit tests: allow you to test small parts of a system (like a database table!).
  * TAP: stands for [Test Anything Protocol](<http://testanything.org/>). It is an framework which aims to simplify the error reporting during testing.


## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `pgtap` and enable the extension.


## Testing tables#
[code] 
    1
    
    begin;
    
    2
    
    select plan( 1 );
    
    3
    
    4
    
    select has_table( 'profiles' );
    
    5
    
    6
    
    select * from finish();
    
    7
    
    rollback;
[/code]

API:

  * [`has_table()`](<https://pgtap.org/documentation.html#has_table>): Tests whether or not a table exists in the database
  * [`has_index()`](<https://pgtap.org/documentation.html#has_index>): Checks for the existence of a named index associated with the named table.
  * [`has_relation()`](<https://pgtap.org/documentation.html#has_relation>): Tests whether or not a relation exists in the database.


## Testing columns#
[code] 
    1
    
    begin;
    
    2
    
    select plan( 2 );
    
    3
    
    4
    
    select has_column( 'profiles', 'id' ); -- test that the "id" column exists in the "profiles" table
    
    5
    
    select col_is_pk( 'profiles', 'id' ); -- test that the "id" column is a primary key
    
    6
    
    7
    
    select * from finish();
    
    8
    
    rollback;
[/code]

API:

  * [`has_column()`](<https://pgtap.org/documentation.html#has_column>): Tests whether or not a column exists in a given table, view, materialized view or composite type.
  * [`col_is_pk()`](<https://pgtap.org/documentation.html#col_is_pk>): Tests whether the specified column or columns in a table is/are the primary key for that table.


## Testing RLS policies#
[code] 
    1
    
    begin;
    
    2
    
    select plan( 1 );
    
    3
    
    4
    
    select policies_are(
    
    5
    
      'public',
    
    6
    
      'profiles',
    
    7
    
      ARRAY [
    
    8
    
        'Profiles are public', -- Test that there is a policy called  "Profiles are public" on the "profiles" table.
    
    9
    
        'Profiles can only be updated by the owner'  -- Test that there is a policy called  "Profiles can only be updated by the owner" on the "profiles" table.
    
    10
    
      ]
    
    11
    
    );
    
    12
    
    13
    
    select * from finish();
    
    14
    
    rollback;
[/code]

API:

  * [`policies_are()`](<https://pgtap.org/documentation.html#policies_are>): Tests that all of the policies on the named table are only the policies that should be on that table.
  * [`policy_roles_are()`](<https://pgtap.org/documentation.html#policy_roles_are>): Tests whether the roles to which policy applies are only the roles that should be on that policy.
  * [`policy_cmd_is()`](<https://pgtap.org/documentation.html#policy_cmd_is>): Tests whether the command to which policy applies is same as command that is given in function arguments.


You can also use the `results_eq()` method to test that a Policy returns the correct data:
[code] 
    1
    
    begin;
    
    2
    
    select plan( 1 );
    
    3
    
    4
    
    select results_eq(
    
    5
    
        'select * from profiles()',
    
    6
    
        $$VALUES ( 1, 'Anna'), (2, 'Bruce'), (3, 'Caryn')$$,
    
    7
    
        'profiles() should return all users'
    
    8
    
    );
    
    9
    
    10
    
    11
    
    select * from finish();
    
    12
    
    rollback;
[/code]

API:

  * [`results_eq()`](<https://pgtap.org/documentation.html#results_eq>)
  * [`results_ne()`](<https://pgtap.org/documentation.html#results_ne>)


## Testing functions#
[code] 
    1
    
    prepare hello_expr as select 'hello'
    
    2
    
    3
    
    begin;
    
    4
    
    select plan(3);
    
    5
    
    -- You'll need to create a hello_world and is_even function
    
    6
    
    select function_returns( 'hello_world', 'text' );                   -- test if the function "hello_world" returns text
    
    7
    
    select function_returns( 'is_even', ARRAY['integer'], 'boolean' );  -- test if the function "is_even" returns a boolean
    
    8
    
    select results_eq('select * from hello_world()', 'hello_expr');          -- test if the function "hello_world" returns "hello"
    
    9
    
    10
    
    select * from finish();
    
    11
    
    rollback;
[/code]

API:

  * [`function_returns()`](<https://pgtap.org/documentation.html#function_returns>): Tests that a particular function returns a particular data type
  * [`is_definer()`](<https://pgtap.org/documentation.html#is_definer>): Tests that a function is a security definer (that is, a `setuid` function).


## Resources#

  * Official [`pgTAP` documentation](<https://pgtap.org/>)