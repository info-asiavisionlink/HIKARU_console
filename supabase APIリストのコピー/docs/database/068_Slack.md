---
タイトル: Slack
URL: https://supabase.com/docs/guides/database/extensions/wrappers/slack
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, slack, wrappers
---

# Slack

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/slack
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, slack, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Slack Wrapper#](#enable-the-slack-wrapper)
  - [Create a Slack API Token#](#create-a-slack-api-token)
  - [Store credentials (optional)#](#store-credentials-optional)
  - [Connecting to Slack#](#connecting-to-slack)
  - [Create a schema#](#create-a-schema)
- [Entities#](#entities)
  - [Messages#](#messages)
  - [Channels#](#channels)
  - [Users#](#users)
  - [User Groups#](#user-groups)
  - [User Group Members#](#user-group-members)
  - [Files#](#files)
  - [Team Info#](#team-info)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Required Slack API Scopes#](#required-slack-api-scopes)
  - [Adding Scopes to an Existing App#](#adding-scopes-to-an-existing-app)
- [Limitations#](#limitations)
- [Troubleshooting#](#troubleshooting)
  - [Error: "Slack API error: missing_scope"#](#error-slack-api-error-missingscope)
  - [Error: "channel_id is required for querying messages"#](#error-channelid-is-required-for-querying-messages)
  - [Error: "Rate limit exceeded"#](#error-rate-limit-exceeded)

## 概要

Searchdocs...

---

[Slack](<https://slack.com/>) is a messaging app for business that connects people to the information they need. By bringing people together to work as one unified team, Slack transforms the way organizations communicate.

The Slack Wrapper is a WebAssembly (Wasm) foreign data wrapper which allows you to query Slack workspaces, channels, messages, and users directly from your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_slack_fdw_v0.2.0/slack_fdw.wasm`| `bfb0d22ffea2092c049773302c049162a2a57ddc265da59a83116bf29ed40c3a`| >=0.5.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_slack_fdw_v0.1.0/slack_fdw.wasm`| `5b022b441c0007e31d792ecb1341bfffed1c29cb865eb0c7969989dff0e8fdc3`| >=0.4.0  
0.0.6| `https://github.com/supabase/wrappers/releases/download/wasm_slack_fdw_v0.0.6/slack_fdw.wasm`| `349cb556f87a0233e25eb608a77e840531bc87f1acf9916856268bdcdd9973e2`| >=0.4.0  
  
## Preparation#

Before you can query Slack, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Slack Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

### Create a Slack API Token#

  1. Visit the [Slack API Apps page](<https://api.slack.com/apps>)
  2. Click "Create New App" and select "From scratch"
  3. Name your app and select the workspace to install it
  4. Navigate to "OAuth & Permissions" in the sidebar
  5. Under "Scopes", add the following Bot Token Scopes:
     * `channels:history` \- Read messages in public channels
     * `channels:read` \- View basic channel information
     * `users:read` \- View users in workspace
     * `users:read.email` \- View email addresses
     * `files:read` \- View files shared in channels
     * `reactions:read` \- View emoji reactions
     * `team:read` \- View information about the workspace
     * `usergroups:read` \- View user groups and their members
  6. Install the app to your workspace
  7. Copy the "Bot User OAuth Token" that starts with `xoxb-`


### Store credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Slack API token in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'xoxb-your-slack-token' -- Slack Bot User OAuth Token
    
    4
    
      'slack',
    
    5
    
      'Slack API token for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Slack#

We need to provide Postgres with the credentials to access Slack and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server slack_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_name 'supabase:slack-fdw',
    
    5
    
        fdw_package_url '{See: "Available Versions"}',
    
    6
    
        fdw_package_checksum '{See: "Available Versions"}',
    
    7
    
        fdw_package_version '{See: "Available Versions"}', -- eg: 0.1.0
    
    8
    
        api_token_id '<key_ID>', -- The Key ID from Vault
    
    9
    
        workspace 'your-workspace' -- Optional workspace name
    
    10
    
      );
[/code]

The full list of server options are below:

  * `fdw_package_*`: required. Specify the Wasm package metadata. You can get the available package version list from above.
  * `api_token` | `api_token_id`
    * `api_token`:Slack Bot User OAuth Token, required if not using Vault.
    * `api_token_id`: Vault secret key ID storing the Slack token, required if using Vault.
  * `workspace` \- Slack workspace name, optional.


### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists slack;
[/code]

## Entities#

The Slack Wrapper supports data reads from the Slack API.

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Slack.

For example, using below SQL can automatically create foreign tables in the `slack` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema slack from server slack_server into slack;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema slack
    
    6
    
       limit to ("messages", "channels")
    
    7
    
       from server slack_server into slack;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema slack
    
    11
    
       except ("messages")
    
    12
    
       from server slack_server into slack;
[/code]

### Messages#

This represents messages from channels, DMs, and group messages.

Ref: [Slack conversations.history API](<https://api.slack.com/methods/conversations.history>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
messages| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.messages (
    
    2
    
      ts text,
    
    3
    
      user_id text,
    
    4
    
      channel_id text,
    
    5
    
      text text,
    
    6
    
      thread_ts text,
    
    7
    
      reply_count integer
    
    8
    
    )
    
    9
    
      server slack_server
    
    10
    
      options (
    
    11
    
        resource 'messages'
    
    12
    
      );
[/code]

#### Notes#

  * The `ts` field is the message timestamp ID and is used as the primary key
  * Supports query pushdown for channel filtering
  * Requires the `channels:history` scope


### Channels#

This represents all channels in the workspace.

Ref: [Slack conversations.list API](<https://api.slack.com/methods/conversations.list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
channels| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.channels (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      is_private boolean,
    
    5
    
      created timestamp,
    
    6
    
      creator text
    
    7
    
    )
    
    8
    
    server slack_server
    
    9
    
    options (
    
    10
    
      resource 'channels'
    
    11
    
    );
[/code]

#### Notes#

  * The `id` field is the channel ID and is used as the primary key
  * Requires the `channels:read` scope


### Users#

This represents all users in the workspace.

Ref: [Slack users.list API](<https://api.slack.com/methods/users.list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
users| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.users (
    
    2
    
      -- Basic information
    
    3
    
      id text,
    
    4
    
      name text,
    
    5
    
      
    
    6
    
      -- Name and profile fields
    
    7
    
      real_name text,
    
    8
    
      display_name text,
    
    9
    
      display_name_normalized text,
    
    10
    
      real_name_normalized text,
    
    11
    
      
    
    12
    
      -- Contact information
    
    13
    
      email text,
    
    14
    
      phone text,
    
    15
    
      skype text,
    
    16
    
      
    
    17
    
      -- Role information
    
    18
    
      is_admin boolean,
    
    19
    
      is_owner boolean,
    
    20
    
      is_primary_owner boolean,
    
    21
    
      is_bot boolean,
    
    22
    
      is_app_user boolean,
    
    23
    
      is_restricted boolean,
    
    24
    
      is_ultra_restricted boolean,
    
    25
    
      deleted boolean,
    
    26
    
      
    
    27
    
      -- Status information
    
    28
    
      status_text text,
    
    29
    
      status_emoji text,
    
    30
    
      status_expiration bigint,
    
    31
    
      title text,
    
    32
    
      
    
    33
    
      -- Team information
    
    34
    
      team_id text,
    
    35
    
      team text,
    
    36
    
      
    
    37
    
      -- Time zone information
    
    38
    
      tz text,
    
    39
    
      tz_label text,
    
    40
    
      tz_offset integer,
    
    41
    
      locale text,
    
    42
    
      
    
    43
    
      -- Avatar/image URLs
    
    44
    
      image_24 text,
    
    45
    
      image_48 text,
    
    46
    
      image_72 text,
    
    47
    
      image_192 text,
    
    48
    
      image_512 text,
    
    49
    
      
    
    50
    
      -- Miscellaneous
    
    51
    
      color text,
    
    52
    
      updated bigint
    
    53
    
    )
    
    54
    
    server slack_server
    
    55
    
    options (
    
    56
    
      resource 'users'
    
    57
    
    );
[/code]

#### Notes#

  * The `id` field is the user ID and is used as the primary key
  * Requires the `users:read` scope
  * Email field requires the `users:read.email` scope
  * Supports query pushdown for filtering by `name`, `email`, and `team_id` directly via the Slack API
  * Supports sorting by `name`, `real_name`, and `email`
  * Supports LIMIT and OFFSET clauses for pagination


### User Groups#

This represents user groups (a.k.a. user groups) in the workspace.

Ref: [Slack usergroups.list API](<https://api.slack.com/methods/usergroups.list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
usergroups| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.usergroups (
    
    2
    
      id text,
    
    3
    
      team_id text,
    
    4
    
      name text,
    
    5
    
      handle text,
    
    6
    
      description text,
    
    7
    
      is_external boolean,
    
    8
    
      date_create bigint,
    
    9
    
      date_update bigint,
    
    10
    
      date_delete bigint,
    
    11
    
      auto_type text,
    
    12
    
      created_by text,
    
    13
    
      updated_by text,
    
    14
    
      deleted_by text,
    
    15
    
      user_count integer,
    
    16
    
      channel_count integer
    
    17
    
    )
    
    18
    
    server slack_server
    
    19
    
    options (
    
    20
    
      resource 'usergroups'
    
    21
    
    );
    
    22
    
    23
    
    -- Get all user groups
    
    24
    
    select * from slack.usergroups;
    
    25
    
    26
    
    -- Get user groups sorted by name
    
    27
    
    select * from slack.usergroups order by name;
[/code]

#### Notes#

  * The `id` field is the user group ID and is used as the primary key
  * Requires the `usergroups:read` scope
  * Supports query pushdown for filtering by `team_id` and `include_disabled`
  * Supports sorting by `name`, `handle`, `date_create`, and `date_update`
  * Supports LIMIT and OFFSET clauses for pagination


### User Group Members#

This represents the membership relationship between users and user groups.

Ref: [Slack usergroups.users.list API](<https://api.slack.com/methods/usergroups.users.list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
usergroup_members| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.usergroup_members (
    
    2
    
      usergroup_id text,
    
    3
    
      usergroup_name text,
    
    4
    
      usergroup_handle text,
    
    5
    
      user_id text
    
    6
    
    )
    
    7
    
    server slack_server
    
    8
    
    options (
    
    9
    
      resource 'usergroup_members'
    
    10
    
    );
    
    11
    
    12
    
    -- Get all user group memberships
    
    13
    
    select * from slack.usergroup_members;
[/code]

#### Notes#

  * The `usergroup_id` and `user_id` fields form a composite primary key
  * Requires the `usergroups:read` scope
  * Supports LIMIT and OFFSET clauses for pagination
  * To avoid excessive API calls and potential rate limiting, consider using materialized views instead of direct joins


### Files#

This represents files shared in the workspace.

Ref: [Slack files.list API](<https://api.slack.com/methods/files.list>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
files| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.files (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      title text,
    
    5
    
      mimetype text,
    
    6
    
      size bigint,
    
    7
    
      url_private text,
    
    8
    
      user_id text,
    
    9
    
      created timestamp
    
    10
    
    )
    
    11
    
    server slack_server
    
    12
    
    options (
    
    13
    
      resource 'files'
    
    14
    
    );
[/code]

#### Notes#

  * The `id` field is the file ID and is used as the primary key
  * Requires the `files:read` scope
  * Supports query pushdown for filtering by channel or user


### Team Info#

This represents information about the team/workspace.

Ref: [Slack team.info API](<https://api.slack.com/methods/team.info>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
team-info| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table slack.team_info (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      domain text,
    
    5
    
      email_domain text
    
    6
    
    )
    
    7
    
    server slack_server
    
    8
    
    options (
    
    9
    
      resource 'team-info'
    
    10
    
    );
[/code]

#### Notes#

  * Returns a single row with team information
  * No special scopes required beyond authentication


## Query Pushdown Support#

This FDW supports the following condition pushdowns:

Resource| Supported Filters| Sorting| Limit/Offset  
---|---|---|---  
messages| channel_id, oldest, latest| No| Yes*  
users| name, email, team_id| name, real_name, email| Yes  
usergroups| team_id, include_disabled| name, handle, date_create, date_update| Yes  
usergroup_members|  _(no filter support)_|  No| Yes  
channels| types (public/private)| No| Yes*  
files| channel_id, user_id, ts_from, ts_to| No| No  
team-info|  _(no filter support)_|  No| No  
  
* Pagination is supported through cursor-based pagination from the Slack API

## Supported Data Types#

Postgres Data Type| Slack JSON Type  
---|---  
text| string  
boolean| boolean  
integer| number  
bigint| number  
timestamp| string (Unix timestamp)  
  
## Required Slack API Scopes#

Each entity type in the Slack FDW requires specific API scopes. If you get a `missing_scope` error, you may need to add additional scopes and reinstall your app to the workspace.

Entity Type| Required Scopes| Error If Missing  
---|---|---  
users| `users:read`| "The token used is not granted the required scopes"  
users (emails)| `users:read.email`| "missing_scope" on email fields  
usergroups| `usergroups:read`| "missing_scope" when querying user groups  
usergroup_members| `usergroups:read`| "missing_scope" when querying user group members  
channels| `channels:read`| "missing_scope" when querying channels  
messages| `channels:history`, `channels:read`| "missing_scope" when querying messages  
files| `files:read`| "missing_scope" when querying files  
team-info| `team:read`| "missing_scope" when querying team info  
  
### Adding Scopes to an Existing App#

If you need to add scopes to an existing Slack app:

  1. Go to [Your Slack Apps](<https://api.slack.com/apps>)
  2. Select your app
  3. Click "OAuth & Permissions" in the sidebar
  4. Under "Bot Token Scopes", click "Add an OAuth Scope"
  5. Add any missing scopes from the table above
  6. Scroll up and click "Reinstall to Workspace"
  7. Approve the new permissions
  8. Copy the new Bot User OAuth Token (it may have changed)
  9. Update your token in your database server configuration


## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to pagination requirements
  * Rate limits are enforced by the Slack API (Tier 2: 20+ requests/minute)
  * Messages older than the workspace retention policy are not accessible
  * Private channels require the `groups:history` and `groups:read` scopes
  * Direct messages require the `im:history` and `im:read` scopes


## Troubleshooting#

### Error: "Slack API error: missing_scope"#

This error occurs when your Slack token doesn't have all the required OAuth scopes for the resource you're trying to access.

**Solution:**

  1. Check the Required Slack API Scopes section above to see which scopes are needed for the entity you're querying
  2. Follow the steps in the "Adding Scopes to an Existing App" section to add the missing scopes
  3. Reinstall your app to the workspace
  4. Update your token in the PostgreSQL server configuration


### Error: "channel_id is required for querying messages"#

When querying the `messages` table, you must include a `WHERE channel_id = 'CXXXXXXXX'` clause.

**Solution:**
[code] 
    1
    
    -- Incorrect (will error):
    
    2
    
    SELECT * FROM slack.messages LIMIT 10;
    
    3
    
    4
    
    -- Correct:
    
    5
    
    SELECT * FROM slack.messages WHERE channel_id = 'C01234ABCDE' LIMIT 10;
[/code]

### Error: "Rate limit exceeded"#

Slack's API enforces rate limits (Tier 2: ~20 requests/minute).

**Solution:**

  * Add more specific WHERE clauses to reduce the number of API calls
  * Use smaller LIMIT values
  * Consider materialized views for frequent queries:


[code] 
    1
    
    CREATE MATERIALIZED VIEW slack_users AS 
    
    2
    
    SELECT * FROM slack.users;
    
    3
    
    4
    
    -- Query the materialized view instead
    
    5
    
    SELECT * FROM slack_users;
    
    6
    
    7
    
    -- Refresh when needed (less frequently)
    
    8
    
    REFRESH MATERIALIZED VIEW slack_users;
[/code]

## Examples#

Below are some examples on how to use Slack foreign tables.

### Basic Example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table slack.channels (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      is_private boolean,
    
    5
    
      created timestamp,
    
    6
    
      creator text
    
    7
    
    )
    
    8
    
    server slack_server
    
    9
    
    options (
    
    10
    
      resource 'channels'
    
    11
    
    );
    
    12
    
    13
    
    -- Query all channels
    
    14
    
    select * from slack.channels;
[/code]

### User Information#
[code] 
    1
    
    create foreign table slack.users (
    
    2
    
      -- Basic subset of fields
    
    3
    
      id text,
    
    4
    
      name text,
    
    5
    
      real_name text,
    
    6
    
      email text,
    
    7
    
      is_admin boolean,
    
    8
    
      is_bot boolean,
    
    9
    
      
    
    10
    
      -- Additional useful fields
    
    11
    
      display_name text,
    
    12
    
      phone text,
    
    13
    
      title text,
    
    14
    
      status_text text,
    
    15
    
      status_emoji text,
    
    16
    
      team_id text,
    
    17
    
      image_192 text
    
    18
    
    )
    
    19
    
    server slack_server
    
    20
    
    options (
    
    21
    
      resource 'users'
    
    22
    
    );
    
    23
    
    24
    
    -- List all admin users
    
    25
    
    select * from slack.users where is_admin = true;
    
    26
    
    27
    
    -- Get users ordered by name
    
    28
    
    select * from slack.users order by name;
    
    29
    
    30
    
    -- Get top 5 non-bot users ordered by real_name 
    
    31
    
    select * from slack.users where is_bot = false order by real_name limit 5;
    
    32
    
    33
    
    -- Filter users by email domain
    
    34
    
    select * from slack.users where email like '%@example.com' order by name;
    
    35
    
    36
    
    -- Find user by name (pushes filter down to API)
    
    37
    
    select * from slack.users where name = 'johndoe';
    
    38
    
    39
    
    -- Show user with their profile picture
    
    40
    
    select id, name, real_name, image_192 as profile_picture from slack.users 
    
    41
    
    where name = 'johndoe';
[/code]

### User Groups Example#
[code] 
    1
    
    -- Create tables
    
    2
    
    create foreign table slack.usergroups (
    
    3
    
      id text,
    
    4
    
      name text,
    
    5
    
      handle text,
    
    6
    
      description text,
    
    7
    
      user_count integer
    
    8
    
    )
    
    9
    
    server slack_server
    
    10
    
    options (
    
    11
    
      resource 'usergroups'
    
    12
    
    );
    
    13
    
    14
    
    create foreign table slack.usergroup_members (
    
    15
    
      usergroup_id text,
    
    16
    
      usergroup_name text,
    
    17
    
      usergroup_handle text,
    
    18
    
      user_id text
    
    19
    
    )
    
    20
    
    server slack_server
    
    21
    
    options (
    
    22
    
      resource 'usergroup_members'
    
    23
    
    );
    
    24
    
    25
    
    -- Get all user groups
    
    26
    
    select name, handle, description, user_count 
    
    27
    
    from slack.usergroups 
    
    28
    
    order by name;
    
    29
    
    30
    
    -- Get all members of a user group (just IDs)
    
    31
    
    select * from slack.usergroup_members 
    
    32
    
    where usergroup_id = 'S01234ABCDE';
[/code]

### Messages from a Specific Channel#
[code] 
    1
    
    create foreign table slack.messages (
    
    2
    
      ts text,
    
    3
    
      user_id text,
    
    4
    
      channel_id text,
    
    5
    
      text text,
    
    6
    
      thread_ts text,
    
    7
    
      reply_count integer
    
    8
    
    )
    
    9
    
    server slack_server
    
    10
    
    options (
    
    11
    
      resource 'messages'
    
    12
    
    );
    
    13
    
    14
    
    -- Get messages from a specific channel
    
    15
    
    select * from slack.messages 
    
    16
    
    where channel_id = 'C01234ABCDE'
    
    17
    
    limit 100;
[/code]