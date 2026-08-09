---
タイトル: Amazon Bedrock
URL: https://supabase.com/docs/guides/ai/integrations/amazon-bedrock
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, amazon, amazon-bedrock, bedrock, integrations
---

# Amazon Bedrock

**URL:** https://supabase.com/docs/guides/ai/integrations/amazon-bedrock
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, amazon, amazon-bedrock, bedrock, integrations

## 目次

- [Create an environment#](#create-an-environment)
- [Create embeddings#](#create-embeddings)
  - [Store the embeddings with vecs#](#store-the-embeddings-with-vecs)
  - [Querying for most similar sentences#](#querying-for-most-similar-sentences)
- [Resources#](#resources)

## 概要

Learn how to integrate Supabase with Amazon Bedrock, a fully managed service of high-performing foundation models.

---

[Amazon Bedrock](<https://aws.amazon.com/bedrock>) is a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies like AI21 Labs, Anthropic, Cohere, Meta, Mistral AI, Stability AI, and Amazon. Each model is accessible through a common API which implements a broad set of features to help build generative AI applications with security, privacy, and responsible AI in mind.

This guide will walk you through an example using Amazon Bedrock SDK with `vecs`. We will create embeddings using the Amazon Titan Embeddings G1 – Text v1.2 (amazon.titan-embed-text-v1) model, insert these embeddings into a Postgres database using vecs, and then query the collection to find the most similar sentences to a given query sentence.

## Create an environment#

First, you need to set up your environment. You will need Python 3.7+ with the `vecs` and `boto3` libraries installed.

You can install the necessary Python libraries using pip:
[code] 
    1
    
    pip install vecs boto3
[/code]

You'll also need:

  * [Credentials to your AWS account](<https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html>)
  * [A Postgres database with the pgvector extension](</docs/guides/database/extensions/pgvector>)


## Create embeddings#

Next, we will use Amazon’s Titan Embedding G1 - Text v1.2 model to create embeddings for a set of sentences.
[code] 
    1
    
    import boto3
    
    2
    
    import vecs
    
    3
    
    import json
    
    4
    
    5
    
    client = boto3.client(
    
    6
    
        'bedrock-runtime',
    
    7
    
        region_name='us-east-1',
    
    8
    
    	# Credentials from your AWS account
    
    9
    
        aws_access_key_id='<replace_your_own_credentials>',
    
    10
    
        aws_secret_access_key='<replace_your_own_credentials>',
    
    11
    
        aws_session_token='<replace_your_own_credentials>',
    
    12
    
    )
    
    13
    
    14
    
    dataset = [
    
    15
    
        "The cat sat on the mat.",
    
    16
    
        "The quick brown fox jumps over the lazy dog.",
    
    17
    
        "Friends, Romans, countrymen, lend me your ears",
    
    18
    
        "To be or not to be, that is the question.",
    
    19
    
    ]
    
    20
    
    21
    
    embeddings = []
    
    22
    
    23
    
    for sentence in dataset:
    
    24
    
        # invoke the embeddings model for each sentence
    
    25
    
        response = client.invoke_model(
    
    26
    
            body= json.dumps({"inputText": sentence}),
    
    27
    
            modelId= "amazon.titan-embed-text-v1",
    
    28
    
            accept = "application/json",
    
    29
    
            contentType = "application/json"
    
    30
    
        )
    
    31
    
        # collect the embedding from the response
    
    32
    
        response_body = json.loads(response["body"].read())
    
    33
    
        # add the embedding to the embedding list
    
    34
    
        embeddings.append((sentence, response_body.get("embedding"), {}))
[/code]

### Store the embeddings with vecs#

Now that we have our embeddings, we can insert them into a Postgres database using vecs.
[code] 
    1
    
    import vecs
    
    2
    
    3
    
    DB_CONNECTION = "postgresql://<user>:<password>@<host>:<port>/<db_name>"
    
    4
    
    5
    
    # create vector store client
    
    6
    
    vx = vecs.Client(DB_CONNECTION)
    
    7
    
    8
    
    # create a collection named 'sentences' with 1536 dimensional vectors
    
    9
    
    # to match the default dimension of the Titan Embeddings G1 - Text model
    
    10
    
    sentences = vx.get_or_create_collection(name="sentences", dimension=1536)
    
    11
    
    12
    
    # upsert the embeddings into the 'sentences' collection
    
    13
    
    sentences.upsert(records=embeddings)
    
    14
    
    15
    
    # create an index for the 'sentences' collection
    
    16
    
    sentences.create_index()
[/code]

### Querying for most similar sentences#

Now, we query the `sentences` collection to find the most similar sentences to a sample query sentence. First need to create an embedding for the query sentence. Next, we query the collection we created earlier to find the most similar sentences.
[code] 
    1
    
    query_sentence = "A quick animal jumps over a lazy one."
    
    2
    
    3
    
    # create vector store client
    
    4
    
    vx = vecs.Client(DB_CONNECTION)
    
    5
    
    6
    
    # create an embedding for the query sentence
    
    7
    
    response = client.invoke_model(
    
    8
    
            body= json.dumps({"inputText": query_sentence}),
    
    9
    
            modelId= "amazon.titan-embed-text-v1",
    
    10
    
            accept = "application/json",
    
    11
    
            contentType = "application/json"
    
    12
    
        )
    
    13
    
    14
    
    response_body = json.loads(response["body"].read())
    
    15
    
    16
    
    query_embedding = response_body.get("embedding")
    
    17
    
    18
    
    # query the 'sentences' collection for the most similar sentences
    
    19
    
    results = sentences.query(
    
    20
    
        data=query_embedding,
    
    21
    
        limit=3,
    
    22
    
        include_value = True
    
    23
    
    )
    
    24
    
    25
    
    # print the results
    
    26
    
    for result in results:
    
    27
    
        print(result)
[/code]

This returns the most similar 3 records and their distance to the query vector.
[code] 
    1
    
    ('The quick brown fox jumps over the lazy dog.', 0.27600620558852)
    
    2
    
    ('The cat sat on the mat.', 0.609986272479202)
    
    3
    
    ('To be or not to be, that is the question.', 0.744849503688346)
[/code]

## Resources#

  * [Amazon Bedrock](<https://aws.amazon.com/bedrock>)
  * [Amazon Titan](<https://aws.amazon.com/bedrock/titan>)
  * [Semantic Image Search with Amazon Titan](</docs/guides/ai/examples/semantic-image-search-amazon-titan>)