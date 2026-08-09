---
タイトル: Routing
URL: https://supabase.com/docs/guides/functions/http-methods
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, functions, http-methods, routing
---

# Routing

**URL:** https://supabase.com/docs/guides/functions/http-methods
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, functions, http-methods, routing

## 目次

- [Overview#](#overview)
- [Example#](#example)

## 概要

Build complete REST APIs with Edge Functions using all standard HTTP methods.

---

## Overview#

Edge Functions support **`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`**. This means you can build complete REST APIs in a single function:
[code] 
    1
    
    Deno.serve(async (req) => {
    
    2
    
      const { method, url } = req
    
    3
    
      const { pathname } = new URL(url)
    
    4
    
    5
    
      // Route based on method and path
    
    6
    
      if (method === 'GET' && pathname === '/users') {
    
    7
    
        return getAllUsers()
    
    8
    
      } else if (method === 'POST' && pathname === '/users') {
    
    9
    
        return createUser(req)
    
    10
    
      }
    
    11
    
    12
    
      return new Response('Not found', { status: 404 })
    
    13
    
    })
[/code]

Edge Functions allow you to build APIs without needing separate functions for each endpoint. This reduces cold starts and simplifies deployment while keeping your code organized.

HTML content is not supported. `GET` requests that return `text/html` will be rewritten to `text/plain`. Edge Functions are designed for APIs and data processing, not serving web pages. Use Supabase for your backend API and your favorite frontend framework for HTML.

* * *

## Example#

Here's a full example of a RESTful API built with Edge Functions.
[code] 
    1
    
    // Follow this setup guide to integrate the Deno language server with your editor:
    
    2
    
    // https://deno.land/manual/getting_started/setup_your_environment
    
    3
    
    // This enables autocomplete, go to definition, etc.
    
    4
    
    5
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    6
    
    import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'
    
    7
    
    8
    
    interface Task {
    
    9
    
      name: string
    
    10
    
      status: number
    
    11
    
    }
    
    12
    
    13
    
    async function getTask(supabaseClient: SupabaseClient, id: string) {
    
    14
    
      const { data: task, error } = await supabaseClient.from('tasks').select('*').eq('id', id)
    
    15
    
      if (error) throw error
    
    16
    
    17
    
      return Response.json({ task })
    
    18
    
    }
    
    19
    
    20
    
    async function getAllTasks(supabaseClient: SupabaseClient) {
    
    21
    
      const { data: tasks, error } = await supabaseClient.from('tasks').select('*')
    
    22
    
      if (error) throw error
    
    23
    
    24
    
      return Response.json({ tasks })
    
    25
    
    }
    
    26
    
    27
    
    async function deleteTask(supabaseClient: SupabaseClient, id: string) {
    
    28
    
      const { error } = await supabaseClient.from('tasks').delete().eq('id', id)
    
    29
    
      if (error) throw error
    
    30
    
    31
    
      return Response.json({})
    
    32
    
    }
    
    33
    
    34
    
    async function updateTask(supabaseClient: SupabaseClient, id: string, task: Task) {
    
    35
    
      const { error } = await supabaseClient.from('tasks').update(task).eq('id', id)
    
    36
    
      if (error) throw error
    
    37
    
    38
    
      return Response.json({ task })
    
    39
    
    }
    
    40
    
    41
    
    async function createTask(supabaseClient: SupabaseClient, task: Task) {
    
    42
    
      const { error } = await supabaseClient.from('tasks').insert(task)
    
    43
    
      if (error) throw error
    
    44
    
    45
    
      return Response.json({ task })
    
    46
    
    }
    
    47
    
    48
    
    export default {
    
    49
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    50
    
        const { url, method } = req
    
    51
    
    52
    
        try {
    
    53
    
          // ctx.supabase is scoped to the calling user, so your row-level-security
    
    54
    
          // (RLS) policies are applied.
    
    55
    
          const supabaseClient = ctx.supabase
    
    56
    
    57
    
          // For more details on URLPattern, check https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API
    
    58
    
          const taskPattern = new URLPattern({ pathname: '/restful-tasks/:id' })
    
    59
    
          const matchingPath = taskPattern.exec(url)
    
    60
    
          const id = matchingPath ? matchingPath.pathname.groups.id : null
    
    61
    
    62
    
          let task = null
    
    63
    
          if (method === 'POST' || method === 'PUT') {
    
    64
    
            const body = await req.json()
    
    65
    
            task = body.task
    
    66
    
          }
    
    67
    
    68
    
          // call relevant method based on method and id
    
    69
    
          switch (true) {
    
    70
    
            case id && method === 'GET':
    
    71
    
              return getTask(supabaseClient, id as string)
    
    72
    
            case id && method === 'PUT':
    
    73
    
              return updateTask(supabaseClient, id as string, task)
    
    74
    
            case id && method === 'DELETE':
    
    75
    
              return deleteTask(supabaseClient, id as string)
    
    76
    
            case method === 'POST':
    
    77
    
              return createTask(supabaseClient, task)
    
    78
    
            case method === 'GET':
    
    79
    
              return getAllTasks(supabaseClient)
    
    80
    
            default:
    
    81
    
              return getAllTasks(supabaseClient)
    
    82
    
          }
    
    83
    
        } catch (error) {
    
    84
    
          console.error(error)
    
    85
    
    86
    
          return Response.json({ error: error.message }, { status: 400 })
    
    87
    
        }
    
    88
    
      }),
    
    89
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/restful-tasks/index.ts>)