---
タイトル: Use Supabase Auth with React Native
URL: https://supabase.com/docs/guides/auth/quickstarts/react-native
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, native, quickstarts, react, react-native, supabase, with
---

# Use Supabase Auth with React Native

**URL:** https://supabase.com/docs/guides/auth/quickstarts/react-native
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, native, quickstarts, react, react-native, supabase, with

## 目次

  - [Get API details#](#get-api-details)

## 概要

Learn how to use Supabase Auth with React Native

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

Create a React app using the `create-expo-app` command.

Terminal
[code]
    1
    
    npx create-expo-app -t expo-template-blank-typescript my-app
[/code]

3

Install the Supabase client library

Install `supabase-js` and the required dependencies.

Terminal
[code]
    1
    
    cd my-app && npx expo install @supabase/supabase-js @react-native-async-storage/async-storage @rneui/themed react-native-url-polyfill
[/code]

4

Set up your login component

Create a helper file `lib/supabase.ts` that exports a Supabase client using your Project URL and key.

Rename `.env.example` to `.env` and populate with your Supabase connection variables:

Project URL

No project found

Publishable key

No project found

lib/supabase.ts
[code]
    1
    
    import { AppState, Platform } from 'react-native'
    
    2
    
    import 'react-native-url-polyfill/auto'
    
    3
    
    import AsyncStorage from '@react-native-async-storage/async-storage'
    
    4
    
    import { createClient, processLock } from '@supabase/supabase-js'
    
    5
    
    6
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
    
    7
    
    const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    
    8
    
    9
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    
    10
    
      auth: {
    
    11
    
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    
    12
    
        autoRefreshToken: true,
    
    13
    
        persistSession: true,
    
    14
    
        detectSessionInUrl: false,
    
    15
    
        lock: processLock,
    
    16
    
      },
    
    17
    
    })
    
    18
    
    19
    
    // Tells Supabase Auth to continuously refresh the session automatically
    
    20
    
    // if the app is in the foreground. When this is added, you will continue
    
    21
    
    // to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
    
    22
    
    // `SIGNED_OUT` event if the user's session is terminated. This should
    
    23
    
    // only be registered once.
    
    24
    
    if (Platform.OS !== 'web') {
    
    25
    
      AppState.addEventListener('change', (state) => {
    
    26
    
        if (state === 'active') {
    
    27
    
          supabase.auth.startAutoRefresh()
    
    28
    
        } else {
    
    29
    
          supabase.auth.stopAutoRefresh()
    
    30
    
        }
    
    31
    
      })
    
    32
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/quickstarts/react-native/lib/supabase.ts>)

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=exporeactnative>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

5

Create a login component

Create a React Native component to manage logins and sign ups. The app later uses the [`getClaims`](</docs/reference/javascript/auth-getclaims>) method in `App.tsx` to validate the local JWT before showing the signed-in user.

