---
タイトル: http: RESTful Client
URL: https://supabase.com/docs/guides/database/extensions/http
カテゴリ: database
更新日: 2026-08-02
タグ: cli, client, database, extensions, http, rest, restful
---

# http: RESTful Client

**URL:** https://supabase.com/docs/guides/database/extensions/http
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** cli, client, database, extensions, http, rest, restful

## 目次

- [Quick demo#](#quick-demo)
- [Overview#](#overview)
- [Usage#](#usage)
  - [Enable the extension#](#enable-the-extension)
  - [Available functions#](#available-functions)
  - [Returned values#](#returned-values)
- [Examples#](#examples)
  - [BasicGET#](#simple-get-example)
  - [BasicPOST#](#simple-post-example)
- [Resources#](#resources)

## 概要

An HTTP Client for Postgres Functions.

---

The `http` extension allows you to call RESTful endpoints within Postgres.

## Quick demo#

## Overview#

This section covers basic concepts:

  * REST: stands for REpresentational State Transfer. It's a way to request data from external services.
  * RESTful APIs are servers which accept HTTP "calls". The calls are typically:
    * `GET` − Read only access to a resource.
    * `POST` − Creates a new resource.
    * `DELETE` − Removes a resource.
    * `PUT` − Updates an existing resource or creates a new resource.


You can use the `http` extension to make these network requests from Postgres.

## Usage#

### Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `http` and enable the extension.


### Available functions#

While the main usage is `http('http_request')`, there are 5 wrapper functions for specific functionality:

  * `http_get()`
  * `http_post()`
  * `http_put()`
  * `http_delete()`
  * `http_head()`


### Returned values#

A successful call to a web URL from the `http` extension returns a record with the following fields:

  * `status`: integer
  * `content_type`: character varying
  * `headers`: http_header[]
  * `content`: character varying. Typically you would want to cast this to `jsonb` using the format `content::jsonb`


## Examples#

### Basic `GET`#
[code] 
    1
    
    select
    
    2
    
      "status", "content"::jsonb
    
    3
    
    from
    
    4
    
      extensions.http_get('https://jsonplaceholder.typicode.com/todos/1');
[/code]

### Basic `POST`#
[code] 
    1
    
    select
    
    2
    
      "status", "content"::jsonb
    
    3
    
    from
    
    4
    
      extensions.http_post(
    
    5
    
        'https://jsonplaceholder.typicode.com/posts',
    
    6
    
        '{ "title": "foo", "body": "bar", "userId": 1 }',
    
    7
    
        'application/json'
    
    8
    
      );
[/code]

## Resources#

  * Official [`http` GitHub Repository](<https://github.com/pramsey/pgsql-http>)