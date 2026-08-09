---
タイトル: Engineering for Scale
URL: https://supabase.com/docs/guides/ai/engineering-for-scale
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, engineering, engineering-for-scale, scale
---

# Engineering for Scale

**URL:** https://supabase.com/docs/guides/ai/engineering-for-scale
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, engineering, engineering-for-scale, scale

## 目次

- [Small workloads#](#simple-workloads)
- [Enterprise workloads#](#enterprise-workloads)
  - [Query collections using Vecs#](#query-collections-using-vecs)
  - [Accessing external collections using Wrappers#](#accessing-external-collections-using-wrappers)
  - [Enterprise architecture#](#enterprise-architecture)

## 概要

Building an enterprise-grade vector architecture

---

Content sources for vectors can be extremely large. As you grow you should run your Vector workloads across several secondary databases (sometimes called "pods"), which allows each collection to scale independently.

## Small workloads #

For small workloads, you can typically store your data in a single database.

If you've used [Vecs](</docs/guides/ai/vecs-python-client>) to create 3 different collections, you can expose collections to your web or mobile application using [views](</docs/guides/database/tables#views>):

The diagram below shows a single database holding the three vector collections of `docs`, `posts`, and `images`. Each are exposed to your application through a view.

![Architecture diagram: a single Supabase database holding three vector collections \(docs, posts, and images\), each exposed to the application through a view.](/docs/_next/image?url=%2Fdocs%2Fimg%2Fai%2Fscaling%2Fengineering-for-scale--single-database--light.png&w=3840&q=75)

For example, with 3 collections, called `docs`, `posts`, and `images`, we could expose the "docs" inside the public schema like this:
[code] 
    1
    
    create view public.docs as
    
    2
    
    select
    
    3
    
      id,
    
    4
    
      embedding,
    
    5
    
      metadata, # Expose the metadata as JSON
    
    6
    
      (metadata->>'url')::text as url # Extract the URL as a string
    
    7
    
    from vector
[/code]

You can then use any of the client libraries to access your collections within your applications:
[code] 
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('docs')
    
    3
    
      .select('id, embedding, metadata')
    
    4
    
      .eq('url', '/hello-world')
[/code]

## Enterprise workloads#

As you move into production, we recommend splitting your collections into separate projects. This is because it allows your vector stores to scale independently of your production data. Vectors typically grow faster than operational data, and they have different resource requirements. Running them on separate databases removes the single-point-of-failure.

The diagram below shows a primary database alongside separate secondary "pod" databases, each holding its own vector collection so they can scale independently.

![Architecture diagram: a primary database alongside separate secondary 'pod' databases, each holding its own vector collection so collections can scale independently.](/docs/_next/image?url=%2Fdocs%2Fimg%2Fai%2Fscaling%2Fengineering-for-scale--with-secondaries--light.png&w=3840&q=75)

You can use as many secondary databases as you need to manage your collections. With this architecture, you have 2 options for accessing collections within your application:

  1. Query the collections directly using Vecs.
  2. Access the collections from your Primary database through a Wrapper.


You can use both of these in tandem to suit your use-case. We recommend option `1` wherever possible, as it offers the most scalability.

### Query collections using Vecs#

Vecs provides methods for querying collections, either using a [cosine similarity function](<https://supabase.github.io/vecs/api/#basic>) or with [metadata filtering](<https://supabase.github.io/vecs/api/#metadata-filtering>).
[code] 
    1
    
    # cosine similarity
    
    2
    
    docs.query(query_vector=[0.4,0.5,0.6], limit=5)
    
    3
    
    4
    
    # metadata filtering
    
    5
    
    docs.query(
    
    6
    
        query_vector=[0.4,0.5,0.6],
    
    7
    
        limit=5,
    
    8
    
        filters={"year": {"$eq": 2012}}, # metadata filters
    
    9
    
    )
[/code]

### Accessing external collections using Wrappers#

Supabase supports [Foreign Data Wrappers](</blog/postgres-foreign-data-wrappers-rust>). Wrappers allow you to connect two databases together so that you can query them over the network.

This involves 2 steps: connecting to your remote database from the primary and creating a Foreign Table.

#### Connecting your remote database#

Inside your Primary database we need to provide the credentials to access the secondary database:
[code] 
    1
    
    create extension postgres_fdw;
    
    2
    
    3
    
    create server docs_server
    
    4
    
    foreign data wrapper postgres_fdw
    
    5
    
    options (host 'db.xxx.supabase.co', port '5432', dbname 'postgres');
    
    6
    
    7
    
    create user mapping for docs_user
    
    8
    
    server docs_server
    
    9
    
    options (user 'postgres', password 'password');
[/code]

#### Create a foreign table#

We can now create a foreign table to access the data in our secondary project.
[code] 
    1
    
    create foreign table docs (
    
    2
    
      id text not null,
    
    3
    
      embedding extensions.vector(384),
    
    4
    
      metadata jsonb,
    
    5
    
      url text
    
    6
    
    )
    
    7
    
    server docs_server
    
    8
    
    options (schema_name 'public', table_name 'docs');
[/code]

This looks very similar to our View example above, and you can continue to use the client libraries to access your collections through the foreign table:
[code] 
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('docs')
    
    3
    
      .select('id, embedding, metadata')
    
    4
    
      .eq('url', '/hello-world')
[/code]

### Enterprise architecture#

This diagram below provides an example architecture that allows you to access the collections either with our client libraries or using Vecs. You can add as many secondary databases as you need (in this example we only show one):

![Enterprise architecture diagram: an application accessing vector collections in multiple secondary databases, either directly via Vecs or through the primary database using Foreign Data Wrappers.](/docs/_next/image?url=%2Fdocs%2Fimg%2Fai%2Fscaling%2Fengineering-for-scale--multi-database--light.png&w=3840&q=75)