---
タイトル: Google Colab
URL: https://supabase.com/docs/guides/ai/google-colab
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, colab, google, google-colab
---

# Google Colab

**URL:** https://supabase.com/docs/guides/ai/google-colab
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, colab, google, google-colab

## 目次

- [Create a new notebook#](#create-a-new-notebook)
- [Install Vecs#](#install-vecs)
- [Connect to your database#](#connect-to-your-database)
- [Create a collection#](#create-a-collection)
- [Query your documents#](#query-your-documents)
- [Resources#](#resources)

## 概要

Use Google Colab to manage your Supabase Vector store.

---

[![](/docs/img/ai/colab-badge.svg)](<https://colab.research.google.com/github/supabase/supabase/blob/master/examples/ai/vector_hello_world.ipynb>)

Google Colab is a hosted Jupyter Notebook service. It provides free access to computing resources, including GPUs and TPUs, and is well-suited to machine learning, data science, and education. We can use Colab to manage collections using [Supabase Vecs](</docs/guides/ai/vecs-python-client>).

In this tutorial we'll connect to a database running on the Supabase [platform](</dashboard/>). If you don't already have a database, you can create one here: [database.new](<https://database.new>).

## Create a new notebook#

Start by visiting [colab.research.google.com](<https://colab.research.google.com/>). There you can create a new notebook.

![Google Colab new notebook](/docs/img/ai/google-colab/colab-new.png)

## Install Vecs#

We'll use the Supabase Vector client, [Vecs](</docs/guides/ai/vecs-python-client>), to manage our collections.

At the top of the notebook, paste the following code and click "Execute" (`ctrl+enter`):
[code] 
    1
    
    pip install vecs
[/code]

![Install vecs](/docs/img/ai/google-colab/install-vecs.png)

## Connect to your database#

On your project dashboard, click [Connect](</dashboard/project/_?showConnect=true>). The connection string should look like `postgres://postgres.xxxx:password@xxxx.pooler.supabase.com:6543/postgres`

Create a new code block below the install block (`ctrl+m b`) and add the following code using the Postgres URI you copied above:
[code] 
    1
    
    import vecs
    
    2
    
    3
    
    DB_CONNECTION = "postgres://postgres.xxxx:password@xxxx.pooler.supabase.com:6543/postgres"
    
    4
    
    5
    
    # create vector store client
    
    6
    
    vx = vecs.create_client(DB_CONNECTION)
[/code]

Execute the code block (`ctrl+enter`). If no errors were returned then your connection was successful.

## Create a collection#

Now we're going to create a new collection and insert some documents.

Create a new code block below the install block (`ctrl+m b`). Add the following code to the code block and execute it (`ctrl+enter`):
[code] 
    1
    
    collection = vx.get_or_create_collection(name="colab_collection", dimension=3)
    
    2
    
    3
    
    collection.upsert(
    
    4
    
        vectors=[
    
    5
    
            (
    
    6
    
             "vec0",           # the vector's identifier
    
    7
    
             [0.1, 0.2, 0.3],  # the vector. list or np.array
    
    8
    
             {"year": 1973}    # associated  metadata
    
    9
    
            ),
    
    10
    
            (
    
    11
    
             "vec1",
    
    12
    
             [0.7, 0.8, 0.9],
    
    13
    
             {"year": 2012}
    
    14
    
            )
    
    15
    
        ]
    
    16
    
    )
[/code]

This will create a table inside your database within the `vecs` schema, called `colab_collection`. You can view the inserted items in the [Table Editor](</dashboard/project/_/editor/>), by selecting the `vecs` schema from the schema dropdown.

![Colab documents](/docs/img/ai/google-colab/colab-documents.png)

## Query your documents#

Now we can search for documents based on their similarity. Create a new code block and execute the following code:
[code] 
    1
    
    collection.query(
    
    2
    
        query_vector=[0.4,0.5,0.6],  # required
    
    3
    
        limit=5,                     # number of records to return
    
    4
    
        filters={},                  # metadata filters
    
    5
    
        measure="cosine_distance",   # distance measure to use
    
    6
    
        include_value=False,         # should distance measure values be returned?
    
    7
    
        include_metadata=False,      # should record metadata be returned?
    
    8
    
    )
[/code]

You will see that this returns two documents in an array `['vec1', 'vec0']`:

![Colab results](/docs/img/ai/google-colab/colab-results.png)

It also returns a warning:
[code] 
    1
    
    Query does not have a covering index for cosine_distance.
[/code]

You can lean more about creating indexes in the [Vecs documentation](<https://supabase.github.io/vecs/api/#create-an-index>).

## Resources#

  * Vecs API: [supabase.github.io/vecs/api](<https://supabase.github.io/vecs/api>)