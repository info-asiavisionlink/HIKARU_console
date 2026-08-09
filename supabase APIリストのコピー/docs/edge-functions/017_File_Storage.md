---
タイトル: File Storage
URL: https://supabase.com/docs/guides/functions/ephemeral-storage
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, ephemeral-storage, file, functions, storage
---

# File Storage

**URL:** https://supabase.com/docs/guides/functions/ephemeral-storage
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, ephemeral-storage, file, functions, storage

## 目次

- [Persistent Storage#](#persistent-storage)
- [Ephemeral storage#](#ephemeral-storage)
- [Common use cases#](#common-use-cases)
  - [Archive processing with background tasks#](#archive-processing-with-background-tasks)
  - [Image manipulation#](#image-manipulation)
- [Using synchronous file APIs#](#using-synchronous-file-apis)
- [Limits#](#limits)

## 概要

Use persistent and ephemeral file storage

---

Edge Functions provides two flavors of file storage:

  * Persistent - backed by S3 protocol, can read/write from any S3 compatible bucket, including Supabase Storage
  * Ephemeral - You can read and write files to the `/tmp` directory. Only suitable for temporary operations


You can use file storage to:

  * Handle complex file transformations and workflows
  * Do data migrations between projects
  * Process user uploaded files and store them
  * Unzip archives and process contents before saving to database


* * *

## Persistent Storage#

The persistent storage option is built on top of the S3 protocol. It allows you to mount any S3-compatible bucket, including Supabase Storage Buckets, as a directory for your Edge Functions. You can perform operations such as reading and writing files to the mounted buckets as you would in a POSIX file system.

To access an S3 bucket from Edge Functions, you must set the following for environment variables in Edge Function Secrets.

  * `S3FS_ENDPOINT_URL`
  * `S3FS_REGION`
  * `S3FS_ACCESS_KEY_ID`
  * `S3FS_SECRET_ACCESS_KEY`


[Follow this guide](</docs/guides/storage/s3/authentication>) to enable and create an access key for Supabase Storage S3.

To access a file path in your mounted bucket from your Edge Function, use the prefix `/s3/YOUR-BUCKET-NAME`.
[code] 
    1
    
    // read from S3 bucket
    
    2
    
    const data = await Deno.readFile('/s3/my-bucket/results.csv')
    
    3
    
    4
    
    // make a directory
    
    5
    
    await Deno.mkdir('/s3/my-bucket/sub-dir')
    
    6
    
    7
    
    // write to S3 bucket
    
    8
    
    await Deno.writeTextFile('/s3/my-bucket/demo.txt', 'hello world')
[/code]

## Ephemeral storage#

Ephemeral storage will reset on each function invocation. This means the files you write during an invocation can only be read within the same invocation.

You can use [Deno File System APIs](<https://docs.deno.com/api/deno/file-system>) or the [`node:fs`](<https://docs.deno.com/api/node/fs/>) module to access the `/tmp` path.
[code] 
    1
    
    Deno.serve(async (req) => {
    
    2
    
      if (req.headers.get('content-type') !== 'application/zip') {
    
    3
    
        return new Response('file must be a zip file', {
    
    4
    
          status: 400,
    
    5
    
        })
    
    6
    
      }
    
    7
    
    8
    
      const uploadId = crypto.randomUUID()
    
    9
    
      await Deno.writeFile('/tmp/' + uploadId, req.body)
    
    10
    
    11
    
      // E.g. extract and process the zip file
    
    12
    
      const zipFile = await Deno.readFile('/tmp/' + uploadId)
    
    13
    
      // You could use a zip library to extract contents
    
    14
    
      const extracted = await extractZip(zipFile)
    
    15
    
    16
    
      // Or process the file directly
    
    17
    
      console.log(`Processing zip file: ${uploadId}, size: ${zipFile.length} bytes`)
    
    18
    
    })
[/code]

* * *

## Common use cases#

### Archive processing with background tasks#

You can use ephemeral storage with [Background Tasks](</docs/guides/functions/background-tasks>) to handle large file processing operations that exceed memory limits.

Imagine you have a Photo Album application that accepts photo uploads as zip files. A streaming implementation will run into memory limit errors with zip files exceeding 100MB, as it retains all archive files in memory simultaneously.

You can write the zip file to ephemeral storage first, then use a background task to extract and upload files to Supabase Storage. This way, you only read parts of the zip file to the memory.
[code] 
    1
    
    import { BlobWriter, ZipReader } from 'https://deno.land/x/zipjs/index.js'
    
    2
    
    import { createClient } from 'jsr:@supabase/supabase-js@2'
    
    3
    
    4
    
    const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    
    5
    
    // If you want to use a different api key, change 'default' to your preferred key name
    
    6
    
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SUPABASE_SECRET_KEYS['default'])
    
    7
    
    8
    
    async function processZipFile(uploadId: string, filepath: string) {
    
    9
    
      const file = await Deno.open(filepath, { read: true })
    
    10
    
      const zipReader = new ZipReader(file.readable)
    
    11
    
      const entries = await zipReader.getEntries()
    
    12
    
    13
    
      await supabase.storage.createBucket(uploadId, { public: false })
    
    14
    
    15
    
      await Promise.all(
    
    16
    
        entries.map(async (entry) => {
    
    17
    
          if (entry.directory) return
    
    18
    
    19
    
          // Read file entry from temp storage
    
    20
    
          const blobWriter = new BlobWriter()
    
    21
    
          const blob = await entry.getData(blobWriter)
    
    22
    
    23
    
          // Upload to permanent storage
    
    24
    
          await supabase.storage.from(uploadId).upload(entry.filename, blob)
    
    25
    
    26
    
          console.log('uploaded', entry.filename)
    
    27
    
        })
    
    28
    
      )
    
    29
    
    30
    
      await zipReader.close()
    
    31
    
    }
    
    32
    
    33
    
    Deno.serve(async (req) => {
    
    34
    
      const uploadId = crypto.randomUUID()
    
    35
    
      const filepath = `/tmp/${uploadId}.zip`
    
    36
    
    37
    
      // Write zip to ephemeral storage
    
    38
    
      await Deno.writeFile(filepath, req.body)
    
    39
    
    40
    
      // Process in background to avoid memory limits
    
    41
    
      EdgeRuntime.waitUntil(processZipFile(uploadId, filepath))
    
    42
    
    43
    
      return new Response(JSON.stringify({ uploadId }), {
    
    44
    
        headers: { 'Content-Type': 'application/json' },
    
    45
    
      })
    
    46
    
    })
[/code]

### Image manipulation#

Custom image manipulation workflows using [`magick-wasm`](</docs/guides/functions/examples/image-manipulation>).
[code] 
    1
    
    Deno.serve(async (req) => {
    
    2
    
      // Save uploaded image to temp storage
    
    3
    
      const imagePath = `/tmp/input-${crypto.randomUUID()}.jpg`
    
    4
    
      await Deno.writeFile(imagePath, req.body)
    
    5
    
    6
    
      // Process image with magick-wasm
    
    7
    
      const processedPath = `/tmp/output-${crypto.randomUUID()}.jpg`
    
    8
    
      // ... image manipulation logic
    
    9
    
    10
    
      // Read processed image and return
    
    11
    
      const processedImage = await Deno.readFile(processedPath)
    
    12
    
      return new Response(processedImage, {
    
    13
    
        headers: { 'Content-Type': 'image/jpeg' },
    
    14
    
      })
    
    15
    
    })
[/code]

* * *

## Using synchronous file APIs#

You can safely use the following synchronous Deno APIs (and their Node counterparts) _during initial script evaluation_ :

  * Deno.statSync
  * Deno.removeSync
  * Deno.writeFileSync
  * Deno.writeTextFileSync
  * Deno.readFileSync
  * Deno.readTextFileSync
  * Deno.mkdirSync
  * Deno.makeTempDirSync
  * Deno.readDirSync


**Keep in mind** that the sync APIs are available only during initial script evaluation and aren’t supported in callbacks like HTTP handlers or `setTimeout`.
[code] 
    1
    
    Deno.statSync('...') // ✅
    
    2
    
    3
    
    setTimeout(() => {
    
    4
    
      Deno.statSync('...') // 💣 ERROR! Deno.statSync is blocklisted on the current context
    
    5
    
    })
    
    6
    
    7
    
    Deno.serve(() => {
    
    8
    
      Deno.statSync('...') // 💣 ERROR! Deno.statSync is blocklisted on the current context
    
    9
    
    })
[/code]

* * *

## Limits#

There are no limits on S3 buckets you mount for Persistent storage.

Ephemeral Storage:

  * Free projects: Up to 256MB of ephemeral storage
  * Paid projects: Up to 512MB of ephemeral storage