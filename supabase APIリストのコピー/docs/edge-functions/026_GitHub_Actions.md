---
タイトル: GitHub Actions
URL: https://supabase.com/docs/guides/functions/examples/github-actions
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: actions, edge-functions, examples, functions, github, github-actions
---

# GitHub Actions

**URL:** https://supabase.com/docs/guides/functions/examples/github-actions
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** actions, edge-functions, examples, functions, github, github-actions

## 目次

（目次なし）

## 概要

Deploying Edge Functions with GitHub Actions.

---

Use the Supabase CLI together with GitHub Actions to automatically deploy our Supabase Edge Functions. [View on GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/github-action-deploy>).
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
    
          SUPABASE_ACCESS_TOKEN: YOUR_SUPABASE_ACCESS_TOKEN
    
    15
    
          PROJECT_ID: YOUR_SUPABASE_PROJECT_ID
    
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

Since Supabase CLI [v1.62.0](<https://github.com/supabase/cli/releases/tag/v1.62.0>) you can deploy all functions with a single command.

Individual function configuration like [JWT verification](</docs/guides/local-development/cli/config#functions.function_name.verify_jwt>) and [import map location](</docs/guides/local-development/cli/config#functions.function_name.import_map>) can be set via the `config.toml` file.
[code] 
    1
    
    [functions.hello-world]
    
    2
    
    verify_jwt = false
[/code]