---
タイトル: Generate image captions using Hugging Face
URL: https://supabase.com/docs/guides/ai/examples/huggingface-image-captioning
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, captions, examples, face, generate, hugging, huggingface-image-captioning, image, using
---

# Generate image captions using Hugging Face

**URL:** https://supabase.com/docs/guides/ai/examples/huggingface-image-captioning
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, captions, examples, face, generate, hugging, huggingface-image-captioning, image, using

## 目次

- [About Hugging Face#](#about-hugging-face)
- [Setup#](#setup)
- [Generate TypeScript types#](#generate-typescript-types)
- [Code#](#code)

## 概要

Use the Hugging Face Inference API to make calls to 100,000+ Machine Learning models from Supabase Edge Functions.

---

We can combine Hugging Face with [Supabase Storage](</storage>) and [Database Webhooks](</docs/guides/database/webhooks>) to automatically caption for any image we upload to a storage bucket.

## About Hugging Face#

[Hugging Face](<https://huggingface.co/>) is the collaboration platform for the machine learning community.

[Huggingface.js](<https://huggingface.co/docs/huggingface.js/index>) provides a convenient way to make calls to 100,000+ Machine Learning models, making it easy to incorporate AI functionality into your [Supabase Edge Functions](</edge-functions>).

## Setup#

  * Open your Supabase project dashboard or [create a new project](</dashboard/projects>).
  * [Create a new bucket](</dashboard/project/_/storage/buckets>) called `images`.
  * Generate TypeScript types from remote Database.
  * Create a new Database table called `image_caption`.
    * Create `id` column of type `uuid` which references `storage.objects.id`.
    * Create a `caption` column of type `text`.
  * Regenerate TypeScript types to include new `image_caption` table.
  * Deploy the function to Supabase: `supabase functions deploy huggingface-image-captioning`.
  * Create the Database Webhook in the [Supabase Dashboard](</dashboard/project/_/database/hooks>) to trigger the `huggingface-image-captioning` function anytime a record is added to the `storage.objects` table.


## Generate TypeScript types#

To generate the types.ts file for the storage and public schemas, run the following command in the terminal:
[code] 
    1
    
    supabase gen types typescript --project-id=your-project-ref --schema=storage,public > supabase/functions/huggingface-image-captioning/types.ts
[/code]

## Code#

Find the complete code on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/huggingface-image-captioning>).
[code] 
    1
    
    import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2'
    
    2
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    3
    
    4
    
    import { Database } from './types.ts'
    
    5
    
    6
    
    console.log('Hello from `huggingface-image-captioning` function!')
    
    7
    
    8
    
    const hf = new HfInference(Deno.env.get('HUGGINGFACE_ACCESS_TOKEN'))
    
    9
    
    10
    
    type SoRecord = Database['storage']['Tables']['objects']['Row']
    
    11
    
    interface WebhookPayload {
    
    12
    
      type: 'INSERT' | 'UPDATE' | 'DELETE'
    
    13
    
      table: string
    
    14
    
      record: SoRecord
    
    15
    
      schema: 'public'
    
    16
    
      old_record: null | SoRecord
    
    17
    
    }
    
    18
    
    19
    
    Deno.serve(async (req) => {
    
    20
    
      const payload: WebhookPayload = await req.json()
    
    21
    
      const soRecord = payload.record
    
    22
    
      const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    
    23
    
      const supabaseAdminClient = createClient<Database>(
    
    24
    
        // Supabase API URL - env var exported by default when deployed.
    
    25
    
        Deno.env.get('SUPABASE_URL') ?? '',
    
    26
    
        // Supabase API SECRET KEY - env var exported by default when deployed.
    
    27
    
        SUPABASE_SECRET_KEYS['default'] ?? ''
    
    28
    
      )
    
    29
    
    30
    
      // Construct image url from storage
    
    31
    
      const { data, error } = await supabaseAdminClient.storage
    
    32
    
        .from(soRecord.bucket_id!)
    
    33
    
        .createSignedUrl(soRecord.path_tokens!.join('/'), 60)
    
    34
    
      if (error) throw error
    
    35
    
      const { signedUrl } = data
    
    36
    
    37
    
      // Run image captioning with Huggingface
    
    38
    
      const imgDesc = await hf.imageToText({
    
    39
    
        data: await (await fetch(signedUrl)).blob(),
    
    40
    
        model: 'nlpconnect/vit-gpt2-image-captioning',
    
    41
    
      })
    
    42
    
    43
    
      // Store image caption in Database table
    
    44
    
      await supabaseAdminClient
    
    45
    
        .from('image_caption')
    
    46
    
        .insert({ id: soRecord.id!, caption: imgDesc.generated_text })
    
    47
    
        .throwOnError()
    
    48
    
    49
    
      return new Response('ok')
    
    50
    
    })
[/code]