---
タイトル: Roboflow
URL: https://supabase.com/docs/guides/ai/integrations/roboflow
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, integrations, roboflow
---

# Roboflow

**URL:** https://supabase.com/docs/guides/ai/integrations/roboflow
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, integrations, roboflow

## 目次

- [Project setup#](#project-setup)
- [Save computer vision predictions#](#save-computer-vision-predictions)
  - [Preparation: Set up a model#](#preparation-set-up-a-model)
  - [Step 1: Install and start Roboflow Inference#](#step-1-install-and-start-roboflow-inference)
  - [Step 2: Run inference on an image#](#step-2-run-inference-on-an-image)
  - [Step 3: Save results in Supabase#](#step-3-save-results-in-supabase)
- [Calculate and save CLIP embeddings#](#calculate-and-save-clip-embeddings)
  - [Step 1: Install and start Roboflow Inference#](#step-1-install-and-start-roboflow-inference)
  - [Step 2: Run CLIP on an image#](#step-2-run-clip-on-an-image)
  - [Step 3: Save embeddings in Supabase#](#step-3-save-embeddings-in-supabase)
- [Resources#](#resources)

## 概要

Learn how to integrate Supabase with Roboflow, a tool for running fine-tuned and foundation vision models.

---

In this guide, we will walk through two examples of using [Roboflow Inference](<https://inference.roboflow.com>) to run fine-tuned and foundation models. We will run inference and save predictions using an object detection model and [CLIP](<https://github.com/openai/CLIP>).

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


## Save computer vision predictions#

Once you have a trained vision model, you need to create business logic for your application. In many cases, you want to save inference results to a file.

The steps below show you how to run a vision model locally and save predictions to Supabase.

### Preparation: Set up a model#

Before you begin, you will need an object detection model trained on your data.

You can [train a model on Roboflow](<https://blog.roboflow.com/getting-started-with-roboflow/>), leveraging end-to-end tools from data management and annotation to deployment, or [upload custom model weights](<https://docs.roboflow.com/deploy/upload-custom-weights>) for deployment.

All models have an infinitely scalable API through which you can query your model, and can be run locally.

For this guide, we will use a demo [rock, paper, scissors](<https://universe.roboflow.com/roboflow-58fyf/rock-paper-scissors-sxsw>) model.

### Step 1: Install and start Roboflow Inference#

You will deploy our model locally using Roboflow Inference, a computer vision inference server.

To install and start Roboflow Inference, first install Docker on your machine.

Then, run:
[code] 
    1
    
    pip install inference inference-cli inference-sdk && inference server start
[/code]

An inference server will be available at `http://localhost:9001`.

### Step 2: Run inference on an image#

You can run inference on images and videos.

Create a new Python file and add the following code:
[code] 
    1
    
    from inference_sdk import InferenceHTTPClient
    
    2
    
    3
    
    image = "example.jpg"
    
    4
    
    MODEL_ID = "rock-paper-scissors-sxsw/11"
    
    5
    
    6
    
    client = InferenceHTTPClient(
    
    7
    
        api_url="http://localhost:9001",
    
    8
    
        api_key="ROBOFLOW_API_KEY"
    
    9
    
    )
    
    10
    
    with client.use_model(MODEL_ID):
    
    11
    
        predictions = client.infer(image)
    
    12
    
    13
    
    print(predictions)
[/code]

Above, replace:

  1. The image URL with the name of the image on which you want to run inference.
  2. `ROBOFLOW_API_KEY` with your Roboflow API key. [Learn how to retrieve your Roboflow API key](<https://docs.roboflow.com/api-reference/authentication#retrieve-an-api-key>).
  3. `MODEL_ID` with your Roboflow model ID. [Learn how to retrieve your model ID](<https://docs.roboflow.com/api-reference/workspace-and-project-ids>).


When you run the code above, a list of predictions will be printed to the console:
[code] 
    1
    
    {'time': 0.05402109300121083, 'image': {'width': 640, 'height': 480}, 'predictions': [{'x': 312.5, 'y': 392.0, 'width': 255.0, 'height': 110.0, 'confidence': 0.8620790839195251, 'class': 'Paper', 'class_id': 0}]}
[/code]

### Step 3: Save results in Supabase#

To save results in Supabase, add the following code to your script:
[code] 
    1
    
    import os
    
    2
    
    from supabase import create_client, Client
    
    3
    
    4
    
    url: str = os.environ.get("SUPABASE_URL")
    
    5
    
    key: str = os.environ.get("SUPABASE_KEY")
    
    6
    
    supabase: Client = create_client(url, key)
    
    7
    
    8
    
    result = supabase.table('predictions') \
    
    9
    
        .insert({"filename": image, "predictions": predictions}) \
    
    10
    
        .execute()
[/code]

You can then query your predictions using the following code:
[code] 
    1
    
    result = supabase.table('predictions') \
    
    2
    
        .select("predictions") \
    
    3
    
        .filter("filename", "eq", image) \
    
    4
    
        .execute()
    
    5
    
    6
    
    print(result)
[/code]

Here is an example result:
[code] 
    1
    
    data=[{'predictions': {'time': 0.08492901099998562, 'image': {'width': 640, 'height': 480}, 'predictions': [{'x': 312.5, 'y': 392.0, 'width': 255.0, 'height': 110.0, 'confidence': 0.8620790839195251, 'class': 'Paper', 'class_id': 0}]}}, {'predictions': {'time': 0.08818970100037404, 'image': {'width': 640, 'height': 480}, 'predictions': [{'x': 312.5, 'y': 392.0, 'width': 255.0, 'height': 110.0, 'confidence': 0.8620790839195251, 'class': 'Paper', 'class_id': 0}]}}] count=None
[/code]

## Calculate and save CLIP embeddings#

You can use the Supabase vector database functionality to store and query CLIP embeddings.

Roboflow Inference provides an HTTP interface through which you can calculate image and text embeddings using CLIP.

### Step 1: Install and start Roboflow Inference#

See Step #1: Install and Start Roboflow Inference above to install and start Roboflow Inference.

### Step 2: Run CLIP on an image#

Create a new Python file and add the following code:
[code] 
    1
    
    import cv2
    
    2
    
    import supervision as sv
    
    3
    
    import requests
    
    4
    
    import base64
    
    5
    
    import os
    
    6
    
    7
    
    IMAGE_DIR = "images/train/images/"
    
    8
    
    API_KEY = ""
    
    9
    
    SERVER_URL = "http://localhost:9001"
    
    10
    
    11
    
    results = []
    
    12
    
    13
    
    for i, image in enumerate(os.listdir(IMAGE_DIR)):
    
    14
    
        print(f"Processing image {image}")
    
    15
    
        infer_clip_payload = {
    
    16
    
            "image": {
    
    17
    
                "type": "base64",
    
    18
    
                "value": base64.b64encode(open(IMAGE_DIR + image, "rb").read()).decode("utf-8"),
    
    19
    
            },
    
    20
    
        }
    
    21
    
    22
    
        res = requests.post(
    
    23
    
            f"{SERVER_URL}/clip/embed_image?api_key={API_KEY}",
    
    24
    
            json=infer_clip_payload,
    
    25
    
        )
    
    26
    
    27
    
        embeddings = res.json()['embeddings']
    
    28
    
    29
    
        results.append({
    
    30
    
            "filename": image,
    
    31
    
            "embeddings": embeddings
    
    32
    
        })
[/code]

This code will calculate CLIP embeddings for each image in the directory and print the results to the console.

Above, replace:

  1. `IMAGE_DIR` with the directory containing the images on which you want to run inference.
  2. `ROBOFLOW_API_KEY` with your Roboflow API key. [Learn how to retrieve your Roboflow API key](<https://docs.roboflow.com/api-reference/authentication#retrieve-an-api-key>).


You can also calculate CLIP embeddings in the cloud by setting `SERVER_URL` to `https://infer.roboflow.com`.

### Step 3: Save embeddings in Supabase#

You can store your image embeddings in Supabase using the Supabase `vecs` Python package:

First, install `vecs`:
[code] 
    1
    
    pip install vecs
[/code]

Next, add the following code to your script to create an index:
[code] 
    1
    
    import vecs
    
    2
    
    3
    
    DB_CONNECTION = "postgresql://postgres:[password]@[host]:[port]/[database]"
    
    4
    
    5
    
    vx = vecs.create_client(DB_CONNECTION)
    
    6
    
    7
    
    # create a collection of vectors with 3 dimensions
    
    8
    
    images = vx.get_or_create_collection(name="image_vectors", dimension=512)
    
    9
    
    10
    
    for result in results:
    
    11
    
        image = result["filename"]
    
    12
    
        embeddings = result["embeddings"][0]
    
    13
    
    14
    
        # insert a vector into the collection
    
    15
    
        images.upsert(
    
    16
    
            records=[
    
    17
    
                (
    
    18
    
                    image,
    
    19
    
                    embeddings,
    
    20
    
                    {} # metadata
    
    21
    
                )
    
    22
    
            ]
    
    23
    
        )
    
    24
    
    25
    
    images.create_index()
[/code]

Replace `DB_CONNECTION` with the authentication information for your database. You can retrieve this from the Supabase dashboard in `Project Settings > Database Settings`.

You can then query your embeddings using the following code:
[code] 
    1
    
    infer_clip_payload = {
    
    2
    
        "text": "cat",
    
    3
    
    }
    
    4
    
    5
    
    res = requests.post(
    
    6
    
        f"{SERVER_URL}/clip/embed_text?api_key={API_KEY}",
    
    7
    
        json=infer_clip_payload,
    
    8
    
    )
    
    9
    
    10
    
    embeddings = res.json()['embeddings']
    
    11
    
    12
    
    result = images.query(
    
    13
    
        data=embeddings[0],
    
    14
    
        limit=1
    
    15
    
    )
    
    16
    
    17
    
    print(result[0])
[/code]

## Resources#

  * [Roboflow Inference documentation](<https://inference.roboflow.com>)
  * [Roboflow Getting Started guide](<https://blog.roboflow.com/getting-started-with-roboflow/>)
  * [How to Build a Semantic Image Search Engine with Supabase and OpenAI CLIP](<https://blog.roboflow.com/how-to-use-semantic-search-supabase-openai-clip/>)