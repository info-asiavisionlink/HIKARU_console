---
タイトル: AWS S3 Vectors
URL: https://supabase.com/docs/guides/database/extensions/wrappers/s3_vectors
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, s3_vectors, vector, vectors, wrappers
---

# AWS S3 Vectors

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/s3_vectors
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, s3_vectors, vector, vectors, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the S3 Vectors Wrapper#](#enable-the-s3-vectors-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to S3 Vectors#](#connecting-to-s3-vectors)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [S3 Vector Tables#](#s3-vector-tables)
  - [Custom Data Types#](#custom-data-types)
  - [Functions#](#functions)
- [Query Pushdown Support#](#query-pushdown-support)
  - [Vector Similarity Search (ANN)#](#vector-similarity-search-ann)
  - [Key-based Queries#](#key-based-queries)
  - [Supported Query Patterns#](#supported-query-patterns)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic Setup#](#basic-setup)
  - [Querying Vectors#](#querying-vectors)
  - [Inserting Vectors#](#inserting-vectors)
  - [Deleting Vectors#](#deleting-vectors)
  - [Vector Similarity Search with Filtering#](#vector-similarity-search-with-filtering)
  - [Advanced Example: Semantic Search#](#advanced-example-semantic-search)

## 概要

Searchdocs...

---

You can enable the AWS S3 Vectors wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/s3_vectors_wrapper/overview>)

# S3 Vectors

[AWS S3 Vectors](<https://aws.amazon.com/s3/features/vectors/>) is a managed service that stores and queries high-dimensional vectors at scale, optimized for machine learning and artificial intelligence applications.

The S3 Vectors Wrapper allows you to read, write, and perform vector similarity search operations on S3 Vectors within your Postgres database.

## Preparation#

Before you can query S3 Vectors, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the S3 Vectors Wrapper#

Enable the `s3_vectors_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper s3_vectors_wrapper
    
    2
    
      handler s3_vectors_fdw_handler
    
    3
    
      validator s3_vectors_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your AWS credentials in Vault and retrieve the created
    
    2
    
    -- `vault_access_key_id` and `vault_secret_access_key`
    
    3
    
    select vault.create_secret(
    
    4
    
      '<access key id>',  -- secret to be encrypted
    
    5
    
      'vault_access_key_id',  -- secret name
    
    6
    
      'AWS access key for Wrappers'  -- secret description
    
    7
    
    );
    
    8
    
    select vault.create_secret(
    
    9
    
      '<secret access key>',
    
    10
    
      'vault_secret_access_key',
    
    11
    
      'AWS secret access key for Wrappers'
    
    12
    
    );
[/code]

### Connecting to S3 Vectors#

We need to provide Postgres with the credentials to connect to S3 Vectors. We can do this using the `create server` command.

With VaultWithout Vault
[code]
    1
    
    create server s3_vectors_server
    
    2
    
      foreign data wrapper s3_vectors_wrapper
    
    3
    
      options (
    
    4
    
        -- The key id saved in Vault from above
    
    5
    
        vault_access_key_id '<key_ID>',
    
    6
    
    7
    
        -- The secret id saved in Vault from above
    
    8
    
        vault_secret_access_key '<secret_key>',
    
    9
    
    10
    
        -- AWS region
    
    11
    
        aws_region 'us-east-1',
    
    12
    
    13
    
        -- Optional: Custom endpoint URL for alternative S3 services
    
    14
    
        endpoint_url 'http://localhost:8080'
    
    15
    
      );
[/code]

#### Additional Server Options#

  * `batch_size` \- Controls the batch size of vectors read from or written to remote. Minimum value of 1, maximum value of 500, default value of 300.


### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists s3_vectors;
[/code]

## Options#

The full list of foreign table options are below:

  * `bucket_name` \- The name of the S3 Vector bucket, required.
  * `index_name` \- The name of the S3 Vector index, required.
  * `rowid_column` \- The column to use as the row identifier for INSERT/DELETE operations, required.


## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from S3 Vectors.

For example, using below SQL can automatically create foreign tables in the `s3_vectors` schema.
[code] 
    1
    
    -- create foreign table for each index from S3 Vector bucket
    
    2
    
    import foreign schema "my-vector-bucket"
    
    3
    
      from server s3_vectors_server into s3_vectors;
[/code]

### S3 Vector Tables#

This is an object representing S3 Vector index.

Ref: [S3 Vectors API Reference](<https://docs.aws.amazon.com/AmazonS3/latest/API/API_Operations_Amazon_S3_Vectors.html>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
table| ✅| ✅| ❌| ✅| ❌  
  
#### Usage#

You can also manually create the foreign table like below if you did not use `import foreign schema`.
[code] 
    1
    
    create foreign table s3_vectors.embeddings (
    
    2
    
      key text not null,
    
    3
    
      data s3vec not null,
    
    4
    
      metadata jsonb
    
    5
    
    )
    
    6
    
      server s3_vectors_server
    
    7
    
      options (
    
    8
    
        bucket_name 'my-vector-bucket',
    
    9
    
        index_name 'my-vector-index',
    
    10
    
        rowid_column 'key'
    
    11
    
      );
[/code]

### Custom Data Types#

#### s3vec#

The `s3vec` type is a custom PostgreSQL data type designed to store and work with high-dimensional vectors for machine learning and AI applications.

**Structure:**

The `s3vec` type internally contains:

  * Vector data as an array of 32-bit floating point numbers (Float32)
  * Additional metadata fields for internal use


**Input Formats:**

The `s3vec` type accepts input in JSON array format:
[code] 
    1
    
    -- Simple array format (most common)
    
    2
    
    '[0.1, 0.2, 0.3, 0.4, 0.5]'::s3vec
    
    3
    
    4
    
    -- Full JSON object format (advanced)
    
    5
    
    '{"data": [0.1, 0.2, 0.3], "key": "vector_001"}'::s3vec
[/code]

**Output Format:**

When displayed, the `s3vec` type shows a summary format:
[code] 
    1
    
    s3vec:5  -- indicates an embedding with 5 dimensions
[/code]

**Usage Examples:**

See the following sections for complete examples:

  * Inserting Vectors \- Examples of inserting data with `s3vec` type
  * Querying Vectors \- Basic queries and vector similarity search
  * Vector Similarity Search with Filtering \- Advanced search with metadata filtering
  * Advanced Example: Semantic Search \- Complete semantic search implementation


**Operations:**

  * **Vector similarity search** : Use the `<==>` operator for approximate nearest neighbor search
  * **Distance calculation** : Use `s3vec_distance()` function to get similarity scores
  * **Type casting** : Convert JSON arrays to `s3vec` type using `::s3vec` cast


**Constraints:**

  * Only supports 32-bit floating point vectors (Float32)
  * Vector dimensions should be consistent within the same index
  * Cannot be null when used as vector data in S3 Vectors tables


### Functions#

#### s3vec_distance(s3vec)#

Returns the distance score from the most recent vector similarity search operation.

**Syntax:**
[code] 
    1
    
    s3vec_distance(vector_data) -> real
[/code]

**Parameters:**

  * `vector_data` \- An `s3vec` type column containing vector data


**Returns:**

  * `real` \- The distance score from the vector similarity search. This value is only meaningful when used in queries with the `<==>` operator for vector similarity search.


**Usage:**
[code] 
    1
    
    -- Get similarity search results with distance scores
    
    2
    
    select s3vec_distance(data) as distance, key, metadata
    
    3
    
    from s3_vectors.embeddings
    
    4
    
    where data <==> '[0.1, 0.2, 0.3, 0.4, 0.5]'::s3vec
    
    5
    
    order by 1
    
    6
    
    limit 5;
[/code]

**Notes:**

  * The distance value is only populated during vector similarity search operations using the `<==>` operator
  * For other query types (key-based lookups, list all), the distance will be 0.0
  * Lower distance values indicate higher similarity


## Query Pushdown Support#

This FDW supports limited query pushdown with specific operators based on the type of operation:

### Vector Similarity Search (ANN)#

For approximate nearest neighbor search using the `<==>` operator:

Operation| Note  
---|---  
`data <==> vector_value`| Vector similarity search with embeddings  
`metadata <==> json_filter`| Metadata filtering using S3 Vectors filter expressions  
  
**Metadata Filtering Syntax:**

The `json_filter` uses S3 Vectors metadata filtering expressions with the following operators:

  * **Equality** : `$eq`, `$ne` \- Exact match or not equal
  * **Numeric Comparisons** : `$gt`, `$gte`, `$lt`, `$lte` \- Greater than, less than comparisons
  * **Array Operations** : `$in`, `$nin` \- Match any/none of the values in array
  * **Existence Check** : `$exists` \- Check if field exists
  * **Logical Operations** : `$and`, `$or` \- Combine multiple conditions


**Examples:**
[code] 
    1
    
    -- Simple equality
    
    2
    
    metadata <==> '{"category": "electronics"}'::jsonb
    
    3
    
    4
    
    -- Numeric range
    
    5
    
    metadata <==> '{"price": {"$gte": 100, "$lte": 500}}'::jsonb
    
    6
    
    7
    
    -- Array matching
    
    8
    
    metadata <==> '{"tags": {"$in": ["popular", "trending"]}}'::jsonb
    
    9
    
    10
    
    -- Complex logical conditions
    
    11
    
    metadata <==> '{"$and": [{"category": "books"}, {"year": {"$gte": 2020}}]}'::jsonb
[/code]

For more details on metadata filtering syntax, see the [AWS S3 Vectors metadata filtering documentation](<https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-metadata-filtering.html>).

### Key-based Queries#

For exact key lookups:

Operation| Note  
---|---  
`key = 'value'`| Exact key match  
`key in ('val1', 'val2')`| Multiple key lookup  
  
### Supported Query Patterns#

  1. **List all vectors** (no WHERE clause):
[code] 1
         
         select * from s3_vectors.embeddings;
[/code]

  2. **Get a specific vector by key** :
[code] 1
         
         select * from s3_vectors.embeddings where key = 'vector_001';
[/code]

  3. **Vector similarity search** :
[code] 1
         
         select s3vec_distance(data) as distance, *
         
         2
         
         from s3_vectors.embeddings
         
         3
         
         where data <==> '[0.1, 0.2, 0.3, ...]'::s3vec
         
         4
         
         order by 1
         
         5
         
         limit 10;
[/code]

  4. **Vector search with metadata filtering** :
[code] 1
         
         select s3vec_distance(data) as distance, *
         
         2
         
         from s3_vectors.embeddings
         
         3
         
         where data <==> '[0.1, 0.2, 0.3, ...]'::s3vec
         
         4
         
         and metadata <==> '{"category": "product"}'::jsonb
         
         5
         
         order by 1
         
         6
         
         limit 5;
[/code]


Only above specific query patterns are supported. Complex queries with unsupported operators or combinations may result in errors.

## Supported Data Types#

Postgres Type| S3 Vectors Type  
---|---  
text| String (for vector key)  
s3vec| Float32 vector data  
jsonb| Document metadata  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Only supports specific query patterns as described in the Query Pushdown section
  * Vector similarity search is limited to Float32 vectors
  * UPDATE operations are not supported (use DELETE + INSERT instead)
  * Complex WHERE clauses with AND/OR combinations are not supported except for specific vector search patterns
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

### Basic Setup#

First, create a server for S3 Vectors:
[code] 
    1
    
    create server s3_vectors_server
    
    2
    
      foreign data wrapper s3_vectors_wrapper
    
    3
    
      options (
    
    4
    
        aws_access_key_id '<AWS_access_key_ID>',
    
    5
    
        aws_secret_access_key '<AWS_secret_access_key>',
    
    6
    
        aws_region 'us-east-1'
    
    7
    
      );
[/code]

Import the foreign table:
[code] 
    1
    
    -- Import all indexes from a vector bucket
    
    2
    
    import foreign schema "my-vector-bucket"
    
    3
    
      from server s3_vectors_server into s3_vectors;
    
    4
    
    5
    
    -- or, create the foreign table manually
    
    6
    
    create foreign table if not exists s3_vectors.embeddings (
    
    7
    
      key text not null,
    
    8
    
      data s3vec not null,
    
    9
    
      metadata jsonb
    
    10
    
    )
    
    11
    
      server s3_vectors_server
    
    12
    
      options (
    
    13
    
        bucket_name 'my-vector-bucket',
    
    14
    
        index_name 'my-vector-index',
    
    15
    
        rowid_column 'key'
    
    16
    
      );
[/code]

### Querying Vectors#
[code] 
    1
    
    -- List all vectors in an index
    
    2
    
    select * from s3_vectors.embeddings;
    
    3
    
    4
    
    -- Get specific vector by key
    
    5
    
    select * from s3_vectors.embeddings where key = 'product_001';
    
    6
    
    7
    
    -- Vector similarity search (top 5 similar vectors)
    
    8
    
    select s3vec_distance(data) as distance, key, metadata
    
    9
    
    from s3_vectors.embeddings
    
    10
    
    where data <==> '[0.1, 0.2, 0.3, 0.4, 0.5]'::s3vec
    
    11
    
    order by 1
    
    12
    
    limit 5;
[/code]

### Inserting Vectors#
[code] 
    1
    
    -- Insert a single vector
    
    2
    
    insert into s3_vectors.embeddings (key, data, metadata)
    
    3
    
    values (
    
    4
    
      'product_001',
    
    5
    
      '[0.1, 0.2, 0.3, 0.4, 0.5]'::s3vec,
    
    6
    
      '{"category": "electronics", "price": 299.99}'::jsonb
    
    7
    
    );
    
    8
    
    9
    
    -- Insert multiple vectors
    
    10
    
    insert into s3_vectors.embeddings (key, data, metadata)
    
    11
    
    values
    
    12
    
      ('product_002', '[0.2, 0.3, 0.4, 0.5, 0.6]'::s3vec, '{"category": "books"}'::jsonb),
    
    13
    
      ('product_003', '[0.3, 0.4, 0.5, 0.6, 0.7]'::s3vec, '{"category": "clothing"}'::jsonb);
[/code]

### Deleting Vectors#
[code] 
    1
    
    -- Delete a specific vector by key
    
    2
    
    delete from s3_vectors.embeddings where key = 'product_001';
    
    3
    
    4
    
    -- Delete all vectors
    
    5
    
    delete from s3_vectors.embeddings;
[/code]

### Vector Similarity Search with Filtering#
[code] 
    1
    
    -- Find similar vectors with metadata filtering
    
    2
    
    select s3vec_distance(data) as distance, key, metadata
    
    3
    
    from s3_vectors.embeddings
    
    4
    
    where data <==> '[0.1, 0.2, 0.3, 0.4, 0.5]'::s3vec
    
    5
    
    and metadata <==> '{"category": "electronics"}'::jsonb
    
    6
    
    order by 1
    
    7
    
    limit 3;
[/code]

### Advanced Example: Semantic Search#
[code] 
    1
    
    -- Create a function to convert text to embeddings (pseudo-code)
    
    2
    
    -- This would typically use an external embedding service
    
    3
    
    create or replace function text_to_embedding(input_text text)
    
    4
    
    returns s3vec
    
    5
    
    language sql
    
    6
    
    as $$
    
    7
    
      -- This is a placeholder - you would implement actual text embedding logic
    
    8
    
      select '[0.1, 0.2, 0.3, 0.4, 0.5]'::s3vec;
    
    9
    
    $$;
    
    10
    
    11
    
    -- Semantic search example
    
    12
    
    select s3vec_distance(data) as distance, key, metadata
    
    13
    
    from s3_vectors.embeddings
    
    14
    
    where data <==> text_to_embedding('Find similar products')
    
    15
    
    and metadata <==> '{"status": "active"}'::jsonb
    
    16
    
    order by 1
    
    17
    
    limit 10;
[/code]