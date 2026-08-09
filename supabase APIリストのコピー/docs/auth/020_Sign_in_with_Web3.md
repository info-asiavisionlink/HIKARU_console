---
タイトル: Sign in with Web3
URL: https://supabase.com/docs/guides/auth/auth-web3
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-web3, sign, with
---

# Sign in with Web3

**URL:** https://supabase.com/docs/guides/auth/auth-web3
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-web3, sign, with

## 目次

- [How does it work?#](#how-does-it-work)
- [Enable the Web3 provider#](#enable-the-web3-provider)
  - [Potential for abuse#](#potential-for-abuse)
- [Sign in with Ethereum#](#sign-in-with-ethereum)
- [Sign in with Solana#](#sign-in-with-solana)
- [Frequently asked questions#](#frequently-asked-questions)
  - [How to associate an email address, phone number or social login to a user signing in with Web3?#](#how-to-associate-an-email-address-phone-number-or-social-login-to-a-user-signing-in-with-web3)

## 概要

Use your Web3 wallet to authenticate users with Supabase

---

[Enable Sign In with Web3](</dashboard/project/_/auth/providers>) to allow users to sign in to your application using only their Web3 wallet.

Supported Web3 wallets:

  * All Solana wallets
  * All Ethereum wallets


## How does it work?#

Sign in with Web3 uses the [EIP 4361](<https://eips.ethereum.org/EIPS/eip-4361>) standard to authenticate wallet addresses off-chain. This standard is widely supported by the Ethereum and Solana ecosystems, making it the best choice for verifying wallet ownership.

Authentication works by asking the Web3 wallet application to sign a predefined message with the user's wallet. This message is parsed both by the Web3 wallet application and Supabase Auth to verify its validity and purpose, before creating a user account or session.

An example of such a message is:
[code] 
    1
    
    example.com wants you to sign in with your Ethereum account:
    
    2
    
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    
    3
    
    4
    
    I accept the ExampleOrg Terms of Service: https://example.com/tos
    
    5
    
    6
    
    URI: https://example.com/login
    
    7
    
    Version: 1
    
    8
    
    Chain ID: 1
    
    9
    
    Nonce: 32891756
    
    10
    
    Issued At: 2021-09-30T16:25:24Z
    
    11
    
    Resources:
    
    12
    
    - https://example.com/my-web2-claim.json
[/code]

It defines the wallet address, timestamp, browser location where the sign-in occurred and includes a customizable statement (`I accept...`) which you can use to ask consent from the user.

Most Web3 wallets are able to recognize these messages and show a dedicated "Confirm Sign In" dialog validating and presenting the information in the message in a secure and responsible way to the user. Even if the wallet does not directly support these messages, it will use the message signature dialog instead.

Finally the Supabase Auth server validates both the message's contents and signature before issuing a valid [User session](</docs/guides/auth/sessions>) to your application. Validation rules include:

  * Message structure validation
  * Cryptographic signature verification
  * Timestamp validation, ensuring the signature was created within 10 minutes of the sign-in call
  * URI and Domain validation, ensuring these match your server's defined [Redirect URLs](</docs/guides/auth/redirect-urls>)


The wallet address is used as the identity identifier, and in the identity data you can also find the statement and additional metadata.

## Enable the Web3 provider#

In the dashboard navigate to your project's [Authentication Providers](</dashboard/project/_/auth/providers>) section and enable the Web3 Wallet provider.

In the CLI add the following config to your `supabase/config.toml` file:
[code] 
    1
    
    [auth.web3.solana]
    
    2
    
    enabled = true
    
    3
    
    4
    
    [auth.web3.ethereum]
    
    5
    
    enabled = true
[/code]

### Potential for abuse#

User accounts that sign in with their Web3 wallet will not have an email address or phone number associated with them. This can open your project to abuse as creating a Web3 wallet account is free and easy to automate and difficult to correlate with a real person's identity.

Control your project's exposure by configuring in the dashboard:

  * [Rate Limits for Web3](</dashboard/project/_/auth/rate-limits>)
  * [Enable CAPTCHA protection](</docs/guides/auth/auth-captcha>)


Or in the CLI:
[code] 
    1
    
    [auth.rate_limit]
    
    2
    
    # Number of Web3 logins that can be made in a 5 minute interval per IP address.
    
    3
    
    web3 = 30
    
    4
    
    5
    
    [auth.captcha]
    
    6
    
    enabled = true
    
    7
    
    provider = "hcaptcha" # or other supported providers
    
    8
    
    secret = "0x0000000000000000000000000000000000000000"
[/code]

Many wallet applications will warn the user if the message sent for signing is not coming from the page they are currently visiting. To further prevent your Supabase project from receiving signed messages destined for other applications, you must register your application's URL using the [Redirect URL settings](</docs/guides/auth/redirect-urls>).

For example if the user is signing in to the page `https://example.com/sign-in` you should add the following configurations in the Redirect URL settings:

  * `https://example.com/sign-in/` (last slash is important)
  * Alternatively set up a glob pattern such as `https://example.com/**`


## Sign in with Ethereum#

Ethereum defines the [`window.ethereum` global scope object](<https://eips.ethereum.org/EIPS/eip-1193>) that your app uses to interact with Ethereum Wallets. Additionally there is a [wallet discovery mechanism (EIP-6963)](<https://eips.ethereum.org/EIPS/eip-6963>) that your app can use to discover all of the available wallets on the user's browser.

To sign in a user with their Ethereum wallet make sure that the user has installed a wallet application. There are two ways to do this:

  1. Detect the `window.ethereum` global scope object and ensure it's defined. This only works if your user has only one wallet installed on their browser.
  2. Use the wallet discovery mechanism (EIP-6963) to ask the user to choose a wallet before they continue to sign in. Read [the MetaMask guide on the best way to support this](<https://docs.metamask.io/wallet/tutorials/react-dapp-local-state>).


Ethereum Window API (EIP-1193)Ethereum Wallet API (EIP-6963)Ethereum Message and Signature

Use the following code to sign in a user, implicitly relying on the `window.ethereum` global scope wallet API:
[code]
    1
    
    const { data, error } = await supabase.auth.signInWithWeb3({
    
    2
    
      chain: 'ethereum',
    
    3
    
      statement: 'I accept the Terms of Service at https://example.com/tos',
    
    4
    
    })
[/code]

## Sign in with Solana#

Solana Window APISolana Wallet Adapter

Most Solana wallet applications expose their API via the `window.solana` global scope object in your web application.

Supabase's JavaScript Client Library provides built-in support for this API.

To sign in a user make sure that:

  1. The user has installed a wallet application (by checking that the `window.solana` object is defined)
  2. The wallet application is connected to your application by using the [`window.solana.connect()` API](<https://docs.phantom.com/solana/establishing-a-connection>)


Use the following code to authenticate a user:
[code]
    1
    
    const { data, error } = await supabase.auth.signInWithWeb3({
    
    2
    
      chain: 'solana',
    
    3
    
      statement: 'I accept the Terms of Service at https://example.com/tos',
    
    4
    
    })
[/code]

Providing a `statement` is required for most Solana wallets and this message will be shown to the user on the consent dialog. It will also be added to the identity data for your users.

If you are using a non-standard Solana wallet that does not register the `window.solana` object, or your user has multiple Solana wallets attached to the page you can disambiguate by providing the wallet object like so:

  * To use [Brave Wallet with Solana](<https://wallet-docs.brave.com/solana>):
[code] 1
        
        const { data, error } = await supabase.auth.signInWithWeb3({
        
        2
        
          chain: 'solana',
        
        3
        
          statement: 'I accept the Terms of Service at https://example.com/tos',
        
        4
        
          wallet: window.braveSolana,
        
        5
        
        })
[/code]

  * To use [Phantom with Solana](<https://docs.phantom.com/solana/detecting-the-provider>):
[code] 1
        
        const { data, error } = await supabase.auth.signInWithWeb3({
        
        2
        
          chain: 'solana',
        
        3
        
          statement: 'I accept the Terms of Service at https://example.com/tos',
        
        4
        
          wallet: window.phantom,
        
        5
        
        })
[/code]


## Frequently asked questions#

### How to associate an email address, phone number or social login to a user signing in with Web3?#

Web3 wallets don't expose any identifying information about the user other than their wallet address (public key). This is why accounts that were created using Sign in with Web3 don't have any email address or phone number associated.

To associate an email address, phone number or other social login with their account you can use the `supabase.auth.updateUser()` or `supabase.auth.linkIdentity()` APIs.