---
タイトル: Automated testing using GitHub Actions
URL: https://supabase.com/docs/guides/deployment/ci/testing
カテゴリ: platform
更新日: 2026-08-02
タグ: actions, automated, ci, deployment, github, platform, testing, using
---

# Automated testing using GitHub Actions

**URL:** https://supabase.com/docs/guides/deployment/ci/testing
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** actions, automated, ci, deployment, github, platform, testing, using

## 目次

- [Testing your database#](#testing-your-database)
- [Testing your Edge Functions#](#testing-your-edge-functions)
- [More resources#](#more-resources)

## 概要

Run your tests when you or your team make changes.

---

You can use the Supabase CLI to run automated tests.

## Testing your database#

After you have [created unit tests](<https://supabase.com/docs/guides/database/testing>) for your database, you can use the GitHub Action to run the tests.

Inside your repository, create a new file inside the `.github/workflows` folder called `database-tests.yml`. Copy this snippet inside the file, and the action will run whenever a new PR is created:
[code] 
    1
    
    name: 'database-tests'
    
    2
    
    on:
    
    3
    
      pull_request:
    
    4
    
    5
    
    jobs:
    
    6
    
      build:
    
    7
    
        runs-on: ubuntu-latest
    
    8
    
        steps:
    
    9
    
          - uses: actions/checkout@v3
    
    10
    
          - uses: supabase/setup-cli@v1
    
    11
    
            with:
    
    12
    
              version: latest
    
    13
    
          - run: supabase db start
    
    14
    
          - run: supabase test db
[/code]

## Testing your Edge Functions#

After you have [created unit tests](<https://supabase.com/docs/guides/functions/unit-test>) for your Edge Functions, you can use the GitHub Action to run the tests.

Inside your repository, create a new file inside the `.github/workflows` folder called `functions-tests.yml`. Copy this snippet inside the file, and the action will run whenever a new PR is created:
[code] 
    1
    
    name: 'functions-tests'
    
    2
    
    on:
    
    3
    
      pull_request:
    
    4
    
    5
    
    jobs:
    
    6
    
      build:
    
    7
    
        runs-on: ubuntu-latest
    
    8
    
        steps:
    
    9
    
          - uses: actions/checkout@v3
    
    10
    
          - uses: supabase/setup-cli@v1
    
    11
    
            with:
    
    12
    
              version: latest
    
    13
    
          - uses: denoland/setup-deno@v2
    
    14
    
            with:
    
    15
    
              deno-version: latest
    
    16
    
          - run: supabase start
    
    17
    
          - run: deno test --allow-all deno-test.ts --env-file .env.local
[/code]

## More resources#

  * Learn more about the [pgTAP extension](<https://supabase.com/docs/guides/database/extensions/pgtap>) for database testing.
  * Official pgTAP Documentation: [pgtap.org](<https://pgtap.org/>)