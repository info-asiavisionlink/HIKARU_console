---
タイトル: Advanced pgTAP Testing
URL: https://supabase.com/docs/guides/local-development/testing/pgtap-extended
カテゴリ: cli
更新日: 2026-08-02
タグ: advanced, cli, local-development, pgtap, pgtap-extended, testing
---

# Advanced pgTAP Testing

**URL:** https://supabase.com/docs/guides/local-development/testing/pgtap-extended
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** advanced, cli, local-development, pgtap, pgtap-extended, testing

## 目次

- [Using database.dev#](#using-databasedev)
  - [Setting up dbdev#](#setting-up-dbdev)
  - [Installing test helpers#](#installing-test-helpers)
- [Test helper benefits#](#test-helper-benefits)
- [Schema-wide Row Level Security testing#](#schema-wide-row-level-security-testing)
- [Test file organization#](#test-file-organization)
  - [Creating a pre-test hook#](#creating-a-pre-test-hook)
  - [Benefits#](#benefits)
- [Example: Advanced RLS testing#](#example-advanced-rls-testing)
- [Not another todo app: Testing complex organizations#](#not-another-todo-app-testing-complex-organizations)
  - [System overview#](#system-overview)
  - [What makes this complex?#](#what-makes-this-complex)
  - [Testing focus areas#](#testing-focus-areas)
- [Additional resources#](#additional-resources)

## 概要

Learn how to leverage dbdev and test helpers for advanced database testing.

---

While basic pgTAP provides excellent testing capabilities, you can enhance the testing workflow using database development tools and helper packages. This guide covers advanced testing techniques using database.dev and community-maintained test helpers.

## Using database.dev#

[Database.dev](<https://database.dev>) is a package manager for Postgres that allows installation and use of community-maintained packages, including testing utilities.

### Setting up dbdev#

To use database development tools and packages, install some prerequisites:
[code] 
    1
    
    create extension if not exists http with schema extensions;
    
    2
    
    create extension if not exists pg_tle;
    
    3
    
    drop extension if exists "supabase-dbdev";
    
    4
    
    select pgtle.uninstall_extension_if_exists('supabase-dbdev');
    
    5
    
    select
    
    6
    
        pgtle.install_extension(
    
    7
    
            'supabase-dbdev',
    
    8
    
            resp.contents ->> 'version',
    
    9
    
            'PostgreSQL package manager',
    
    10
    
            resp.contents ->> 'sql'
    
    11
    
        )
    
    12
    
    from extensions.http(
    
    13
    
        (
    
    14
    
            'GET',
    
    15
    
            'https://api.database.dev/rest/v1/'
    
    16
    
            || 'package_versions?select=sql,version'
    
    17
    
            || '&package_name=eq.supabase-dbdev'
    
    18
    
            || '&order=version.desc'
    
    19
    
            || '&limit=1',
    
    20
    
            array[
    
    21
    
                ('apiKey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s')::extensions.http_header
    
    22
    
            ],
    
    23
    
            null,
    
    24
    
            null
    
    25
    
        )
    
    26
    
    ) x,
    
    27
    
    lateral (
    
    28
    
        select
    
    29
    
            ((row_to_json(x) -> 'content') #>> '{}')::json -> 0
    
    30
    
    ) resp(contents);
    
    31
    
    create extension "supabase-dbdev";
    
    32
    
    select dbdev.install('supabase-dbdev');
    
    33
    
    34
    
    -- Drop and recreate the extension to ensure a clean installation
    
    35
    
    drop extension if exists "supabase-dbdev";
    
    36
    
    create extension "supabase-dbdev";
[/code]

### Installing test helpers#

The Test Helpers package provides utilities that simplify testing Supabase-specific features:
[code] 
    1
    
    select dbdev.install('basejump-supabase_test_helpers');
    
    2
    
    create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';
[/code]

## Test helper benefits#

The test helpers package provides several advantages over writing raw pgTAP tests:

  1. **Simplified User Management**

     * Create test users with `tests.create_supabase_user()`
     * Switch contexts with `tests.authenticate_as()`
     * Retrieve user IDs using `tests.get_supabase_uid()`
  2. **Row Level Security (RLS) Testing Utilities**

     * Verify RLS status with `tests.rls_enabled()`
     * Test policy enforcement
     * Simulate different user contexts
  3. **Reduced Boilerplate**

     * No need to manually insert auth.users
     * Simplified JWT claim management
     * Clean test setup and cleanup


## Schema-wide Row Level Security testing#

When working with Row Level Security, it's crucial to ensure that RLS is enabled on all tables that need it. Create a basic test to verify RLS is enabled across an entire schema:
[code] 
    1
    
    begin;
    
    2
    
    select plan(1);
    
    3
    
    4
    
    -- Verify RLS is enabled on all tables in the public schema
    
    5
    
    select tests.rls_enabled('public');
    
    6
    
    7
    
    select * from finish();
    
    8
    
    rollback;
[/code]

## Test file organization#

When working with multiple test files that share common setup requirements, it's beneficial to create a single "pre-test" file that handles the global environment setup. This approach reduces duplication and ensures consistent test environments.

### Creating a pre-test hook#

Since pgTAP test files are executed in alphabetical order, create a setup file that runs first by using a naming convention like `000-setup-tests-hooks.sql`:
[code] 
    1
    
    supabase test new 000-setup-tests-hooks
[/code]

This setup file should contain:

  1. All shared extensions and dependencies
  2. Common test utilities
  3. A basic always-green test to verify the setup


Here's an example setup file:
[code] 
    1
    
    -- install tests utilities
    
    2
    
    -- install pgtap extension for testing
    
    3
    
    create extension if not exists pgtap with schema extensions;
    
    4
    
    /*
    
    5
    
    ---------------------
    
    6
    
    ---- install dbdev ----
    
    7
    
    ----------------------
    
    8
    
    Requires:
    
    9
    
      - pg_tle: https://github.com/aws/pg_tle
    
    10
    
      - pgsql-http: https://github.com/pramsey/pgsql-http
    
    11
    
    */
    
    12
    
    create extension if not exists http with schema extensions;
    
    13
    
    create extension if not exists pg_tle;
    
    14
    
    drop extension if exists "supabase-dbdev";
    
    15
    
    select pgtle.uninstall_extension_if_exists('supabase-dbdev');
    
    16
    
    select
    
    17
    
        pgtle.install_extension(
    
    18
    
            'supabase-dbdev',
    
    19
    
            resp.contents ->> 'version',
    
    20
    
            'PostgreSQL package manager',
    
    21
    
            resp.contents ->> 'sql'
    
    22
    
        )
    
    23
    
    from extensions.http(
    
    24
    
        (
    
    25
    
            'GET',
    
    26
    
            'https://api.database.dev/rest/v1/'
    
    27
    
            || 'package_versions?select=sql,version'
    
    28
    
            || '&package_name=eq.supabase-dbdev'
    
    29
    
            || '&order=version.desc'
    
    30
    
            || '&limit=1',
    
    31
    
            array[
    
    32
    
                ('apiKey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s')::extensions.http_header
    
    33
    
            ],
    
    34
    
            null,
    
    35
    
            null
    
    36
    
        )
    
    37
    
    ) x,
    
    38
    
    lateral (
    
    39
    
        select
    
    40
    
            ((row_to_json(x) -> 'content') #>> '{}')::json -> 0
    
    41
    
    ) resp(contents);
    
    42
    
    create extension "supabase-dbdev";
    
    43
    
    select dbdev.install('supabase-dbdev');
    
    44
    
    drop extension if exists "supabase-dbdev";
    
    45
    
    create extension "supabase-dbdev";
    
    46
    
    -- Install test helpers
    
    47
    
    select dbdev.install('basejump-supabase_test_helpers');
    
    48
    
    create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';
    
    49
    
    50
    
    -- Verify setup with a no-op test
    
    51
    
    begin;
    
    52
    
    select plan(1);
    
    53
    
    select ok(true, 'Pre-test hook completed successfully');
    
    54
    
    select * from finish();
    
    55
    
    rollback;
[/code]

### Benefits#

This approach provides several advantages:

  * Reduces code duplication across test files
  * Ensures consistent test environment setup
  * Makes it easier to maintain and update shared dependencies
  * Provides immediate feedback if the setup process fails


Your subsequent test files (`001-auth-tests.sql`, `002-rls-tests.sql`) can focus solely on their specific test cases, knowing that the environment is properly configured.

## Example: Advanced RLS testing#

Here's a complete example using test helpers to verify RLS policies putting it all together:
[code] 
    1
    
    begin;
    
    2
    
    -- Assuming 000-setup-tests-hooks.sql file is present to use tests helpers
    
    3
    
    select plan(4);
    
    4
    
    5
    
    -- Set up test data
    
    6
    
    7
    
    -- Create test supabase users
    
    8
    
    select tests.create_supabase_user('user1@test.com');
    
    9
    
    select tests.create_supabase_user('user2@test.com');
    
    10
    
    11
    
    -- Create test data
    
    12
    
    insert into public.todos (task, user_id) values
    
    13
    
      ('User 1 Task 1', tests.get_supabase_uid('user1@test.com')),
    
    14
    
      ('User 1 Task 2', tests.get_supabase_uid('user1@test.com')),
    
    15
    
      ('User 2 Task 1', tests.get_supabase_uid('user2@test.com'));
    
    16
    
    17
    
    -- Test as User 1
    
    18
    
    select tests.authenticate_as('user1@test.com');
    
    19
    
    20
    
    -- Test 1: User 1 should only see their own todos
    
    21
    
    select results_eq(
    
    22
    
      'select count(*) from todos',
    
    23
    
      ARRAY[2::bigint],
    
    24
    
      'User 1 should only see their 2 todos'
    
    25
    
    );
    
    26
    
    27
    
    -- Test 2: User 1 can create their own todo
    
    28
    
    select lives_ok(
    
    29
    
      $$insert into todos (task, user_id) values ('New Task', tests.get_supabase_uid('user1@test.com'))$$,
    
    30
    
      'User 1 can create their own todo'
    
    31
    
    );
    
    32
    
    33
    
    -- Test as User 2
    
    34
    
    select tests.authenticate_as('user2@test.com');
    
    35
    
    36
    
    -- Test 3: User 2 should only see their own todos
    
    37
    
    select results_eq(
    
    38
    
      'select count(*) from todos',
    
    39
    
      ARRAY[1::bigint],
    
    40
    
      'User 2 should only see their 1 todo'
    
    41
    
    );
    
    42
    
    43
    
    -- Test 4: User 2 cannot modify User 1's todo
    
    44
    
    SELECT results_ne(
    
    45
    
        $$ update todos set task = 'Hacked!' where user_id = tests.get_supabase_uid('user1@test.com') returning 1 $$,
    
    46
    
        $$ values(1) $$,
    
    47
    
        'User 2 cannot modify User 1 todos'
    
    48
    
    );
    
    49
    
    50
    
    select * from finish();
    
    51
    
    rollback;
[/code]

## Not another todo app: Testing complex organizations#

Todo apps are great for learning, but this section explores testing a more realistic scenario: a multi-tenant content publishing platform. This example demonstrates testing complex permissions, plan restrictions, and content management.

### System overview#

This demo app implements:

  * Organizations with tiered plans (free/pro/enterprise)
  * Role-based access (owner/admin/editor/viewer)
  * Content management (posts/comments)
  * Premium content restrictions
  * Plan-based limitations


### What makes this complex?#

  1. **Layered Permissions**

     * Role hierarchies affect access rights
     * Plan types influence user capabilities
     * Content state (draft/published) affects permissions
  2. **Business Rules**

     * Free plan post limits
     * Premium content visibility
     * Cross-organization security


### Testing focus areas#

When writing tests, verify:

  * Organization member access control
  * Content visibility across roles
  * Plan limitation enforcement
  * Cross-organization data isolation


#### 1\. App schema definitions#

The app schema tables are defined like this:
[code] 
    1
    
    create table public.profiles (
    
    2
    
      id uuid references auth.users(id) primary key,
    
    3
    
      username text unique not null,
    
    4
    
      full_name text,
    
    5
    
      bio text,
    
    6
    
      created_at timestamptz default now(),
    
    7
    
      updated_at timestamptz default now()
    
    8
    
    );
    
    9
    
    10
    
    create table public.organizations (
    
    11
    
      id bigint primary key generated always as identity,
    
    12
    
      name text not null,
    
    13
    
      slug text unique not null,
    
    14
    
      plan_type text not null check (plan_type in ('free', 'pro', 'enterprise')),
    
    15
    
      max_posts int not null default 5,
    
    16
    
      created_at timestamptz default now()
    
    17
    
    );
    
    18
    
    19
    
    create table public.org_members (
    
    20
    
      org_id bigint references public.organizations(id) on delete cascade,
    
    21
    
      user_id uuid references auth.users(id) on delete cascade,
    
    22
    
      role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
    
    23
    
      created_at timestamptz default now(),
    
    24
    
      primary key (org_id, user_id)
    
    25
    
    );
    
    26
    
    27
    
    create table public.posts (
    
    28
    
      id bigint primary key generated always as identity,
    
    29
    
      title text not null,
    
    30
    
      content text not null,
    
    31
    
      author_id uuid references public.profiles(id) not null,
    
    32
    
      org_id bigint references public.organizations(id),
    
    33
    
      status text not null check (status in ('draft', 'published', 'archived')),
    
    34
    
      is_premium boolean default false,
    
    35
    
      scheduled_for timestamptz,
    
    36
    
      category text,
    
    37
    
      view_count int default 0,
    
    38
    
      published_at timestamptz,
    
    39
    
      created_at timestamptz default now(),
    
    40
    
      updated_at timestamptz default now()
    
    41
    
    );
    
    42
    
    43
    
    create table public.comments (
    
    44
    
      id bigint primary key generated always as identity,
    
    45
    
      post_id bigint references public.posts(id) on delete cascade,
    
    46
    
      author_id uuid references public.profiles(id),
    
    47
    
      content text not null,
    
    48
    
      is_deleted boolean default false,
    
    49
    
      created_at timestamptz default now(),
    
    50
    
      updated_at timestamptz default now()
    
    51
    
    );
[/code]

#### 2\. Grant role privileges#

Grant the necessary privileges for each role, ensuring the principle of least privilege is followed:
[code] 
    1
    
    -- Grant the privileges that roles need
    
    2
    
    GRANT SELECT ON public.profiles TO anon;
    
    3
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
    
    4
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
    
    5
    
    6
    
    GRANT SELECT ON public.organizations TO anon;
    
    7
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
    
    8
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;
    
    9
    
    10
    
    GRANT SELECT ON public.org_members TO anon;
    
    11
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
    
    12
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO service_role;
    
    13
    
    14
    
    GRANT SELECT ON public.posts TO anon;
    
    15
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
    
    16
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO service_role;
    
    17
    
    18
    
    GRANT SELECT ON public.comments TO anon;
    
    19
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
    
    20
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO service_role;
[/code]

#### 3\. RLS policies declaration#

Now to setup the RLS policies for each tables:
[code] 
    1
    
    -- Create a private schema to store all security definer functions utils
    
    2
    
    -- As such functions should never be in an API exposed schema
    
    3
    
    create schema if not exists private;
    
    4
    
    -- Helper function for role checks
    
    5
    
    create or replace function private.get_user_org_role(org_id bigint, user_id uuid)
    
    6
    
    returns text
    
    7
    
    set search_path = ''
    
    8
    
    as $$
    
    9
    
      select role from public.org_members
    
    10
    
      where org_id = $1 and user_id = $2;
    
    11
    
    -- Note the use of security definer to avoid RLS checking recursion issue
    
    12
    
    -- see: https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions
    
    13
    
    $$ language sql security definer;
    
    14
    
    -- Helper utils to check if an org is below the max post limit
    
    15
    
    create or replace function private.can_add_post(org_id bigint)
    
    16
    
    returns boolean
    
    17
    
    set search_path = ''
    
    18
    
    as $$
    
    19
    
      select (select count(*)
    
    20
    
              from public.posts p
    
    21
    
              where p.org_id = $1) < o.max_posts
    
    22
    
      from public.organizations o
    
    23
    
      where o.id = $1
    
    24
    
    $$ language sql security definer;
    
    25
    
    26
    
    27
    
    -- Enable RLS for all tables
    
    28
    
    alter table public.profiles enable row level security;
    
    29
    
    alter table public.organizations enable row level security;
    
    30
    
    alter table public.org_members enable row level security;
    
    31
    
    alter table public.posts enable row level security;
    
    32
    
    alter table public.comments enable row level security;
    
    33
    
    34
    
    -- Profiles policies
    
    35
    
    create policy "Public profiles are viewable by everyone"
    
    36
    
      on public.profiles for select using (true);
    
    37
    
    38
    
    create policy "Users can insert their own profile"
    
    39
    
      on public.profiles for insert with check ((select auth.uid()) = id);
    
    40
    
    41
    
    create policy "Users can update their own profile"
    
    42
    
      on public.profiles for update using ((select auth.uid()) = id)
    
    43
    
      with check ((select auth.uid()) = id);
    
    44
    
    45
    
    -- Organizations policies
    
    46
    
    create policy "Public org info visible to all"
    
    47
    
      on public.organizations for select using (true);
    
    48
    
    49
    
    create policy "Org management restricted to owners"
    
    50
    
      on public.organizations for all using (
    
    51
    
        private.get_user_org_role(id, (select auth.uid())) = 'owner'
    
    52
    
      );
    
    53
    
    54
    
    -- Org Members policies
    
    55
    
    create policy "Members visible to org members"
    
    56
    
      on public.org_members for select using (
    
    57
    
        private.get_user_org_role(org_id, (select auth.uid())) is not null
    
    58
    
      );
    
    59
    
    60
    
    create policy "Member management restricted to admins and owners"
    
    61
    
      on public.org_members for all using (
    
    62
    
        private.get_user_org_role(org_id, (select auth.uid())) in ('owner', 'admin')
    
    63
    
      );
    
    64
    
    65
    
    -- Posts policies
    
    66
    
    create policy "Complex post visibility"
    
    67
    
      on public.posts for select using (
    
    68
    
        -- Published non-premium posts are visible to all
    
    69
    
        (status = 'published' and not is_premium)
    
    70
    
        or
    
    71
    
        -- Premium posts visible to org members only
    
    72
    
        (status = 'published' and is_premium and
    
    73
    
        private.get_user_org_role(org_id, (select auth.uid())) is not null)
    
    74
    
        or
    
    75
    
        -- All posts visible to editors and above
    
    76
    
        private.get_user_org_role(org_id, (select auth.uid())) in ('owner', 'admin', 'editor')
    
    77
    
      );
    
    78
    
    79
    
    create policy "Post creation rules"
    
    80
    
      on public.posts for insert with check (
    
    81
    
        -- Must be org member with appropriate role
    
    82
    
        private.get_user_org_role(org_id, (select auth.uid())) in ('owner', 'admin', 'editor')
    
    83
    
        and
    
    84
    
        -- Check org post limits for free plans
    
    85
    
        (
    
    86
    
          (select o.plan_type != 'free'
    
    87
    
          from organizations o
    
    88
    
          where o.id = org_id)
    
    89
    
          or
    
    90
    
          (select private.can_add_post(org_id))
    
    91
    
        )
    
    92
    
      );
    
    93
    
    94
    
    create policy "Post update rules"
    
    95
    
      on public.posts for update using (
    
    96
    
        exists (
    
    97
    
          select 1
    
    98
    
          where
    
    99
    
            -- Editors can update non-published posts
    
    100
    
            (private.get_user_org_role(org_id, (select auth.uid())) = 'editor' and status != 'published')
    
    101
    
            or
    
    102
    
            -- Admins and owners can update any post
    
    103
    
            private.get_user_org_role(org_id, (select auth.uid())) in ('owner', 'admin')
    
    104
    
        )
    
    105
    
      );
    
    106
    
    107
    
    -- Comments policies
    
    108
    
    create policy "Comments on published posts are viewable by everyone"
    
    109
    
      on public.comments for select using (
    
    110
    
        exists (
    
    111
    
          select 1 from public.posts
    
    112
    
          where id = post_id
    
    113
    
          and status = 'published'
    
    114
    
        )
    
    115
    
        and not is_deleted
    
    116
    
      );
    
    117
    
    118
    
    create policy "Authenticated users can create comments"
    
    119
    
      on public.comments for insert with check ((select auth.uid()) = author_id);
    
    120
    
    121
    
    create policy "Users can update their own comments"
    
    122
    
      on public.comments for update using (author_id = (select auth.uid()));
[/code]

#### 4\. Test cases:#

With setup complete, write RLS test cases. Each section can be in its own test:
[code] 
    1
    
    -- Assuming we already have: 000-setup-tests-hooks.sql file we can use tests helpers
    
    2
    
    begin;
    
    3
    
    -- Declare total number of tests
    
    4
    
    select plan(10);
    
    5
    
    6
    
    -- Create test users
    
    7
    
    select tests.create_supabase_user('org_owner', 'owner@test.com');
    
    8
    
    select tests.create_supabase_user('org_admin', 'admin@test.com');
    
    9
    
    select tests.create_supabase_user('org_editor', 'editor@test.com');
    
    10
    
    select tests.create_supabase_user('premium_user', 'premium@test.com');
    
    11
    
    select tests.create_supabase_user('free_user', 'free@test.com');
    
    12
    
    select tests.create_supabase_user('scheduler', 'scheduler@test.com');
    
    13
    
    select tests.create_supabase_user('free_author', 'free_author@test.com');
    
    14
    
    15
    
    -- Create profiles for test users
    
    16
    
    insert into profiles (id, username, full_name)
    
    17
    
    values
    
    18
    
      (tests.get_supabase_uid('org_owner'), 'org_owner', 'Organization Owner'),
    
    19
    
      (tests.get_supabase_uid('org_admin'), 'org_admin', 'Organization Admin'),
    
    20
    
      (tests.get_supabase_uid('org_editor'), 'org_editor', 'Organization Editor'),
    
    21
    
      (tests.get_supabase_uid('premium_user'), 'premium_user', 'Premium User'),
    
    22
    
      (tests.get_supabase_uid('free_user'), 'free_user', 'Free User'),
    
    23
    
      (tests.get_supabase_uid('scheduler'), 'scheduler', 'Scheduler User'),
    
    24
    
      (tests.get_supabase_uid('free_author'), 'free_author', 'Free Author');
    
    25
    
    26
    
    -- First authenticate as service role to bypass RLS for initial setup
    
    27
    
    select tests.authenticate_as_service_role();
    
    28
    
    29
    
    -- Create test organizations and setup data
    
    30
    
    with new_org as (
    
    31
    
      insert into organizations (name, slug, plan_type, max_posts)
    
    32
    
      values
    
    33
    
        ('Test Org', 'test-org', 'pro', 100),
    
    34
    
        ('Premium Org', 'premium-org', 'enterprise', 1000),
    
    35
    
        ('Schedule Org', 'schedule-org', 'pro', 100),
    
    36
    
        ('Free Org', 'free-org', 'free', 2)
    
    37
    
      returning id, slug
    
    38
    
    ),
    
    39
    
    -- Setup members and posts
    
    40
    
    member_setup as (
    
    41
    
      insert into org_members (org_id, user_id, role)
    
    42
    
      select
    
    43
    
        org.id,
    
    44
    
        user_id,
    
    45
    
        role
    
    46
    
      from new_org org cross join (
    
    47
    
        values
    
    48
    
          (tests.get_supabase_uid('org_owner'), 'owner'),
    
    49
    
          (tests.get_supabase_uid('org_admin'), 'admin'),
    
    50
    
          (tests.get_supabase_uid('org_editor'), 'editor'),
    
    51
    
          (tests.get_supabase_uid('premium_user'), 'viewer'),
    
    52
    
          (tests.get_supabase_uid('scheduler'), 'editor'),
    
    53
    
          (tests.get_supabase_uid('free_author'), 'editor')
    
    54
    
      ) as members(user_id, role)
    
    55
    
      where org.slug = 'test-org'
    
    56
    
         or (org.slug = 'premium-org' and role = 'viewer')
    
    57
    
         or (org.slug = 'schedule-org' and role = 'editor')
    
    58
    
         or (org.slug = 'free-org' and role = 'editor')
    
    59
    
    )
    
    60
    
    -- Setup initial posts
    
    61
    
    insert into posts (title, content, org_id, author_id, status, is_premium, scheduled_for)
    
    62
    
    select
    
    63
    
      title,
    
    64
    
      content,
    
    65
    
      org.id,
    
    66
    
      author_id,
    
    67
    
      status,
    
    68
    
      is_premium,
    
    69
    
      scheduled_for
    
    70
    
    from new_org org cross join (
    
    71
    
      values
    
    72
    
        ('Premium Post', 'Premium content', tests.get_supabase_uid('premium_user'), 'published', true, null),
    
    73
    
        ('Free Post', 'Free content', tests.get_supabase_uid('premium_user'), 'published', false, null),
    
    74
    
        ('Future Post', 'Future content', tests.get_supabase_uid('scheduler'), 'published', false, '2024-01-02 12:00:00+00'::timestamptz)
    
    75
    
    ) as posts(title, content, author_id, status, is_premium, scheduled_for)
    
    76
    
    where org.slug in ('premium-org', 'schedule-org');
    
    77
    
    78
    
    -- Test owner privileges
    
    79
    
    select tests.authenticate_as('org_owner');
    
    80
    
    select lives_ok(
    
    81
    
      $$
    
    82
    
        update organizations
    
    83
    
        set name = 'Updated Org'
    
    84
    
        where id = (select id from organizations limit 1)
    
    85
    
      $$,
    
    86
    
      'Owner can update organization'
    
    87
    
    );
    
    88
    
    89
    
    -- Test admin privileges
    
    90
    
    select tests.authenticate_as('org_admin');
    
    91
    
    select results_eq(
    
    92
    
        $$select count(*) from org_members$$,
    
    93
    
        ARRAY[6::bigint],
    
    94
    
        'Admin can view all members'
    
    95
    
    );
    
    96
    
    97
    
    -- Test editor restrictions
    
    98
    
    select tests.authenticate_as('org_editor');
    
    99
    
    select throws_ok(
    
    100
    
      $$
    
    101
    
        insert into org_members (org_id, user_id, role)
    
    102
    
        values (
    
    103
    
          (select id from organizations limit 1),
    
    104
    
          (select tests.get_supabase_uid('org_editor')),
    
    105
    
          'viewer'
    
    106
    
        )
    
    107
    
      $$,
    
    108
    
      '42501',
    
    109
    
      'new row violates row-level security policy for table "org_members"',
    
    110
    
      'Editor cannot manage members'
    
    111
    
    );
    
    112
    
    113
    
    -- Premium Content Access Tests
    
    114
    
    select tests.authenticate_as('premium_user');
    
    115
    
    select results_eq(
    
    116
    
        $$select count(*) from posts where org_id = (select id from organizations where slug = 'premium-org')$$,
    
    117
    
        ARRAY[3::bigint],
    
    118
    
        'Premium user can see all posts'
    
    119
    
    );
    
    120
    
    121
    
    select tests.clear_authentication();
    
    122
    
    select results_eq(
    
    123
    
        $$select count(*) from posts where org_id = (select id from organizations where slug = 'premium-org')$$,
    
    124
    
        ARRAY[2::bigint],
    
    125
    
        'Anonymous users can only see free posts'
    
    126
    
    );
    
    127
    
    128
    
    -- Time-Based Publishing Tests
    
    129
    
    select tests.authenticate_as('scheduler');
    
    130
    
    select tests.freeze_time('2024-01-01 12:00:00+00'::timestamptz);
    
    131
    
    132
    
    select results_eq(
    
    133
    
        $$select count(*) from posts where scheduled_for > now() and org_id = (select id from organizations where slug = 'schedule-org')$$,
    
    134
    
        ARRAY[1::bigint],
    
    135
    
        'Can see scheduled posts'
    
    136
    
    );
    
    137
    
    138
    
    select tests.freeze_time('2024-01-02 13:00:00+00'::timestamptz);
    
    139
    
    140
    
    select results_eq(
    
    141
    
        $$select count(*) from posts where scheduled_for < now() and org_id = (select id from organizations where slug = 'schedule-org')$$,
    
    142
    
        ARRAY[1::bigint],
    
    143
    
        'Can see posts after schedule time'
    
    144
    
    );
    
    145
    
    146
    
    select tests.unfreeze_time();
    
    147
    
    148
    
    -- Plan Limit Tests
    
    149
    
    select tests.authenticate_as('free_author');
    
    150
    
    151
    
    select lives_ok(
    
    152
    
      $$
    
    153
    
        insert into posts (title, content, org_id, author_id, status)
    
    154
    
        select 'Post 1', 'Content 1', id, auth.uid(), 'draft'
    
    155
    
        from organizations where slug = 'free-org' limit 1
    
    156
    
      $$,
    
    157
    
      'First post creates successfully'
    
    158
    
    );
    
    159
    
    160
    
    select lives_ok(
    
    161
    
      $$
    
    162
    
        insert into posts (title, content, org_id, author_id, status)
    
    163
    
        select 'Post 2', 'Content 2', id, auth.uid(), 'draft'
    
    164
    
        from organizations where slug = 'free-org' limit 1
    
    165
    
      $$,
    
    166
    
      'Second post creates successfully'
    
    167
    
    );
    
    168
    
    169
    
    select throws_ok(
    
    170
    
      $$
    
    171
    
        insert into posts (title, content, org_id, author_id, status)
    
    172
    
        select 'Post 3', 'Content 3', id, auth.uid(), 'draft'
    
    173
    
        from organizations where slug = 'free-org' limit 1
    
    174
    
      $$,
    
    175
    
      '42501',
    
    176
    
      'new row violates row-level security policy for table "posts"',
    
    177
    
      'Cannot exceed free plan post limit'
    
    178
    
    );
    
    179
    
    180
    
    select * from finish();
    
    181
    
    rollback;
[/code]

## Additional resources#

  * [Test Helpers Documentation](<https://database.dev/basejump/supabase_test_helpers>)
  * [Test Helpers Reference](<https://github.com/usebasejump/supabase-test-helpers>)
  * [Row Level Security Writing Guide](<https://usebasejump.com/blog/testing-on-supabase-with-pgtap>)
  * [Database.dev Package Registry](<https://database.dev>)
  * [Row Level Security Performance and Best Practices](<https://github.com/orgs/supabase/discussions/14576>)