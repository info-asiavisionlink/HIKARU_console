---
タイトル: Hybrid search
URL: https://supabase.com/docs/guides/ai/hybrid-search
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, hybrid, hybrid-search, search
---

# Hybrid search

**URL:** https://supabase.com/docs/guides/ai/hybrid-search
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, hybrid, hybrid-search, search

## 目次

- [Use cases for hybrid search#](#use-cases-for-hybrid-search)
- [When to consider hybrid search#](#when-to-consider-hybrid-search)
- [How to combine search methods#](#how-to-combine-search-methods)
- [Reciprocal Ranked Fusion (RRF)#](#reciprocal-ranked-fusion-rrf)
  - [Smoothing constantk#](#smoothing-constant-k)
- [Hybrid search in Postgres#](#hybrid-search-in-postgres)
- [Running hybrid search#](#running-hybrid-search)
- [See also#](#see-also)

## 概要

Combine keyword search with semantic search to get both direct and contextual results.

---

Hybrid search combines [full text search](</docs/guides/ai/keyword-search>) (searching by keyword) with [semantic search](</docs/guides/ai/semantic-search>) (searching by meaning) to identify results that are both directly and contextually relevant to the user's query.

## Use cases for hybrid search#

Sometimes a single search method doesn't quite capture what a user is really looking for. For example, if a user searches for "Italian recipes with tomato sauce" on a cooking app, a keyword search would pull up recipes that specifically mention "Italian," "recipes," and "tomato sauce" in the text. However, it might miss out on dishes that are quintessentially Italian and use tomato sauce but don't explicitly label themselves with these words, or use variations like "pasta sauce" or "marinara." On the other hand, a semantic search might understand the culinary context and find recipes that match the intent, such as a traditional "Spaghetti Marinara," even if they don't match the exact keyword phrase. However, it could also suggest recipes that are contextually related but not what the user is looking for, like a "Mexican salsa" recipe, because it understands the context to be broadly about tomato-based sauces.

Hybrid search combines the strengths of both these methods. It would ensure that recipes explicitly mentioning the keywords are prioritized, thus capturing direct hits that satisfy the keyword criteria. At the same time, it would include recipes identified through semantic understanding as being related in meaning or context, like different Italian dishes that traditionally use tomato sauce but might not have been tagged explicitly with the user's search terms. It identifies results that are both directly and contextually relevant to the user's query while ideally minimizing misses and irrelevant suggestions.

## When to consider hybrid search#

The decision to use hybrid search depends on what your users are looking for in your app. For a code repository where developers need to find exact lines of code or error messages, keyword search is likely ideal because it matches specific terms. In a mental health forum where users search for advice or experiences related to their feelings, semantic search may be better because it finds results based on the meaning of a query, not only specific words. For a shopping app where customers might search for specific product names yet also be open to related suggestions, hybrid search combines the best of both worlds - finding exact matches while also uncovering similar products based on the shopping context.

## How to combine search methods#

Hybrid search merges keyword search and semantic search, but how does this process work?

First, each search method is executed separately. Keyword search, which involves searching by specific words or phrases present in the content, will yield its own set of results. Similarly, semantic search, which involves understanding the context or meaning behind the search query rather than the specific words used, will generate its own unique results.

Now with these separate result lists available, the next step is to combine them into a single, unified list. This is achieved through a process known as “fusion”. Fusion takes the results from both search methods and merges them together based on a certain ranking or scoring system. This system may prioritize certain results based on factors like their relevance to the search query, their ranking in the individual lists, or other criteria. The result is a final list that integrates the strengths of both keyword and semantic search methods.

## Reciprocal Ranked Fusion (RRF)#

One of the most common fusion methods is Reciprocal Ranked Fusion (RRF). The key idea behind RRF is to give more weight to the top-ranked items in each individual result list when building the final combined list.

In RRF, we iterate over each record and assign a score (noting that each record could exist in one or both lists). The score is calculated as 1 divided by that record's rank in each list, summed together between both lists. For example, if a record with an ID of `123` was ranked third in the keyword search and ninth in semantic search, it would receive a score of 13+19=0.444\dfrac{1}{3} + \dfrac{1}{9} = 0.44431​+91​=0.444. If the record was found in only one list and not the other, it would receive a score of 0 for the other list. The records are then sorted by this score to create the final list. The items with the highest scores are ranked first, and lowest scores ranked last.

This method ensures that items that are ranked high in multiple lists are given a high rank in the final list. It also ensures that items that are ranked high in only a few lists but low in others are not given a high rank in the final list. Placing the rank in the denominator when calculating score helps penalize the low ranking records.

### Smoothing constant `k`#

To prevent extremely high scores for items that are ranked first (since we're dividing by the rank), a `k` constant is often added to the denominator to smooth the score:

1k+rank\dfrac{1}{k+rank}k+rank1​

This constant can be any positive number, but is typically small. A constant of 1 would mean that a record ranked first would have a score of 11+1=0.5\dfrac{1}{1+1} = 0.51+11​=0.5 instead of 111. This adjustment can help balance the influence of items that are ranked very high in individual lists when creating the final combined list.

## Hybrid search in Postgres#

Implement hybrid search in Postgres using `tsvector` (keyword search) and `pgvector` (semantic search).

First, you can create a `documents` table to store the documents that you can search over. This is an example. Adjust this to match the structure of your application.
[code] 
    1
    
    create table documents (
    
    2
    
      id bigint primary key generated always as identity,
    
    3
    
      content text,
    
    4
    
      fts tsvector generated always as (to_tsvector('english', content)) stored,
    
    5
    
      embedding extensions.vector(512)
    
    6
    
    );
[/code]

The table contains 4 columns:

  * `id` is an auto-generated unique ID for the record. We'll use this later to match records when performing RRF.
  * `content` contains the actual text we will be searching over.
  * `fts` is an auto-generated `tsvector` column that is generated using the text in `content`. We will use this for [full text search](</docs/guides/database/full-text-search>) (search by keyword).
  * `embedding` is a [vector column](</docs/guides/ai/vector-columns>) that stores the vector generated from our embedding model. We will use this for [semantic search](</docs/guides/ai/semantic-search>) (search by meaning). We chose 512 dimensions for this example, but adjust this to match the size of the embedding vectors generated from your preferred model.


Next we'll create indexes on the `fts` and `embedding` columns so that their individual queries will remain fast at scale:
[code] 
    1
    
    -- Create an index for the full-text search
    
    2
    
    create index on documents using gin(fts);
    
    3
    
    4
    
    -- Create an index for the semantic vector search
    
    5
    
    create index on documents using hnsw (embedding vector_ip_ops);
[/code]

For full text search we use a [generalized inverted (GIN) index](<https://www.postgresql.org/docs/current/gin.html>) which is designed for handling composite values like those stored in a `tsvector`.

For semantic vector search we use an [HNSW index](</docs/guides/ai/vector-indexes/hnsw-indexes>), which is a high performing approximate nearest neighbor (ANN) search algorithm. Note that we are using the `vector_ip_ops` (inner product) operator with this index because we plan on using the inner product (`<#>`) operator later in our query. If you plan to use a different operator like cosine distance (`<=>`), be sure to update the index accordingly. For more information, see [distance operators](</docs/guides/ai/vector-indexes#distance-operators>).

Finally we'll create our `hybrid_search` function:
[code] 
    1
    
    create or replace function hybrid_search(
    
    2
    
      query_text text,
    
    3
    
      query_embedding extensions.vector(512),
    
    4
    
      match_count int,
    
    5
    
      full_text_weight float = 1,
    
    6
    
      semantic_weight float = 1,
    
    7
    
      rrf_k int = 50
    
    8
    
    )
    
    9
    
    returns setof documents
    
    10
    
    language sql
    
    11
    
    as $$
    
    12
    
    with full_text as (
    
    13
    
      select
    
    14
    
        id,
    
    15
    
        -- Note: ts_rank_cd is not indexable but will only rank matches of the where clause
    
    16
    
        -- which shouldn't be too big
    
    17
    
        row_number() over(order by ts_rank_cd(fts, websearch_to_tsquery(query_text)) desc) as rank_ix
    
    18
    
      from
    
    19
    
        documents
    
    20
    
      where
    
    21
    
        fts @@ websearch_to_tsquery(query_text)
    
    22
    
      order by rank_ix
    
    23
    
      limit least(match_count, 30) * 2
    
    24
    
    ),
    
    25
    
    semantic as (
    
    26
    
      select
    
    27
    
        id,
    
    28
    
        row_number() over (order by embedding <#> query_embedding) as rank_ix
    
    29
    
      from
    
    30
    
        documents
    
    31
    
      order by rank_ix
    
    32
    
      limit least(match_count, 30) * 2
    
    33
    
    )
    
    34
    
    select
    
    35
    
      documents.*
    
    36
    
    from
    
    37
    
      full_text
    
    38
    
      full outer join semantic
    
    39
    
        on full_text.id = semantic.id
    
    40
    
      join documents
    
    41
    
        on coalesce(full_text.id, semantic.id) = documents.id
    
    42
    
    order by
    
    43
    
      coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
    
    44
    
      coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
    
    45
    
      desc
    
    46
    
    limit
    
    47
    
      least(match_count, 30)
    
    48
    
    $$;
[/code]

Where:

  * **Parameters:** The function accepts quite a few parameters, but the main (required) ones are `query_text`, `query_embedding`, and `match_count`.

    * `query_text` is the user's query text (more on this shortly)
    * `query_embedding` is the vector representation of the user's query produced by the embedding model. We chose 512 dimensions for this example, but adjust this to match the size of the embedding vectors generated from your preferred model. This must match the size of the `embedding` vector on the `documents` table (and use the same model).
    * `match_count` is the number of records returned in the `limit` clause.

The other parameters are optional, but give more control over the fusion process.

    * `full_text_weight` and `semantic_weight` decide how much weight each search method gets in the final score. These are both 1 by default which means they both equally contribute towards the final rank. A `full_text_weight` of 2 and `semantic_weight` of 1 would give full-text search twice as much weight as semantic search.
    * `rrf_k` is the `k` smoothing constant added to the reciprocal rank. The default is 50.
  * **Return type:** The function returns a set of records from our `documents` table.

  * **CTE:** We create two [common table expressions (CTE)](<https://www.postgresql.org/docs/current/queries-with.html>), one for full-text search and one for semantic search. These perform each query individually prior to joining them.

  * **RRF:** The final query combines the results from the two CTEs using reciprocal rank fusion (RRF).


## Running hybrid search#

To use this function in SQL, we can run:
[code] 
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      hybrid_search(
    
    5
    
        'Italian recipes with tomato sauce', -- user query
    
    6
    
        '[...]'::extensions.vector(512), -- embedding generated from user query
    
    7
    
        10
    
    8
    
      );
[/code]

In practice, you will likely be calling this from the [Supabase client](</docs/reference/javascript/introduction>) or through a custom backend layer. Here is a quick example of how you might call this from an [Edge Function](</docs/guides/functions>) using JavaScript:
[code] 
    1
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    2
    
    import OpenAI from 'npm:openai'
    
    3
    
    4
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    
    5
    
    const supabaseSecretKey = Deno.env.get('SUPABASE_SECRET_KEY')!
    
    6
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
    
    7
    
    8
    
    Deno.serve(async (req) => {
    
    9
    
      // Grab the user's query from the JSON payload
    
    10
    
      const { query } = await req.json()
    
    11
    
    12
    
      // Instantiate OpenAI client
    
    13
    
      const openai = new OpenAI({ apiKey: openaiApiKey })
    
    14
    
    15
    
      // Generate a one-time embedding for the user's query
    
    16
    
      const embeddingResponse = await openai.embeddings.create({
    
    17
    
        model: 'text-embedding-3-large',
    
    18
    
        input: query,
    
    19
    
        dimensions: 512,
    
    20
    
      })
    
    21
    
    22
    
      const [{ embedding }] = embeddingResponse.data
    
    23
    
    24
    
      // Instantiate the Supabase client
    
    25
    
      // (replace service role key with user's JWT if using Supabase auth and RLS)
    
    26
    
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    
    27
    
    28
    
      // Call hybrid_search Postgres function via RPC
    
    29
    
      const { data: documents } = await supabase.rpc('hybrid_search', {
    
    30
    
        query_text: query,
    
    31
    
        query_embedding: embedding,
    
    32
    
        match_count: 10,
    
    33
    
      })
    
    34
    
    35
    
      return new Response(JSON.stringify(documents), {
    
    36
    
        headers: { 'Content-Type': 'application/json' },
    
    37
    
      })
    
    38
    
    })
[/code]

This uses OpenAI's `text-embedding-3-large` model to generate embeddings (shortened to 512 dimensions for faster retrieval). Swap in your preferred embedding model (and dimension size) accordingly.

To test this, make a `POST` request to the function's endpoint while passing in a JSON payload containing the user's query. Here is an example `POST` request using cURL:
[code] 
    1
    
    curl -i --location --request POST \
    
    2
    
      'http://127.0.0.1:54321/functions/v1/hybrid-search' \
    
    3
    
      --header 'Authorization: Bearer <anonymous key>' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data '{"query":"Italian recipes with tomato sauce"}'
[/code]

For more information on how to create, test, and deploy edge functions, see [Getting started](</docs/guides/functions/quickstart>).

## See also#

  * [Embedding concepts](</docs/guides/ai/concepts>)
  * [Vector columns](</docs/guides/ai/vector-columns>)
  * [Vector indexes](</docs/guides/ai/vector-indexes>)
  * [Semantic search](</docs/guides/ai/semantic-search>)
  * [Full text (keyword) search](</docs/guides/database/full-text-search>)