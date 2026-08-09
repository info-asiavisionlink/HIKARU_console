---
タイトル: Seeding your database
URL: https://supabase.com/docs/guides/local-development/seeding-your-database
カテゴリ: cli
更新日: 2026-08-02
タグ: cli, database, local-development, seeding, seeding-your-database, your
---

# Seeding your database

**URL:** https://supabase.com/docs/guides/local-development/seeding-your-database
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** cli, database, local-development, seeding, seeding-your-database, your

## 目次

- [What is seed data?#](#what-is-seed-data)
- [Using seed files#](#using-seed-files)
  - [Splitting up your seed file#](#splitting-up-your-seed-file)
- [Generating seed data#](#generating-seed-data)

## 概要

Populate your database with initial data for reproducible environments across local and testing.

---

## What is seed data?#

Seeding is the process of populating a database with initial data, typically used to provide sample or default records for testing and development purposes. You can use this to create "reproducible environments" for local development, staging, and production.

## Using seed files#

Seed files are executed the first time you run `supabase start` and every time you run `supabase db reset`. Seeding occurs _after_ all database migrations have been completed. As a best practice, only include data insertions in your seed files, and avoid adding schema statements.

By default, if no specific configuration is provided, the system will look for a seed file matching the pattern `supabase/seed.sql`. This maintains backward compatibility with earlier versions, where the seed file was placed in the `supabase` folder.

You can add any SQL statements to this file. For example:
[code] 
    1
    
    insert into countries
    
    2
    
      (name, code)
    
    3
    
    values
    
    4
    
      ('United States', 'US'),
    
    5
    
      ('Canada', 'CA'),
    
    6
    
      ('Mexico', 'MX');
[/code]

If you want to manage multiple seed files or organize them across different folders, you can configure additional paths or glob patterns in your `config.toml` (see the next section for details).

### Splitting up your seed file#

For better modularity and maintainability, you can split your seed data into multiple files. For example, you can organize your seeds by table and include files such as `countries.sql` and `cities.sql`. Configure them in `config.toml` like so:
[code] 
    1
    
    [db.seed]
    
    2
    
    enabled = true
    
    3
    
    sql_paths = ['./countries.sql', './cities.sql']
[/code]

Or to include all `.sql` files under a specific folder you can do:
[code] 
    1
    
    [db.seed]
    
    2
    
    enabled = true
    
    3
    
    sql_paths = ['./seeds/*.sql']
[/code]

The CLI processes seed files in the order they are declared in the `sql_paths` array. If a glob pattern is used and matches multiple files, those files are sorted in lexicographic order to ensure consistent execution. Additionally:

  * The base folder for the pattern matching is `supabase` so `./countries.sql` will search for `supabase/countries.sql`
  * Files matched by multiple patterns will be deduplicated to prevent redundant seeding.
  * If a pattern does not match any files, a warning will be logged to help you troubleshoot potential configuration issues.


## Generating seed data#

For most projects, a hand-written `supabase/seed.sql` (see Using seed files above) is the simplest and most reliable approach. If you need large volumes of realistic data, you can generate it with [Snaplet Seed](<https://github.com/supabase-community/seed>).

Snaplet wound down as a company in 2024 and open-sourced its tooling. `@snaplet/seed` is now community-maintained at [supabase-community/seed](<https://github.com/supabase-community/seed>) and receives only occasional fixes, so treat it as an optional convenience rather than a required part of the workflow.

To use Snaplet, you need to have Node.js and npm installed. You can add Node.js to your project by running `npm init -y` in your project directory.

If this is your first time using Snaplet to seed your project, you'll need to set up Snaplet with the following command:
[code] 
    1
    
    npx @snaplet/seed init
[/code]

This command will analyze your database and its structure, and then generate a JavaScript client which can be used to define exactly how your data should be generated using code. The `init` command generates a configuration file, `seed.config.ts` and an example script, `seed.ts`, as a starting point.

During `init` if you are not using an Object Relational Mapper (ORM) or your ORM is not in the supported list, choose `node-postgres`.

In most cases you only want to generate data for specific schemas or tables. This is defined with `select`. Here is an example `seed.config.ts` configuration file:
[code] 
    1
    
    export default defineConfig({
    
    2
    
      adapter: async () => {
    
    3
    
        const client = new Client({
    
    4
    
          connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres',
    
    5
    
        })
    
    6
    
        await client.connect()
    
    7
    
        return new SeedPg(client)
    
    8
    
      },
    
    9
    
      // We only want to generate data for the public schema
    
    10
    
      select: ['!*', 'public.*'],
    
    11
    
    })
[/code]

Suppose you have a database with the following schema:

User PK bigint id text email text name Post PK bigint id text title text content FK bigint createdBy Comment PK bigint id text text FK bigint userId FK bigint postId createdBy userId postId

This example schema has three tables. A `User` can author many `Post` rows (`Post.createdBy` references `User.id`) and many `Comment` rows (`Comment.userId` references `User.id`), and each `Post` can have many `Comment` rows (`Comment.postId` references `Post.id`). In other words, users create posts and comments, and every comment belongs to a post.

You can use the seed script example generated by Snaplet `seed.ts` to define the values you want to generate. For example:

  * A `Post` with the title `"There is a lot of snow around here!"`
  * The `Post.createdBy` user with an email address ending in `"@acme.org"`
  * Three `Post.comments` from three different users.


[code] 
    1
    
    import { copycat } from '@snaplet/copycat'
    
    2
    
    import { createSeedClient } from '@snaplet/seed'
    
    3
    
    4
    
    async function main() {
    
    5
    
      const seed = await createSeedClient({ dryRun: true })
    
    6
    
    7
    
      await seed.Post([
    
    8
    
        {
    
    9
    
          title: 'There is a lot of snow around here!',
    
    10
    
          createdBy: {
    
    11
    
            email: (ctx) =>
    
    12
    
              copycat.email(ctx.seed, {
    
    13
    
                domain: 'acme.org',
    
    14
    
              }),
    
    15
    
          },
    
    16
    
          Comment: (x) => x(3),
    
    17
    
        },
    
    18
    
      ])
    
    19
    
    20
    
      process.exit()
    
    21
    
    }
    
    22
    
    23
    
    main()
[/code]

Running `npx tsx seed.ts > supabase/seed.sql` generates the relevant SQL statements inside your `supabase/seed.sql` file:
[code] 
    1
    
    -- The `Post.createdBy` user with an email address ending in `"@acme.org"`
    
    2
    
    insert into "User" (name, email) values ('John Snow', 'snow@acme.org');
    
    3
    
    4
    
    -- - A `Post` with the title `"There is a lot of snow around here!"`
    
    5
    
    insert into "Post" (title, content, createdBy)
    
    6
    
    values
    
    7
    
      ('There is a lot of snow around here!', 'Lorem ipsum dolar', 1);
    
    8
    
    9
    
    -- - Three `Post.Comment` from three different users.
    
    10
    
    insert into "User" (name, email) values ('Stephanie Shadow', 'shadow@domain.com');
    
    11
    
    insert into "Comment" (text, userId, postId) values ('I love cheese', 2, 1);
    
    12
    
    13
    
    insert into "User" (name, email) values ('John Rambo', 'rambo@trymore.dev');
    
    14
    
    insert into "Comment" (text, userId, postId) values ('Lorem ipsum dolar sit', 3, 1);
    
    15
    
    16
    
    insert into "User" (name, email) values ('Steven Plank', 's@plank.org');
    
    17
    
    insert into "Comment" (text, userId, postId) values ('Actually, that''s not correct...', 4, 1);
[/code]

Whenever your database structure changes, you will need to regenerate `@snaplet/seed` to keep it in sync with the new structure. You can do this by running:
[code] 
    1
    
    npx @snaplet/seed sync
[/code]

You can further enhance your seed script by using Large Language Models to generate more realistic data. To enable this feature, set one of the following environment variables in your `.env` file:
[code] 
    1
    
    OPENAI_API_KEY=<your_openai_api_key>
    
    2
    
    GROQ_API_KEY=<your_groq_api_key>
[/code]

After setting the environment variables, run the following commands to sync and generate the seed data:
[code] 
    1
    
    npx @snaplet/seed sync
    
    2
    
    npx tsx seed.ts > supabase/seed.sql
[/code]

For more information, see the [Snaplet Seed repository](<https://github.com/supabase-community/seed>).