---
タイトル: Use Supabase with Ruby on Rails
URL: https://supabase.com/docs/guides/getting-started/quickstarts/ruby-on-rails
カテゴリ: getting-started
更新日: 2026-08-02
タグ: ai, getting-started, quickstarts, rails, ruby, ruby-on-rails, supabase, with
---

# Use Supabase with Ruby on Rails

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/ruby-on-rails
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** ai, getting-started, quickstarts, rails, ruby, ruby-on-rails, supabase, with

## 目次

- [1. Create a Rails project#](#1-create-a-rails-project)
- [3. Install MCP server (optional)#](#3-install-mcp-server-optional)
- [4. Set up the Postgres connection details#](#4-set-up-the-postgres-connection-details)
- [5. Create and run a database migration#](#5-create-and-run-a-database-migration)
- [6. Use the model to interact with the database#](#6-use-the-model-to-interact-with-the-database)
- [7. Start the app#](#7-start-the-app)

## 概要

Learn how to create a Rails project and connect it to your Supabase Postgres database.

---

AI Prompt

Help me add Supabase to my Ruby on Rails project. Create a Supabase project at database.new. Then: 1\. Run `rails new blog -d=postgresql` to scaffold a new Rails project. 2\. Set `DATABASE_URL` to the Supabase Session Pooler connection string in `.env`. 3\. Generate an Article model with `bin/rails generate model Article title:string body:text` and run `bin/rails db:migrate`. 4\. Use `bin/rails console` to create and query articles. 5\. Run `bin/rails server` and open http://127.0.0.1:3000. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/ruby-on-rails.md

Show more

## 1\. Create a Rails project#

With your Ruby and Rails versions up to date, run `rails new` on your terminal to scaffold a new project.

Use the `-d=postgresql` flag to set it up for Postgres.

Check the [Rails docs](<https://guides.rubyonrails.org/getting_started.html>) for more details.
[code] 
    1
    
    rails new blog -d=postgresql
[/code]

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 3\. Install MCP server (optional)#

The Supabase MCP server connects AI assistants to Supabase, allowing you to interact with your projects on your behalf. Find out more on how to add it to your client in [the MCP docs](</docs/guides/ai-tools/mcp>).

## 4\. Set up the Postgres connection details#

Go to [database.new](<https://database.new>) and create a new Supabase project. Save your database password securely.

When your project is up and running, navigate to your project dashboard and click on [Connect](</dashboard/project/_?showConnect=true&method=session>).

Look for the Session Pooler connection string and copy the string. You will need to replace the Password with your saved database password. You can reset your database password in your [Database Settings](</dashboard/project/_/database/settings>) if you do not have it.

If you're in an [IPv6 environment](<https://github.com/orgs/supabase/discussions/27034>) or have the IPv4 Add-On, you can use the direct connection string instead of Supavisor in Session mode.

.env
[code]
    1
    
    export DATABASE_URL=postgres://postgres.xxxx:password@xxxx.pooler.supabase.com:5432/postgres
[/code]

## 5\. Create and run a database migration#

Rails includes Active Record as the ORM as well as database migration tooling which generates the SQL migration files for you.

Create an example `Article` model and generate the migration files.
[code] 
    1
    
    bin/rails generate model Article title:string body:text
    
    2
    
    bin/rails db:migrate
[/code]

## 6\. Use the model to interact with the database#

You can use the included Rails console to interact with the database. For example, you can create new entries or list all entries in a Model's table.
[code] 
    1
    
    bin/rails console
[/code]

irb
[code]
    1
    
    article = Article.new(title: "Hello Rails", body: "I am on Rails!")
    
    2
    
    article.save # Saves the entry to the database
    
    3
    
    4
    
    Article.all
[/code]

## 7\. Start the app#

Run the development server. Go to <http://127.0.0.1:3000>[](<http://127.0.0.1:3000>) in a browser to see your application running.
[code] 
    1
    
    bin/rails server
[/code]