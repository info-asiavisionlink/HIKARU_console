---
タイトル: Learn how to integrate Supabase with LlamaIndex, a data framework for your LLM applications.
URL: https://supabase.com/docs/guides/ai/integrations/llamaindex
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, applications, data, framework, integrate, integrations, learn, llamaindex, supabase, with, your
---

# Learn how to integrate Supabase with LlamaIndex, a data framework for your LLM applications.

**URL:** https://supabase.com/docs/guides/ai/integrations/llamaindex
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, applications, data, framework, integrate, integrations, learn, llamaindex, supabase, with, your

## 目次

- [Project setup#](#project-setup)
- [Launching a notebook#](#launching-a-notebook)
- [Fill in your OpenAI credentials#](#fill-in-your-openai-credentials)
- [Connecting to your database#](#connecting-to-your-database)
- [Stepping through the notebook#](#stepping-through-the-notebook)
- [Resources#](#resources)

## 概要

Learn how to integrate Supabase with LlamaIndex, a data framework for your LLM applications.

---

This guide will walk you through a basic example using the LlamaIndex [`SupabaseVectorStore`](<https://github.com/supabase/supabase/blob/master/examples/ai/llamaindex/llamaindex.ipynb>).

## Project setup#

To create a new Postgres database, start a new Project in Supabase:

  1. [Create a new project](<https://database.new/>) in the Supabase dashboard.
  2. Enter your project details. Remember to store your password somewhere safe.


Your database will be available in less than a minute.

**Finding your credentials:**

You can find your project credentials on the dashboard:

  * [Database connection strings](</dashboard/project/_/settings/api?showConnect=true>): Direct and Pooler connection details including the connection string and parameters.
  * [Database password](</dashboard/project/_/database/settings>): Reset database password here if you do not have it.
  * [API credentials](</dashboard/project/_/settings/api>): your serverless API URL and publishable keys.


## Launching a notebook#

Launch our [LlamaIndex](<https://github.com/supabase/supabase/blob/master/examples/ai/llamaindex/llamaindex.ipynb>) notebook in Colab:

[![](/docs/img/ai/colab-badge.svg)](<https://colab.research.google.com/github/supabase/supabase/blob/master/examples/ai/llamaindex/llamaindex.ipynb>)

At the top of the notebook, you'll see a button `Copy to Drive`. Click this button to copy the notebook to your Google Drive.

## Fill in your OpenAI credentials#

Inside the Notebook, add your `OPENAI_API_KEY` key. Find the cell which contains this code:
[code] 
    1
    
    import os
    
    2
    
    os.environ['OPENAI_API_KEY'] = "[your_openai_api_key]"
[/code]

## Connecting to your database#

Inside the Notebook, find the cell which specifies the `DB_CONNECTION`. It will contain some code like this:
[code] 
    1
    
    DB_CONNECTION = "postgresql://<user>:<password>@<host>:<port>/<db_name>"
    
    2
    
    3
    
    # create vector store client
    
    4
    
    vx = vecs.create_client(DB_CONNECTION)
[/code]

Replace the `DB_CONNECTION` with your own connection string. You can find the connection string on your project dashboard by clicking [Connect](</dashboard/project/_?showConnect=true>).

SQLAlchemy requires the connection string to start with `postgresql://` (instead of `postgres://`). Don't forget to rename this after copying the string from the dashboard.

You must use the "connection pooling" string (domain ending in `*.pooler.supabase.com`) with Google Colab since Colab does not support IPv6.

## Stepping through the notebook#

Now all that's left is to step through the notebook. You can do this by clicking the "execute" button (`ctrl+enter`) at the top left of each code cell. The notebook guides you through the process of creating a collection, adding data to it, and querying it.

You can view the inserted items in the [Table Editor](</dashboard/project/_/editor/>), by selecting the `vecs` schema from the schema dropdown.

![Colab documents](/docs/img/ai/google-colab/colab-documents.png)

## Resources#

  * Visit the LlamaIndex + `SupabaseVectorStore` [docs](<https://developers.llamaindex.ai/python/examples/vector_stores/supabasevectorindexdemo/>)
  * Visit the official LlamaIndex [repo](<https://github.com/jerryjliu/llama_index/>)