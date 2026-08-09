---
タイトル: OpenAPI
URL: https://supabase.com/docs/guides/database/extensions/wrappers/openapi
カテゴリ: database
更新日: 2026-08-02
タグ: api, database, extensions, openapi, wrappers
---

# OpenAPI

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/openapi
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** api, database, extensions, openapi, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the OpenAPI Wrapper#](#enable-the-openapi-wrapper)
  - [Store credentials (optional)#](#store-credentials-optional)
  - [Connecting to an API#](#connecting-to-an-api)
  - [Server Options#](#server-options)
  - [Create a schema#](#create-a-schema)
- [Creating Foreign Tables#](#creating-foreign-tables)
  - [Manual Table Creation#](#manual-table-creation)
  - [Table Options#](#table-options)
  - [Automatic Schema Import#](#automatic-schema-import)
- [Path Parameters#](#path-parameters)
  - [Multiple Path Parameters#](#multiple-path-parameters)
- [Query Pushdown#](#query-pushdown)
  - [Single Resource Access#](#single-resource-access)
  - [Query Parameters#](#query-parameters)
  - [LIMIT Pushdown#](#limit-pushdown)
- [POST-for-Read Endpoints#](#post-for-read-endpoints)
- [Debug Mode#](#debug-mode)
- [Pagination#](#pagination)
  - [Configuring Pagination#](#configuring-pagination)
- [GeoJSON Support#](#geojson-support)
- [Supported Data Types#](#supported-data-types)
  - [TheattrsColumn#](#the-attrs-column)

## 概要

Searchdocs...

---

[OpenAPI](<https://www.openapis.org/>) is a specification for describing HTTP APIs. The OpenAPI Wrapper is a generic WebAssembly (Wasm) foreign data wrapper that can connect to any REST API with an OpenAPI 3.0+ specification.

This wrapper allows you to query any REST API endpoint as a PostgreSQL foreign table, with support for path parameters, pagination, POST-for-read endpoints, and automatic schema import.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.1| `https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.1/openapi_fdw.wasm`| `12c902f3089e18142a1d8d35c66b9ceb85c193224229687bd929aff6b44cddde`| >=0.6.2  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm`| `f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa`| >=0.5.0  
0.1.4| `https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.1.4/openapi_fdw.wasm`| `dd434f8565b060b181d1e69e1e4d5c8b9c3ac5ca444056d3c2fb939038d308fe`| >=0.5.0  
  
## Preparation#

Before you can query an API, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the OpenAPI Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

### Store credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'your-api-key',
    
    4
    
      'my_api',
    
    5
    
      'API key for My API'
    
    6
    
    );
[/code]

### Connecting to an API#

We need to provide Postgres with the credentials to access the API and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server my_api_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:openapi-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    8
    
        base_url 'https://api.example.com/v1',
    
    9
    
        api_key_id '<key_ID>'  -- The Key ID from Vault
    
    10
    
      );
[/code]

### Server Options#

Option| Required| Description  
---|---|---  
`fdw_package_*`| Yes| Standard Wasm FDW package metadata. See Available Versions.  
`base_url`| Yes*| Base URL for the API (e.g., `https://api.example.com/v1`). *Optional if `spec_url` or `spec_json` provides servers.  
`spec_url`| No| URL to the OpenAPI specification (JSON or YAML). Required for `IMPORT FOREIGN SCHEMA`. Mutually exclusive with `spec_json`.  
`spec_json`| No| Inline OpenAPI 3.0+ JSON spec for `IMPORT FOREIGN SCHEMA`. Mutually exclusive with `spec_url`. Useful when the API doesn't publish a spec URL.  
`api_key`| No| API key for authentication.  
`api_key_id`| No| Vault secret key ID storing the API key. Use instead of `api_key`.  
`api_key_header`| No| Header name for API key (default: `Authorization`).  
`api_key_prefix`| No| Prefix for API key value (default: `Bearer` for Authorization header).  
`api_key_location`| No| Where to send the API key: `header` (default), `query`, or `cookie`.  
`bearer_token`| No| Bearer token for authentication (alternative to `api_key`).  
`bearer_token_id`| No| Vault secret key ID storing the bearer token.  
`auth_token_setting`| No| Name of a Postgres session variable (GUC) to read the auth token from at request time, e.g. `app.api_token`. When set and non-empty it overrides any static credential for that request. See Per-request credentials.  
`auth_token_prefix`| No| Prefix for the `auth_token_setting` value in the Authorization header (default: `Bearer`). Set to an empty string to send the raw token.  
`user_agent`| No| Custom User-Agent header value.  
`accept`| No| Custom Accept header for content negotiation (e.g., `application/geo+json`).  
`headers`| No| Custom headers as JSON object (e.g., `'{"X-Custom": "value"}'`).  
`include_attrs`| No| Include `attrs` jsonb column in `IMPORT FOREIGN SCHEMA` output (default: `'true'`). Set to `'false'` to omit.  
`page_size`| No| Default page size for pagination (0 = no automatic limit).  
`page_size_param`| No| Query parameter name for page size (default: `limit`).  
`cursor_param`| No| Query parameter name for pagination cursor (default: `after`).  
`max_pages`| No| Maximum pages per scan to prevent infinite pagination loops (default: `1000`).  
`max_response_bytes`| No| Maximum response body size in bytes (default: `52428800` / 50 MiB).  
`debug`| No| Emit HTTP request details and scan stats via PostgreSQL INFO messages when set to `'true'` or `'1'`.  
  
### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists openapi;
[/code]

## Creating Foreign Tables#

### Manual Table Creation#

Create foreign tables manually by specifying the endpoint and columns:
[code] 
    1
    
    create foreign table openapi.users (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      email text,
    
    5
    
      created_at timestamptz,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
    server my_api_server
    
    9
    
    options (
    
    10
    
      endpoint '/users',
    
    11
    
      rowid_column 'id'
    
    12
    
    );
[/code]

### Table Options#

Option| Required| Description  
---|---|---  
`endpoint`| Yes| API endpoint path (e.g., `/users`, `/users/{user_id}/posts`).  
`rowid_column`| No| Column used as row identifier for single-resource access and modifications (default: `id`).  
`response_path`| No| JSON pointer to extract data array from response (e.g., `/data`, `/results`).  
`object_path`| No| JSON pointer to extract nested object from each row (e.g., `/properties` for GeoJSON).  
`cursor_path`| No| JSON pointer to pagination cursor in response.  
`cursor_param`| No| Override server-level cursor parameter name.  
`page_size_param`| No| Override server-level page size parameter name.  
`page_size`| No| Override server-level page size.  
`method`| No| HTTP method for this endpoint. Use `POST` for read-via-POST endpoints (default: `GET`).  
`request_body`| No| Request body string for POST endpoints.  
  
### Automatic Schema Import#

If you provide a `spec_url` or `spec_json` in the server options, you can automatically import table definitions:
[code] 
    1
    
    -- Import all endpoints
    
    2
    
    import foreign schema openapi
    
    3
    
      from server my_api_server
    
    4
    
      into api;
    
    5
    
    6
    
    -- Import specific endpoints only
    
    7
    
    import foreign schema openapi
    
    8
    
      limit to ("users", "orders")
    
    9
    
      from server my_api_server
    
    10
    
      into api;
    
    11
    
    12
    
    -- Import all except specific endpoints
    
    13
    
    import foreign schema openapi
    
    14
    
      except ("internal_endpoint")
    
    15
    
      from server my_api_server
    
    16
    
      into api;
[/code]

`IMPORT FOREIGN SCHEMA` only generates tables for non-parameterized GET endpoints (e.g., `/users`, `/orders`). Endpoints with path parameters like `/users/{user_id}/posts` are skipped because they require WHERE clause values at query time. Create these tables manually using the `endpoint` option with `{param}` placeholders — see Path Parameters for examples.

## Path Parameters#

The OpenAPI FDW supports path parameter substitution. Define parameters in the endpoint template using `{param_name}` syntax, and provide values via WHERE clauses:
[code] 
    1
    
    -- Endpoint template with path parameter
    
    2
    
    create foreign table openapi.user_posts (
    
    3
    
      user_id text,
    
    4
    
      id text,
    
    5
    
      title text,
    
    6
    
      body text,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
    server my_api_server
    
    10
    
    options (
    
    11
    
      endpoint '/users/{user_id}/posts',
    
    12
    
      rowid_column 'id'
    
    13
    
    );
    
    14
    
    15
    
    -- Query with path parameter - generates GET /users/123/posts
    
    16
    
    select * from openapi.user_posts where user_id = '123';
[/code]

### Multiple Path Parameters#
[code] 
    1
    
    create foreign table openapi.project_issues (
    
    2
    
      org text,
    
    3
    
      repo text,
    
    4
    
      id text,
    
    5
    
      title text,
    
    6
    
      status text,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
    server my_api_server
    
    10
    
    options (
    
    11
    
      endpoint '/projects/{org}/{repo}/issues',
    
    12
    
      rowid_column 'id'
    
    13
    
    );
    
    14
    
    15
    
    -- Generates GET /projects/acme/widgets/issues
    
    16
    
    select * from openapi.project_issues where org = 'acme' and repo = 'widgets';
[/code]

## Query Pushdown#

### Single Resource Access#

When filtering by the `rowid_column`, the FDW automatically requests a single resource:
[code] 
    1
    
    -- Generates GET /users/user-123
    
    2
    
    select * from openapi.users where id = 'user-123';
[/code]

### Query Parameters#

Other WHERE clause filters are passed as query parameters:
[code] 
    1
    
    -- Generates GET /users?status=active
    
    2
    
    select * from openapi.users where status = 'active';
[/code]

Columns used as query or path parameters always return the value from the WHERE clause, even if the API response contains the same field with different casing. This ensures PostgreSQL's post-filter always passes.

### LIMIT Pushdown#

When your query includes a `LIMIT`, the FDW uses it as the `page_size` for the first API request, reducing unnecessary data transfer:
[code] 
    1
    
    -- Sends GET /users?limit=5 (uses LIMIT as page_size)
    
    2
    
    select * from openapi.users limit 5;
[/code]

## POST-for-Read Endpoints#

Some APIs use POST requests for read operations (e.g., search or query endpoints). Use the `method` and `request_body` table options:
[code] 
    1
    
    create foreign table openapi.search_results (
    
    2
    
      id text,
    
    3
    
      title text,
    
    4
    
      score real,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
    server my_api_server
    
    8
    
    options (
    
    9
    
      endpoint '/search',
    
    10
    
      method 'POST',
    
    11
    
      request_body '{"query": "openapi", "limit": 50}'
    
    12
    
    );
    
    13
    
    14
    
    select id, title, score from openapi.search_results;
[/code]

## Debug Mode#

Enable debug mode to see HTTP request details and scan statistics in PostgreSQL INFO messages:
[code] 
    1
    
    create server debug_api
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:openapi-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    8
    
        base_url 'https://api.example.com',
    
    9
    
        debug 'true'
    
    10
    
      );
[/code]

Debug output includes:

  * HTTP method and URL for each request
  * Response status code and body size
  * Total rows fetched and pages retrieved
  * Pagination details


## Pagination#

The FDW automatically handles pagination. It supports:

  1. **Cursor-based pagination** \- Uses `cursor_param` and `cursor_path`
  2. **URL-based pagination** \- Follows `next` links in response body (e.g., `/links/next`, `/meta/pagination/next`)
  3. **`Link` header pagination** \- Follows [RFC 8288](<https://datatracker.ietf.org/doc/html/rfc8288>) `Link: <...>; rel="next"` response headers (GitHub, GitLab, and most REST APIs)
  4. **Offset-based pagination** \- Auto-detected from common patterns


### Configuring Pagination#
[code] 
    1
    
    create server paginated_api
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:openapi-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    8
    
        base_url 'https://openapi.example.com',
    
    9
    
        page_size '100',
    
    10
    
        page_size_param 'limit',
    
    11
    
        cursor_param 'cursor'
    
    12
    
      );
[/code]
[code] 
    1
    
    create foreign table openapi.items (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      attrs jsonb
    
    5
    
    )
    
    6
    
    server paginated_api
    
    7
    
    options (
    
    8
    
      endpoint '/items',
    
    9
    
      cursor_path '/meta/next_cursor'
    
    10
    
    );
[/code]

## GeoJSON Support#

For APIs that return GeoJSON, use `object_path` to extract properties:
[code] 
    1
    
    create foreign table openapi.locations (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      category text,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
    server my_api_server
    
    8
    
    options (
    
    9
    
      endpoint '/locations',
    
    10
    
      response_path '/features',
    
    11
    
      object_path '/properties'
    
    12
    
    );
[/code]

## Supported Data Types#

Postgres Type| JSON Type  
---|---  
text| string  
boolean| boolean  
smallint*| number  
integer| number  
bigint| number  
real| number  
double precision| number  
numeric*| number  
date| string (ISO 8601)  
timestamp*| string (ISO 8601)  
timestamptz| string (ISO 8601)  
jsonb| object/array  
uuid| string  
  
* Types marked with an asterisk work when you define tables manually, but `IMPORT FOREIGN SCHEMA` won't generate columns with these types automatically.

### The `attrs` Column#

Any foreign table can include an `attrs` column of type `jsonb` to capture the entire raw JSON response for each row:
[code] 
    1
    
    create foreign table openapi.users (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      attrs jsonb  -- Contains full JSON object
    
    5
    
    )
    
    6
    
    server my_api_server
    
    7
    
    options (endpoint '/users');
[/code]

## Limitations#

  * **Read-only** : This FDW only supports SELECT operations. INSERT, UPDATE, and DELETE are not supported at this time.
  * **No transactions** : Each SQL statement results in immediate HTTP requests; there is no transactional grouping.
  * **Authentication** : Supports API Key and Bearer Token authentication, either static (server option or Vault) or resolved per request from a session variable (see Per-request credentials). The FDW does not run OAuth flows itself, but a session variable lets you supply a token your application already obtained.
  * **OpenAPI version** : Only OpenAPI 3.0+ specifications are supported (not Swagger 2.0).


## Automatic Retries#

The FDW automatically retries transient HTTP errors up to 3 times:

  * **HTTP 429** (Rate Limit), **502** (Bad Gateway), **503** (Service Unavailable)
  * **Retry-After header** : Respects server-specified delay when provided
  * **Exponential backoff** : Falls back to 1s, 2s, 4s delays when no Retry-After header is present


For APIs with very strict rate limits, consider using materialized views to cache results.

## Examples#

For additional real-world examples with multiple tables, pagination, and advanced features, see the **[examples directory on GitHub](<https://github.com/supabase/wrappers/tree/main/wasm-wrappers/fdw/openapi_fdw/examples>)**. There are step-by-step walkthroughs for querying the NWS Weather API, PokéAPI, CarAPI, GitHub, and Threads.

### Basic Query#
[code] 
    1
    
    -- Create a foreign server connecting to the Weather.gov API
    
    2
    
    create server openapi_server
    
    3
    
      foreign data wrapper wasm_wrapper
    
    4
    
      options (
    
    5
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    6
    
        fdw_package_name 'supabase:openapi-fdw',
    
    7
    
        fdw_package_version '0.2.0',
    
    8
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    9
    
        base_url 'https://api.weather.gov',
    
    10
    
        spec_url 'https://api.weather.gov/openapi.json'
    
    11
    
      );
    
    12
    
    13
    
    -- Create a schema to hold the imported foreign tables
    
    14
    
    create schema if not exists openapi;
    
    15
    
    16
    
    -- Auto-import all API endpoints as foreign tables based on the OpenAPI spec
    
    17
    
    import foreign schema openapi from server openapi_server into openapi;
    
    18
    
    19
    
    -- Query the stations endpoint to get weather station data
    
    20
    
    select * from openapi.stations limit 5;
[/code]

### Nested Resources#
[code] 
    1
    
    -- Create a foreign table for a parameterized endpoint with {zone_id} path parameter
    
    2
    
    create foreign table openapi.zone_stations (
    
    3
    
      zone_id text,
    
    4
    
      id text,
    
    5
    
      type text,
    
    6
    
      attrs jsonb
    
    7
    
    ) server openapi_server
    
    8
    
    options (
    
    9
    
      endpoint '/zones/forecast/{zone_id}/stations',
    
    10
    
      rowid_column 'id'
    
    11
    
    );
    
    12
    
    13
    
    -- Query stations for Alaska zone AKZ317 - generates GET /zones/forecast/AKZ317/stations
    
    14
    
    select id, type from openapi.zone_stations where zone_id = 'AKZ317';
[/code]

### POST-for-Read#
[code] 
    1
    
    -- Query a search API that uses POST for read operations
    
    2
    
    create foreign table openapi.search_results (
    
    3
    
      id text,
    
    4
    
      title text,
    
    5
    
      score real,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
    server my_api_server
    
    9
    
    options (
    
    10
    
      endpoint '/search',
    
    11
    
      method 'POST',
    
    12
    
      request_body '{"query": "postgresql", "limit": 25}'
    
    13
    
    );
    
    14
    
    15
    
    select id, title, score from openapi.search_results;
[/code]

### Custom Headers#
[code] 
    1
    
    create server custom_api
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:openapi-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    8
    
        base_url 'https://openapi.example.com',
    
    9
    
        api_key 'your-key',
    
    10
    
        user_agent 'MyApp/1.0',
    
    11
    
        accept 'application/json',
    
    12
    
        headers '{"X-Request-ID": "postgres-fdw", "X-Feature-Flag": "beta"}'
    
    13
    
      );
[/code]

### API Key Location#

By default, the API key is sent as a header. Use `api_key_location` to send it as a query parameter or cookie instead:
[code] 
    1
    
    create server query_auth_api
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:openapi-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    8
    
        base_url 'https://api.example.com',
    
    9
    
        api_key 'sk-your-api-key',
    
    10
    
        api_key_location 'query'  -- sends as ?api_key=sk-... (uses api_key_header as param name)
    
    11
    
      );
[/code]

### Per-request credentials (session variables)#

A server's credential is normally fixed when the server is created. To vary it per request (for example, per-user OAuth tokens in a multi-tenant app) set `auth_token_setting` to the name of a Postgres session variable, then resolve that variable per query with a `SECURITY DEFINER` function:
[code] 
    1
    
    create server per_user_api
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_openapi_fdw_v0.2.0/openapi_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:openapi-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum 'f0d4d6e50f7c519a66363bd8bdbe1ea8086ca810ca14b43fb0ed18b64acdf6aa',
    
    8
    
        base_url 'https://api.example.com',
    
    9
    
        auth_token_setting 'app.api_token'  -- read the token from this session variable each request
    
    10
    
      );
    
    11
    
    12
    
    -- Resolve the calling user's token (e.g. from an RLS-protected table keyed to
    
    13
    
    -- auth.uid()) and pin it for the life of the transaction:
    
    14
    
    create function set_api_token() returns void
    
    15
    
      language sql security definer set search_path = '' as $$
    
    16
    
      select set_config('app.api_token',
    
    17
    
        (select access_token from public.user_tokens where user_id = auth.uid()),
    
    18
    
        true);
    
    19
    
    $$;
    
    20
    
    21
    
    select set_api_token();
    
    22
    
    select * from some_foreign_table;
[/code]

On each request the FDW reads `app.api_token` and sends it as `Authorization: Bearer <token>`. If the variable is unset or empty no token is injected, and any static credential on the server still applies. Use `auth_token_prefix` to change the `Bearer` prefix, or set it to an empty string to send the raw token.

### Response Path Extraction#

For APIs that wrap data in a container object:
[code] 
    1
    
    -- API returns: {"data": [...], "meta": {...}}
    
    2
    
    create foreign table openapi.items (
    
    3
    
      id text,
    
    4
    
      name text,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
    server my_api_server
    
    8
    
    options (
    
    9
    
      endpoint '/items',
    
    10
    
      response_path '/data'
    
    11
    
    );
[/code]

### Combining with Materialized Views#

For frequently accessed data, use materialized views to reduce API calls:
[code] 
    1
    
    create materialized view api_users_cache as
    
    2
    
    select * from openapi.users;
    
    3
    
    4
    
    -- Query the cache
    
    5
    
    select * from api_users_cache;
    
    6
    
    7
    
    -- Refresh when needed
    
    8
    
    refresh materialized view api_users_cache;
[/code]