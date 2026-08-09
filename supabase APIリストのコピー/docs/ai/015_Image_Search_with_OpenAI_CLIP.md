---
タイトル: Image Search with OpenAI CLIP
URL: https://supabase.com/docs/guides/ai/examples/image-search-openai-clip
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, cli, clip, examples, image, image-search-openai-clip, openai, search, with
---

# Image Search with OpenAI CLIP

**URL:** https://supabase.com/docs/guides/ai/examples/image-search-openai-clip
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, cli, clip, examples, image, image-search-openai-clip, openai, search, with

## 目次

- [Create a new Python project with Poetry#](#create-a-new-python-project-with-poetry)
- [Setup Supabase project#](#setup-supabase-project)
- [Install the dependencies#](#install-the-dependencies)
- [Import the necessary dependencies#](#import-the-necessary-dependencies)
- [Create embeddings for your images#](#create-embeddings-for-your-images)
- [Perform an image search from a text query#](#perform-an-image-search-from-a-text-query)
- [Conclusion#](#conclusion)

## 概要

Implement image search with the OpenAI CLIP Model and Supabase Vector.

---

The [OpenAI CLIP Model](<https://github.com/openai/CLIP>) was trained on a variety of (image, text)-pairs. You can use the CLIP model for:

  * Text-to-Image / Image-To-Text / Image-to-Image / Text-to-Text Search
  * You can fine-tune it on your own image and text data with the regular `SentenceTransformers` training code.


[`SentenceTransformers`](<https://www.sbert.net/examples/applications/image-search/README.html>) provides models that allow you to embed images and text into the same vector space. You can use this to find similar images as well as to implement image search.

You can find the full application code as a Python Poetry project on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/ai/image_search#image-search-with-supabase-vector>).

## Create a new Python project with Poetry#

[Poetry](<https://python-poetry.org/>) provides packaging and dependency management for Python. If you haven't already, install poetry via pip:
[code] 
    1
    
    pip install poetry
[/code]

Then initialize a new project:
[code] 
    1
    
    poetry new image-search
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

This will start up the Supabase stack locally and print out a bunch of environment details, including your local `DB URL`. Make a note of that for later user.

## Install the dependencies#

We will need to add the following dependencies to our project:

  * [`vecs`](<https://github.com/supabase/vecs#vecs>): Supabase Vector Python Client.
  * [`sentence-transformers`](<https://huggingface.co/sentence-transformers/clip-ViT-B-32>): a framework for sentence, text and image embeddings (used with OpenAI CLIP model)
  * [`matplotlib`](<https://matplotlib.org/>): for displaying our image result


[code] 
    1
    
    poetry add vecs sentence-transformers matplotlib
[/code]

## Import the necessary dependencies#

At the top of your main python script, import the dependencies and store your `DB URL` from above in a variable:
[code] 
    1
    
    from PIL import Image
    
    2
    
    from sentence_transformers import SentenceTransformer
    
    3
    
    import vecs
    
    4
    
    from matplotlib import pyplot as plt
    
    5
    
    from matplotlib import image as mpimg
    
    6
    
    7
    
    DB_CONNECTION = "postgresql://postgres:postgres@localhost:54322/postgres"
[/code]

## Create embeddings for your images#

In the root of your project, create a new folder called `images` and add some images. You can use the images from the example project on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/ai/image_search/images>) or you can find license free images on [Unsplash](<https://unsplash.com>).

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
    
        # create a collection of vectors with 3 dimensions
    
    6
    
        images = vx.get_or_create_collection(name="image_vectors", dimension=512)
    
    7
    
    8
    
        # Load CLIP model
    
    9
    
        model = SentenceTransformer('clip-ViT-B-32')
    
    10
    
    11
    
        # Encode an image:
    
    12
    
        img_emb1 = model.encode(Image.open('./images/one.jpg'))
    
    13
    
        img_emb2 = model.encode(Image.open('./images/two.jpg'))
    
    14
    
        img_emb3 = model.encode(Image.open('./images/three.jpg'))
    
    15
    
        img_emb4 = model.encode(Image.open('./images/four.jpg'))
    
    16
    
    17
    
        # add records to the *images* collection
    
    18
    
        images.upsert(
    
    19
    
            records=[
    
    20
    
                (
    
    21
    
                    "one.jpg",        # the vector's identifier
    
    22
    
                    img_emb1,          # the vector. list or np.array
    
    23
    
                    {"type": "jpg"}   # associated  metadata
    
    24
    
                ), (
    
    25
    
                    "two.jpg",
    
    26
    
                    img_emb2,
    
    27
    
                    {"type": "jpg"}
    
    28
    
                ), (
    
    29
    
                    "three.jpg",
    
    30
    
                    img_emb3,
    
    31
    
                    {"type": "jpg"}
    
    32
    
                ), (
    
    33
    
                    "four.jpg",
    
    34
    
                    img_emb4,
    
    35
    
                    {"type": "jpg"}
    
    36
    
                )
    
    37
    
            ]
    
    38
    
        )
    
    39
    
        print("Inserted images")
    
    40
    
    41
    
        # index the collection for fast search performance
    
    42
    
        images.create_index()
    
    43
    
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

After activating the virtual environment with `poetry shell` you can now run your seed script via `poetry run seed`. You can inspect the generated embeddings in your local database by visiting the local Supabase dashboard at [localhost:54323](<http://localhost:54323/project/default/editor>), selecting the `vecs` schema, and the `image_vectors` database.

## Perform an image search from a text query#

With Supabase Vector we can query our embeddings. We can use either an image as search input or alternative we can generate an embedding from a string input and use that as the query input:
[code] 
    1
    
    def search():
    
    2
    
        # create vector store client
    
    3
    
        vx = vecs.create_client(DB_CONNECTION)
    
    4
    
        images = vx.get_or_create_collection(name="image_vectors", dimension=512)
    
    5
    
    6
    
        # Load CLIP model
    
    7
    
        model = SentenceTransformer('clip-ViT-B-32')
    
    8
    
        # Encode text query
    
    9
    
        query_string = "a bike in front of a red brick wall"
    
    10
    
        text_emb = model.encode(query_string)
    
    11
    
    12
    
        # query the collection filtering metadata for "type" = "jpg"
    
    13
    
        results = images.query(
    
    14
    
            data=text_emb,                      # required
    
    15
    
            limit=1,                            # number of records to return
    
    16
    
            filters={"type": {"$eq": "jpg"}},   # metadata filters
    
    17
    
        )
    
    18
    
        result = results[0]
    
    19
    
        print(result)
    
    20
    
        plt.title(result)
    
    21
    
        image = mpimg.imread('./images/' + result)
    
    22
    
        plt.imshow(image)
    
    23
    
        plt.show()
[/code]

By limiting the query to one result, we can show the most relevant image to the user. Finally we use `matplotlib` to show the image result to the user.

Go ahead and test it out by running `poetry run search` and you will be presented with an image of a "bike in front of a red brick wall".

## Conclusion#

With a couple of lines of Python you are able to implement image search as well as reverse image search using OpenAI's CLIP model and Supabase Vector.