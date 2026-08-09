---
タイトル: Use Supabase Auth with Next.js
URL: https://supabase.com/docs/guides/auth/quickstarts/nextjs
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, next, nextjs, quickstarts, supabase, with
---

# Use Supabase Auth with Next.js

**URL:** https://supabase.com/docs/guides/auth/quickstarts/nextjs
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, next, nextjs, quickstarts, supabase, with

## 目次

  - [Get API details#](#get-api-details)
- [Learn more#](#learn-more)

## 概要

Learn how to configure Supabase Auth for the Next.js App Router.

---

1

Create a new Supabase project

Head over to [database.new](<https://database.new>) and create a new Supabase project.

Your new database has a table for storing your users. You can see that this table is currently empty by running some SQL in the [SQL Editor](</dashboard/project/_/sql/new>).

SQL_EDITOR
[code]
    1
    
    select * from auth.users;
[/code]

2

Create a Next.js app

Use the `create-next-app` command and the `with-supabase` template, to create a Next.js app pre-configured with:

  * [Cookie-based Auth](</docs/guides/auth/server-side/creating-a-client?queryGroups=package-manager&package-manager=npm&queryGroups=framework&framework=nextjs&queryGroups=environment&environment=server>)

  * [TypeScript](<https://www.typescriptlang.org/>)

  * [Tailwind CSS](<https://tailwindcss.com/>)

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)


Terminal
[code]
    1
    
    npx create-next-app -e with-supabase
[/code]

3

Declare Supabase Environment Variables

Rename `.env.example` to `.env.local` and populate with your Supabase connection variables:

Project URL

No project found

Publishable key

No project found

.env.local
[code]
    1
    
    NEXT_PUBLIC_SUPABASE_URL=your-project-url
    
    2
    
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... key
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nextjs>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

4

Start the app

Start the development server, go to <http://localhost:3000>[](<http://localhost:3000>) in a browser, and you should see the contents of `app/page.tsx`.

To sign up a new user, navigate to <http://localhost:3000/auth/sign-up>[](<http://localhost:3000/auth/sign-up>), and click `Sign up`.

Terminal
[code]
    1
    
    npm run dev
[/code]

## Learn more#

  * [Setting up Server-Side Auth for Next.js](</docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs>) for a Next.js deep dive
  * [Supabase Auth docs](</docs/guides/auth#authentication>) for more Supabase authentication methods