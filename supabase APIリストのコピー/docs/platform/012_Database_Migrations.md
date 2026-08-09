---
タイトル: Database Migrations
URL: https://supabase.com/docs/guides/deployment/database-migrations
カテゴリ: platform
更新日: 2026-08-02
タグ: database, database-migrations, deployment, migrations, platform
---

# Database Migrations

**URL:** https://supabase.com/docs/guides/deployment/database-migrations
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** database, database-migrations, deployment, migrations, platform

## 目次

- [Schema migrations#](#schema-migrations)
  - [Seeding data#](#seeding-data)
  - [Diffing changes#](#diffing-changes)
- [Deploy your project#](#deploy-your-project)
- [Working with a team#](#working-with-a-team)
- [Diagnosing and fixing sync errors#](#diagnosing-and-fixing-sync-errors)
  - [How migration tracking works#](#how-migration-tracking-works)
  - [Step 1: Check what's out of sync#](#step-1-check-whats-out-of-sync)
  - [Step 2: If you made changes on the remote database directly#](#step-2-if-you-made-changes-on-the-remote-database-directly)
  - [Step 3: If the migration history table is wrong#](#step-3-if-the-migration-history-table-is-wrong)

## 概要

How to manage schema migrations for your Supabase project.

---

Database migrations are SQL statements that create, update, or delete your existing database schemas. They are a common way of tracking changes to your database over time.

## Schema migrations#

For this guide, we'll create a table called `employees` and see how we can make changes to it.

You will need to [install](</docs/guides/local-development#quickstart>) the Supabase CLI and start the local development stack.

If a lock timeout error occurs, in your migration file, consider increasing your [`lock_timeout`](<https://postgresqlco.nf/doc/en/param/lock_timeout/>) setting.

1

Create your first migration file

To get started, generate a [new migration](</docs/reference/cli/supabase-migration-new>) to store the SQL needed to create our `employees` table.

Terminal
[code]
    1
    
    supabase migration new create_employees_table
[/code]

2

Add the SQL to your migration file

This creates a new migration file in supabase/migrations directory.

To that file, add the SQL to create this `employees` table.

supabase/migrations/<timestamp>_create_employees_table.sql
[code]
    1
    
    create table if not exists employees (
    
    2
    
      id bigint primary key generated always as identity,
    
    3
    
      name text not null,
    
    4
    
      email text,
    
    5
    
      created_at timestamptz default now()
    
    6
    
    );
[/code]

3

Apply your first migration

Run this migration to create the `employees` table.

Now you can visit your new `employees` table in the local Dashboard.

Terminal
[code]
    1
    
    supabase migration up
[/code]

4

Modify your employees table

Next, modify your `employees` table by adding a column for `department`.

Terminal
[code]
    1
    
    supabase migration new add_department_column
[/code]

5

Add a new column to your table

To that new migration file, add the SQL to create a new `department` column.

supabase/migrations/<timestamp>_add_department_column.sql
[code]
    1
    
    alter table if exists public.employees
    
    2
    
    add department text default 'Hooli';
[/code]

6

Apply your second migration

Run this migration to update your existing `employees` table.

Terminal
[code]
    1
    
    supabase migration up
[/code]

Finally, you should see the `department` column added to your `employees` table in the local Dashboard.

View the [complete code](<https://github.com/supabase/supabase/tree/master/examples/database/employees>) for this example on GitHub.

### Seeding data#

Now that you are managing your database with migrations, it would be great have some seed data to use every time you reset the database.

1

Populate your table

Create a seed script in supabase/seed.sql.

To that file, add the SQL to insert data into your `employees` table.

supabase/seed.sql
[code]
    1
    
    insert into public.employees
    
    2
    
      (name)
    
    3
    
    values
    
    4
    
      ('Erlich Bachman'),
    
    5
    
      ('Richard Hendricks'),
    
    6
    
      ('Monica Hall');
[/code]

2

Reset your database

Reset your database to reapply migrations and populate with seed data.

Terminal
[code]
    1
    
    supabase db reset
[/code]

You should now see the `employees` table, along with your seed data in the Dashboard! All of your database changes are captured in code, and you can reset to a known state at any time, complete with seed data.

### Diffing changes#

This workflow is great if you know SQL and are comfortable creating tables and columns. If not, you can still use the Dashboard to create tables and columns, and then use the CLI to diff your changes and create migrations.

Only use the Dashboard to make schema changes on your **local** database, then capture them with `supabase db diff`. Making schema changes directly on your **remote** database (via the SQL editor or Table Editor) bypasses the migration history and will cause `db push` to fail with sync errors. Once you're using migrations, all schema changes to your remote database should go through migration files only.

1

Create your table from the Dashboard

Create a new table called `cities`, with columns `id`, `name` and `population`.

Then generate a [schema diff](</docs/reference/cli/supabase-db-diff>).

Terminal
[code]
    1
    
    supabase db diff -f create_cities_table
[/code]

2

Add schema diff as a migration

A new migration file is created for you.

Alternately, you can copy the table definitions directly from the Table Editor.

supabase/migrations/<timestamp>_create_cities_table.sql
[code]
    1
    
    create table "public"."cities" (
    
    2
    
      "id" bigint primary key generated always as identity,
    
    3
    
      "name" text,
    
    4
    
      "population" bigint
    
    5
    
    );
[/code]

3

Test your migration

Test your new migration file by resetting your local database.

Terminal
[code]
    1
    
    supabase db reset
[/code]

The last step is deploying these changes to a live Supabase project.

## Deploy your project#

You've been developing your project locally, making changes to your tables via migrations. It's time to deploy your project to the Supabase Platform and start scaling up to millions of users!

Head over to [Supabase](</dashboard>) and create a new project to deploy to.

1

Log in to the Supabase CLI

[Login](</docs/reference/cli/supabase-login>) to the Supabase CLI using an auto-generated Personal Access Token.

Terminal
[code]
    1
    
    supabase login
[/code]

2

Link your project

[Link](</docs/reference/cli/supabase-link>) to your remote project by selecting from the on-screen prompt.

Terminal
[code]
    1
    
    supabase link
[/code]

3

Deploy database migrations

[Push](</docs/reference/cli/supabase-db-push>) your migrations to the remote database.

Terminal
[code]
    1
    
    supabase db push
[/code]

4

Deploy database seed data (optional)

[Push](</docs/reference/cli/supabase-db-push>) your migrations and seed the remote database.

Terminal
[code]
    1
    
    supabase db push --include-seed
[/code]

Visiting your live project on [Supabase](</dashboard/project/_>), you'll see a new `employees` table, complete with the `department` column you added in the second migration above.

## Working with a team#

When multiple developers share a Supabase project, a few rules keep migrations from getting out of sync.

**The golden rule: never change the remote database directly.** Once you're using migrations, all schema changes — even small ones — should go through migration files. Using the Dashboard's SQL editor or Table Editor on your remote database bypasses the migration history, and `db push` will start failing with sync errors.

**The team workflow:**

1

Create a migration locally

Each developer creates migration files on their own branch, never touching the remote database directly.

Terminal
[code]
    1
    
    supabase migration new your_change_description
[/code]

2

Test and commit

Reset your local database to apply the migration, then commit the migration file to git.

Terminal
[code]
    1
    
    supabase db reset
    
    2
    
    git add supabase/migrations
    
    3
    
    git commit -m "add migration: your_change_description"
[/code]

3

Pull and reset when a teammate merges a migration

After pulling new migration files from git, reset your local database to apply them.

Terminal
[code]
    1
    
    git pull
    
    2
    
    supabase db reset
[/code]

4

One person deploys to remote

Coordinate so only one person runs `db push` at a time. Migration files are applied in timestamp order, so concurrent pushes from different machines can cause conflicts.

Terminal
[code]
    1
    
    supabase db push
[/code]

For a more automated deployment approach, consider using [Supabase Branching](</docs/guides/deployment/branching>) or a CI/CD pipeline that runs `supabase db push` on merge to your main branch.

## Diagnosing and fixing sync errors#

If `db push` fails with errors suggesting you run `supabase migration repair`, your local migration files and the remote database's migration history are out of sync. Here's how to diagnose and fix it.

### How migration tracking works#

Supabase tracks which migrations have been applied on each database in a table called `supabase_migrations.schema_migrations`. When you run `supabase db push`, it compares your local `supabase/migrations` folder against that table and runs only the ones not yet applied, in order.

Git tracks your migration _files_. Supabase tracks what's been _applied to each database_. These are two separate systems that need to stay in sync.

### Step 1: Check what's out of sync#

Start by listing the migration status across local and remote:

Terminal
[code]
    1
    
    supabase migration list
[/code]

This shows which migrations are applied locally, which are applied on the remote, and where they diverge.

### Step 2: If you made changes on the remote database directly#

Pull the current remote state into a migration file to get back in sync:

Terminal
[code]
    1
    
    supabase db pull
[/code]

This creates a new migration file capturing the current remote schema. Commit it to git, then follow the standard workflow going forward.

### Step 3: If the migration history table is wrong#

If a migration shows as missing in the remote history table but the schema change is already there (for example, it was applied manually), you can mark it as applied without re-running it:

Terminal
[code]
    1
    
    supabase migration repair --status applied <migration-timestamp>
[/code]

Or if a migration is recorded as applied but was never run:

Terminal
[code]
    1
    
    supabase migration repair --status reverted <migration-timestamp>
[/code]

`migration repair` updates the tracking table only — it does not apply or revert any SQL. Use it to correct the history record when you know the actual database state is correct.