---
タイトル: Generate types using GitHub Actions
URL: https://supabase.com/docs/guides/deployment/ci/generating-types
カテゴリ: platform
更新日: 2026-08-02
タグ: actions, ci, deployment, generate, generating-types, github, platform, types, using
---

# Generate types using GitHub Actions

**URL:** https://supabase.com/docs/guides/deployment/ci/generating-types
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** actions, ci, deployment, generate, generating-types, github, platform, types, using

## 目次

- [Verify types#](#verify-types)
- [More resources#](#more-resources)

## 概要

End-to-end type safety across client, server, and database.

---

You can use the Supabase CLI to automatically generate Typescript definitions from your Postgres database. You can then pass these definitions to your `supabase-js` client and get end-to-end type safety across client, server, and database.

Inside your repository, create a new file inside the `.github/workflows` folder called `generate-types.yml`. Copy this snippet inside the file, and the action will run whenever a new PR is created:

## Verify types#
[code] 
    1
    
    name: 'generate-types'
    
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
    
            - uses: supabase/setup-cli@v1
    
    10
    
              with:
    
    11
    
                version: latest
    
    12
    
            - run: supabase init
    
    13
    
            - run: supabase db start
    
    14
    
            - name: Verify generated types match Postgres schema
    
    15
    
              run: |
    
    16
    
                supabase gen types typescript --local > schema.gen.ts
    
    17
    
                if ! git diff --ignore-space-at-eol --exit-code --quiet schema.gen.ts; then
    
    18
    
                  echo "Detected uncommitted changes after build. See status below:"
    
    19
    
                  git diff
    
    20
    
                  exit 1
    
    21
    
                fi
[/code]

## More resources#

  * Using supabase-js with type definitions: [Typescript Support](<https://supabase.com/docs/reference/javascript/typescript-support>)