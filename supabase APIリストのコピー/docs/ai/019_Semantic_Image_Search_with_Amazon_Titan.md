---
タイトル: Semantic Image Search with Amazon Titan
URL: https://supabase.com/docs/guides/ai/examples/semantic-image-search-amazon-titan
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, amazon, examples, image, search, semantic, semantic-image-search-amazon-titan, titan, with
---

# Semantic Image Search with Amazon Titan

**URL:** https://supabase.com/docs/guides/ai/examples/semantic-image-search-amazon-titan
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, amazon, examples, image, search, semantic, semantic-image-search-amazon-titan, titan, with

## 目次

- [Create a new Python project with Poetry#](#create-a-new-python-project-with-poetry)
- [Spin up a Postgres database with pgvector#](#spin-up-a-postgres-database-with-pgvector)
- [Install the dependencies#](#install-the-dependencies)
- [Import the necessary dependencies#](#import-the-necessary-dependencies)
- [Create embeddings for your images#](#create-embeddings-for-your-images)
- [Perform an image search from a text query#](#perform-an-image-search-from-a-text-query)
- [Conclusion#](#conclusion)

## 概要

Implement semantic image search with Amazon Titan and Supabase Vector in Python.

---

[Amazon Bedrock](<https://aws.amazon.com/bedrock>) is a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies like AI21 Labs, Anthropic, Cohere, Meta, Mistral AI, Stability AI, and Amazon. Each model is accessible through a common API which implements a broad set of features to help build generative AI applications with security, privacy, and responsible AI in mind.

[Amazon Titan](<https://aws.amazon.com/bedrock/titan/>) is a family of foundation models (FMs) for text and image generation, summarization, classification, open-ended Q&A, information extraction, and text or image search.

In this guide we'll look at how we can get started with Amazon Bedrock and Supabase Vector in Python using the Amazon Titan multimodal model and the [vecs client](</docs/guides/ai/vecs-python-client>).

You can find the full application code as a Python Poetry project on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/ai/aws_bedrock_image_search>).

## Create a new Python project with Poetry#

[Poetry](<https://python-poetry.org/>) provides packaging and dependency management for Python. If you haven't already, install poetry via pip:
[code] 
    1
    
    pip install poetry
[/code]

Then initialize a new project:
[code] 
    1
    
    poetry new aws_bedrock_image_search
[/code]

## Spin up a Postgres database with pgvector#

If you haven't already, head over to [database.new](<https://database.new>) and create a new project. Every Supabase project comes with a full Postgres database and the [pgvector extension](</docs/guides/database/extensions/pgvector>) preconfigured.

When creating your project, make sure to note down your database password as you will need it to construct the `DB_URL` in the next step.

You can find your database connection string on your project dashboard, click [Connect](</dashboard/project/_?showConnect=true>). Use the Session pooler connection string which looks like this:
[code] 
    1
    
    postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
[/code]

## Install the dependencies#

We will need to add the following dependencies to our project:

  * [`vecs`](<https://github.com/supabase/vecs#vecs>): Supabase Vector Python Client.
  * [`boto3`](<https://boto3.amazonaws.com/v1/documentation/api/latest/index.html>): AWS SDK for Python.
  * [`matplotlib`](<https://matplotlib.org/>): for displaying our image result.


[code] 
    1
    
    poetry add vecs boto3 matplotlib
[/code]

## Import the necessary dependencies#

At the top of your main python script, import the dependencies and store your `DB URL` from above in a variable:
[code] 
    1
    
    import sys
    
    2
    
    import boto3
    
    3
    
    import vecs
    
    4
    
    import json
    
    5
    
    import base64
    
    6
    
    from matplotlib import pyplot as plt
    
    7
    
    from matplotlib import image as mpimg
    
    8
    
    from typing import Optional
    
    9
    
    10
    
    DB_CONNECTION = "postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
[/code]

Next, get the [credentials to your AWS account](<https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html>) and instantiate the `boto3` client:
[code] 
    1
    
    bedrock_client = boto3.client(
    
    2
    
        'bedrock-runtime',
    
    3
    
        region_name='us-west-2',
    
    4
    
        # Credentials from your AWS account
    
    5
    
        aws_access_key_id='<replace_your_own_credentials>',
    
    6
    
        aws_secret_access_key='<replace_your_own_credentials>',
    
    7
    
        aws_session_token='<replace_your_own_credentials>',
    
    8
    
    )
[/code]

## Create embeddings for your images#

In the root of your project, create a new folder called `images` and add some images. You can use the images from the example project on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/ai/aws_bedrock_image_search/images>) or you can find license free images on [Unsplash](<https://unsplash.com>).

To send images to the Amazon Bedrock API we need to need to encode them as `base64` strings. Create the following helper methods:
[code] 
    1
    
    def readFileAsBase64(file_path):
    
    2
    
        """Encode image as base64 string."""
    
    3
    
        try:
    
    4
    
            with open(file_path, "rb") as image_file:
    
    5
    
                input_image = base64.b64encode(image_file.read()).decode("utf8")
    
    6
    
            return input_image
    
    7
    
        except:
    
    8
    
            print("bad file name")
    
    9
    
            sys.exit(0)
    
    10
    
    11
    
    12
    
    def construct_bedrock_image_body(base64_string):
    
    13
    
        """Construct the request body.
    
    14
    
    15
    
        https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-embed-mm.html
    
    16
    
        """
    
    17
    
        return json.dumps(
    
    18
    
            {
    
    19
    
                "inputImage": base64_string,
    
    20
    
                "embeddingConfig": {"outputEmbeddingLength": 1024},
    
    21
    
            }
    
    22
    
        )
    
    23
    
    24
    
    25
    
    def get_embedding_from_titan_multimodal(body):
    
    26
    
        """Invoke the Amazon Titan Model via API request."""
    
    27
    
        response = bedrock_client.invoke_model(
    
    28
    
            body=body,
    
    29
    
            modelId="amazon.titan-embed-image-v1",
    
    30
    
            accept="application/json",
    
    31
    
            contentType="application/json",
    
    32
    
        )
    
    33
    
    34
    
        response_body = json.loads(response.get("body").read())
    
    35
    
        print(response_body)
    
    36
    
        return response_body["embedding"]
    
    37
    
    38
    
    39
    
    def encode_image(file_path):
    
    40
    
        """Generate embedding for the image at file_path."""
    
    41
    
        base64_string = readFileAsBase64(file_path)
    
    42
    
        body = construct_bedrock_image_body(base64_string)
    
    43
    
        emb = get_embedding_from_titan_multimodal(body)
    
    44
    
        return emb
[/code]

Next, create a `seed` method, which will create a new Supabase Vector Collection, generate embeddings for your images, and upsert the embeddings into your database:
[code] 
    1
    
    def seed():
    
    2
    
        # create vector store client
    
    3
    
        vx = vecs.create_client(DB_CONNECTION)
    
    4
    
    5
    
        # get or create a collection of vectors with 1024 dimensions
    
    6
    
        images = vx.get_or_create_collection(name="image_vectors", dimension=1024)
    
    7
    
    8
    
        # Generate image embeddings with Amazon Titan Model
    
    9
    
        img_emb1 = encode_image('./images/one.jpg')
    
    10
    
        img_emb2 = encode_image('./images/two.jpg')
    
    11
    
        img_emb3 = encode_image('./images/three.jpg')
    
    12
    
        img_emb4 = encode_image('./images/four.jpg')
    
    13
    
    14
    
        # add records to the *images* collection
    
    15
    
        images.upsert(
    
    16
    
            records=[
    
    17
    
                (
    
    18
    
                    "one.jpg",       # the vector's identifier
    
    19
    
                    img_emb1,        # the vector. list or np.array
    
    20
    
                    {"type": "jpg"}  # associated  metadata
    
    21
    
                ), (
    
    22
    
                    "two.jpg",
    
    23
    
                    img_emb2,
    
    24
    
                    {"type": "jpg"}
    
    25
    
                ), (
    
    26
    
                    "three.jpg",
    
    27
    
                    img_emb3,
    
    28
    
                    {"type": "jpg"}
    
    29
    
                ), (
    
    30
    
                    "four.jpg",
    
    31
    
                    img_emb4,
    
    32
    
                    {"type": "jpg"}
    
    33
    
                )
    
    34
    
            ]
    
    35
    
        )
    
    36
    
        print("Inserted images")
    
    37
    
    38
    
        # index the collection for fast search performance
    
    39
    
        images.create_index()
    
    40
    
        print("Created index")
[/code]

Add this method as a script in your `pyproject.toml` file:
[code] 
    1
    
    [tool.poetry.scripts]
    
    2
    
    seed = "image_search.main:seed"
    
    3
    
    search = "image_search.main:search"
[/code]

After activating the virtual environment with `poetry shell` you can now run your seed script via `poetry run seed`. You can inspect the generated embeddings in your Supabase Dashboard by visiting the [Table Editor](</dashboard/project/_/editor>), selecting the `vecs` schema, and the `image_vectors` table.

## Perform an image search from a text query#

We can use Supabase Vector to query our embeddings. We can either use an image as the search input or generate an embedding from a string input:
[code] 
    1
    
    def search(query_term: Optional[str] = None):
    
    2
    
        if query_term is None:
    
    3
    
            query_term = sys.argv[1]
    
    4
    
    5
    
        # create vector store client
    
    6
    
        vx = vecs.create_client(DB_CONNECTION)
    
    7
    
        images = vx.get_or_create_collection(name="image_vectors", dimension=1024)
    
    8
    
    9
    
        # Encode text query
    
    10
    
        text_emb = get_embedding_from_titan_multimodal(json.dumps(
    
    11
    
            {
    
    12
    
                "inputText": query_term,
    
    13
    
                "embeddingConfig": {"outputEmbeddingLength": 1024},
    
    14
    
            }
    
    15
    
        ))
    
    16
    
    17
    
        # query the collection filtering metadata for "type" = "jpg"
    
    18
    
        results = images.query(
    
    19
    
            data=text_emb,                      # required
    
    20
    
            limit=1,                            # number of records to return
    
    21
    
            filters={"type": {"$eq": "jpg"}},   # metadata filters
    
    22
    
        )
    
    23
    
        result = results[0]
    
    24
    
        print(result)
    
    25
    
        plt.title(result)
    
    26
    
        image = mpimg.imread('./images/' + result)
    
    27
    
        plt.imshow(image)
    
    28
    
        plt.show()
[/code]

By limiting the query to one result, we can show the most relevant image to the user. Finally we use `matplotlib` to show the image result to the user.

Go ahead and test it out by running `poetry run search` and you will be presented with an image of a "bike in front of a red brick wall".

## Conclusion#

With a couple of lines of Python you are able to implement image search as well as reverse image search using the Amazon Titan multimodal model and Supabase Vector.