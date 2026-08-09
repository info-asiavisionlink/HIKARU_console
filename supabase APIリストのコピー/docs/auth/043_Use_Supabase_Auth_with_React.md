---
タイトル: Use Supabase Auth with React
URL: https://supabase.com/docs/guides/auth/quickstarts/react
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, quickstarts, react, supabase, with
---

# Use Supabase Auth with React

**URL:** https://supabase.com/docs/guides/auth/quickstarts/react
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, quickstarts, react, supabase, with

## 目次

  - [Get API details#](#get-api-details)

## 概要

Learn how to use Supabase Auth with React.js.

---

1

Create a new Supabase project

[Launch a new project](</dashboard>) in the Supabase Dashboard.

Your new database has a table for storing your users. You can see that this table is currently empty by running some SQL in the [SQL Editor](</dashboard/project/_/sql>).

SQL_EDITOR
[code]
    1
    
    select * from auth.users;
[/code]

2

Create a React app

Create a React app using a [Vite](<https://vitejs.dev/guide/>) template.

Terminal
[code]
    1
    
    npm create vite@latest my-app -- --template react
[/code]

3

Install the Supabase client library

Navigate to the React app and install the Supabase libraries.

Terminal
[code]
    1
    
    cd my-app && npm install @supabase/supabase-js
[/code]

4

Declare Supabase Environment Variables

Rename `.env.example` to `.env.local` and populate with your Supabase connection variables:

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=react>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

.env.local
[code]
    1
    
    VITE_SUPABASE_URL=your-project-url
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-or-anon-key
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/quickstarts/react/.env.example>)

5

Set up your login component

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)

In `App.jsx`, create a Supabase client using your Project URL and key.

The code uses the [`getClaims`](</docs/reference/javascript/auth-getclaims>) method in `App.jsx` to validate the local JWT before showing the signed-in user.

