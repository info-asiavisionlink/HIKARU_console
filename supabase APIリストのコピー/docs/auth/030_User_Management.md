---
タイトル: User Management
URL: https://supabase.com/docs/guides/auth/managing-user-data
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, management, managing-user-data, user
---

# User Management

**URL:** https://supabase.com/docs/guides/auth/managing-user-data
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, management, managing-user-data, user

## 目次

- [Accessing user data via API#](#accessing-user-data-via-api)
- [Adding and retrieving user metadata#](#adding-and-retrieving-user-metadata)
- [Deleting users#](#deleting-users)
  - [Removing account access#](#removing-account-access)
- [Exporting users#](#exporting-users)

## 概要

View, delete, and export user information.

---

You can view your users on the [Users page](</dashboard/project/_/auth/users>) of the Dashboard. You can also view the contents of the Auth schema in the [Table Editor](</dashboard/project/_/editor>).

## Accessing user data via API#

For security, the Auth schema is not exposed in the auto-generated API. If you want to access users data via the API, you can create your own user tables in the `public` schema.

Make sure to protect the table by enabling [Row Level Security](</docs/guides/database/postgres/row-level-security>) and only granting the necessary privileges for each role. Reference the `auth.users` table to ensure data integrity. Specify `on delete cascade` in the reference. For example, a `public.profiles` table might look like this:
[code] 
    1
    
    create table public.profiles (
    
    2
    
      id uuid not null references auth.users on delete cascade,
    
    3
    
      first_name text,
    
    4
    
      last_name text,
    
    5
    
    6
    
      primary key (id)
    
    7
    
    );
    
    8
    
    9
    
    -- Grant the privileges the roles need
    
    10
    
    GRANT SELECT ON public.profiles TO anon;
    
    11
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
    
    12
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
    
    13
    
    14
    
    -- Enable row level security for the table
    
    15
    
    alter table public.profiles enable row level security;
[/code]

Only use primary keys as [foreign key references](<https://www.postgresql.org/docs/current/tutorial-fk.html>) for schemas and tables like `auth.users` which are managed by Supabase. Postgres lets you specify a foreign key reference for columns backed by a unique index (not necessarily primary keys).

Primary keys are **guaranteed not to change**. Columns, indices, constraints or other database objects managed by Supabase **may change at any time** and you should be careful when referencing them directly.

To update your `public.profiles` table every time a user signs up, set up a trigger. If the trigger fails, it could block signups, so test your code thoroughly.
[code] 
    1
    
    -- inserts a row into public.profiles
    
    2
    
    create function public.handle_new_user()
    
    3
    
    returns trigger
    
    4
    
    language plpgsql
    
    5
    
    security definer set search_path = ''
    
    6
    
    as $$
    
    7
    
    begin
    
    8
    
      insert into public.profiles (id, first_name, last_name)
    
    9
    
      values (new.id, new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name');
    
    10
    
      return new;
    
    11
    
    end;
    
    12
    
    $$;
    
    13
    
    14
    
    -- trigger the function every time a user is created
    
    15
    
    create trigger on_auth_user_created
    
    16
    
      after insert on auth.users
    
    17
    
      for each row execute procedure public.handle_new_user();
[/code]

## Adding and retrieving user metadata#

You can assign metadata to users on sign up:

JavaScriptDartSwiftKotlin
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)
    
    3
    
    4
    
    // ---cut---
    
    5
    
    const { data, error } = await supabase.auth.signUp({
    
    6
    
      email: 'valid.email@supabase.io',
    
    7
    
      password: 'example-password',
    
    8
    
      options: {
    
    9
    
        data: {
    
    10
    
          first_name: 'John',
    
    11
    
          age: 27,
    
    12
    
        },
    
    13
    
      },
    
    14
    
    })
[/code]

User metadata is stored on the `raw_user_meta_data` column of the `auth.users` table. To view the metadata:

JavaScriptDartSwiftKotlin
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)
    
    3
    
    4
    
    // ---cut---
    
    5
    
    const {
    
    6
    
      data: { user },
    
    7
    
    } = await supabase.auth.getUser()
    
    8
    
    let metadata = user?.user_metadata
[/code]

## Deleting users#

You may delete users directly or via the management console at Authentication > Users. Note that deleting a user from the `auth.users` table does not automatically sign out a user. As Supabase makes use of JSON Web Tokens (JWT), a user's JWT will remain "valid" until it has expired.

You cannot delete a user if they are the owner of any objects in Supabase Storage.

You will encounter an error when you try to delete an Auth user that owns any Storage objects. If this happens, try deleting all the objects for that user, or reassign ownership to another user.

### Removing account access#

When the goal is to remove an account so it can no longer access your app, delete the auth user with [`auth.admin.deleteUser()`](</docs/reference/javascript/auth-admin-deleteuser>). With the default `shouldSoftDelete: false`, this removes the row from `auth.users`, which cascades to `auth.sessions` and invalidates the user's refresh tokens — so the account can no longer mint new access tokens.

A few things are _not_ a substitute for deleting the user:

  * A temporary [ban](</docs/reference/javascript/auth-admin-updateuserbyid>) only blocks sign-in for its duration and does not revoke existing sessions.
  * Marking the account as deleted only in your own application tables leaves the `auth.users` row intact, so it can still authenticate and refresh.


Deleting the user still cannot retroactively invalidate an access token that was already issued. Supabase access tokens are stateless JWTs, so a token already in the user's hands stays valid until its `exp` claim passes, and during that window the account can still call the API. You have two ways to handle this window:

  * **Bound it:** keep the [access token (JWT) expiry](</docs/guides/auth/sessions>) short, so any outstanding token expires soon after you delete the user.
  * **Close it for sensitive operations:** validate the `session_id` claim against the `auth.sessions` table on those operations. Because deleting the user removes the session row, an outstanding token fails this check — but only on the requests where you perform it; other API calls still accept the token until `exp`.


See [User sessions](</docs/guides/auth/sessions>) for details.

## Exporting users#

As Supabase is built on top of Postgres, you can query the `auth.users` and `auth.identities` table via the `SQL Editor` tab to extract all users:
[code] 
    1
    
    select * from auth.users;
[/code]

You can then export the results as CSV.