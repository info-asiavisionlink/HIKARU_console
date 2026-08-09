---
タイトル: Deploy to Production
URL: https://supabase.com/docs/guides/functions/deploy
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: deploy, edge-functions, functions, production
---

# Deploy to Production

**URL:** https://supabase.com/docs/guides/functions/deploy
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** deploy, edge-functions, functions, production

## 目次

- [Step 1: Authenticate#](#step-1-authenticate)
- [Step 2: Connect your project#](#step-2-connect-your-project)
- [Step 3: Deploy Functions#](#step-3-deploy-functions)
- [Step 4: Verify successful deployment#](#step-4-verify-successful-deployment)
- [Step 5: Test your live function#](#step-5-test-your-live-function)
- [CI/CD deployment#](#cicd-deployment)
  - [GitHub Actions#](#github-actions)
  - [GitLab CI#](#gitlab-ci)
  - [Bitbucket Pipelines#](#bitbucket-pipelines)
  - [Function configuration#](#function-configuration)
  - [Example#](#example)

## 概要

Deploy your Edge Functions to your remote Supabase Project.

---

Once you have developed your Edge Functions locally, you can deploy them to your Supabase project.

Before getting started, make sure you have the Supabase CLI installed. Check out the CLI installation guide for installation methods and troubleshooting.

* * *

## Step 1: Authenticate#

Log in to the Supabase CLI if you haven't already:
[code] 
    1
    
    supabase login
[/code]

* * *

## Step 2: Connect your project#

Get the project ID associated with your function:
[code] 
    1
    
    supabase projects list
[/code]

Need a new project?

If you haven't yet created a Supabase project, you can do so by visiting [database.new](<https://database.new>).

[Link](</docs/reference/cli/usage#supabase-link>) your local project to your remote Supabase project using the ID you retrieved:
[code] 
    1
    
    supabase link --project-ref your-project-id
[/code]

Now you should have your local development environment connected to your production project.

* * *

## Step 3: Deploy Functions#

You can deploy all edge functions within the `functions` folder with a single command:
[code] 
    1
    
    supabase functions deploy
[/code]

Or deploy individual Edge Functions by specifying the function name:
[code] 
    1
    
    supabase functions deploy hello-world
[/code]

## Step 4: Verify successful deployment#

🎉 Your function is now live!

When the deployment is successful, your function is automatically distributed to edge locations worldwide. Your edge functions is now running globally at `https://[YOUR_PROJECT_ID].supabase.co/functions/v1/hello-world.`

* * *

## Step 5: Test your live function#

You can now invoke your Edge Function using one of the project's `PUBLISHABLE_KEYS`, which can be found in the [API settings](</dashboard/project/_/settings/api>) of the Supabase Dashboard. You can invoke it from within your app:

cURLJavaScript
[code]
    1
    
    curl --request POST 'https://<project_id>.supabase.co/functions/v1/hello-world' \
    
    2
    
      --header 'apikey: PUBLISHABLE_KEY' \
    
    3
    
      --header 'Content-Type: application/json' \
    
    4
    
      --data '{ "name":"Functions" }'
[/code]

Note that the `SUPABASE_PUBLISHABLE_KEYS` is different in development and production. To get a publishable key, you can find it in your Supabase dashboard under Settings > API.

You should now see the expected response:
[code] 
    1
    
    { "message": "Hello Production!" }
[/code]

You can also test the function through the Dashboard. To see how that works, check out the [Dashboard Quickstart guide](</docs/guides/functions/quickstart-dashboard>).

* * *

## CI/CD deployment#

You can use popular CI / CD tools like GitHub Actions, Bitbucket, and GitLab CI to automate Edge Function deployments.

### GitHub Actions#

You can use the official [`setup-cli` GitHub Action](<https://github.com/marketplace/actions/supabase-cli-action>) to run Supabase CLI commands in your GitHub Actions.

The following GitHub Action deploys all Edge Functions any time code is merged into the `main` branch:
[code] 
    1
    
    name: Deploy Function
    
    2
    
    3
    
    on:
    
    4
    
      push:
    
    5
    
        branches:
    
    6
    
          - main
    
    7
    
      workflow_dispatch:
    
    8
    
    9
    
    jobs:
    
    10
    
      deploy:
    
    11
    
        runs-on: ubuntu-latest
    
    12
    
    13
    
        env:
    
    14
    
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    
    15
    
          PROJECT_ID: your-project-id
    
    16
    
    17
    
        steps:
    
    18
    
          - uses: actions/checkout@v4
    
    19
    
    20
    
          - uses: supabase/setup-cli@v1
    
    21
    
            with:
    
    22
    
              version: latest
    
    23
    
    24
    
          - run: supabase functions deploy --project-ref $PROJECT_ID
[/code]

* * *

### GitLab CI#

Here is the sample pipeline configuration to deploy via GitLab CI.
[code] 
    1
    
    image: node:20
    
    2
    
    3
    
    # List of stages for jobs, and their order of execution
    
    4
    
    stages:
    
    5
    
      - setup
    
    6
    
      - deploy
    
    7
    
    8
    
    # This job runs in the setup stage, which runs first.
    
    9
    
    setup-npm:
    
    10
    
      stage: setup
    
    11
    
      script:
    
    12
    
        - npm i supabase
    
    13
    
      cache:
    
    14
    
        paths:
    
    15
    
          - node_modules/
    
    16
    
      artifacts:
    
    17
    
        paths:
    
    18
    
          - node_modules/
    
    19
    
    20
    
    # This job runs in the deploy stage, which only starts when the job in the build stage completes successfully.
    
    21
    
    deploy-function:
    
    22
    
      stage: deploy
    
    23
    
      script:
    
    24
    
        - npx supabase init
    
    25
    
        - npx supabase functions deploy --debug
    
    26
    
      services:
    
    27
    
        - docker:dind
    
    28
    
      variables:
    
    29
    
        DOCKER_HOST: tcp://docker:2375
[/code]

* * *

### Bitbucket Pipelines#

Here is the sample pipeline configuration to deploy via Bitbucket.
[code] 
    1
    
    image: node:20
    
    2
    
    3
    
    pipelines:
    
    4
    
      default:
    
    5
    
        - step:
    
    6
    
            name: Setup
    
    7
    
            caches:
    
    8
    
              - node
    
    9
    
            script:
    
    10
    
              - npm i supabase
    
    11
    
        - parallel:
    
    12
    
            - step:
    
    13
    
                name: Functions Deploy
    
    14
    
                script:
    
    15
    
                  - npx supabase init
    
    16
    
                  - npx supabase functions deploy --debug
    
    17
    
                services:
    
    18
    
                  - docker
[/code]

* * *

### Function configuration#

Individual function configuration like [JWT verification](</docs/guides/local-development/cli/config#functions.function_name.verify_jwt>) and [import map location](</docs/guides/local-development/cli/config#functions.function_name.import_map>) can be set via the `config.toml` file.
[code] 
    1
    
    [functions.hello-world]
    
    2
    
    verify_jwt = false
[/code]

This ensures your function configurations are consistent across all environments and deployments.

* * *

### Example#

This example shows a GitHub Actions workflow that deploys all Edge Functions when code is merged into the `main` branch.
[code] 
    1
    
    name: Deploy Function
    
    2
    
    3
    
    on:
    
    4
    
      push:
    
    5
    
        branches:
    
    6
    
          - main
    
    7
    
      workflow_dispatch:
    
    8
    
    9
    
    permissions:
    
    10
    
      contents: read
    
    11
    
    12
    
    jobs:
    
    13
    
      deploy:
    
    14
    
        runs-on: ubuntu-latest
    
    15
    
    16
    
        env:
    
    17
    
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    
    18
    
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
    
    19
    
    20
    
        steps:
    
    21
    
          - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
    
    22
    
            with:
    
    23
    
              persist-credentials: false
    
    24
    
    25
    
          - uses: supabase/setup-cli@3c2f5e2ae34c34e428e8e206e2c4d21fa2d20fbf # v2.1.1
    
    26
    
            with:
    
    27
    
              version: latest
    
    28
    
    29
    
          - run: supabase functions deploy --project-ref $SUPABASE_PROJECT_ID
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/.github/workflows/deploy.yaml>)