---
タイトル: Using Custom Schemas
URL: https://supabase.com/docs/guides/api/using-custom-schemas
カテゴリ: api
更新日: 2026-08-02
タグ: api, custom, schemas, using, using-custom-schemas
---

# Using Custom Schemas

**URL:** https://supabase.com/docs/guides/api/using-custom-schemas
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, custom, schemas, using, using-custom-schemas

## 目次

- [Creating custom schemas#](#creating-custom-schemas)
- [Exposing custom schemas#](#exposing-custom-schemas)

## 概要

You need additional steps to use custom database schemas with data APIs.

---

By default, your database has a `public` schema which is automatically exposed on data APIs.

## Creating custom schemas#

You can create your own custom schema/s by running the following SQL, substituting `myschema` with the name you want to use for your schema:
[code] 
    1
    
    CREATE SCHEMA myschema;
[/code]

## Exposing custom schemas#

You can expose custom database schemas - to do so you need to follow these steps:

  1. Go to [API settings](</dashboard/project/_/settings/api>) and add your custom schema to "Exposed schemas".
  2. Run the following SQL, substituting `myschema` with your schema name:


[code] 
    1
    
    GRANT USAGE ON SCHEMA myschema TO anon, authenticated, service_role;
    
    2
    
    GRANT ALL ON ALL TABLES IN SCHEMA myschema TO anon, authenticated, service_role;
    
    3
    
    GRANT ALL ON ALL ROUTINES IN SCHEMA myschema TO anon, authenticated, service_role;
    
    4
    
    GRANT ALL ON ALL SEQUENCES IN SCHEMA myschema TO anon, authenticated, service_role;
    
    5
    
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema GRANT ALL ON TABLES TO anon, authenticated, service_role;
    
    6
    
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
    
    7
    
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myschema GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
[/code]

Now you can access these schemas from data APIs:

JavaScriptDartcURL
[code]
    1
    
    // Initialize the JS client
    
    2
    
    import { createClient } from '@supabase/supabase-js'
    
    3
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    
    4
    
      db: { schema: 'myschema' },
    
    5
    
    })
    
    6
    
    7
    
    // Make a request
    
    8
    
    const { data: todos, error } = await supabase.from('todos').select('*')
    
    9
    
    10
    
    // You can also change the target schema on a per-query basis
    
    11
    
    const { data: todos, error } = await supabase.schema('myschema').from('todos').select('*')
[/code]