---
タイトル: Generating Python Types
URL: https://supabase.com/docs/guides/api/rest/generating-python-types
カテゴリ: api
更新日: 2026-08-02
タグ: api, generating, generating-python-types, python, rest, types
---

# Generating Python Types

**URL:** https://supabase.com/docs/guides/api/rest/generating-python-types
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, generating, generating-python-types, python, rest, types

## 目次

- [Generating types using Supabase CLI#](#generating-types-using-supabase-cli)
- [Types for select, insert and update#](#types-for-select-insert-and-update)
- [Update types automatically with GitHub Actions#](#update-types-automatically-with-github-actions)
- [Resources#](#resources)

## 概要

How to generate Python types for your API and Supabase libraries.

---

Supabase APIs are generated from your database, which means that we can use database introspection to generate type-safe API definitions.

## Generating types using Supabase CLI#

The Supabase CLI is a single binary Go application that provides everything you need to setup a local development environment.

You can [install the CLI](<https://www.npmjs.com/package/supabase>) via npm or other supported package managers. The minimum required version of the CLI is [v2.66.0](<https://github.com/supabase/cli/releases>).
[code] 
    1
    
    npm i supabase --save-dev
[/code]

Login with your Personal Access Token:
[code] 
    1
    
    npx supabase login
[/code]

Before generating types, ensure you initialize your Supabase project:
[code] 
    1
    
    npx supabase init
[/code]

Generate types for your project to produce the `database_types.py` file:
[code] 
    1
    
    npx supabase gen types --lang=python --project-id "$PROJECT_REF" --schema public > database.types.py
[/code]

or in case of local development:
[code] 
    1
    
    npx supabase gen types --lang=python --local > database_types.py
[/code]

These types are generated from your database schema. Given a table `public.movies`, the generated types will look like:
[code] 
    1
    
    create table public.movies (
    
    2
    
      id bigint generated always as identity primary key,
    
    3
    
      name text not null,
    
    4
    
      data jsonb null
    
    5
    
    );
[/code]
[code] 
    1
    
    class PublicMovies(BaseModel):
    
    2
    
        data: Optional[Json[Any]] = Field(alias="data")
    
    3
    
        id: int = Field(alias="id")
    
    4
    
        name: str = Field(alias="name")
    
    5
    
    6
    
    class PublicMoviesInsert(TypedDict):
    
    7
    
        data: NotRequired[Annotated[Json[Any], Field(alias="data")]]
    
    8
    
        id: NotRequired[Annotated[int, Field(alias="id")]]
    
    9
    
        name: Annotated[str, Field(alias="name")]
    
    10
    
    11
    
    class PublicMoviesUpdate(TypedDict):
    
    12
    
        data: NotRequired[Annotated[Json[Any], Field(alias="data")]]
    
    13
    
        id: NotRequired[Annotated[int, Field(alias="id")]]
    
    14
    
        name: NotRequired[Annotated[str, Field(alias="name")]]
[/code]

## Types for select, insert and update#

The `PublicMovies` class is used to parse `SELECT` results from the `movies` table, while `PublicMoviesInsert` and `PublicMoviesUpdate` are used to format and provide completion for arguments for `insert` and `update` respectively.
[code] 
    1
    
    from .database_types import PublicMovies, PublicMoviesInsert, PublicMoviesUpdate
    
    2
    
    from supabase import create_client
    
    3
    
    4
    
    client = create_client("YOUR_SUPABASE_URL", "YOUR_SUPABASE_KEY")
    
    5
    
    movies = client.table("movies")
    
    6
    
    7
    
    # Select
    
    8
    
    selected = [PublicMovies(m) for m in movies.select("*").execute().data]
    
    9
    
    10
    
    # Insert
    
    11
    
    inserted = [PublicMovies(m) for m in movies.insert(PublicMoviesInsert(name="foo", data="bar")) \
    
    12
    
                                              .execute().data]
    
    13
    
    14
    
    # Update
    
    15
    
    updated  = [PublicMovies(m) for m in movies.update(PublicMoviesUpdate(name="bar")) \
    
    16
    
                                            .eq("id", 5) \
    
    17
    
                                            .execute().data]
[/code]

## Update types automatically with GitHub Actions#

One way to keep your type definitions in sync with your database is to set up a GitHub action that runs on a schedule.

Add the following script to your `package.json` to run it using `npm run update-types`
[code] 
    1
    
    "update-types": "npx supabase gen types --lang=python --project-id \"$PROJECT_REF\" > database_types.py"
[/code]

Create a file `.github/workflows/update-types.yml` with the following snippet to define the action along with the environment variables. This script will commit new type changes to your repo every night.
[code] 
    1
    
    name: Update database types
    
    2
    
    3
    
    on:
    
    4
    
      schedule:
    
    5
    
        # sets the action to run daily. You can modify this to run the action more or less frequently
    
    6
    
        - cron: '0 0 * * *'
    
    7
    
    8
    
    jobs:
    
    9
    
      update:
    
    10
    
        runs-on: ubuntu-latest
    
    11
    
        permissions:
    
    12
    
          contents: write
    
    13
    
        env:
    
    14
    
          SUPABASE_ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
    
    15
    
          PROJECT_REF: <your-project-id>
    
    16
    
        steps:
    
    17
    
          - uses: actions/checkout@v4
    
    18
    
            with:
    
    19
    
              persist-credentials: false
    
    20
    
              fetch-depth: 0
    
    21
    
          - uses: actions/setup-node@v4
    
    22
    
            with:
    
    23
    
              node-version: 22
    
    24
    
          - run: npm run update-types
    
    25
    
          - name: check for file changes
    
    26
    
            id: git_status
    
    27
    
            run: |
    
    28
    
              echo "status=$(git status -s)" >> $GITHUB_OUTPUT
    
    29
    
          - name: Commit files
    
    30
    
            if: ${{contains(steps.git_status.outputs.status, ' ')}}
    
    31
    
            run: |
    
    32
    
              git add database_types.py
    
    33
    
              git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"
    
    34
    
              git config --local user.name "github-actions[bot]"
    
    35
    
              git commit -m "Update database types" -a
    
    36
    
          - name: Push changes
    
    37
    
            if: ${{contains(steps.git_status.outputs.status, ' ')}}
    
    38
    
            uses: ad-m/github-push-action@master
    
    39
    
            with:
    
    40
    
              github_token: ${{ secrets.GITHUB_TOKEN }}
    
    41
    
              branch: ${{ github.ref }}
[/code]

## Resources#

  * [Generating Supabase types with GitHub Actions](<https://blog.esteetey.dev/how-to-create-and-test-a-github-action-that-generates-types-from-supabase-database>)
  * [Generating TypeScript Types](</docs/guides/api/rest/generating-types>)