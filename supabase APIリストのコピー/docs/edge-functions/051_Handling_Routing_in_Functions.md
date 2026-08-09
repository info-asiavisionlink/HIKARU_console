---
タイトル: Handling Routing in Functions
URL: https://supabase.com/docs/guides/functions/routing
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, functions, handling, routing
---

# Handling Routing in Functions

**URL:** https://supabase.com/docs/guides/functions/routing
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, functions, handling, routing

## 目次

- [Basic routing example#](#basic-routing-example)
- [Using route parameters#](#using-route-parameters)
- [URL Patterns API#](#url-patterns-api)

## 概要

How to handle custom routing within Edge Functions.

---

Usually, an Edge Function is written to perform a single action (e.g. write a record to the database). However, if your app's logic is split into multiple Edge Functions, requests to each action may seem slower.

Each Edge Function needs to be booted before serving a request (known as cold starts). If an action is performed less frequently (e.g. deleting a record), there is a high chance of that function experiencing a cold start.

One way to reduce cold starts and increase performance is to combine multiple actions into a single Edge Function. This way only one instance needs to be booted and it can handle multiple requests to different actions.

This allows you to:

  * Reduce cold starts by combining multiple actions into one function
  * Build complete REST APIs in a single function
  * Improve performance by keeping one instance warm for multiple endpoints


* * *

For example, we can use a single Edge Function to create a typical CRUD API (create, read, update, delete records).

To combine multiple endpoints into a single Edge Function, you can use web application frameworks such as [Express](<https://expressjs.com/>), [Oak](<https://oakserver.github.io/oak/>), or [Hono](<https://hono.dev>).

* * *

## Basic routing example#

Here's a basic hello world example using some popular web frameworks:

DenoExpressOakHono
[code]
    1
    
    import { Hono } from 'jsr:@hono/hono@^4'
    
    2
    
    3
    
    const app = new Hono()
    
    4
    
    5
    
    app.post('/hello-world', async (c) => {
    
    6
    
      const { name } = await c.req.json()
    
    7
    
      return c.json({ message: `Hello ${name}!` })
    
    8
    
    })
    
    9
    
    10
    
    app.get('/hello-world', (c) => {
    
    11
    
      return c.json({ message: 'Hello World!' })
    
    12
    
    })
    
    13
    
    14
    
    export default { fetch: app.fetch }
[/code]

To add Supabase auth per route, use the Hono adapter from `npm:@supabase/server@^1/adapters/hono`. See [Securing Edge Functions](</docs/guides/functions/auth>).

Within Edge Functions, paths should always be prefixed with the function name (in this case `hello-world`).

* * *

## Using route parameters#

You can use route parameters to capture values at specific URL segments (e.g. `/tasks/:taskId/notes/:noteId`).

Keep in mind paths must be prefixed by function name. Route parameters can only be used after the function name prefix.

DenoExpressOakHono
[code]
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    interface Task {
    
    4
    
      id: string
    
    5
    
      name: string
    
    6
    
    }
    
    7
    
    8
    
    let tasks: Task[] = []
    
    9
    
    10
    
    const router = new Map<string, (req: Request) => Promise<Response>>()
    
    11
    
    12
    
    async function getAllTasks(): Promise<Response> {
    
    13
    
      return Response.json({ tasks })
    
    14
    
    }
    
    15
    
    16
    
    async function getTask(id: string): Promise<Response> {
    
    17
    
      const task = tasks.find((t) => t.id === id)
    
    18
    
      if (task) {
    
    19
    
        return Response.json({ task })
    
    20
    
      } else {
    
    21
    
        return Response.json({ error: 'Task not found' }, { status: 404 })
    
    22
    
      }
    
    23
    
    }
    
    24
    
    25
    
    async function createTask(req: Request): Promise<Response> {
    
    26
    
      const id = Math.random().toString(36).substring(7)
    
    27
    
      const task = { id, name: '' }
    
    28
    
      tasks.push(task)
    
    29
    
      return Response.json({ task }, { status: 201 })
    
    30
    
    }
    
    31
    
    32
    
    async function updateTask(id: string, req: Request): Promise<Response> {
    
    33
    
      const index = tasks.findIndex((t) => t.id === id)
    
    34
    
      if (index !== -1) {
    
    35
    
        const updates = await req.json()
    
    36
    
        tasks[index] = { ...tasks[index], ...updates }
    
    37
    
        return Response.json({ task: tasks[index] })
    
    38
    
      } else {
    
    39
    
        return Response.json({ error: 'Task not found' }, { status: 404 })
    
    40
    
      }
    
    41
    
    }
    
    42
    
    43
    
    async function deleteTask(id: string): Promise<Response> {
    
    44
    
      const index = tasks.findIndex((t) => t.id === id)
    
    45
    
      if (index !== -1) {
    
    46
    
        tasks.splice(index, 1)
    
    47
    
        return Response.json({ message: 'Task deleted successfully' })
    
    48
    
      } else {
    
    49
    
        return Response.json({ error: 'Task not found' }, { status: 404 })
    
    50
    
      }
    
    51
    
    }
    
    52
    
    53
    
    export default {
    
    54
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    55
    
        const url = new URL(req.url)
    
    56
    
        const method = req.method
    
    57
    
        // Extract the last part of the path as the command
    
    58
    
        const command = url.pathname.split('/').pop()
    
    59
    
        // Assuming the last part of the path is the task ID
    
    60
    
        const id = command
    
    61
    
        try {
    
    62
    
          switch (method) {
    
    63
    
            case 'GET':
    
    64
    
              if (id) {
    
    65
    
                return getTask(id)
    
    66
    
              } else {
    
    67
    
                return getAllTasks()
    
    68
    
              }
    
    69
    
            case 'POST':
    
    70
    
              return createTask(req)
    
    71
    
            case 'PUT':
    
    72
    
              if (id) {
    
    73
    
                return updateTask(id, req)
    
    74
    
              } else {
    
    75
    
                return Response.json({ error: 'Bad Request' }, { status: 400 })
    
    76
    
              }
    
    77
    
            case 'DELETE':
    
    78
    
              if (id) {
    
    79
    
                return deleteTask(id)
    
    80
    
              } else {
    
    81
    
                return Response.json({ error: 'Bad Request' }, { status: 400 })
    
    82
    
              }
    
    83
    
            default:
    
    84
    
              return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
    
    85
    
          }
    
    86
    
        } catch (error) {
    
    87
    
          return Response.json({ error: `Internal Server Error: ${error}` }, { status: 500 })
    
    88
    
        }
    
    89
    
      }),
    
    90
    
    }
[/code]

* * *

## URL Patterns API#

If you prefer not to use a web framework, you can directly use [URL Pattern API](<https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API>) within your Edge Functions to implement routing.

This works well for small apps with only a couple of routes:
[code] 
    1
    
    // ...
    
    2
    
    3
    
    export default {
    
    4
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    5
    
        const { url, method } = req
    
    6
    
    7
    
        try {
    
    8
    
          // ctx.supabase is scoped to the calling user, so your row-level-security
    
    9
    
          // (RLS) policies are applied.
    
    10
    
          const supabaseClient = ctx.supabase
    
    11
    
    12
    
          // For more details on URLPattern, check https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API
    
    13
    
          const taskPattern = new URLPattern({ pathname: '/restful-tasks/:id' })
    
    14
    
          const matchingPath = taskPattern.exec(url)
    
    15
    
          const id = matchingPath ? matchingPath.pathname.groups.id : null
    
    16
    
    17
    
          let task = null
    
    18
    
          if (method === 'POST' || method === 'PUT') {
    
    19
    
            const body = await req.json()
    
    20
    
            task = body.task
    
    21
    
          }
    
    22
    
    23
    
          // call relevant method based on method and id
    
    24
    
          switch (true) {
    
    25
    
            case id && method === 'GET':
    
    26
    
              return getTask(supabaseClient, id as string)
    
    27
    
            case id && method === 'PUT':
    
    28
    
              return updateTask(supabaseClient, id as string, task)
    
    29
    
            case id && method === 'DELETE':
    
    30
    
              return deleteTask(supabaseClient, id as string)
    
    31
    
            case method === 'POST':
    
    32
    
              return createTask(supabaseClient, task)
    
    33
    
            case method === 'GET':
    
    34
    
              return getAllTasks(supabaseClient)
    
    35
    
            default:
    
    36
    
              return getAllTasks(supabaseClient)
    
    37
    
          }
    
    38
    
        } catch (error) {
    
    39
    
          console.error(error)
    
    40
    
    41
    
          return Response.json({ error: error.message }, { status: 400 })
    
    42
    
        }
    
    43
    
      }),
    
    44
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/restful-tasks/index.ts>)