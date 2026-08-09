---
タイトル: Postgres.js
URL: https://supabase.com/docs/guides/database/postgres-js
カテゴリ: database
更新日: 2026-08-02
タグ: database, postgres, postgres-js
---

# Postgres.js

**URL:** https://supabase.com/docs/guides/database/postgres-js
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, postgres, postgres-js

## 目次

- [Connecting with Postgres.js#](#connecting-with-postgresjs)

## 概要

Postgres.js Quickstart

---

## Connecting with Postgres.js#

[Postgres.js](<https://github.com/porsager/postgres>) is a full-featured Postgres client for Node.js and Deno.

1

Install

Install Postgres.js and related dependencies.
[code]
    1
    
    npm i postgres
[/code]

2

Connect

Create a `db.js` file with the connection details.

To get your connection details, go to the [**Connect** panel](</dashboard/project/_?showConnect=true>). Choose [**Transaction pooler**](</dashboard/project/_?showConnect=true&method=transaction>) if you're on a platform with transient connections, such as a serverless function, and [**Session pooler**](</dashboard/project/_?showConnect=true&method=session>) if you have a long-lived connection. Copy the URI and save it as the environment variable `DATABASE_URL`.
[code]
    1
    
    // db.js
    
    2
    
    import postgres from 'postgres'
    
    3
    
    4
    
    const connectionString = process.env.DATABASE_URL
    
    5
    
    const sql = postgres(connectionString)
    
    6
    
    7
    
    export default sql
[/code]

3

Execute commands

Use the connection to execute commands.
[code]
    1
    
    import sql from './db.js'
    
    2
    
    3
    
    async function getUsersOver(age) {
    
    4
    
      const users = await sql`
    
    5
    
        select name, age
    
    6
    
        from users
    
    7
    
        where age > ${ age }
    
    8
    
      `
    
    9
    
      // users = Result [{ name: "Walter", age: 80 }, { name: 'Murray', age: 68 }, ...]
    
    10
    
      return users
    
    11
    
    }
[/code]