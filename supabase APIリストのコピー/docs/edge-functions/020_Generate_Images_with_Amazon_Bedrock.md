---
タイトル: Generate Images with Amazon Bedrock
URL: https://supabase.com/docs/guides/functions/examples/amazon-bedrock-image-generator
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: amazon, amazon-bedrock-image-generator, bedrock, edge-functions, examples, functions, generate, images, with
---

# Generate Images with Amazon Bedrock

**URL:** https://supabase.com/docs/guides/functions/examples/amazon-bedrock-image-generator
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** amazon, amazon-bedrock-image-generator, bedrock, edge-functions, examples, functions, generate, images, with

## 目次

- [Setup#](#setup)
  - [Configure Storage#](#configure-storage)
- [Code#](#code)
- [Run the function locally#](#run-the-function-locally)
- [Deploy to your hosted project#](#deploy-to-your-hosted-project)

## 概要

Generate images with Amazon Bedrock and store them in Supabase Storage.

---

[Amazon Bedrock](<https://aws.amazon.com/bedrock>) is a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies like AI21 Labs, Anthropic, Cohere, Meta, Mistral AI, Stability AI, and Amazon. Each model is accessible through a common API which implements a broad set of features to help build generative AI applications with security, privacy, and responsible AI in mind.

This guide will walk you through an example using the Amazon Bedrock JavaScript SDK in Supabase Edge Functions to generate images using the [Amazon Titan Image Generator G1](<https://aws.amazon.com/blogs/machine-learning/use-amazon-titan-models-for-image-generation-editing-and-searching/>) model.

## Setup#

  * In your AWS console, navigate to Amazon Bedrock and under "Request model access", select the Amazon Titan Image Generator G1 model.
  * In your Supabase project, create a `.env` file in the `supabase` directory with the following contents:


[code] 
    1
    
    AWS_DEFAULT_REGION="<your_region>"
    
    2
    
    AWS_ACCESS_KEY_ID="<replace_your_own_credentials>"
    
    3
    
    AWS_SECRET_ACCESS_KEY="<replace_your_own_credentials>"
    
    4
    
    AWS_SESSION_TOKEN="<replace_your_own_credentials>"
    
    5
    
    6
    
    # Mocked config files
    
    7
    
    AWS_SHARED_CREDENTIALS_FILE="./aws/credentials"
    
    8
    
    AWS_CONFIG_FILE="./aws/config"
[/code]

### Configure Storage#

  * [locally] Run `supabase start`
  * Open Studio URL: [locally](<http://127.0.0.1:54323/project/default/storage/buckets>) | [hosted](<https://app.supabase.com/project/_/storage/buckets>)
  * Navigate to Storage
  * Click "New bucket"
  * Create a new public bucket called "images"


## Code#

Create a new function in your project:
[code] 
    1
    
    supabase functions new amazon-bedrock
[/code]

And add the code to the `index.ts` file:
[code] 
    1
    
    // We need to mock the file system for the AWS SDK to work.
    
    2
    
    import { prepareVirtualFile } from 'https://deno.land/x/mock_file@v1.1.2/mod.ts'
    
    3
    
    import { BedrockRuntimeClient, InvokeModelCommand } from 'npm:@aws-sdk/client-bedrock-runtime@^3'
    
    4
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    5
    
    import { decode } from 'npm:base64-arraybuffer@^1'
    
    6
    
    7
    
    console.log('Hello from Amazon Bedrock!')
    
    8
    
    9
    
    // Called with a publishable key on the `apikey` header. Deploy with `verify_jwt = false`.
    
    10
    
    export default {
    
    11
    
      fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    
    12
    
        prepareVirtualFile('./aws/config')
    
    13
    
        prepareVirtualFile('./aws/credentials')
    
    14
    
    15
    
        const client = new BedrockRuntimeClient({
    
    16
    
          region: Deno.env.get('AWS_DEFAULT_REGION') ?? 'us-west-2',
    
    17
    
          credentials: {
    
    18
    
            accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
    
    19
    
            secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
    
    20
    
            sessionToken: Deno.env.get('AWS_SESSION_TOKEN') ?? '',
    
    21
    
          },
    
    22
    
        })
    
    23
    
    24
    
        const { prompt, seed } = await req.json()
    
    25
    
        console.log(prompt)
    
    26
    
        const input = {
    
    27
    
          contentType: 'application/json',
    
    28
    
          accept: '*/*',
    
    29
    
          modelId: 'amazon.titan-image-generator-v1',
    
    30
    
          body: JSON.stringify({
    
    31
    
            taskType: 'TEXT_IMAGE',
    
    32
    
            textToImageParams: { text: prompt },
    
    33
    
            imageGenerationConfig: {
    
    34
    
              numberOfImages: 1,
    
    35
    
              quality: 'standard',
    
    36
    
              cfgScale: 8.0,
    
    37
    
              height: 512,
    
    38
    
              width: 512,
    
    39
    
              seed: seed ?? 0,
    
    40
    
            },
    
    41
    
          }),
    
    42
    
        }
    
    43
    
    44
    
        const command = new InvokeModelCommand(input)
    
    45
    
        const response = await client.send(command)
    
    46
    
        console.log(response)
    
    47
    
    48
    
        if (response.$metadata.httpStatusCode === 200) {
    
    49
    
          const { body, $metadata } = response
    
    50
    
    51
    
          const textDecoder = new TextDecoder('utf-8')
    
    52
    
          const jsonString = textDecoder.decode(body.buffer)
    
    53
    
          const parsedData = JSON.parse(jsonString)
    
    54
    
          console.log(parsedData)
    
    55
    
          const image = parsedData.images[0]
    
    56
    
    57
    
          const { data: upload, error: uploadError } = await ctx.supabase.storage
    
    58
    
            .from('images')
    
    59
    
            .upload(`${$metadata.requestId ?? ''}.png`, decode(image), {
    
    60
    
              contentType: 'image/png',
    
    61
    
              cacheControl: '3600',
    
    62
    
              upsert: false,
    
    63
    
            })
    
    64
    
          if (!upload) {
    
    65
    
            return Response.json({ error: uploadError?.message ?? 'Upload failed' }, { status: 500 })
    
    66
    
          }
    
    67
    
          const { data } = ctx.supabase.storage.from('images').getPublicUrl(upload.path!)
    
    68
    
          return Response.json(data)
    
    69
    
        }
    
    70
    
    71
    
        return Response.json(response)
    
    72
    
      }),
    
    73
    
    }
[/code]

## Run the function locally#

  1. Run `supabase start` (see: <https://supabase.com/docs/reference/cli/supabase-start>)
  2. Start with env: `supabase functions serve --no-verify-jwt --env-file supabase/.env`
  3. Make an HTTP request:


[code] 
    1
    
    curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/amazon-bedrock' \
    
    2
    
        --header 'apikey: <SUPABASE_PUBLISHABLE_KEY>' \
    
    3
    
        --header 'Content-Type: application/json' \
    
    4
    
        --data '{"prompt":"A beautiful picture of a bird"}'
[/code]

  4. Navigate back to your storage bucket. You might have to hit the refresh button to see the uploaded image.


## Deploy to your hosted project#
[code] 
    1
    
    supabase link
    
    2
    
    supabase functions deploy amazon-bedrock --no-verify-jwt
    
    3
    
    supabase secrets set --env-file supabase/.env
[/code]

You've now deployed a serverless function that uses AI to generate and upload images to your Supabase storage bucket.