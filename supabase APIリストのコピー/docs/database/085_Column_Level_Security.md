---
タイトル: Column Level Security
URL: https://supabase.com/docs/guides/database/postgres/column-level-security
カテゴリ: database
更新日: 2026-08-02
タグ: column, column-level-security, database, level, postgres, security
---

# Column Level Security

**URL:** https://supabase.com/docs/guides/database/postgres/column-level-security
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** column, column-level-security, database, level, postgres, security

## 目次

- [Policies at the row level#](#policies-at-the-row-level)
- [Privileges at the column level#](#privileges-at-the-column-level)
- [Manage column privileges in the Dashboard#](#manage-column-privileges-in-the-dashboard)
- [Manage column privileges in migrations#](#manage-column-privileges-in-migrations)
- [Considerations when using column-level privileges#](#considerations-when-using-column-level-privileges)

## 概要

Secure your data using Postgres Column Level Security.

---

Postgres's [Row Level Security (RLS)](<https://www.postgresql.org/docs/current/ddl-rowsecurity.html>) gives you granular control over who can access rows of data. However, it doesn't give you control over which columns they can access within rows. Sometimes you want to restrict access to specific columns in your database. Column Level Privileges allows you to do that.

This is an advanced feature. We do not recommend using column-level privileges for most users. Instead, we recommend using RLS policies in combination with a dedicated table for handling user roles.

Restricted roles cannot use the wildcard operator (`*`) on the affected table. Instead of using `SELECT * FROM <restricted_table>;` or its API equivalent, you must specify the column names explicitly.

## Policies at the row level#

Policies in Row Level Security (RLS) are used to restrict access to rows in a table. Think of them like adding a `WHERE` clause to every query.

For example, assume you have a `posts` table with the following columns:

  * `id`
  * `user_id`
  * `title`
  * `content`
  * `created_at`
  * `updated_at`


You can restrict updates to the user who created it using [RLS](</docs/guides/auth#row-level-security>), with the following policy:
[code] 
    1
    
    create policy "Allow update for owners" on posts for
    
    2
    
    update
    
    3
    
      using ((select auth.uid()) = user_id);
[/code]

However, this gives the post owner full access to update the row, including all of the columns.

## Privileges at the column level#

To restrict access to columns, you can use [Privileges](<https://www.postgresql.org/docs/current/ddl-priv.html>).

There are two types of privileges in Postgres:

  1. **table-level** : Grants the privilege on all columns in the table.
  2. **column-level** Grants the privilege on a specific column in the table.


You can have both types of privileges on the same table. If you have both, and you revoke the column-level privilege, the table-level privilege will still be in effect.

By default, our table will have a table-level `UPDATE` privilege, which means that the `authenticated` role can update all the columns in the table.
[code] 
    1
    
    revoke
    
    2
    
    update
    
    3
    
      on table public.posts
    
    4
    
    from
    
    5
    
      authenticated;
    
    6
    
    7
    
    grant
    
    8
    
    update
    
    9
    
      (title, content) on table public.posts to authenticated;
[/code]

In the above example, we are revoking the table-level `UPDATE` privilege from the `authenticated` role and granting a column-level `UPDATE` privilege on the `title` and `content` columns.

If we want to restrict access to updating the `title` column:
[code] 
    1
    
    revoke
    
    2
    
    update
    
    3
    
      (title) on table public.posts
    
    4
    
    from
    
    5
    
      authenticated;
[/code]

This time, we are revoking the column-level `UPDATE` privilege of the `title` column from the `authenticated` role. We didn't need to revoke the table-level `UPDATE` privilege because it's already revoked.

## Manage column privileges in the Dashboard#

Column-level privileges are a powerful tool, but they're also quite advanced and in many cases, not the best fit for common access control needs. For that reason, we've intentionally moved the UI for this feature under the Feature Preview section in the dashboard.

You can view and edit the privileges in the [Supabase Studio](</dashboard/project/_/database/column-privileges>).

![Column level privileges](/docs/img/guides/privileges/column-level-privileges-2.png)

## Manage column privileges in migrations#

While you can manage privileges directly from the Dashboard, as your project grows you may want to manage them in your migrations. Read about database migrations in the [Local Development](</docs/guides/deployment/database-migrations>) guide.

1

Create a migration file

To get started, generate a [new migration](</docs/reference/cli/supabase-migration-new>) to store the SQL needed to create your table along with row and column-level privileges.
[code]
    1
    
    supabase migration new create_posts_table
[/code]

2

Add the SQL to your migration file

This creates a new migration: supabase/migrations/<timestamp> _create_posts_table.sql.

To that file, add the SQL to create this `posts` table with row and column-level privileges.
[code]
    1
    
    create table
    
    2
    
    posts (
    
    3
    
    id bigint primary key generated always as identity,
    
    4
    
    user_id text,
    
    5
    
    title text,
    
    6
    
    content text,
    
    7
    
    created_at timestamptz default now(),
    
    8
    
    updated_at timestamptz default now()
    
    9
    
    );
    
    10
    
    11
    
    -- Add row-level security
    
    12
    
    create policy "Allow update for owners" on posts for
    
    13
    
    update
    
    14
    
    using ((select auth.uid()) = user_id);
    
    15
    
    16
    
    -- Add column-level security
    
    17
    
    revoke
    
    18
    
    update
    
    19
    
    (title) on table public.posts
    
    20
    
    from
    
    21
    
    authenticated;
[/code]

## Considerations when using column-level privileges#

  * If you turn off a column privilege you won't be able to use that column at all.
  * All operations (insert, update, delete) as well as using `select *` will fail.