src/App.jsx
[code]
    1
    
    import './index.css'
    
    2
    
    import { useState, useEffect } from 'react'
    
    3
    
    import { createClient } from '@supabase/supabase-js'
    
    4
    
    5
    
    const supabase = createClient(
    
    6
    
      import.meta.env.VITE_SUPABASE_URL,
    
    7
    
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    8
    
    )
    
    9
    
    10
    
    export default function App() {
    
    11
    
      const [loading, setLoading] = useState(false)
    
    12
    
      const [email, setEmail] = useState('')
    
    13
    
      const [claims, setClaims] = useState(null)
    
    14
    
    15
    
      // Check URL params on initial render
    
    16
    
      const params = new URLSearchParams(window.location.search)
    
    17
    
      const hasTokenHash = params.get('token_hash')
    
    18
    
    19
    
      const [verifying, setVerifying] = useState(!!hasTokenHash)
    
    20
    
      const [authError, setAuthError] = useState(null)
    
    21
    
      const [authSuccess, setAuthSuccess] = useState(false)
    
    22
    
    23
    
      useEffect(() => {
    
    24
    
        // Check if we have token_hash in URL (magic link callback)
    
    25
    
        const params = new URLSearchParams(window.location.search)
    
    26
    
        const token_hash = params.get('token_hash')
    
    27
    
        const type = params.get('type')
    
    28
    
    29
    
        if (token_hash) {
    
    30
    
          // Verify the OTP token
    
    31
    
          supabase.auth
    
    32
    
            .verifyOtp({
    
    33
    
              token_hash,
    
    34
    
              type: type || 'email',
    
    35
    
            })
    
    36
    
            .then(({ error }) => {
    
    37
    
              if (error) {
    
    38
    
                setAuthError(error.message)
    
    39
    
              } else {
    
    40
    
                setAuthSuccess(true)
    
    41
    
                // Clear URL params
    
    42
    
                window.history.replaceState({}, document.title, '/')
    
    43
    
              }
    
    44
    
              setVerifying(false)
    
    45
    
            })
    
    46
    
        }
    
    47
    
    48
    
        // Check for existing session using getClaims
    
    49
    
        supabase.auth.getClaims().then(({ data: { claims } }) => {
    
    50
    
          setClaims(claims)
    
    51
    
        })
    
    52
    
    53
    
        // Listen for auth changes
    
    54
    
        const {
    
    55
    
          data: { subscription },
    
    56
    
        } = supabase.auth.onAuthStateChange(() => {
    
    57
    
          supabase.auth.getClaims().then(({ data: { claims } }) => {
    
    58
    
            setClaims(claims)
    
    59
    
          })
    
    60
    
        })
    
    61
    
    62
    
        return () => subscription.unsubscribe()
    
    63
    
      }, [])
    
    64
    
    65
    
      const handleLogin = async (event) => {
    
    66
    
        event.preventDefault()
    
    67
    
        setLoading(true)
    
    68
    
        const { error } = await supabase.auth.signInWithOtp({
    
    69
    
          email,
    
    70
    
          options: {
    
    71
    
            emailRedirectTo: window.location.origin,
    
    72
    
          },
    
    73
    
        })
    
    74
    
        if (error) {
    
    75
    
          alert(error.error_description || error.message)
    
    76
    
        } else {
    
    77
    
          alert('Check your email for the login link!')
    
    78
    
        }
    
    79
    
        setLoading(false)
    
    80
    
      }
    
    81
    
    82
    
      const handleLogout = async () => {
    
    83
    
        await supabase.auth.signOut()
    
    84
    
        setClaims(null)
    
    85
    
      }
    
    86
    
    87
    
      // Show verification state
    
    88
    
      if (verifying) {
    
    89
    
        return (
    
    90
    
          <div>
    
    91
    
            <h1>Authentication</h1>
    
    92
    
            <p>Confirming your magic link...</p>
    
    93
    
            <p>Loading...</p>
    
    94
    
          </div>
    
    95
    
        )
    
    96
    
      }
    
    97
    
    98
    
      // Show auth error
    
    99
    
      if (authError) {
    
    100
    
        return (
    
    101
    
          <div>
    
    102
    
            <h1>Authentication</h1>
    
    103
    
            <p>✗ Authentication failed</p>
    
    104
    
            <p>{authError}</p>
    
    105
    
            <button
    
    106
    
              onClick={() => {
    
    107
    
                setAuthError(null)
    
    108
    
                window.history.replaceState({}, document.title, '/')
    
    109
    
              }}
    
    110
    
            >
    
    111
    
              Return to login
    
    112
    
            </button>
    
    113
    
          </div>
    
    114
    
        )
    
    115
    
      }
    
    116
    
    117
    
      // Show auth success (briefly before claims load)
    
    118
    
      if (authSuccess && !claims) {
    
    119
    
        return (
    
    120
    
          <div>
    
    121
    
            <h1>Authentication</h1>
    
    122
    
            <p>✓ Authentication successful!</p>
    
    123
    
            <p>Loading your account...</p>
    
    124
    
          </div>
    
    125
    
        )
    
    126
    
      }
    
    127
    
    128
    
      // If user is logged in, show welcome screen
    
    129
    
      if (claims) {
    
    130
    
        return (
    
    131
    
          <div>
    
    132
    
            <h1>Welcome!</h1>
    
    133
    
            <p>You are logged in as: {claims.email}</p>
    
    134
    
            <button onClick={handleLogout}>Sign Out</button>
    
    135
    
          </div>
    
    136
    
        )
    
    137
    
      }
    
    138
    
    139
    
      // Show login form
    
    140
    
      return (
    
    141
    
        <div>
    
    142
    
          <h1>Supabase + React</h1>
    
    143
    
          <p>Sign in via magic link with your email below</p>
    
    144
    
          <form onSubmit={handleLogin}>
    
    145
    
            <input
    
    146
    
              type="email"
    
    147
    
              placeholder="Your email"
    
    148
    
              value={email}
    
    149
    
              required={true}
    
    150
    
              onChange={(e) => setEmail(e.target.value)}
    
    151
    
            />
    
    152
    
            <button disabled={loading}>
    
    153
    
              {loading ? <span>Loading</span> : <span>Send magic link</span>}
    
    154
    
            </button>
    
    155
    
          </form>
    
    156
    
        </div>
    
    157
    
      )
    
    158
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/quickstarts/react/src/App.jsx>)

6

Customize email template

Before proceeding, change the email template to support a server-side authentication flow that sends a token hash:

  * Go to the [Auth templates](</dashboard/project/_/auth/templates>) page in your dashboard.
  * Select the Confirm sign up template.
  * Change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email`.
  * Change your [Site URL](</dashboard/project/_/auth/url-configuration>) to `https://localhost:5173`


7

Start the app

Start the app, go to <http://localhost:5173>[](<http://localhost:5173>) in a browser, and open the browser console and you should be able to register and log in.

Terminal
[code]
    1
    
    npm run dev
[/code]