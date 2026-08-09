---
タイトル: Drizzle
URL: https://supabase.com/docs/guides/database/drizzle
カテゴリ: database
更新日: 2026-08-02
タグ: database, drizzle
---

# Drizzle

**URL:** https://supabase.com/docs/guides/database/drizzle
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, drizzle

## 目次

- [Connecting with Drizzle#](#connecting-with-drizzle)

## 概要

Drizzle Quickstart

---

## Connecting with Drizzle#

[Drizzle ORM](<https://github.com/drizzle-team/drizzle-orm>) is a TypeScript ORM for SQL databases designed with maximum type safety in mind. You can use their ORM to connect to your database.

If you plan on solely using Drizzle instead of the Supabase Data API (PostgREST), you can turn off the latter in the [API Settings](</dashboard/project/_/settings/api>).

1

Install

Install Drizzle and related dependencies.
[code]
    1
    
    npm i drizzle-orm postgres
    
    2
    
    npm i -D drizzle-kit
[/code]

2

Create your models

Create a `schema.ts` file and define your models.
[code]
    1
    
    import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
    
    2
    
    3
    
    export const users = pgTable('users', {
    
    4
    
      id: serial('id').primaryKey(),
    
    5
    
      fullName: text('full_name'),
    
    6
    
      phone: varchar('phone', { length: 256 }),
    
    7
    
    });
[/code]

3

Connect

Connect to your database using the Connection Pooler.

From the project [**Connect** panel](</dashboard/project/_?showConnect=true>), copy the URI from the "Shared Pooler" option and save it as the `DATABASE_URL` environment variable. Remember to replace the password placeholder with your actual database password.

In local SUPABASE_DB_URL require to be adapted to work with Docker resolver
[code]
    1
    
    import 'dotenv/config'
    
    2
    
    3
    
    import { drizzle } from 'drizzle-orm/postgres-js'
    
    4
    
    import postgres from 'postgres'
    
    5
    
    6
    
    const databaseUrl = process.env.DATABASE_URL
    
    7
    
    if (!databaseUrl) throw new Error('DATABASE_URL is not set')
    
    8
    
    9
    
    let connectionString = databaseUrl
    
    10
    
    if (connectionString.includes('postgres:postgres@supabase_db_')) {
    
    11
    
      const url = new URL(connectionString)
    
    12
    
      url.hostname = url.hostname.split('_')[1]
    
    13
    
      connectionString = url.href
    
    14
    
    }
    
    15
    
    16
    
    // Disable prefetch as it is not supported for "Transaction" pool mode
    
    17
    
    export const client = postgres(connectionString, { prepare: false })
    
    18
    
    export const db = drizzle(client)
[/code]