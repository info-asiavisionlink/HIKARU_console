---
タイトル: Getting Started with Edge Functions
URL: https://supabase.com/docs/guides/functions/quickstart
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge, edge-functions, functions, getting, quickstart, started, with
---

# Getting Started with Edge Functions

**URL:** https://supabase.com/docs/guides/functions/quickstart
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge, edge-functions, functions, getting, quickstart, started, with

## 目次

- [Prerequisites#](#prerequisites)
- [Step 1: Create or configure your project#](#step-1-create-or-configure-your-project)
- [Step 2: Create your first function#](#step-2-create-your-first-function)
- [Step 3: Test your function locally#](#step-3-test-your-function-locally)
  - [Function not starting locally?#](#function-not-starting-locally)
  - [Port already in use?#](#port-already-in-use)
- [Step 4: Send a test request#](#step-4-send-a-test-request)
- [Step 5: Connect to your Supabase project#](#step-5-connect-to-your-supabase-project)
- [Step 6: Deploy to production#](#step-6-deploy-to-production)
- [Step 7: Test your live function#](#step-7-test-your-live-function)
- [Usage#](#usage)

## 概要

Get started with Supabase Edge Functions.

---

This guide walks you through creating, testing locally, deploying, and invoking a Supabase Edge Function using the CLI. By the end, you'll have a working function running on Supabase's global edge network.

You can also create and deploy functions directly from the Supabase Dashboard. Read [the Dashboard Quickstart guide](</docs/guides/functions/quickstart-dashboard>) for more information.

Supabase Edge Functions **only** supports creating functions in TypeScript with [the Deno runtime](<https://deno.com/>). This is because Deno was designed with extensibility in mind and its Rust codebase offers a modern developer experience, memory safety, and other features ideal for running edge functions.

## Prerequisites#

  * Make sure you have the Supabase CLI installed and configured. Read [the CLI installation guide](</docs/guides/local-development>) for installation methods and troubleshooting.
  * Running and testing Supabase Edge Functions locally requires [Docker](<https://www.docker.com/>) or a Docker-compatible runtime.


## Step 1: Create or configure your project#

If you don't have a project yet, initialize a new Supabase project in your current directory.
[code] 
    1
    
    mkdir my-edge-functions-project
    
    2
    
    cd my-edge-functions-project
    
    3
    
    supabase init
[/code]

If you already have a project locally, navigate to your project directory. If you haven't configured the project for Supabase yet, make sure to run the `supabase init` command.
[code] 
    1
    
    cd your-existing-project
    
    2
    
    supabase init # Initialize Supabase, if you haven't already
[/code]

After this step, you should have a project directory with a `supabase` folder containing a `config.toml` file.

## Step 2: Create your first function#

Within your project, generate a new Edge Function with a basic template:
[code] 
    1
    
    supabase functions new hello-world
[/code]

Secure your function with Supabase Auth

When an HTTP request is sent to Edge Functions, you can use Supabase Auth to secure endpoints. By default, the `supabase functions new` command adds handling a valid publishable or secret key to the basic template. However, you can change this behavior with the `--auth` flag when creating a new function.

This creates a new function at `supabase/functions/hello-world/index.ts` with this starter code:
[code] 
    1
    
    export default {
    
    2
    
      fetch: withSupabase({ auth: ['publishable', 'secret'] }, async (req, ctx) => {
    
    3
    
        const { name } = await req.json()
    
    4
    
    5
    
        return Response.json({
    
    6
    
          message: `Hello ${name}!`,
    
    7
    
        })
    
    8
    
      }),
    
    9
    
    }
[/code]

This function accepts a JSON payload with a `name` field and returns a greeting message.

The `supabase functions new` command also optionally creates Deno configuration for VSCode.

## Step 3: Test your function locally#

After starting Docker, start the local development server to test your function:
[code] 
    1
    
    supabase start  # Start all Supabase services
    
    2
    
    supabase functions serve hello-world
[/code]

On first use, the `supabase start` command downloads Docker images, and starts all Supabase services locally, which can take a few minutes.

Your function is now running at [`http://localhost:54321/functions/v1/hello-world`](<http://localhost:54321/functions/v1/hello-world>). Hot reloading is enabled, which means that the server automatically reloads when you save changes to your function code. Keep this terminal window open.

### Function not starting locally?#

  * Make sure Docker is running
  * Run `supabase stop` then `supabase start` to restart services


### Port already in use?#

  * Check what's running with `supabase status`
  * Stop other Supabase instances with `supabase stop`


## Step 4: Send a test request#

Open a new terminal and test your function with curl. You can find your local Publishable key, by running `supabase status`, or you can find the complete `curl` command already in `functions/hello-world/index.ts`.
[code] 
    1
    
    curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/hello-world' \
    
    2
    
        --header 'apiKey: <SUPABASE_PUBLISHABLE_KEY>' \
    
    3
    
        --data '{"name":"Functions"}'
[/code]

After running this curl command, you should see:
[code] 
    1
    
    { "message": "Hello Functions!" }
[/code]

You can also try different inputs. Change `"Functions"` to `"World"` in the curl command and run it again to see the response change.

After this step, you should have successfully tested your Edge Function locally and received a JSON response with your greeting message.

## Step 5: Connect to your Supabase project#

To deploy your function globally, you need to connect your local project to a Supabase project.

Need to create a new Supabase project?

Create one at [database.new](<https://database.new/>).

First, login to the CLI if you haven't already, and authenticate with Supabase. This opens your browser to authenticate with Supabase; complete the login process in your browser.
[code] 
    1
    
    supabase login
[/code]

Next, list your Supabase projects to find your project ID:
[code] 
    1
    
    supabase projects list
[/code]

Next, copy your project ID from the output, then connect your local project to your remote Supabase project. Replace `YOUR_PROJECT_ID` with the ID from the previous step.
[code] 
    1
    
    supabase link --project-ref [YOUR_PROJECT_ID]
[/code]

After this step, you should have your local project authenticated and linked to your remote Supabase project. You can verify this by running `supabase status`.

## Step 6: Deploy to production#

Deploy your function to Supabase's global edge network:
[code] 
    1
    
    supabase functions deploy hello-world
[/code]

If you want to deploy all functions, run the `deploy` command without specifying a function name:
[code] 
    1
    
    supabase functions deploy
[/code]

Docker not required

The CLI automatically falls back to API-based deployment if Docker isn't available. You can also explicitly use API deployment with the `--use-api` flag:
[code]
    1
    
    supabase functions deploy hello-world --use-api
[/code]

When the deployment is successful, your function is automatically distributed to edge locations worldwide.

Now, you should have your Edge Function deployed and running globally at `https://[YOUR_PROJECT_ID].supabase.co/functions/v1/hello-world`.

## Step 7: Test your live function#

🎉 Your function is now live! Test it with your project's publishable key that you can find in the **Settings > API Keys** section of the [Dashboard](</dashboard/project/_/settings/api-keys>):
[code] 
    1
    
    curl --request POST 'https://[YOUR_PROJECT_ID].supabase.co/functions/v1/hello-world' \
    
    2
    
      --header 'apikey: <SUPABASE_PUBLISHABLE_KEY>' \
    
    3
    
      --header 'Content-Type: application/json' \
    
    4
    
      --data '{"name":"Production"}'
[/code]

**Expected response:**
[code] 
    1
    
    { "message": "Hello Production!" }
[/code]

## Usage#

Now that your function is deployed, you can invoke it from within an app:

Make sure your function can handle [CORS](</docs/guides/functions/cors>) (Cross-Origin Resource Sharing) requests by configuring its headers correctly.

Supabase ClientFetch API
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://[YOUR_PROJECT_ID].supabase.co', 'YOUR_PUBLISHABLE_KEY')
    
    4
    
    5
    
    const { data, error } = await supabase.functions.invoke('hello-world', {
    
    6
    
      body: { name: 'JavaScript' },
    
    7
    
    })
    
    8
    
    9
    
    console.log(data) // { message: "Hello JavaScript!" }
[/code]