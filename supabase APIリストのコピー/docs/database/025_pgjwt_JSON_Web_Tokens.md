---
タイトル: pgjwt: JSON Web Tokens
URL: https://supabase.com/docs/guides/database/extensions/pgjwt
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, json, pgjwt, tokens
---

# pgjwt: JSON Web Tokens

**URL:** https://supabase.com/docs/guides/database/extensions/pgjwt
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, json, pgjwt, tokens

## 目次

- [Enable the extension#](#enable-the-extension)
- [API#](#api)
- [Usage#](#usage)
- [Resources#](#resources)

## 概要

Encode and decode JWTs in Postgres

---

Supabase creates and handles JWT for you. It is built into the platform. **If you use Postgres version 15 or earlier** , you don't need the pgjwt extension, and it is safe to disable. For more information on how Supabase handles JWTs, read the [Supabase and JWTs documentation](</docs/guides/auth/jwts#supabase-and-jwts>)

The `pgjwt` extension is deprecated in projects using Postgres 17. It continues to be supported in projects using Postgres 15, but will need to dropped before those projects are upgraded to Postgres 17. See the [Upgrading to Postgres 17 notes](</docs/guides/platform/upgrading#upgrading-to-postgres-17>) for more information.

The [`pgjwt`](<https://github.com/michelp/pgjwt>) (Postgres JSON Web Token) extension allows you to create and parse [JSON Web Tokens (JWTs)](<https://en.wikipedia.org/wiki/JSON_Web_Token>) within a Postgres database. JWTs are commonly used for authentication and authorization in web applications and services.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `pgjwt` and enable the extension.


## API#

  * [`sign(payload json, secret text, algorithm text default 'HS256')`](<https://github.com/michelp/pgjwt#usage>): Signs a JWT containing _payload_ with _secret_ using _algorithm_.
  * [`verify(token text, secret text, algorithm text default 'HS256')`](<https://github.com/michelp/pgjwt#usage>): Decodes a JWT _token_ that was signed with _secret_ using _algorithm_.


Where:

  * `payload` is an encrypted JWT represented as a string.
  * `secret` is the private/secret passcode which is used to sign the JWT and verify its integrity.
  * `algorithm` is the method used to sign the JWT using the secret.
  * `token` is an encrypted JWT represented as a string.


## Usage#

Once the extension is installed, you can use its functions to create and parse JWTs. Here's an example of how you can use the `sign` function to create a JWT:
[code] 
    1
    
    select
    
    2
    
      extensions.sign(
    
    3
    
        payload   := '{"sub":"1234567890","name":"John Doe","iat":1516239022}',
    
    4
    
        secret    := 'secret',
    
    5
    
        algorithm := 'HS256'
    
    6
    
      );
[/code]

The `pgjwt_encode` function returns a string that represents the JWT, which can then be safely transmitted between parties.
[code] 
    1
    
    sign
    
    2
    
    ---------------------------------
    
    3
    
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX
    
    4
    
     VCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiw
    
    5
    
     ibmFtZSI6IkpvaG4gRG9lIiwiaWF0Ijo
    
    6
    
     xNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y9
    
    7
    
     22BhjWgQzWXcXNrz0ogtVhfEd2o
    
    8
    
    (1 row)
[/code]

To parse a JWT and extract its claims, you can use the `verify` function. Here's an example:
[code] 
    1
    
    select
    
    2
    
      extensions.verify(
    
    3
    
        token := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRm9vIn0.Q8hKjuadCEhnCPuqIj9bfLhTh_9QSxshTRsA5Aq4IuM',
    
    4
    
        secret    := 'secret',
    
    5
    
        algorithm := 'HS256'
    
    6
    
      );
[/code]

Which returns the decoded contents and some associated metadata.
[code] 
    1
    
    header            |    payload     | valid
    
    2
    
    -----------------------------+----------------+-------
    
    3
    
     {"alg":"HS256","typ":"JWT"} | {"name":"Foo"} | t
    
    4
    
    (1 row)
[/code]

## Resources#

  * Official [`pgjwt` documentation](<https://github.com/michelp/pgjwt>)