---
タイトル: Use Supabase with Laravel
URL: https://supabase.com/docs/guides/getting-started/quickstarts/laravel
カテゴリ: getting-started
更新日: 2026-08-02
タグ: getting-started, laravel, quickstarts, supabase, with
---

# Use Supabase with Laravel

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/laravel
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** getting-started, laravel, quickstarts, supabase, with

## 目次

- [1. Create a Supabase project#](#1-create-a-supabase-project)
- [2. Set up your database#](#2-set-up-your-database)
- [3. Create a Laravel project#](#3-create-a-laravel-project)
- [4. Install Agent Skills (optional)#](#4-install-agent-skills-optional)
- [5. Install the authentication template#](#5-install-the-authentication-template)
- [6. Set up the Postgres connection details#](#6-set-up-the-postgres-connection-details)
- [7. Change the default schema#](#7-change-the-default-schema)
- [8. Run the database migrations#](#8-run-the-database-migrations)
- [9. Start the app#](#9-start-the-app)

## 概要

Learn how to create a PHP Laravel project, connect it to your Supabase Postgres database, and configure user authentication.

---

AI Prompt

Help me add Supabase to my Laravel project. Create a Supabase project at database.new. Then: 1\. Run `composer create-project laravel/laravel example-app` to scaffold the project. 2\. Install Laravel Breeze with `composer require laravel/breeze --dev && php artisan breeze:install`. 3\. Copy the Session Pooler connection string from the Supabase Connect panel and set `DB_URL` in `.env`. 4\. Set `search_path` to a custom schema (e.g. `laravel`) in `config/database.php`. 5\. Run `php artisan migrate` to apply database migrations. 6\. Run `php artisan serve` and open http://127.0.0.1:8000. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/laravel.md

Show more

## 1\. Create a Supabase project#

To start, you need a Supabase project.

Create a new Supabase project from [the Dashboard of any organization](</dashboard/new/_>) you belong to.

Want to create a project programmatically?

Use [the Management API](</docs/reference/api/v1-create-a-project>) or ask [the MCP server](</docs/guides/ai-tools/mcp#account-management>) to create a new Supabase project.

## 2\. Set up your database#

When your Supabase project is up and running, create an `instruments` table with some sample data. Then set only the privileges each Postgres role needs, add [Row Level Security (RLS)](</docs/guides/database/postgres/row-level-security>) for enhanced security for database data by default, and create an RLS policy to make the data in the table publicly readable.

Do these steps within your project's dashboard by copying and running the snippet in your project's [SQL Editor](</dashboard/project/_/sql/new>).

Save some steps by [clicking here to prefill the SQL](</dashboard/project/_/sql/new?content=--%20Create%20the%20table%0Acreate%20table%20instruments%20\(%0A%20%20id%20bigint%20primary%20key%20generated%20always%20as%20identity%2C%0A%20%20name%20text%20not%20null%0A\)%3B%0A%0A--%20Insert%20sample%20data%20into%20the%20table%0Ainsert%20into%20instruments%20\(name\)%0Avalues%0A\('violin'\)%2C%0A\('viola'\)%2C%0A\('cello'\)%3B%0A%0A--%20Grant%20the%20privileges%20the%20role%20needs%2C%20which%20is%20read%20access%0Agrant%20select%20on%20public.instruments%20to%20anon%3B%0A%0A--%20Enable%20row%20level%20security%20for%20the%20table%0Aalter%20table%20instruments%20enable%20row%20level%20security%3B%0A%0A--%20Create%20a%20policy%20to%20allow%20the%20anon%20role%20to%20read%20from%20the%20instruments%20table%0Acreate%20policy%20%22public%20can%20read%20instruments%22%0Aon%20public.instruments%0Afor%20select%20to%20anon%0Ausing%20\(true\)%3B>) in the SQL Editor, and then clicking **Run**.

Want to setup the database programmatically?

You can use [the Management API](</docs/reference/api/v1-run-a-query>) or ask [the MCP server](</docs/guides/ai-tools/mcp#database>) to execute SQL queries.
[code] 
    1
    
    -- Create the table
    
    2
    
    create table instruments (
    
    3
    
      id bigint primary key generated always as identity,
    
    4
    
      name text not null
    
    5
    
    );
    
    6
    
    7
    
    -- Insert sample data into the table
    
    8
    
    insert into instruments (name)
    
    9
    
    values
    
    10
    
      ('violin'),
    
    11
    
      ('viola'),
    
    12
    
      ('cello');
    
    13
    
    14
    
    -- Grant the privileges the role needs, which is read access
    
    15
    
    grant select on public.instruments to anon;
    
    16
    
    17
    
    -- Enable row level security for the table
    
    18
    
    alter table instruments enable row level security;
    
    19
    
    20
    
    -- Create a policy to allow the anon role to read from the instruments table
    
    21
    
    create policy "public can read instruments"
    
    22
    
    on public.instruments
    
    23
    
    for select to anon
    
    24
    
    using (true);
[/code]

If you disabled the Data API during project setup, enable it in the [**Integrations > Data API**](</dashboard/project/_/integrations/data_api/settings>) section of the Dashboard and expose the specific tables or functions you want to access. To automatically grant access for new tables and functions in `public`, enable **Automatically expose new tables**.

## 3\. Create a Laravel project#

Make sure your PHP and Composer versions are up to date, then use `composer create-project` to scaffold a new Laravel project.

See the [Laravel docs](<https://laravel.com/docs/10.x/installation#creating-a-laravel-project>) for more details.
[code] 
    1
    
    composer create-project laravel/laravel example-app
[/code]

## 4\. Install Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 5\. Install the authentication template#

Install [Laravel Breeze](<https://laravel.com/docs/10.x/starter-kits#laravel-breeze>), a basic implementation of all of Laravel's [authentication features](<https://laravel.com/docs/10.x/authentication>).
[code] 
    1
    
    composer require laravel/breeze --dev
    
    2
    
    php artisan breeze:install
[/code]

## 6\. Set up the Postgres connection details#

Go to [database.new](<https://database.new>) and create a new Supabase project. Save your database password securely.

When your project is up and running, navigate to your project dashboard and click on [Connect](</dashboard/project/_?showConnect=true&method=session>).

Look for the Session Pooler connection string and copy the string. You will need to replace the Password with your saved database password. You can reset your database password in your [Database Settings](</dashboard/project/_/database/settings>) if you do not have it.

If you're in an [IPv6 environment](<https://github.com/orgs/supabase/discussions/27034>) or have the IPv4 Add-On, you can use the direct connection string instead of Supavisor in Session mode.

.env
[code]
    1
    
    DB_CONNECTION=pgsql
    
    2
    
    DB_URL=postgres://postgres.xxxx:password@xxxx.pooler.supabase.com:5432/postgres
[/code]

## 7\. Change the default schema#

By default Laravel uses the `public` schema. We recommend changing this as Supabase exposes the `public` schema as a [data API](</docs/guides/api>).

You can change the schema of your Laravel application by modifying the `search_path` variable `app/config/database.php`.

The schema you specify in `search_path` has to exist on Supabase. You can create a new schema from the [Table Editor](</dashboard/project/_/editor>).

app/config/database.php
[code]
    1
    
    'pgsql' => [
    
    2
    
        'driver' => 'pgsql',
    
    3
    
        'url' => env('DB_URL'),
    
    4
    
        'host' => env('DB_HOST', '127.0.0.1'),
    
    5
    
        'port' => env('DB_PORT', '5432'),
    
    6
    
        'database' => env('DB_DATABASE', 'laravel'),
    
    7
    
        'username' => env('DB_USERNAME', 'root'),
    
    8
    
        'password' => env('DB_PASSWORD', ''),
    
    9
    
        'charset' => env('DB_CHARSET', 'utf8'),
    
    10
    
        'prefix' => '',
    
    11
    
        'prefix_indexes' => true,
    
    12
    
        'search_path' => 'laravel',
    
    13
    
        'sslmode' => 'prefer',
    
    14
    
    ],
[/code]

## 8\. Run the database migrations#

Laravel ships with database migration files that set up the required tables for Laravel Authentication and User Management.

Note: Laravel does not use Supabase Auth but rather implements its own authentication system!
[code] 
    1
    
    php artisan migrate
[/code]

## 9\. Start the app#

Run the development server. Go to <http://127.0.0.1:8000>[](<http://127.0.0.1:8000>) in a browser to see your application. You can also navigate to <http://127.0.0.1:8000/register>[](<http://127.0.0.1:8000/register>) and <http://127.0.0.1:8000/login>[](<http://127.0.0.1:8000/login>) to register and log in users.
[code] 
    1
    
    php artisan serve
[/code]