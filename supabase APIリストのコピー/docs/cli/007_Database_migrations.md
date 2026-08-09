---
タイトル: Database migrations
URL: https://supabase.com/docs/guides/local-development/database-migrations
カテゴリ: cli
更新日: 2026-08-02
タグ: cli, database, database-migrations, local-development, migrations
---

# Database migrations

**URL:** https://supabase.com/docs/guides/local-development/database-migrations
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** cli, database, database-migrations, local-development, migrations

## 目次

- [Database migrations#](#database-migrations)
  - [Add sample data#](#add-sample-data)
  - [Diffing changes#](#diffing-changes)
- [Deploy your project#](#deploy-your-project)
  - [Log in to the Supabase CLI#](#log-in-to-the-supabase-cli)
  - [Link your project#](#link-your-project)
  - [Deploy database changes#](#deploy-database-changes)
  - [Deploy Edge Functions#](#deploy-edge-functions)
  - [Use Auth locally#](#use-auth-locally)
  - [Sync storage buckets#](#sync-storage-buckets)
  - [Sync any schema with--schema#](#sync-any-schema-with---schema)
- [Limitations and considerations#](#limitations-and-considerations)

## 概要

Track and version your database schema changes with migrations.

---

Supabase is a flexible platform that lets you decide how you want to build your projects. You can use the Dashboard directly to get up and running, or use a proper local setup. We suggest you work locally and deploy your changes to a linked project on the [Supabase Platform](<https://app.supabase.io/>).

Develop locally using the CLI to run a local Supabase stack. You can use the integrated Studio Dashboard to make changes, then capture your changes in schema migration files, which can be saved in version control.

Alternatively, if you're comfortable with migration files and SQL, you can write your own migrations and push them to the local database for testing before sharing your changes.

This page is a focused tutorial on migrations. If you want to move an existing platform project to local development, or set up a reproducible project from scratch and take it all the way to a remote deploy, see the [Local development workflow](</docs/guides/local-development/cli-workflows>) guide. It covers both starting points, the daily development loop, pushing to production, cleaning up generated migrations, and troubleshooting.

## Database migrations#

Database changes are managed through "migrations." Database migrations are a common way of tracking changes to your database over time.

For this guide, we'll create a table called `employees` and see how we can make changes to it.

1

Create your first migration file

To get started, generate a [new migration](</docs/reference/cli/supabase-migration-new>) to store the SQL needed to create our `employees` table

Terminal
[code]
    1
    
    supabase migration new create_employees_table
[/code]

2

Add the SQL to your migration file

This creates a new migration: supabase/migrations/<timestamp> _create_employees_table.sql.

To that file, add the SQL to create this `employees` table

20250101000000_create_employees_table.sql
[code]
    1
    
    create table employees (
    
    2
    
      id bigint primary key generated always as identity,
    
    3
    
      name text,
    
    4
    
      email text,
    
    5
    
      created_at timestamptz default now()
    
    6
    
    );
[/code]

3

Apply your migration

Now that you have a migration file, you can run this migration and create the `employees` table.

Use the `reset` command here to reset the database to the current migrations

Terminal
[code]
    1
    
    supabase db reset
[/code]

4

Modify your employees table

Now you can visit your new `employees` table in the Dashboard.

Next, modify your `employees` table by adding a column for department. Create a new migration file for that.

Terminal
[code]
    1
    
    supabase migration new add_department_to_employees_table
[/code]

5

Add a new column to your table

This creates a new migration file: supabase/migrations/<timestamp> _add_department_to_employees_table.sql.

To that file, add the SQL to create a new department column

20250101000001_add_department_to_employees_table.sql
[code]
    1
    
    alter table if exists public.employees
    
    2
    
    add department text default 'Hooli';
[/code]

### Add sample data#

Now that you are managing your database with migrations scripts, it would be great have some seed data to use every time you reset the database.

For this, you can create a seed script in `supabase/seed.sql`.

1

Populate your table

Insert data into your `employees` table with your `supabase/seed.sql` file.

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

Reset your database (apply current migrations), and populate with seed data

Terminal
[code]
    1
    
    supabase db reset
[/code]

You should now see the `employees` table, along with your seed data in the Dashboard! All of your database changes are captured in code, and you can reset to a known state at any time, complete with seed data.

### Diffing changes#

This workflow is great if you know SQL and are comfortable creating tables and columns. If not, you can still use the Dashboard to create tables and columns, and then use the CLI to diff your changes and create migrations.

Create a new table called `cities`, with columns `id`, `name` and `population`. To see the corresponding SQL for this, you can use the `supabase db diff --schema public` command. This will show you the SQL that will be run to create the table and columns. The output of `supabase db diff` will look something like this:
[code] 
    1
    
    Diffing schemas: public
    
    2
    
    Finished supabase db diff on branch main.
    
    3
    
    4
    
    create table "public"."cities" (
    
    5
    
        "id" bigint primary key generated always as identity,
    
    6
    
        "name" text,
    
    7
    
        "population" bigint
    
    8
    
    );
[/code]

Alternately, you can view your table definitions directly from the Table Editor:

![SQL Definition](/docs/img/guides/cli/sql-definitions.png)

You can then copy this SQL into a new migration file, and run `supabase db reset` to apply the changes.

The last step is deploying these changes to a live Supabase project.

## Deploy your project#

You've been developing your project locally, making changes to your tables via migrations. It's time to deploy your project to the Supabase Platform and start scaling up to millions of users! Head over to [Supabase](</dashboard>) and create a new project to deploy to.

### Log in to the Supabase CLI#

Terminalnpx
[code]
    1
    
    supabase login
[/code]

### Link your project#

Associate your local project with your remote project using [`supabase link`](</docs/reference/cli/usage#supabase-link>).
[code] 
    1
    
    supabase link --project-ref <project-id>
    
    2
    
    # You can get <project-id> from your project's dashboard URL: https://supabase.com/dashboard/project/<project-id>
[/code]

If your remote database already has schema changes that aren't in your local migrations (for example, tables you created directly in the Dashboard), capture them before you push:
[code]
    1
    
    supabase db pull
    
    2
    
    supabase db reset
[/code]

`db pull` writes those changes to a `<timestamp>_remote_schema.sql` migration so your local and remote histories line up, and `db reset` re-applies your migrations locally to confirm they're consistent. For a brand-new remote project with nothing in it yet, skip this step.

### Deploy database changes#

Deploy any local database migrations using [`db push`](</docs/reference/cli/usage#supabase-db-push>):
[code] 
    1
    
    supabase db push
[/code]

Visiting your live project on [Supabase](</dashboard>), you'll see a new `employees` table, complete with the `department` column you added in the second migration above.

### Deploy Edge Functions#

If your project uses Edge Functions, you can deploy these using [`functions deploy`](</docs/reference/cli/usage#supabase-functions-deploy>):
[code] 
    1
    
    supabase functions deploy <function_name>
[/code]

### Use Auth locally#

To use Auth locally, update your project's `supabase/config.toml` file that gets created after running `supabase init`. Add any providers you want, and set enabled to `true`.
[code] 
    1
    
    [auth.external.github]
    
    2
    
    enabled = true
    
    3
    
    client_id = "env(SUPABASE_AUTH_GITHUB_CLIENT_ID)"
    
    4
    
    secret = "env(SUPABASE_AUTH_GITHUB_SECRET)"
    
    5
    
    redirect_uri = "http://localhost:54321/auth/v1/callback"
[/code]

As a best practice, any secret values should be loaded from environment variables. You can add them to `.env` file in your project's root directory for the CLI to automatically substitute them.
[code] 
    1
    
    SUPABASE_AUTH_GITHUB_CLIENT_ID="redacted"
    
    2
    
    SUPABASE_AUTH_GITHUB_SECRET="redacted"
[/code]

For these changes to take effect, you need to run `supabase stop` and `supabase start` again.

If you have additional triggers or RLS policies defined on your `auth` schema, you can pull them as a migration file locally.
[code] 
    1
    
    supabase db pull --schema auth
[/code]

### Sync storage buckets#

Your RLS policies on storage buckets can be pulled locally by specifying `storage` schema. For example,
[code] 
    1
    
    supabase db pull --schema storage
[/code]

The buckets and objects themselves are rows in the storage tables so they won't appear in your schema. You can instead define them via `supabase/config.toml` file. For example,
[code] 
    1
    
    [storage.buckets.images]
    
    2
    
    public = false
    
    3
    
    file_size_limit = "50MiB"
    
    4
    
    allowed_mime_types = ["image/png", "image/jpeg"]
    
    5
    
    objects_path = "./images"
[/code]

This will upload files from `supabase/images` directory to a bucket named `images` in your project with one command.
[code] 
    1
    
    supabase seed buckets
[/code]

### Sync any schema with `--schema`#

You can synchronize your database with a specific schema using the `--schema` option as follows:
[code] 
    1
    
    supabase db pull --schema <schema_name>
[/code]

Using `--schema`

If the local `supabase/migrations` directory is empty, the `db pull` command will ignore the `--schema` parameter.

To fix this, you can pull twice:
[code]
    1
    
    supabase db pull
    
    2
    
    supabase db pull --schema <schema_name>
[/code]

## Limitations and considerations#

The local development environment is not as feature-complete as the Supabase Platform. Here are some of the differences:

  * You cannot update your project settings in the Dashboard. This must be done using the local config file.
  * The CLI version determines the local version of Studio used, so make sure you keep your local [Supabase CLI up to date](<https://github.com/supabase/cli#getting-started>). We're constantly adding new features and bug fixes.