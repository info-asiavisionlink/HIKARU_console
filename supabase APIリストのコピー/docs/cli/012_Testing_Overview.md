---
タイトル: Testing Overview
URL: https://supabase.com/docs/guides/local-development/testing/overview
カテゴリ: cli
更新日: 2026-08-02
タグ: cli, local-development, overview, testing
---

# Testing Overview

**URL:** https://supabase.com/docs/guides/local-development/testing/overview
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** cli, local-development, overview, testing

## 目次

- [Testing approaches#](#testing-approaches)
  - [Database unit testing with pgTAP#](#database-unit-testing-with-pgtap)
  - [Application-Level testing#](#application-level-testing)
  - [Continuous integration testing#](#continuous-integration-testing)
- [Best practices#](#best-practices)
- [Real-World examples#](#real-world-examples)
- [Troubleshooting#](#troubleshooting)
- [Additional resources#](#additional-resources)

## 概要

Learn how to develop and test database schemas, tables, functions, and Row Level Security (RLS) policies.

---

Testing is a critical part of database development, especially when working with features like Row Level Security (RLS) policies. This guide provides a comprehensive approach to testing your Supabase database.

## Testing approaches#

### Database unit testing with pgTAP#

[pgTAP](<https://pgtap.org>) is a unit testing framework for Postgres that allows testing:

  * Database structure: tables, columns, constraints
  * Row Level Security (RLS) policies
  * Functions and procedures
  * Data integrity


This example demonstrates setting up and testing RLS policies for a basic todo application:

  1. Create a test table with RLS enabled:
[code] 1
         
         -- Create a todos table
         
         2
         
         create table todos (
         
         3
         
         id uuid primary key default gen_random_uuid(),
         
         4
         
         task text not null,
         
         5
         
         user_id uuid references auth.users not null,
         
         6
         
         completed boolean default false
         
         7
         
         );
         
         8
         
         9
         
         -- Enable RLS
         
         10
         
         alter table todos enable row level security;
         
         11
         
         12
         
         -- Create a policy
         
         13
         
         create policy "Users can only access their own todos"
         
         14
         
         on todos for all -- this policy applies to all operations
         
         15
         
         to authenticated
         
         16
         
         using ((select auth.uid()) = user_id);
[/code]

  2. Set up your testing environment:
[code] 1
         
         # Create a new test for our policies using supabase cli
         
         2
         
         supabase test new todos_rls.test
[/code]

  3. Write your RLS tests:
[code] 1
         
         begin;
         
         2
         
         -- install tests utilities
         
         3
         
         -- install pgtap extension for testing
         
         4
         
         create extension if not exists pgtap with schema extensions;
         
         5
         
         -- Start declare we'll have 4 test cases in our test suite
         
         6
         
         select plan(4);
         
         7
         
         8
         
         -- Setup our testing data
         
         9
         
         -- Set up auth.users entries
         
         10
         
         insert into auth.users (id, email) values
         
         11
         
         	('123e4567-e89b-12d3-a456-426614174000', 'user1@test.com'),
         
         12
         
         	('987fcdeb-51a2-43d7-9012-345678901234', 'user2@test.com');
         
         13
         
         14
         
         -- Create test todos
         
         15
         
         insert into public.todos (task, user_id) values
         
         16
         
         	('User 1 Task 1', '123e4567-e89b-12d3-a456-426614174000'),
         
         17
         
         	('User 1 Task 2', '123e4567-e89b-12d3-a456-426614174000'),
         
         18
         
         	('User 2 Task 1', '987fcdeb-51a2-43d7-9012-345678901234');
         
         19
         
         20
         
         -- as User 1
         
         21
         
         set local role authenticated;
         
         22
         
         set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';
         
         23
         
         24
         
         -- Test 1: User 1 should only see their own todos
         
         25
         
         select results_eq(
         
         26
         
         	'select count(*) from todos',
         
         27
         
         	ARRAY[2::bigint],
         
         28
         
         	'User 1 should only see their 2 todos'
         
         29
         
         );
         
         30
         
         31
         
         -- Test 2: User 1 can create their own todo
         
         32
         
         select lives_ok(
         
         33
         
         	$$insert into todos (task, user_id) values ('New Task', '123e4567-e89b-12d3-a456-426614174000'::uuid)$$,
         
         34
         
         	'User 1 can create their own todo'
         
         35
         
         );
         
         36
         
         37
         
         -- as User 2
         
         38
         
         set local request.jwt.claim.sub = '987fcdeb-51a2-43d7-9012-345678901234';
         
         39
         
         40
         
         -- Test 3: User 2 should only see their own todos
         
         41
         
         select results_eq(
         
         42
         
         	'select count(*) from todos',
         
         43
         
         	ARRAY[1::bigint],
         
         44
         
         	'User 2 should only see their 1 todo'
         
         45
         
         );
         
         46
         
         47
         
         -- Test 4: User 2 cannot modify User 1's todo
         
         48
         
         SELECT results_ne(
         
         49
         
         	$$ update todos set task = 'Hacked!' where user_id = '123e4567-e89b-12d3-a456-426614174000'::uuid returning 1 $$,
         
         50
         
         	$$ values(1) $$,
         
         51
         
         	'User 2 cannot modify User 1 todos'
         
         52
         
         );
         
         53
         
         54
         
         select * from finish();
         
         55
         
         rollback;
[/code]

  4. Run the tests:
[code] 1
         
         supabase test db
         
         2
         
         psql:todos_rls.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
         
         3
         
         ./todos_rls.test.sql .. ok
         
         4
         
         All tests successful.
         
         5
         
         Files=1, Tests=6,  0 wallclock secs ( 0.01 usr +  0.00 sys =  0.01 CPU)
         
         6
         
         Result: PASS
[/code]


### Application-Level testing#

Testing through application code provides end-to-end verification. Unlike database-level testing with pgTAP, application-level tests cannot use transactions for isolation.

Application-level tests should not rely on a clean database state, as resetting the database before each test can be slow and makes tests difficult to parallelize. Instead, design your tests to be independent by using unique user IDs for each test case.

Here's an example using TypeScript that mirrors the pgTAP tests above:
[code] 
    1
    
    import crypto from 'crypto'
    
    2
    
    import { createClient } from '@supabase/supabase-js'
    
    3
    
    import { beforeAll, describe, expect, it } from 'vitest'
    
    4
    
    5
    
    describe('Todos RLS', () => {
    
    6
    
      // Generate unique IDs for this test suite to avoid conflicts with other tests
    
    7
    
      const USER_1_ID = crypto.randomUUID()
    
    8
    
      const USER_2_ID = crypto.randomUUID()
    
    9
    
    10
    
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!)
    
    11
    
    12
    
      beforeAll(async () => {
    
    13
    
        // Setup test data specific to this test suite
    
    14
    
        const adminSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    
    15
    
    16
    
        // Create test users with unique IDs
    
    17
    
        await adminSupabase.auth.admin.createUser({
    
    18
    
          id: USER_1_ID,
    
    19
    
          email: `user1-${USER_1_ID}@test.com`,
    
    20
    
          password: 'password123',
    
    21
    
          // We want the user to be usable right away without email confirmation
    
    22
    
          email_confirm: true,
    
    23
    
        })
    
    24
    
        await adminSupabase.auth.admin.createUser({
    
    25
    
          id: USER_2_ID,
    
    26
    
          email: `user2-${USER_2_ID}@test.com`,
    
    27
    
          password: 'password123',
    
    28
    
          email_confirm: true,
    
    29
    
        })
    
    30
    
    31
    
        // Create initial todos
    
    32
    
        await adminSupabase.from('todos').insert([
    
    33
    
          { task: 'User 1 Task 1', user_id: USER_1_ID },
    
    34
    
          { task: 'User 1 Task 2', user_id: USER_1_ID },
    
    35
    
          { task: 'User 2 Task 1', user_id: USER_2_ID },
    
    36
    
        ])
    
    37
    
      })
    
    38
    
    39
    
      it('should allow User 1 to only see their own todos', async () => {
    
    40
    
        // Sign in as User 1
    
    41
    
        await supabase.auth.signInWithPassword({
    
    42
    
          email: `user1-${USER_1_ID}@test.com`,
    
    43
    
          password: 'password123',
    
    44
    
        })
    
    45
    
    46
    
        const { data: todos } = await supabase.from('todos').select('*')
    
    47
    
    48
    
        expect(todos).toHaveLength(2)
    
    49
    
        todos?.forEach((todo) => {
    
    50
    
          expect(todo.user_id).toBe(USER_1_ID)
    
    51
    
        })
    
    52
    
      })
    
    53
    
    54
    
      it('should allow User 1 to create their own todo', async () => {
    
    55
    
        await supabase.auth.signInWithPassword({
    
    56
    
          email: `user1-${USER_1_ID}@test.com`,
    
    57
    
          password: 'password123',
    
    58
    
        })
    
    59
    
    60
    
        const { error } = await supabase.from('todos').insert({ task: 'New Task', user_id: USER_1_ID })
    
    61
    
    62
    
        expect(error).toBeNull()
    
    63
    
      })
    
    64
    
    65
    
      it('should allow User 2 to only see their own todos', async () => {
    
    66
    
        // Sign in as User 2
    
    67
    
        await supabase.auth.signInWithPassword({
    
    68
    
          email: `user2-${USER_2_ID}@test.com`,
    
    69
    
          password: 'password123',
    
    70
    
        })
    
    71
    
    72
    
        const { data: todos } = await supabase.from('todos').select('*')
    
    73
    
        expect(todos).toHaveLength(1)
    
    74
    
        todos?.forEach((todo) => {
    
    75
    
          expect(todo.user_id).toBe(USER_2_ID)
    
    76
    
        })
    
    77
    
      })
    
    78
    
    79
    
      it('should prevent User 2 from modifying User 1 todos', async () => {
    
    80
    
        await supabase.auth.signInWithPassword({
    
    81
    
          email: `user2-${USER_2_ID}@test.com`,
    
    82
    
          password: 'password123',
    
    83
    
        })
    
    84
    
    85
    
        // Attempt to update the todos we shouldn't have access to
    
    86
    
        // result will be a no-op
    
    87
    
        await supabase.from('todos').update({ task: 'Hacked!' }).eq('user_id', USER_1_ID)
    
    88
    
    89
    
        // Log back in as User 1 to verify their todos weren't changed
    
    90
    
        await supabase.auth.signInWithPassword({
    
    91
    
          email: `user1-${USER_1_ID}@test.com`,
    
    92
    
          password: 'password123',
    
    93
    
        })
    
    94
    
    95
    
        // Fetch User 1's todos
    
    96
    
        const { data: todos } = await supabase.from('todos').select('*')
    
    97
    
    98
    
        // Verify that none of the todos were changed to "Hacked!"
    
    99
    
        expect(todos).toBeDefined()
    
    100
    
        todos?.forEach((todo) => {
    
    101
    
          expect(todo.task).not.toBe('Hacked!')
    
    102
    
        })
    
    103
    
      })
    
    104
    
    })
[/code]

#### Test isolation strategies#

For application-level testing, consider these approaches for test isolation:

  1. **Unique Identifiers** : Generate unique IDs for each test suite to prevent data conflicts
  2. **Cleanup After Tests** : If necessary, clean up created data in an `afterAll` or `afterEach` hook
  3. **Isolated Data Sets** : Use prefixes or namespaces in data to separate test cases


### Continuous integration testing#

Set up automated database testing in your CI pipeline:

  1. Create a GitHub Actions workflow `.github/workflows/db-tests.yml`:


[code] 
    1
    
    name: Database Tests
    
    2
    
    3
    
    on:
    
    4
    
      push:
    
    5
    
        branches: [main]
    
    6
    
      pull_request:
    
    7
    
        branches: [main]
    
    8
    
    9
    
    jobs:
    
    10
    
      test:
    
    11
    
        runs-on: ubuntu-latest
    
    12
    
    13
    
        steps:
    
    14
    
          - uses: actions/checkout@v4
    
    15
    
    16
    
          - name: Setup Supabase CLI
    
    17
    
            uses: supabase/setup-cli@v1
    
    18
    
    19
    
          - name: Start Supabase
    
    20
    
            run: supabase start
    
    21
    
    22
    
          - name: Run Tests
    
    23
    
            run: supabase test db
[/code]

## Best practices#

  1. **Test Data Setup**

     * Use begin and rollback to ensure test isolation
     * Create realistic test data that covers edge cases
     * Use different user roles and permissions in tests
  2. **RLS Policy Testing**

     * Test Create, Read, Update, Delete operations
     * Test with different user roles: anonymous and authenticated
     * Test edge cases and potential security bypasses
     * Always test negative cases: what users should not be able to do
  3. **CI/CD Integration**

     * Run tests automatically on every pull request
     * Include database tests in deployment pipeline
     * Keep test runs fast using transactions


## Real-World examples#

For more complex, real-world examples of database testing, check out:

  * [Database Tests Example Repository](<https://github.com/usebasejump/basejump/tree/main/supabase/tests/database>) \- A production-grade example of testing RLS policies
  * [RLS Guide and Best Practices](<https://github.com/orgs/supabase/discussions/14576>)


## Troubleshooting#

Common issues and solutions:

  1. **Test Failures Due to RLS**

     * Ensure you've set the correct role `set local role authenticated;`
     * Verify JWT claims are set `set local "request.jwt.claims"`
     * Check policy definitions match your test assumptions
  2. **CI Pipeline Issues**

     * Verify Supabase CLI is properly installed
     * Ensure database migrations are run before tests
     * Check for proper test isolation using transactions


## Additional resources#

  * [pgTAP Documentation](<https://pgtap.org>)
  * [Supabase CLI Reference](</docs/reference/cli/supabase-test>)
  * [pgTAP Supabase reference](</docs/guides/database/extensions/pgtap?queryGroups=database-method&database-method=sql#testing-rls-policies>)
  * [Database testing reference](</docs/guides/database/testing>)