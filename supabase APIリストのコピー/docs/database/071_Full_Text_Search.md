---
タイトル: Full Text Search
URL: https://supabase.com/docs/guides/database/full-text-search
カテゴリ: database
更新日: 2026-08-02
タグ: database, full, full-text-search, search, text
---

# Full Text Search

**URL:** https://supabase.com/docs/guides/database/full-text-search
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, full, full-text-search, search, text

## 目次

- [Preparation#](#preparation)
- [Usage#](#usage)
  - [to_tsvector()#](#to-tsvector)
  - [to_tsquery()#](#to-tsquery)
  - [Match:@@#](#match)
- [Basic full text queries#](#basic-full-text-queries)
  - [Search a single column#](#search-a-single-column)
  - [Search multiple columns#](#search-multiple-columns)
  - [Match all search words#](#match-all-search-words)
  - [Match any search words#](#match-any-search-words)
- [Partial search#](#partial-search)
  - [Implementing partial search#](#implementing-partial-search)
  - [Extending functionality with RPC#](#extending-functionality-with-rpc)
- [Handling spaces in queries#](#handling-spaces-in-queries)
- [Web search syntax withwebsearch_to_tsquery()#](#websearch-to-tsquery)
  - [Basic usage#](#basic-usage)
  - [Quoted phrases#](#quoted-phrases)
  - [OR searches#](#or-searches)
  - [Negation#](#negation)
  - [Complex queries#](#complex-queries)
- [Creating indexes#](#creating-indexes)
  - [Searchable columns#](#searchable-columns)
  - [Search using the new column#](#search-using-the-new-column)
- [Query operators#](#query-operators)
  - [Proximity:<->#](#proximity)

## 概要

How to use full text search in Postgres.

---

Postgres has built-in functions to handle `Full Text Search` queries. This is like a "search engine" within Postgres.

## Preparation#

For this guide we'll use the following example data:

DataSQL

id| title| author| description  
---|---|---|---  
1| The Poky Little Puppy| Janette Sebring Lowrey| Puppy is slower than other, bigger animals.  
2| The Tale of Peter Rabbit| Beatrix Potter| Rabbit eats some vegetables.  
3| Tootle| Gertrude Crampton| Little toy train has big dreams.  
4| Green Eggs and Ham| Dr. Seuss| Sam has changing food preferences and eats unusually colored food.  
5| Harry Potter and the Goblet of Fire| J.K. Rowling| Fourth year of school starts, big drama ensues.  
  
## Usage#

The functions we'll cover in this guide are:

### `to_tsvector()`#

Converts your data into searchable tokens. `to_tsvector()` stands for "to text search vector." For example:
[code] 
    1
    
    select to_tsvector('green eggs and ham');
    
    2
    
    -- Returns 'egg':2 'green':1 'ham':4
[/code]

Collectively these tokens are called a "document" which Postgres can use for comparisons.

### `to_tsquery()`#

Converts a query string into tokens to match. `to_tsquery()` stands for "to text search query."

This conversion step is important because we will want to "fuzzy match" on keywords. For example if a user searches for `eggs`, and a column has the value `egg`, we probably still want to return a match.

Postgres provides several functions to create tsquery objects:

  * **`to_tsquery()`** \- Requires manual specification of operators (`&`, `|`, `!`)
  * **`plainto_tsquery()`** \- Converts plain text to an AND query: `plainto_tsquery('english', 'fat rats')` → `'fat' & 'rat'`
  * **`phraseto_tsquery()`** \- Creates phrase queries: `phraseto_tsquery('english', 'fat rats')` → `'fat' <-> 'rat'`
  * **`websearch_to_tsquery()`** \- Supports web search syntax with quotes, "or", and negation


### Match: `@@`#

The `@@` symbol is the "match" symbol for Full Text Search. It returns any matches between a `to_tsvector` result and a `to_tsquery` result.

Take the following example:

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select *
    
    2
    
    from books
    
    3
    
    where title = 'Harry';
[/code]

The equality symbol above (`=`) is very "strict" on what it matches. In a full text search context, we might want to find all "Harry Potter" books and so we can rewrite the example above:

SQLJavaScriptDartSwiftKotlin
[code]
    1
    
    select *
    
    2
    
    from books
    
    3
    
    where to_tsvector(title) @@ to_tsquery('Harry');
[/code]

## Basic full text queries#

### Search a single column#

To find all `books` where the `description` contain the word `big`:

SQLJavaScriptDartSwiftKotlinPythonData
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description)
    
    7
    
      @@ to_tsquery('big');
[/code]

### Search multiple columns#

Right now there is no direct way to use JavaScript or Dart to search through multiple columns but you can do it by creating [computed columns](<https://postgrest.org/en/stable/api.html#computed-virtual-columns>) on the database.

To find all `books` where `description` or `title` contain the word `little`:

SQLJavaScriptDartSwiftKotlinPythonData
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description || ' ' || title) -- concat columns, but be sure to include a space to separate them!
    
    7
    
      @@ to_tsquery('little');
[/code]

### Match all search words#

To find all `books` where `description` contains BOTH of the words `little` and `big`, we can use the `&` symbol:

SQLJavaScriptDartSwiftKotlinPythonData
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description)
    
    7
    
      @@ to_tsquery('little & big'); -- use & for AND in the search query
[/code]

### Match any search words#

To find all `books` where `description` contain ANY of the words `little` or `big`, use the `|` symbol:

SQLJavaScriptDartSwiftKotlinPythonData
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description)
    
    7
    
      @@ to_tsquery('little | big'); -- use | for OR in the search query
[/code]

Notice how searching for `big` includes results with the word `bigger` (or `biggest`, etc).

## Partial search#

Partial search is particularly useful when you want to find matches on substrings within your data.

### Implementing partial search#

You can use the `:*` syntax with `to_tsquery()`. Here's an example that searches for any book titles beginning with "Lit":
[code] 
    1
    
    select title from books where to_tsvector(title) @@ to_tsquery('Lit:*');
[/code]

### Extending functionality with RPC#

To make the partial search functionality accessible through the API, you can wrap the search logic in a database function.

After creating this function, you can invoke it from your application using the SDK for your platform. Here's an example:

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    create or replace function search_books_by_title_prefix(prefix text)
    
    2
    
    returns setof books AS $$
    
    3
    
    begin
    
    4
    
      return query
    
    5
    
      select * from books where to_tsvector('english', title) @@ to_tsquery(prefix || ':*');
    
    6
    
    end;
    
    7
    
    $$ language plpgsql;
[/code]

This function takes a prefix parameter and returns all books where the title contains a word starting with that prefix. The `:*` operator is used to denote a prefix match in the `to_tsquery()` function.

## Handling spaces in queries#

When you want the search term to include a phrase or multiple words, you can concatenate words using a `+` as a placeholder for space:
[code] 
    1
    
    select * from search_books_by_title_prefix('Little+Puppy');
[/code]

## Web search syntax with `websearch_to_tsquery()`#

The `websearch_to_tsquery()` function provides an intuitive search syntax similar to popular web search engines, making it ideal for user-facing search interfaces.

### Basic usage#

SQLJavaScript
[code]
    1
    
    select *
    
    2
    
    from books
    
    3
    
    where to_tsvector(description) @@ websearch_to_tsquery('english', 'green eggs');
[/code]

### Quoted phrases#

Use quotes to search for exact phrases:
[code] 
    1
    
    select * from books
    
    2
    
    where to_tsvector(description || ' ' || title) @@ websearch_to_tsquery('english', '"Green Eggs"');
    
    3
    
    -- Matches documents containing "Green" immediately followed by "Eggs"
[/code]

### OR searches#

Use "or" (case-insensitive) to search for multiple terms:
[code] 
    1
    
    select * from books
    
    2
    
    where to_tsvector(description) @@ websearch_to_tsquery('english', 'puppy or rabbit');
    
    3
    
    -- Matches documents containing either "puppy" OR "rabbit"
[/code]

### Negation#

Use a dash (-) to exclude terms:
[code] 
    1
    
    select * from books
    
    2
    
    where to_tsvector(description) @@ websearch_to_tsquery('english', 'animal -rabbit');
    
    3
    
    -- Matches documents containing "animal" but NOT "rabbit"
[/code]

### Complex queries#

Combine multiple operators for sophisticated searches:
[code] 
    1
    
    select * from books
    
    2
    
    where to_tsvector(description || ' ' || title) @@
    
    3
    
      websearch_to_tsquery('english', '"Harry Potter" or "Dr. Seuss" -vegetables');
    
    4
    
    -- Matches books by "Harry Potter" or "Dr. Seuss" but excludes those mentioning vegetables
[/code]

## Creating indexes#

Now that you have Full Text Search working, create an `index`. This allows Postgres to "build" the documents preemptively so that they don't need to be created at the time we execute the query. This will make our queries much faster.

### Searchable columns#

Create a new column `fts` inside the `books` table to store the searchable index of the `title` and `description` columns.

We can use a special feature of Postgres called [Generated Columns](<https://www.postgresql.org/docs/current/ddl-generated-columns.html>) to ensure that the index is updated any time the values in the `title` and `description` columns change.

SQLData
[code]
    1
    
    alter table
    
    2
    
      books
    
    3
    
    add column
    
    4
    
      fts tsvector generated always as (to_tsvector('english', description || ' ' || title)) stored;
    
    5
    
    6
    
    create index books_fts on books using gin (fts); -- generate the index
    
    7
    
    8
    
    select id, fts
    
    9
    
    from books;
[/code]

### Search using the new column#

Now that we've created and populated our index, we can search it using the same techniques as before:

SQLJavaScriptDartSwiftKotlinPythonData
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      fts @@ to_tsquery('little & big');
[/code]

## Query operators#

Visit [Postgres: Text Search Functions and Operators](<https://www.postgresql.org/docs/current/functions-textsearch.html>) to learn about additional query operators you can use to do more advanced `full text queries`, such as:

### Proximity: `<->`#

The proximity symbol is useful for searching for terms that are a certain "distance" apart. For example, to find the phrase `big dreams`, where the a match for "big" is followed immediately by a match for "dreams":

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description) @@ to_tsquery('big <-> dreams');
[/code]

We can also use the `<->` to find words within a certain distance of each other. For example to find `year` and `school` within 2 words of each other:

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description) @@ to_tsquery('year <2> school');
[/code]

### Negation: `!`#

The negation symbol can be used to find phrases which _don't_ contain a search term. For example, to find records that have the word `big` but not `little`:

SQLJavaScriptDartSwiftKotlinPython
[code]
    1
    
    select
    
    2
    
      *
    
    3
    
    from
    
    4
    
      books
    
    5
    
    where
    
    6
    
      to_tsvector(description) @@ to_tsquery('big & !little');
[/code]

## Ranking search results #

Postgres provides ranking functions to sort search results by relevance, helping you present the most relevant matches first. Since ranking functions need to be computed server-side, use RPC functions and generated columns.

### Creating a search function with ranking #

First, create a Postgres function that handles search and ranking:
[code] 
    1
    
    create or replace function search_books(search_query text)
    
    2
    
    returns table(id int, title text, description text, rank real) as $$
    
    3
    
    begin
    
    4
    
      return query
    
    5
    
      select
    
    6
    
        books.id,
    
    7
    
        books.title,
    
    8
    
        books.description,
    
    9
    
        ts_rank(to_tsvector('english', books.description), to_tsquery(search_query)) as rank
    
    10
    
      from books
    
    11
    
      where to_tsvector('english', books.description) @@ to_tsquery(search_query)
    
    12
    
      order by rank desc;
    
    13
    
    end;
    
    14
    
    $$ language plpgsql;
[/code]

Now you can call this function from your client:

JavaScriptDartPythonSQL
[code]
    1
    
    const { data, error } = await supabase.rpc('search_books', { search_query: 'big' })
[/code]

### Ranking with weighted columns #

Postgres allows you to assign different importance levels to different parts of your documents using weight labels. This is especially useful when you want matches in certain fields (like titles) to rank higher than matches in other fields (like descriptions).

#### Understanding weight labels#

Postgres uses four weight labels: **A** , **B** , **C** , and **D** , where:

  * **A** = Highest importance (weight 1.0)
  * **B** = High importance (weight 0.4)
  * **C** = Medium importance (weight 0.2)
  * **D** = Low importance (weight 0.1)


#### Creating weighted search columns#

First, create a weighted tsvector column that gives titles higher priority than descriptions:
[code] 
    1
    
    -- Add a weighted fts column
    
    2
    
    alter table books
    
    3
    
    add column fts_weighted tsvector
    
    4
    
    generated always as (
    
    5
    
      setweight(to_tsvector('english', title), 'A') ||
    
    6
    
      setweight(to_tsvector('english', description), 'B')
    
    7
    
    ) stored;
    
    8
    
    9
    
    -- Create index for the weighted column
    
    10
    
    create index books_fts_weighted on books using gin (fts_weighted);
[/code]

Now create a search function that uses this weighted column:
[code] 
    1
    
    create or replace function search_books_weighted(search_query text)
    
    2
    
    returns table(id int, title text, description text, rank real) as $$
    
    3
    
    begin
    
    4
    
      return query
    
    5
    
      select
    
    6
    
        books.id,
    
    7
    
        books.title,
    
    8
    
        books.description,
    
    9
    
        ts_rank(books.fts_weighted, to_tsquery(search_query)) as rank
    
    10
    
      from books
    
    11
    
      where books.fts_weighted @@ to_tsquery(search_query)
    
    12
    
      order by rank desc;
    
    13
    
    end;
    
    14
    
    $$ language plpgsql;
[/code]

#### Custom weight arrays#

You can also specify custom weights by providing a weight array to `ts_rank()`:
[code] 
    1
    
    create or replace function search_books_custom_weights(search_query text)
    
    2
    
    returns table(id int, title text, description text, rank real) as $$
    
    3
    
    begin
    
    4
    
      return query
    
    5
    
      select
    
    6
    
        books.id,
    
    7
    
        books.title,
    
    8
    
        books.description,
    
    9
    
        ts_rank(
    
    10
    
          '{0.0, 0.2, 0.5, 1.0}'::real[], -- Custom weights {D, C, B, A}
    
    11
    
          books.fts_weighted,
    
    12
    
          to_tsquery(search_query)
    
    13
    
        ) as rank
    
    14
    
      from books
    
    15
    
      where books.fts_weighted @@ to_tsquery(search_query)
    
    16
    
      order by rank desc;
    
    17
    
    end;
    
    18
    
    $$ language plpgsql;
[/code]

This example uses custom weights where:

  * A-labeled terms (titles) have maximum weight (1.0)
  * B-labeled terms (descriptions) have medium weight (0.5)
  * C-labeled terms have low weight (0.2)
  * D-labeled terms are ignored (0.0)


#### Using the weighted search#

JavaScriptPythonSQL
[code]
    1
    
    // Search with standard weighted ranking
    
    2
    
    const { data, error } = await supabase.rpc('search_books_weighted', { search_query: 'Harry' })
    
    3
    
    4
    
    // Search with custom weights
    
    5
    
    const { data: customData, error: customError } = await supabase.rpc('search_books_custom_weights', {
    
    6
    
      search_query: 'Harry',
    
    7
    
    })
[/code]

#### Practical example with results#

Say you search for "Harry". With weighted columns:

  1. **"Harry Potter and the Goblet of Fire"** (title match) gets weight A = 1.0
  2. **Books mentioning "Harry" in description** get weight B = 0.4


This ensures that books with "Harry" in the title ranks significantly higher than books that only mention "Harry" in the description, providing more relevant search results for users.

### Using ranking with indexes #

When using the `fts` column you created earlier, ranking becomes more efficient. Create a function that uses the indexed column:
[code] 
    1
    
    create or replace function search_books_fts(search_query text)
    
    2
    
    returns table(id int, title text, description text, rank real) as $$
    
    3
    
    begin
    
    4
    
      return query
    
    5
    
      select
    
    6
    
        books.id,
    
    7
    
        books.title,
    
    8
    
        books.description,
    
    9
    
        ts_rank(books.fts, to_tsquery(search_query)) as rank
    
    10
    
      from books
    
    11
    
      where books.fts @@ to_tsquery(search_query)
    
    12
    
      order by rank desc;
    
    13
    
    end;
    
    14
    
    $$ language plpgsql;
[/code]

JavaScriptDartPythonSQL
[code]
    1
    
    const { data, error } = await supabase.rpc('search_books_fts', { search_query: 'little & big' })
[/code]

### Using web search syntax with ranking #

You can also create a function that combines `websearch_to_tsquery()` with ranking for user-friendly search:
[code] 
    1
    
    create or replace function websearch_books(search_text text)
    
    2
    
    returns table(id int, title text, description text, rank real) as $$
    
    3
    
    begin
    
    4
    
      return query
    
    5
    
      select
    
    6
    
        books.id,
    
    7
    
        books.title,
    
    8
    
        books.description,
    
    9
    
        ts_rank(books.fts, websearch_to_tsquery('english', search_text)) as rank
    
    10
    
      from books
    
    11
    
      where books.fts @@ websearch_to_tsquery('english', search_text)
    
    12
    
      order by rank desc;
    
    13
    
    end;
    
    14
    
    $$ language plpgsql;
[/code]

JavaScriptSQL
[code]
    1
    
    // Support natural search syntax
    
    2
    
    const { data, error } = await supabase.rpc('websearch_books', {
    
    3
    
      search_text: '"little puppy" or train -vegetables',
    
    4
    
    })
[/code]

## Resources#

  * [Postgres: Text Search Functions and Operators](<https://www.postgresql.org/docs/12/functions-textsearch.html>)