components/Auth.tsx
[code]
    1
    
    import React, { useState } from 'react'
    
    2
    
    import { Alert, StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native'
    
    3
    
    import { supabase } from '../lib/supabase'
    
    4
    
    5
    
    export default function Auth() {
    
    6
    
      const [email, setEmail] = useState('')
    
    7
    
      const [password, setPassword] = useState('')
    
    8
    
      const [loading, setLoading] = useState(false)
    
    9
    
    10
    
      async function signInWithEmail() {
    
    11
    
        setLoading(true)
    
    12
    
        const { error } = await supabase.auth.signInWithPassword({
    
    13
    
          email: email,
    
    14
    
          password: password,
    
    15
    
        })
    
    16
    
    17
    
        if (error) Alert.alert(error.message)
    
    18
    
        setLoading(false)
    
    19
    
      }
    
    20
    
    21
    
      async function signUpWithEmail() {
    
    22
    
        setLoading(true)
    
    23
    
        const {
    
    24
    
          data: { session },
    
    25
    
          error,
    
    26
    
        } = await supabase.auth.signUp({
    
    27
    
          email: email,
    
    28
    
          password: password,
    
    29
    
        })
    
    30
    
    31
    
        if (error) Alert.alert(error.message)
    
    32
    
        if (!session) Alert.alert('Please check your inbox for email verification!')
    
    33
    
        setLoading(false)
    
    34
    
      }
    
    35
    
    36
    
      return (
    
    37
    
        <View style={styles.container}>
    
    38
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    39
    
            <Text style={styles.label}>Email</Text>
    
    40
    
            <TextInput
    
    41
    
              onChangeText={(text) => setEmail(text)}
    
    42
    
              value={email}
    
    43
    
              placeholder="email@address.com"
    
    44
    
              autoCapitalize="none"
    
    45
    
              style={styles.input}
    
    46
    
            />
    
    47
    
          </View>
    
    48
    
          <View style={styles.verticallySpaced}>
    
    49
    
            <Text style={styles.label}>Password</Text>
    
    50
    
            <TextInput
    
    51
    
              onChangeText={(text) => setPassword(text)}
    
    52
    
              value={password}
    
    53
    
              secureTextEntry={true}
    
    54
    
              placeholder="Password"
    
    55
    
              autoCapitalize="none"
    
    56
    
              style={styles.input}
    
    57
    
            />
    
    58
    
          </View>
    
    59
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    60
    
            <TouchableOpacity
    
    61
    
              style={[styles.button, loading && styles.buttonDisabled]}
    
    62
    
              onPress={() => signInWithEmail()}
    
    63
    
              disabled={loading}
    
    64
    
            >
    
    65
    
              <Text style={styles.buttonText}>Sign in</Text>
    
    66
    
            </TouchableOpacity>
    
    67
    
          </View>
    
    68
    
          <View style={styles.verticallySpaced}>
    
    69
    
            <TouchableOpacity
    
    70
    
              style={[styles.button, loading && styles.buttonDisabled]}
    
    71
    
              onPress={() => signUpWithEmail()}
    
    72
    
              disabled={loading}
    
    73
    
            >
    
    74
    
              <Text style={styles.buttonText}>Sign up</Text>
    
    75
    
            </TouchableOpacity>
    
    76
    
          </View>
    
    77
    
        </View>
    
    78
    
      )
    
    79
    
    }
    
    80
    
    81
    
    const styles = StyleSheet.create({
    
    82
    
      container: {
    
    83
    
        marginTop: 40,
    
    84
    
        padding: 12,
    
    85
    
      },
    
    86
    
      verticallySpaced: {
    
    87
    
        paddingTop: 4,
    
    88
    
        paddingBottom: 4,
    
    89
    
        alignSelf: 'stretch',
    
    90
    
      },
    
    91
    
      mt20: {
    
    92
    
        marginTop: 20,
    
    93
    
      },
    
    94
    
      label: {
    
    95
    
        fontSize: 16,
    
    96
    
        fontWeight: '600',
    
    97
    
        color: '#86939e',
    
    98
    
        marginBottom: 6,
    
    99
    
      },
    
    100
    
      input: {
    
    101
    
        borderWidth: 1,
    
    102
    
        borderColor: '#86939e',
    
    103
    
        borderRadius: 4,
    
    104
    
        padding: 12,
    
    105
    
        fontSize: 16,
    
    106
    
      },
    
    107
    
      button: {
    
    108
    
        backgroundColor: '#2089dc',
    
    109
    
        borderRadius: 4,
    
    110
    
        padding: 12,
    
    111
    
        alignItems: 'center',
    
    112
    
      },
    
    113
    
      buttonDisabled: {
    
    114
    
        opacity: 0.5,
    
    115
    
      },
    
    116
    
      buttonText: {
    
    117
    
        color: '#fff',
    
    118
    
        fontSize: 16,
    
    119
    
        fontWeight: '600',
    
    120
    
      },
    
    121
    
    })
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/quickstarts/react-native/components/Auth.tsx>)

6

Add the Auth component to your app

Add the `Auth` component to your `App.tsx` file. If the user is logged in, print the user id to the screen.

App.tsx
[code]
    1
    
    import 'react-native-url-polyfill/auto'
    
    2
    
    import { useState, useEffect } from 'react'
    
    3
    
    import { supabase } from './lib/supabase'
    
    4
    
    import Auth from './components/Auth'
    
    5
    
    import { View, Text } from 'react-native'
    
    6
    
    import { JwtPayload } from '@supabase/supabase-js'
    
    7
    
    8
    
    export default function App() {
    
    9
    
      const [claims, setClaims] = useState<JwtPayload | null>(null)
    
    10
    
    11
    
      useEffect(() => {
    
    12
    
        supabase.auth.getClaims().then(({ data: { claims } }) => {
    
    13
    
          setClaims(claims)
    
    14
    
        })
    
    15
    
    16
    
        supabase.auth.onAuthStateChange(() => {
    
    17
    
          supabase.auth.getClaims().then(({ data: { claims } }) => {
    
    18
    
            setClaims(claims)
    
    19
    
          })
    
    20
    
        })
    
    21
    
      }, [])
    
    22
    
    23
    
      return (
    
    24
    
        <View>
    
    25
    
          <Auth />
    
    26
    
          {claims && <Text>{claims.sub}</Text>}
    
    27
    
        </View>
    
    28
    
      )
    
    29
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/auth/quickstarts/react-native/App.tsx>)

7

Start the app

Start the app, and follow the instructions in the terminal.

Terminal
[code]
    1
    
    npm start
[/code]