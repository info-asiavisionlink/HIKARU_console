---
タイトル: Infura
URL: https://supabase.com/docs/guides/database/extensions/wrappers/infura
カテゴリ: database
更新日: 2026-08-02
タグ: ai, database, extensions, infura, wrappers
---

# Infura

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/infura
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** ai, database, extensions, infura, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Infura Wrapper#](#enable-the-infura-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Infura#](#connecting-to-infura)
  - [Supported Networks#](#supported-networks)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Blocks#](#blocks)
  - [Transactions#](#transactions)
  - [Balances#](#balances)
  - [Logs#](#logs)
  - [Chain Info#](#chain-info)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Query latest block#](#query-latest-block)
  - [Query account balance#](#query-account-balance)
  - [Query transaction details#](#query-transaction-details)
  - [Query event logs#](#query-event-logs)
  - [Query chain information#](#query-chain-information)
  - [Query Polygon network#](#query-polygon-network)

## 概要

Searchdocs...

---

[Infura](<https://www.infura.io/>) provides reliable, scalable blockchain infrastructure for Ethereum, Polygon, and other EVM-compatible networks via JSON-RPC APIs.

The Infura Wrapper is a WebAssembly (Wasm) foreign data wrapper which allows you to read blockchain data (blocks, transactions, balances, logs) directly from your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_infura_fdw_v0.1.0/infura_fdw.wasm`| `6cb829b851ea8cbd70cb893958826824388a4d9477305a16f2f489bcd569b35e`| >=0.5.0  
  
## Preparation#

Before you can query Infura, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Infura Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Infura API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Infura API Key>',
    
    4
    
      'infura',
    
    5
    
      'Infura API key for blockchain data access'
    
    6
    
    );
[/code]

### Connecting to Infura#

We need to provide Postgres with the credentials to access Infura and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server infura_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_infura_fdw_v0.1.0/infura_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:infura-fdw',
    
    6
    
        fdw_package_version '0.1.0',
    
    7
    
        fdw_package_checksum '6cb829b851ea8cbd70cb893958826824388a4d9477305a16f2f489bcd569b35e',
    
    8
    
        api_key_id '<key_ID>', -- The Key ID from above.
    
    9
    
        network 'mainnet'  -- optional, defaults to mainnet
    
    10
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Supported Networks#

The `network` option supports the following values:

Network| Value| Chain ID  
---|---|---  
Ethereum Mainnet| `mainnet`| 1  
Ethereum Sepolia| `sepolia`| 11155111  
Polygon PoS| `polygon-mainnet`| 137  
Polygon Amoy| `polygon-amoy`| 80002  
Arbitrum One| `arbitrum-mainnet`| 42161  
Optimism| `optimism-mainnet`| 10  
Base| `base-mainnet`| 8453  
Linea| `linea-mainnet`| 59144  
  
### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists infura;
[/code]

## Options#

The full list of foreign table options are below:

  * `resource` \- Resource type to query, required. One of: `blocks`, `transactions`, `balances`, `logs`, `chain_info`


## Entities#

Below are all the entities supported by this FDW. Each entity maps to a specific JSON-RPC method on the Infura API.

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Infura.

For example, using below SQL can automatically create foreign tables in the `infura` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema infura from server infura_server into infura;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema infura
    
    6
    
       limit to ("eth_blocks", "eth_transactions")
    
    7
    
       from server infura_server into infura;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema infura
    
    11
    
       except ("eth_blocks")
    
    12
    
       from server infura_server into infura;
[/code]

### Blocks#

Query Ethereum block data using `eth_getBlockByNumber`.

Ref: [Infura API docs](<https://docs.infura.io/api/networks/ethereum/json-rpc-methods/eth_getblockbynumber>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
blocks| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table infura.eth_blocks (
    
    2
    
      number numeric,
    
    3
    
      hash text,
    
    4
    
      parent_hash text,
    
    5
    
      timestamp timestamp,
    
    6
    
      miner text,
    
    7
    
      gas_used numeric,
    
    8
    
      gas_limit numeric,
    
    9
    
      transaction_count bigint,
    
    10
    
      base_fee_per_gas numeric,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server infura_server
    
    14
    
      options (
    
    15
    
        resource 'blocks'
    
    16
    
      );
[/code]

#### Query Pushdown#

  * `number` \- Filter by block number. For example, `WHERE number = 19000000`.


### Transactions#

Query transaction data using `eth_getTransactionByHash`.

Ref: [Infura API docs](<https://docs.infura.io/api/networks/ethereum/json-rpc-methods/eth_gettransactionbyhash>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
transactions| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table infura.eth_transactions (
    
    2
    
      hash text,
    
    3
    
      block_number numeric,
    
    4
    
      block_hash text,
    
    5
    
      from_address text,
    
    6
    
      to_address text,
    
    7
    
      value numeric,
    
    8
    
      gas numeric,
    
    9
    
      gas_price numeric,
    
    10
    
      nonce numeric,
    
    11
    
      input text,
    
    12
    
      transaction_index numeric,
    
    13
    
      attrs jsonb
    
    14
    
    )
    
    15
    
      server infura_server
    
    16
    
      options (
    
    17
    
        resource 'transactions'
    
    18
    
      );
[/code]

#### Query Pushdown#

  * `hash` \- **Required**. Filter by transaction hash: `WHERE hash = '0x...'`


Transaction queries require a `hash` filter in the WHERE clause.

### Balances#

Query account balances using `eth_getBalance`.

Ref: [Infura API docs](<https://docs.infura.io/api/networks/ethereum/json-rpc-methods/eth_getbalance>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
balances| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table infura.eth_balances (
    
    2
    
      address text,
    
    3
    
      balance text,
    
    4
    
      block text
    
    5
    
    )
    
    6
    
      server infura_server
    
    7
    
      options (
    
    8
    
        resource 'balances'
    
    9
    
      );
[/code]

#### Query Pushdown#

  * `address` \- **Required**. Filter by account address: `WHERE address = '0x...'`
  * `block` \- Optional block number (defaults to `latest`)


Balance queries require an `address` filter in the WHERE clause. The balance is returned in ETH (1 ETH = 10^18 Wei).

### Logs#

Query event logs using `eth_getLogs`.

Ref: [Infura API docs](<https://docs.infura.io/api/networks/ethereum/json-rpc-methods/eth_getlogs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
logs| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table infura.eth_logs (
    
    2
    
      address text,
    
    3
    
      block_number numeric,
    
    4
    
      block_hash text,
    
    5
    
      transaction_hash text,
    
    6
    
      transaction_index numeric,
    
    7
    
      log_index numeric,
    
    8
    
      data text,
    
    9
    
      topics jsonb,
    
    10
    
      removed boolean,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server infura_server
    
    14
    
      options (
    
    15
    
        resource 'logs'
    
    16
    
      );
[/code]

#### Query Pushdown#

  * `address` \- Filter by contract address
  * `block_hash` \- Filter by block hash


### Chain Info#

Query chain metadata using `eth_chainId`, `eth_blockNumber`, and `eth_gasPrice`.

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
chain_info| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table infura.eth_chain_info (
    
    2
    
      network text,
    
    3
    
      chain_id numeric,
    
    4
    
      block_number numeric,
    
    5
    
      gas_price numeric
    
    6
    
    )
    
    7
    
      server infura_server
    
    8
    
      options (
    
    9
    
        resource 'chain_info'
    
    10
    
      );
[/code]

## Supported Data Types#

Postgres Data Type| Blockchain Data Type  
---|---  
numeric| Hex uint64 (parsed)  
text| Hex uint256 (parsed)  
text| Hex address/hash  
bigint| Integer  
boolean| Boolean  
timestamp| Unix timestamp  
jsonb| JSON object  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * **Read-only** : Blockchain data is immutable. This FDW only supports SELECT operations.
  * **Rate limiting** : Infura API has rate limits. Consider using materialized views for frequently accessed data.
  * **Large numeric values** : Ethereum values (like Wei balances) can be extremely large. Use `text` type for these columns.
  * **Block range limits** : For `eth_getLogs`, Infura may limit the block range you can query at once.


## Examples#

Below are some examples on how to use Infura foreign tables.

### Query latest block#
[code] 
    1
    
    create foreign table infura.eth_blocks (
    
    2
    
      number numeric,
    
    3
    
      hash text,
    
    4
    
      parent_hash text,
    
    5
    
      timestamp timestamp,
    
    6
    
      miner text,
    
    7
    
      gas_used numeric,
    
    8
    
      gas_limit numeric,
    
    9
    
      transaction_count bigint,
    
    10
    
      base_fee_per_gas numeric,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server infura_server
    
    14
    
      options (
    
    15
    
        resource 'blocks'
    
    16
    
      );
    
    17
    
    18
    
    -- Query the latest block
    
    19
    
    select * from infura.eth_blocks;
    
    20
    
    21
    
    -- Query a specific block
    
    22
    
    select * from infura.eth_blocks where number = 19000000;
[/code]

### Query account balance#
[code] 
    1
    
    create foreign table infura.eth_balances (
    
    2
    
      address text,
    
    3
    
      balance text,
    
    4
    
      block text
    
    5
    
    )
    
    6
    
      server infura_server
    
    7
    
      options (
    
    8
    
        resource 'balances'
    
    9
    
      );
    
    10
    
    11
    
    -- Query Vitalik's wallet balance (in ETH)
    
    12
    
    select
    
    13
    
      address,
    
    14
    
      balance as balance_eth
    
    15
    
    from infura.eth_balances
    
    16
    
    where address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
[/code]

### Query transaction details#
[code] 
    1
    
    create foreign table infura.eth_transactions (
    
    2
    
      hash text,
    
    3
    
      block_number numeric,
    
    4
    
      block_hash text,
    
    5
    
      from_address text,
    
    6
    
      to_address text,
    
    7
    
      value numeric,
    
    8
    
      gas numeric,
    
    9
    
      gas_price numeric,
    
    10
    
      nonce numeric,
    
    11
    
      input text,
    
    12
    
      transaction_index numeric,
    
    13
    
      attrs jsonb
    
    14
    
    )
    
    15
    
      server infura_server
    
    16
    
      options (
    
    17
    
        resource 'transactions'
    
    18
    
      );
    
    19
    
    20
    
    -- Query a specific transaction
    
    21
    
    select
    
    22
    
      from_address,
    
    23
    
      to_address,
    
    24
    
      value / 1e18 as value_eth
    
    25
    
    from infura.eth_transactions
    
    26
    
    where hash = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060';
[/code]

### Query event logs#
[code] 
    1
    
    create foreign table infura.eth_logs (
    
    2
    
      address text,
    
    3
    
      block_number numeric,
    
    4
    
      block_hash text,
    
    5
    
      transaction_hash text,
    
    6
    
      transaction_index numeric,
    
    7
    
      log_index numeric,
    
    8
    
      data text,
    
    9
    
      topics jsonb,
    
    10
    
      removed boolean,
    
    11
    
      attrs jsonb
    
    12
    
    )
    
    13
    
      server infura_server
    
    14
    
      options (
    
    15
    
        resource 'logs'
    
    16
    
      );
    
    17
    
    18
    
    -- Query logs from a specific contract
    
    19
    
    select * from infura.eth_logs
    
    20
    
    where address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
[/code]

### Query chain information#
[code] 
    1
    
    create foreign table infura.eth_chain_info (
    
    2
    
      network text,
    
    3
    
      chain_id numeric,
    
    4
    
      block_number numeric,
    
    5
    
      gas_price numeric
    
    6
    
    )
    
    7
    
      server infura_server
    
    8
    
      options (
    
    9
    
        resource 'chain_info'
    
    10
    
      );
    
    11
    
    12
    
    -- Get current chain status
    
    13
    
    select
    
    14
    
      network,
    
    15
    
      chain_id,
    
    16
    
      block_number,
    
    17
    
      gas_price / 1e9 as gas_price_gwei
    
    18
    
    from infura.eth_chain_info;
[/code]

### Query Polygon network#
[code] 
    1
    
    -- Create a separate server for Polygon
    
    2
    
    create server polygon_server
    
    3
    
      foreign data wrapper wasm_wrapper
    
    4
    
      options (
    
    5
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_infura_fdw_v0.1.0/infura_fdw.wasm',
    
    6
    
        fdw_package_name 'supabase:infura-fdw',
    
    7
    
        fdw_package_version '0.1.0',
    
    8
    
        fdw_package_checksum '6cb829b851ea8cbd70cb893958826824388a4d9477305a16f2f489bcd569b35e',
    
    9
    
        api_key '<your-infura-api-key>',
    
    10
    
        network 'polygon-mainnet'
    
    11
    
      );
    
    12
    
    13
    
    create foreign table infura.polygon_blocks (
    
    14
    
      number numeric,
    
    15
    
      hash text,
    
    16
    
      parent_hash text,
    
    17
    
      timestamp timestamp,
    
    18
    
      miner text,
    
    19
    
      gas_used numeric,
    
    20
    
      gas_limit numeric,
    
    21
    
      transaction_count bigint,
    
    22
    
      base_fee_per_gas numeric,
    
    23
    
      attrs jsonb
    
    24
    
    )
    
    25
    
      server polygon_server
    
    26
    
      options (
    
    27
    
        resource 'blocks'
    
    28
    
      );
    
    29
    
    30
    
    select * from infura.polygon_blocks;
[/code]