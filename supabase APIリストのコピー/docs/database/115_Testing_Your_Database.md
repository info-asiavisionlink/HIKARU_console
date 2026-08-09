---
タイトル: Testing Your Database
URL: https://supabase.com/docs/guides/database/testing
カテゴリ: database
更新日: 2026-08-02
タグ: database, testing, your
---

# Testing Your Database

**URL:** https://supabase.com/docs/guides/database/testing
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, testing, your

## 目次

- [Testing using the Supabase CLI#](#testing-using-the-supabase-cli)
  - [Creating a test#](#creating-a-test)
  - [Writing tests#](#writing-tests)
  - [Running tests#](#running-tests)
  - [More resources#](#more-resources)

## 概要

Test your database schema, tables, functions, and policies.

---

To ensure that queries return the expected data, RLS policies are correctly applied and etc., we encourage you to write automated tests. There are essentially two approaches to testing:

  * Firstly, you can write tests that interface with a Supabase client instance (same way you use Supabase client in your application code) in the programming language(s) you use in your application and using your favorite testing framework.

  * Secondly, you can test through the Supabase CLI, which is a more low-level approach where you write tests in SQL.


## Testing using the Supabase CLI#

You can use the Supabase CLI to test your database. The minimum required version of the CLI is [v1.11.4](<https://github.com/supabase/cli/releases>). To get started:

  * [Install the Supabase CLI](</docs/guides/local-development>) on your local machine


### Creating a test#

Create a tests folder inside the `supabase` folder:
[code] 
    1
    
    mkdir -p ./supabase/tests/database
[/code]

Create a new file with the `.sql` extension which will contain the test.
[code] 
    1
    
    touch ./supabase/tests/database/hello_world.test.sql
[/code]

### Writing tests#

All `sql` files use [pgTAP](</docs/guides/database/extensions/pgtap>) as the test runner.

Write a test to check that our `auth.users` table has an ID column. Open `hello_world.test.sql` and add the following code:
[code] 
    1
    
    begin;
    
    2
    
    select plan(1); -- only one statement to run
    
    3
    
    4
    
    SELECT has_column(
    
    5
    
        'auth',
    
    6
    
        'users',
    
    7
    
        'id',
    
    8
    
        'id should exist'
    
    9
    
    );
    
    10
    
    11
    
    select * from finish();
    
    12
    
    rollback;
[/code]

### Running tests#

To run the test, you can use:
[code] 
    1
    
    supabase test db
[/code]

This will produce the following output:
[code] 
    1
    
    $ supabase test db
    
    2
    
    supabase/tests/database/hello_world.test.sql .. ok
    
    3
    
    All tests successful.
    
    4
    
    Files=1, Tests=1,  1 wallclock secs ( 0.01 usr  0.00 sys +  0.04 cusr  0.02 csys =  0.07 CPU)
    
    5
    
    Result: PASS
[/code]

### More resources#

  * [Testing RLS policies](</docs/guides/database/extensions/pgtap#testing-rls-policies>)
  * [pgTAP extension](</docs/guides/database/extensions/pgtap>)
  * Official [pgTAP documentation](<https://pgtap.org/>)