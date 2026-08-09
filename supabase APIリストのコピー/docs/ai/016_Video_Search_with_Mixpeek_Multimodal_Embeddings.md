---
タイトル: Video Search with Mixpeek Multimodal Embeddings
URL: https://supabase.com/docs/guides/ai/examples/mixpeek-video-search
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, embedding, embeddings, examples, mixpeek, mixpeek-video-search, multimodal, search, video, with
---

# Video Search with Mixpeek Multimodal Embeddings

**URL:** https://supabase.com/docs/guides/ai/examples/mixpeek-video-search
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, embedding, embeddings, examples, mixpeek, mixpeek-video-search, multimodal, search, video, with

## 目次

- [Create a new Python project with Poetry#](#create-a-new-python-project-with-poetry)
- [Setup Supabase project#](#setup-supabase-project)
- [Install the dependencies#](#install-the-dependencies)
- [Import the necessary dependencies#](#import-the-necessary-dependencies)
- [Create embeddings for your videos#](#create-embeddings-for-your-videos)
- [Perform a video search from a text query#](#perform-a-video-search-from-a-text-query)
- [Conclusion#](#conclusion)

## 概要

Implement video search with the Mixpeek Multimodal Embed API and Supabase Vector.

---

The [Mixpeek Embed API](<https://docs.mixpeek.com/api-documentation/inference/embed>) allows you to generate embeddings for various types of content, including videos and text. You can use these embeddings for:

  * Text-to-Video / Video-To-Text / Video-to-Video / Text-to-Text Search
  * Fine-tuning on your own video and text data


This guide demonstrates how to implement video search using Mixpeek Embed for video processing and embedding, and Supabase Vector for storing and querying embeddings.

## Create a new Python project with Poetry#

[Poetry](<https://python-poetry.org/>) provides packaging and dependency management for Python. If you haven't already, install poetry via pip:
[code] 
    1
    
    pip install poetry
[/code]

Then initialize a new project:
[code] 
    1
    
    poetry new video-search
[/code]

## Setup Supabase project#

If you haven't already, [install the Supabase CLI](</docs/guides/local-development>), then initialize Supabase in the root of your newly created poetry project:
[code] 
    1
    
    supabase init
[/code]

Next, start your local Supabase stack:
[code] 
    1
    
    supabase start
[/code]

This will start up the Supabase stack locally and print out a bunch of environment details, including your local `DB URL`. Make a note of that for later use.

## Install the dependencies#

Add the following dependencies to your project:

  * [`supabase`](<https://github.com/supabase-community/supabase-py>): Supabase Python Client
  * [`mixpeek`](<https://github.com/mixpeek/python-sdk>): Mixpeek Python Client for embedding generation


[code] 
    1
    
    poetry add supabase mixpeek
[/code]

## Import the necessary dependencies#

At the top of your main Python script, import the dependencies and store your environment variables:
[code] 
    1
    
    from supabase import create_client, Client
    
    2
    
    from mixpeek import Mixpeek
    
    3
    
    import os
    
    4
    
    5
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    
    6
    
    SUPABASE_KEY = os.getenv("SUPABASE_API_KEY")
    
    7
    
    MIXPEEK_API_KEY = os.getenv("MIXPEEK_API_KEY")
[/code]

## Create embeddings for your videos#

Next, create a `seed` method, which will create a new Supabase table, generate embeddings for your video chunks, and insert the embeddings into your database:
[code] 
    1
    
    def seed():
    
    2
    
        # Initialize Supabase and Mixpeek clients
    
    3
    
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    4
    
        mixpeek = Mixpeek(MIXPEEK_API_KEY)
    
    5
    
    6
    
        # Create a table for storing video chunk embeddings
    
    7
    
        supabase.table("video_chunks").create({
    
    8
    
            "id": "text",
    
    9
    
            "start_time": "float8",
    
    10
    
            "end_time": "float8",
    
    11
    
            "embedding": "extensions.vector(768)",
    
    12
    
            "metadata": "jsonb"
    
    13
    
        })
    
    14
    
    15
    
        # Process and embed video
    
    16
    
        video_url = "https://example.com/your_video.mp4"
    
    17
    
        processed_chunks = mixpeek.tools.video.process(
    
    18
    
            video_source=video_url,
    
    19
    
            chunk_interval=1,  # 1 second intervals
    
    20
    
            resolution=[720, 1280]
    
    21
    
        )
    
    22
    
    23
    
        for chunk in processed_chunks:
    
    24
    
            print(f"Processing video chunk: {chunk['start_time']}")
    
    25
    
    26
    
            # Generate embedding using Mixpeek
    
    27
    
            embed_response = mixpeek.embed.video(
    
    28
    
                model_id="vuse-generic-v1",
    
    29
    
                input=chunk['base64_chunk'],
    
    30
    
                input_type="base64"
    
    31
    
            )
    
    32
    
    33
    
            # Insert into Supabase
    
    34
    
            supabase.table("video_chunks").insert({
    
    35
    
                "id": f"chunk_{chunk['start_time']}",
    
    36
    
                "start_time": chunk["start_time"],
    
    37
    
                "end_time": chunk["end_time"],
    
    38
    
                "embedding": embed_response['embedding'],
    
    39
    
                "metadata": {"video_url": video_url}
    
    40
    
            }).execute()
    
    41
    
    42
    
        print("Video processed and embeddings inserted")
    
    43
    
    44
    
        # Create index for fast search performance
    
    45
    
        supabase.query("CREATE INDEX ON video_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)").execute()
    
    46
    
        print("Created index")
[/code]

Add this method as a script in your `pyproject.toml` file:
[code] 
    1
    
    [tool.poetry.scripts]
    
    2
    
    seed = "video_search.main:seed"
    
    3
    
    search = "video_search.main:search"
[/code]

After activating the virtual environment with `poetry shell`, you can now run your seed script via `poetry run seed`. You can inspect the generated embeddings in your local database by visiting the local Supabase dashboard at [localhost:54323](<http://localhost:54323/project/default/editor>).

## Perform a video search from a text query#

With Supabase Vector, you can query your embeddings. You can use either a video clip as search input or alternatively, you can generate an embedding from a string input and use that as the query input:
[code] 
    1
    
    def search():
    
    2
    
        # Initialize Supabase and Mixpeek clients
    
    3
    
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    4
    
        mixpeek = Mixpeek(MIXPEEK_API_KEY)
    
    5
    
    6
    
        # Generate embedding for text query
    
    7
    
        query_string = "a car chase scene"
    
    8
    
        text_emb = mixpeek.embed.video(
    
    9
    
            model_id="vuse-generic-v1",
    
    10
    
            input=query_string,
    
    11
    
            input_type="text"
    
    12
    
        )
    
    13
    
    14
    
        # Query the collection
    
    15
    
        results = supabase.rpc(
    
    16
    
            'match_video_chunks',
    
    17
    
            {
    
    18
    
                'query_embedding': text_emb['embedding'],
    
    19
    
                'match_threshold': 0.8,
    
    20
    
                'match_count': 5
    
    21
    
            }
    
    22
    
        ).execute()
    
    23
    
    24
    
        # Display the results
    
    25
    
        if results.data:
    
    26
    
            for result in results.data:
    
    27
    
                print(f"Matched chunk from {result['start_time']} to {result['end_time']} seconds")
    
    28
    
                print(f"Video URL: {result['metadata']['video_url']}")
    
    29
    
                print(f"Similarity: {result['similarity']}")
    
    30
    
                print("---")
    
    31
    
        else:
    
    32
    
            print("No matching video chunks found")
[/code]

This query will return the top 5 most similar video chunks from your database.

You can now test it out by running `poetry run search`, and you will be presented with the most relevant video chunks to the query "a car chase scene".

## Conclusion#

With a couple of Python scripts, you are able to implement video search as well as reverse video search using Mixpeek Embed and Supabase Vector. This approach allows for semantic search capabilities that can be integrated into various applications, enabling you to search through video content using both text and video queries.