---
タイトル: Build a User Management App with Expo React Native
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, expo, getting-started, management, native, react, tutorials, user, with, with-expo-react-native
---

# Build a User Management App with Expo React Native

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, expo, getting-started, management, native, react, tutorials, user, with, with-expo-react-native

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a React Native app#](#initialize-a-react-native-app)
  - [App styling#](#app-styling)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
  - [Launch!#](#launch)
- [Bonus: Profile photos#](#bonus-profile-photos)
  - [Additional dependency installation#](#additional-dependency-installation)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Add the new widget#](#add-the-new-widget)

## 概要

Learn how to use Supabase in your React Native App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/supabase-expo-react-native-demo.png)

If you get stuck while working through this guide, refer to the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/expo-user-management>).

## Project setup#

Before you start building you need to set up the Database and API. You can do this by starting a new Project in Supabase and then creating a "schema" inside the database.

### Create a project#

  1. [Create a new project](</dashboard>) in the Supabase Dashboard.
  2. Enter your project details.
  3. Wait for the new database to launch.


### Set up the database schema#

Now set up the database schema. You can use the "User Management Starter" quickstart in the SQL Editor, or you can copy/paste the SQL from below and run it.

DashboardSQL

  1. Go to the [SQL Editor](</dashboard/project/_/sql>) page in the Dashboard.
  2. Click **User Management Starter** under the **Community > Quickstarts** tab.
  3. Click **Run**.


You can pull the database schema down to your local project by running the `db pull` command. Read the [local development docs](</docs/guides/local-development/database-migrations#link-your-project>) for detailed instructions.
[code]
    1
    
    supabase link --project-ref <project-id>
    
    2
    
    # You can get <project-id> from your project's dashboard URL: https://supabase.com/dashboard/project/<project-id>
    
    3
    
    supabase db pull
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=exporeactnative>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start by building the React Native app from scratch.

### Initialize a React Native app#

Use [`expo`](<https://docs.expo.dev/get-started/create-a-new-app/>) to initialize an app called `expo-user-management`:
[code] 
    1
    
    npx create-expo-app -t expo-template-blank-typescript expo-user-management
    
    2
    
    3
    
    cd expo-user-management
[/code]

Then install the additional dependencies:
[code] 
    1
    
    npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
[/code]

Now create a helper file to initialize the Supabase client using the API URL and the key that you copied earlier.

These variables are safe to expose in your Expo app since Supabase has [Row Level Security](</docs/guides/database/postgres/row-level-security>) enabled on your Database.

LocalStorageSecureStore

lib/supabase.ts
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    import AsyncStorage from '@react-native-async-storage/async-storage'
    
    3
    
    4
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
    
    5
    
    const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    
    6
    
    7
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    
    8
    
      auth: {
    
    9
    
        storage: AsyncStorage as any,
    
    10
    
        autoRefreshToken: true,
    
    11
    
        persistSession: true,
    
    12
    
        detectSessionInUrl: false,
    
    13
    
      },
    
    14
    
    })
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/lib/supabase.ts>)

### App styling#

You can use the following `StyleSheet` component in `styles/styles.ts` to add style to the app:

styles/styles.ts
[code]
    1
    
    import { StyleSheet } from 'react-native'
    
    2
    
    3
    
    export const appStyles = StyleSheet.create({
    
    4
    
      container: {
    
    5
    
        marginTop: 40,
    
    6
    
        padding: 12,
    
    7
    
      },
    
    8
    
      verticallySpaced: {
    
    9
    
        paddingTop: 4,
    
    10
    
        paddingBottom: 4,
    
    11
    
        alignSelf: 'stretch',
    
    12
    
      },
    
    13
    
      mt20: {
    
    14
    
        marginTop: 20,
    
    15
    
      },
    
    16
    
      label: {
    
    17
    
        fontSize: 16,
    
    18
    
        fontWeight: '600',
    
    19
    
        color: '#86939e',
    
    20
    
        marginBottom: 6,
    
    21
    
      },
    
    22
    
      input: {
    
    23
    
        borderWidth: 1,
    
    24
    
        borderColor: '#86939e',
    
    25
    
        borderRadius: 4,
    
    26
    
        padding: 12,
    
    27
    
        fontSize: 16,
    
    28
    
      },
    
    29
    
      inputDisabled: {
    
    30
    
        backgroundColor: '#f2f2f2',
    
    31
    
        borderColor: '#d1d1d1',
    
    32
    
        color: '#9e9e9e',
    
    33
    
      },
    
    34
    
      button: {
    
    35
    
        backgroundColor: '#2089dc',
    
    36
    
        borderRadius: 4,
    
    37
    
        padding: 12,
    
    38
    
        alignItems: 'center',
    
    39
    
      },
    
    40
    
      buttonDisabled: {
    
    41
    
        opacity: 0.5,
    
    42
    
      },
    
    43
    
      buttonText: {
    
    44
    
        color: '#fff',
    
    45
    
        fontSize: 16,
    
    46
    
        fontWeight: '600',
    
    47
    
      },
    
    48
    
      avatarContainer: {
    
    49
    
        alignItems: 'center',
    
    50
    
        justifyContent: 'center',
    
    51
    
        marginTop: 20,
    
    52
    
      },
    
    53
    
      avatar: {
    
    54
    
        borderRadius: 5,
    
    55
    
        overflow: 'hidden',
    
    56
    
        maxWidth: '100%',
    
    57
    
        marginBottom: 20,
    
    58
    
      },
    
    59
    
      image: {
    
    60
    
        objectFit: 'cover',
    
    61
    
        paddingTop: 0,
    
    62
    
      },
    
    63
    
      noImage: {
    
    64
    
        backgroundColor: '#333',
    
    65
    
        borderWidth: 1,
    
    66
    
        borderStyle: 'solid',
    
    67
    
        borderColor: 'rgb(200, 200, 200)',
    
    68
    
        borderRadius: 5,
    
    69
    
      },
    
    70
    
    })
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/styles/styles.ts>)

### Set up a login component#

Set up a React Native component to manage logins and sign ups. Users should be able to sign in with their email and password.

components/Auth.tsx
[code]
    1
    
    import React, { useState } from 'react'
    
    2
    
    import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native'
    
    3
    
    import { supabase } from '../lib/supabase'
    
    4
    
    import { appStyles } from '../styles/styles'
    
    5
    
    6
    
    export default function Auth() {
    
    7
    
      const [email, setEmail] = useState('')
    
    8
    
      const [password, setPassword] = useState('')
    
    9
    
      const [loading, setLoading] = useState(false)
    
    10
    
      const styles = appStyles
    
    11
    
    12
    
      async function signInWithEmail() {
    
    13
    
        setLoading(true)
    
    14
    
        const { error } = await supabase.auth.signInWithPassword({
    
    15
    
          email: email,
    
    16
    
          password: password,
    
    17
    
        })
    
    18
    
    19
    
        if (error) Alert.alert(error.message)
    
    20
    
        setLoading(false)
    
    21
    
      }
    
    22
    
    23
    
      async function signUpWithEmail() {
    
    24
    
        setLoading(true)
    
    25
    
        const { error } = await supabase.auth.signUp({
    
    26
    
          email: email,
    
    27
    
          password: password,
    
    28
    
        })
    
    29
    
    30
    
        if (error) Alert.alert(error.message)
    
    31
    
        setLoading(false)
    
    32
    
      }
    
    33
    
    34
    
      return (
    
    35
    
        <View style={styles.container}>
    
    36
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    37
    
            <Text style={styles.label}>Email</Text>
    
    38
    
            <TextInput
    
    39
    
              onChangeText={(text) => setEmail(text)}
    
    40
    
              value={email}
    
    41
    
              placeholder="email@address.com"
    
    42
    
              autoCapitalize="none"
    
    43
    
              style={styles.input}
    
    44
    
            />
    
    45
    
          </View>
    
    46
    
          <View style={styles.verticallySpaced}>
    
    47
    
            <Text style={styles.label}>Password</Text>
    
    48
    
            <TextInput
    
    49
    
              onChangeText={(text) => setPassword(text)}
    
    50
    
              value={password}
    
    51
    
              secureTextEntry={true}
    
    52
    
              placeholder="Password"
    
    53
    
              autoCapitalize="none"
    
    54
    
              style={styles.input}
    
    55
    
            />
    
    56
    
          </View>
    
    57
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    58
    
            <TouchableOpacity
    
    59
    
              style={[styles.button, loading && styles.buttonDisabled]}
    
    60
    
              onPress={() => signInWithEmail()}
    
    61
    
              disabled={loading}
    
    62
    
            >
    
    63
    
              <Text style={styles.buttonText}>Sign in</Text>
    
    64
    
            </TouchableOpacity>
    
    65
    
          </View>
    
    66
    
          <View style={styles.verticallySpaced}>
    
    67
    
            <TouchableOpacity
    
    68
    
              style={[styles.button, loading && styles.buttonDisabled]}
    
    69
    
              onPress={() => signUpWithEmail()}
    
    70
    
              disabled={loading}
    
    71
    
            >
    
    72
    
              <Text style={styles.buttonText}>Sign up</Text>
    
    73
    
            </TouchableOpacity>
    
    74
    
          </View>
    
    75
    
        </View>
    
    76
    
      )
    
    77
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/components/Auth.tsx>)

By default Supabase Auth requires email verification before a session is created for the users. To support email verification you need to [implement deep link handling](</docs/guides/auth/native-mobile-deep-linking?platform=react-native>)!

While testing, you can disable email confirmation in your [project's email auth provider settings](</dashboard/project/_/auth/providers>).

### Account page#

After a user signs in, let them edit their profile details and manage their account.

Create a new component for that called `Account.tsx`.

components/Account.tsx
[code]
    1
    
    import { useState, useEffect } from 'react'
    
    2
    
    import { supabase } from '../lib/supabase'
    
    3
    
    import { View, Alert, TextInput, Text, TouchableOpacity } from 'react-native'
    
    4
    
    import Avatar from './Avatar'
    
    5
    
    6
    
    // ...
    
    7
    
    8
    
    9
    
    export default function Account({ userId, email }: { userId: string; email?: string }) {
    
    10
    
      const [loading, setLoading] = useState(true)
    
    11
    
      const [username, setUsername] = useState('')
    
    12
    
      const [website, setWebsite] = useState('')
    
    13
    
      const [avatarUrl, setAvatarUrl] = useState('')
    
    14
    
      const styles = appStyles
    
    15
    
    16
    
      useEffect(() => {
    
    17
    
        if (userId) getProfile()
    
    18
    
      }, [userId])
    
    19
    
    20
    
      async function getProfile() {
    
    21
    
        try {
    
    22
    
          setLoading(true)
    
    23
    
    24
    
          let { data, error, status } = await supabase
    
    25
    
            .from('profiles')
    
    26
    
            .select(`username, website, avatar_url`)
    
    27
    
            .eq('id', userId)
    
    28
    
            .single()
    
    29
    
          if (error && status !== 406) {
    
    30
    
            throw error
    
    31
    
          }
    
    32
    
    33
    
          if (data) {
    
    34
    
            setUsername(data.username)
    
    35
    
            setWebsite(data.website)
    
    36
    
            setAvatarUrl(data.avatar_url)
    
    37
    
          }
    
    38
    
        } catch (error) {
    
    39
    
          if (error instanceof Error) {
    
    40
    
            Alert.alert(error.message)
    
    41
    
          }
    
    42
    
        } finally {
    
    43
    
          setLoading(false)
    
    44
    
        }
    
    45
    
      }
    
    46
    
    47
    
      async function updateProfile({
    
    48
    
        username,
    
    49
    
        website,
    
    50
    
        avatar_url,
    
    51
    
      }: {
    
    52
    
        username: string
    
    53
    
        website: string
    
    54
    
        avatar_url: string
    
    55
    
      }) {
    
    56
    
        try {
    
    57
    
          setLoading(true)
    
    58
    
    59
    
          const updates = {
    
    60
    
            id: userId,
    
    61
    
            username,
    
    62
    
            website,
    
    63
    
            avatar_url,
    
    64
    
            updated_at: new Date(),
    
    65
    
          }
    
    66
    
    67
    
          let { error } = await supabase.from('profiles').upsert(updates)
    
    68
    
    69
    
          if (error) {
    
    70
    
            throw error
    
    71
    
          }
    
    72
    
        } catch (error: any) {
    
    73
    
          Alert.alert(error.message)
    
    74
    
        } finally {
    
    75
    
          setLoading(false)
    
    76
    
        }
    
    77
    
      }
    
    78
    
    79
    
      return (
    
    80
    
        <View style={styles.container}>
    
    81
    
          <View>
    
    82
    
    83
    
            {/* ... */}
    
    84
    
    85
    
            <Text style={styles.label}>Email</Text>
    
    86
    
            <TextInput
    
    87
    
              value={email ?? ''}
    
    88
    
              editable={false}
    
    89
    
              selectTextOnFocus={false}
    
    90
    
              style={[styles.input, styles.inputDisabled]}
    
    91
    
            />
    
    92
    
          </View>
    
    93
    
          <View style={styles.verticallySpaced}>
    
    94
    
            <Text style={styles.label}>Username</Text>
    
    95
    
            <TextInput
    
    96
    
              value={username || ''}
    
    97
    
              onChangeText={(text) => setUsername(text)}
    
    98
    
              style={styles.input}
    
    99
    
            />
    
    100
    
          </View>
    
    101
    
          <View style={styles.verticallySpaced}>
    
    102
    
            <Text style={styles.label}>Website</Text>
    
    103
    
            <TextInput
    
    104
    
              value={website || ''}
    
    105
    
              onChangeText={(text) => setWebsite(text)}
    
    106
    
              style={styles.input}
    
    107
    
            />
    
    108
    
          </View>
    
    109
    
    110
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    111
    
            <TouchableOpacity
    
    112
    
              style={[styles.button, loading && styles.buttonDisabled]}
    
    113
    
              onPress={() => updateProfile({ username, website, avatar_url: avatarUrl })}
    
    114
    
              disabled={loading}
    
    115
    
            >
    
    116
    
              <Text style={styles.buttonText}>{loading ? 'Loading ...' : 'Update'}</Text>
    
    117
    
            </TouchableOpacity>
    
    118
    
          </View>
    
    119
    
    120
    
          <View style={styles.verticallySpaced}>
    
    121
    
            <TouchableOpacity style={styles.button} onPress={() => supabase.auth.signOut()}>
    
    122
    
              <Text style={styles.buttonText}>Sign Out</Text>
    
    123
    
            </TouchableOpacity>
    
    124
    
          </View>
    
    125
    
        </View>
    
    126
    
      )
    
    127
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/components/Account.tsx>)

### Launch!#

Now that you have all the components in place, update `App.tsx`:

App.tsx
[code]
    1
    
    import { useState, useEffect } from 'react'
    
    2
    
    import { supabase } from './lib/supabase'
    
    3
    
    import Auth from './components/Auth'
    
    4
    
    import Account from './components/Account'
    
    5
    
    import { View } from 'react-native'
    
    6
    
    7
    
    export default function App() {
    
    8
    
      const [userId, setUserId] = useState<string | null>(null)
    
    9
    
      const [email, setEmail] = useState<string | undefined>(undefined)
    
    10
    
    11
    
      useEffect(() => {
    
    12
    
        supabase.auth.getClaims().then(({ data: { claims } }) => {
    
    13
    
          if (claims) {
    
    14
    
            setUserId(claims.sub)
    
    15
    
            setEmail(claims.email)
    
    16
    
          }
    
    17
    
        })
    
    18
    
    19
    
        supabase.auth.onAuthStateChange(async (_event, _session) => {
    
    20
    
          const {
    
    21
    
            data: { claims },
    
    22
    
          } = await supabase.auth.getClaims()
    
    23
    
          if (claims) {
    
    24
    
            setUserId(claims.sub)
    
    25
    
            setEmail(claims.email)
    
    26
    
          } else {
    
    27
    
            setUserId(null)
    
    28
    
            setEmail(undefined)
    
    29
    
          }
    
    30
    
        })
    
    31
    
      }, [])
    
    32
    
    33
    
      return <View>{userId ? <Account key={userId} userId={userId} email={email} /> : <Auth />}</View>
    
    34
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/App.tsx>)

Once that's done, run this in a terminal window:
[code] 
    1
    
    npm start
[/code]

And then press the appropriate key for the environment you want to test the app in and you should see the completed app.

## Bonus: Profile photos#

Every Supabase project is configured with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Additional dependency installation#

You need an image picker that works on the environment you are building the project for, this example uses `expo-image-picker`.
[code] 
    1
    
    npx expo install expo-image-picker
[/code]

### Create an upload widget#

Create an avatar for the user so that they can upload a profile photo. Start by creating a new component:

components/Avatar.tsx
[code]
    1
    
    import { useState, useEffect } from 'react'
    
    2
    
    import { supabase } from '../lib/supabase'
    
    3
    
    import { View, Alert, Image, Text, TouchableOpacity } from 'react-native'
    
    4
    
    import * as ImagePicker from 'expo-image-picker'
    
    5
    
    import { appStyles } from '../styles/styles'
    
    6
    
    7
    
    interface Props {
    
    8
    
      size: number
    
    9
    
      url: string | null
    
    10
    
      onUpload: (filePath: string) => void
    
    11
    
    }
    
    12
    
    13
    
    export default function Avatar({ url, size = 150, onUpload }: Props) {
    
    14
    
      const [uploading, setUploading] = useState(false)
    
    15
    
      const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    
    16
    
      const avatarSize = { height: size, width: size }
    
    17
    
      const styles = appStyles
    
    18
    
    19
    
      useEffect(() => {
    
    20
    
        if (url) downloadImage(url)
    
    21
    
      }, [url])
    
    22
    
    23
    
      async function downloadImage(path: string) {
    
    24
    
        try {
    
    25
    
          const { data, error } = await supabase.storage.from('avatars').download(path)
    
    26
    
    27
    
          if (error) {
    
    28
    
            throw error
    
    29
    
          }
    
    30
    
    31
    
          const fr = new FileReader()
    
    32
    
          fr.readAsDataURL(data)
    
    33
    
          fr.onload = () => {
    
    34
    
            setAvatarUrl(fr.result as string)
    
    35
    
          }
    
    36
    
        } catch (error: any) {
    
    37
    
          console.log('Error downloading image: ', error.message)
    
    38
    
        }
    
    39
    
      }
    
    40
    
    41
    
      async function uploadAvatar() {
    
    42
    
        try {
    
    43
    
          setUploading(true)
    
    44
    
    45
    
          const result = await ImagePicker.launchImageLibraryAsync({
    
    46
    
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // Restrict to only images
    
    47
    
            allowsMultipleSelection: false, // Can only select one image
    
    48
    
            allowsEditing: true, // Allows the user to crop / rotate their photo before uploading it
    
    49
    
            quality: 1,
    
    50
    
            exif: false, // We don't want nor need that data.
    
    51
    
          })
    
    52
    
    53
    
          if (result.canceled || !result.assets || result.assets.length === 0) {
    
    54
    
            console.log('User cancelled image picker.')
    
    55
    
            return
    
    56
    
          }
    
    57
    
    58
    
          const image = result.assets[0]
    
    59
    
          console.log('Got image', image)
    
    60
    
    61
    
          if (!image.uri) {
    
    62
    
            throw new Error('No image uri!') // Realistically, this should never happen, but just in case...
    
    63
    
          }
    
    64
    
    65
    
          const arraybuffer = await fetch(image.uri).then((res) => res.arrayBuffer())
    
    66
    
    67
    
          const fileExt = image.uri?.split('.').pop()?.toLowerCase() ?? 'jpeg'
    
    68
    
          const path = `${Date.now()}.${fileExt}`
    
    69
    
          const { data, error: uploadError } = await supabase.storage
    
    70
    
            .from('avatars')
    
    71
    
            .upload(path, arraybuffer, {
    
    72
    
              contentType: image.mimeType ?? 'image/jpeg',
    
    73
    
            })
    
    74
    
    75
    
          if (uploadError) {
    
    76
    
            throw uploadError
    
    77
    
          }
    
    78
    
    79
    
          onUpload(data.path)
    
    80
    
        } catch (error: any) {
    
    81
    
          if (error) {
    
    82
    
            Alert.alert(error.message)
    
    83
    
          } else {
    
    84
    
            throw error
    
    85
    
          }
    
    86
    
        } finally {
    
    87
    
          setUploading(false)
    
    88
    
        }
    
    89
    
      }
    
    90
    
    91
    
      return (
    
    92
    
        <View style={styles.avatarContainer}>
    
    93
    
          {avatarUrl ? (
    
    94
    
            <Image
    
    95
    
              source={{ uri: avatarUrl }}
    
    96
    
              accessibilityLabel="Avatar"
    
    97
    
              style={[avatarSize, styles.avatar, styles.image]}
    
    98
    
            />
    
    99
    
          ) : (
    
    100
    
            <View style={[avatarSize, styles.avatar, styles.noImage]} />
    
    101
    
          )}
    
    102
    
          <View>
    
    103
    
            <TouchableOpacity
    
    104
    
              style={[styles.button, uploading && styles.buttonDisabled]}
    
    105
    
              onPress={uploadAvatar}
    
    106
    
              disabled={uploading}
    
    107
    
            >
    
    108
    
              <Text style={styles.buttonText}>{uploading ? 'Uploading ...' : 'Upload'}</Text>
    
    109
    
            </TouchableOpacity>
    
    110
    
          </View>
    
    111
    
        </View>
    
    112
    
      )
    
    113
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/components/Avatar.tsx>)

### Add the new widget#

And then add the widget to the Account page:

components/Account.tsx
[code]
    1
    
    import { useState, useEffect } from 'react'
    
    2
    
    import { supabase } from '../lib/supabase'
    
    3
    
    import { View, Alert, TextInput, Text, TouchableOpacity } from 'react-native'
    
    4
    
    import Avatar from './Avatar'
    
    5
    
    import { appStyles } from '../styles/styles'
    
    6
    
    7
    
    export default function Account({ userId, email }: { userId: string; email?: string }) {
    
    8
    
      const [loading, setLoading] = useState(true)
    
    9
    
      const [username, setUsername] = useState('')
    
    10
    
      const [website, setWebsite] = useState('')
    
    11
    
      const [avatarUrl, setAvatarUrl] = useState('')
    
    12
    
      const styles = appStyles
    
    13
    
    14
    
      useEffect(() => {
    
    15
    
        if (userId) getProfile()
    
    16
    
      }, [userId])
    
    17
    
    18
    
      async function getProfile() {
    
    19
    
        try {
    
    20
    
          setLoading(true)
    
    21
    
    22
    
          let { data, error, status } = await supabase
    
    23
    
            .from('profiles')
    
    24
    
            .select(`username, website, avatar_url`)
    
    25
    
            .eq('id', userId)
    
    26
    
            .single()
    
    27
    
          if (error && status !== 406) {
    
    28
    
            throw error
    
    29
    
          }
    
    30
    
    31
    
          if (data) {
    
    32
    
            setUsername(data.username)
    
    33
    
            setWebsite(data.website)
    
    34
    
            setAvatarUrl(data.avatar_url)
    
    35
    
          }
    
    36
    
        } catch (error) {
    
    37
    
          if (error instanceof Error) {
    
    38
    
            Alert.alert(error.message)
    
    39
    
          }
    
    40
    
        } finally {
    
    41
    
          setLoading(false)
    
    42
    
        }
    
    43
    
      }
    
    44
    
    45
    
      async function updateProfile({
    
    46
    
        username,
    
    47
    
        website,
    
    48
    
        avatar_url,
    
    49
    
      }: {
    
    50
    
        username: string
    
    51
    
        website: string
    
    52
    
        avatar_url: string
    
    53
    
      }) {
    
    54
    
        try {
    
    55
    
          setLoading(true)
    
    56
    
    57
    
          const updates = {
    
    58
    
            id: userId,
    
    59
    
            username,
    
    60
    
            website,
    
    61
    
            avatar_url,
    
    62
    
            updated_at: new Date(),
    
    63
    
          }
    
    64
    
    65
    
          let { error } = await supabase.from('profiles').upsert(updates)
    
    66
    
    67
    
          if (error) {
    
    68
    
            throw error
    
    69
    
          }
    
    70
    
        } catch (error: any) {
    
    71
    
          Alert.alert(error.message)
    
    72
    
        } finally {
    
    73
    
          setLoading(false)
    
    74
    
        }
    
    75
    
      }
    
    76
    
    77
    
      return (
    
    78
    
        <View style={styles.container}>
    
    79
    
          <View>
    
    80
    
            <Avatar
    
    81
    
              size={200}
    
    82
    
              url={avatarUrl}
    
    83
    
              onUpload={(url: string) => {
    
    84
    
                setAvatarUrl(url)
    
    85
    
                updateProfile({ username, website, avatar_url: url })
    
    86
    
              }}
    
    87
    
            />
    
    88
    
          </View>
    
    89
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    90
    
            <Text style={styles.label}>Email</Text>
    
    91
    
            <TextInput
    
    92
    
              value={email ?? ''}
    
    93
    
              editable={false}
    
    94
    
              selectTextOnFocus={false}
    
    95
    
              style={[styles.input, styles.inputDisabled]}
    
    96
    
            />
    
    97
    
          </View>
    
    98
    
          <View style={styles.verticallySpaced}>
    
    99
    
            <Text style={styles.label}>Username</Text>
    
    100
    
            <TextInput
    
    101
    
              value={username || ''}
    
    102
    
              onChangeText={(text) => setUsername(text)}
    
    103
    
              style={styles.input}
    
    104
    
            />
    
    105
    
          </View>
    
    106
    
          <View style={styles.verticallySpaced}>
    
    107
    
            <Text style={styles.label}>Website</Text>
    
    108
    
            <TextInput
    
    109
    
              value={website || ''}
    
    110
    
              onChangeText={(text) => setWebsite(text)}
    
    111
    
              style={styles.input}
    
    112
    
            />
    
    113
    
          </View>
    
    114
    
    115
    
          <View style={[styles.verticallySpaced, styles.mt20]}>
    
    116
    
            <TouchableOpacity
    
    117
    
              style={[styles.button, loading && styles.buttonDisabled]}
    
    118
    
              onPress={() => updateProfile({ username, website, avatar_url: avatarUrl })}
    
    119
    
              disabled={loading}
    
    120
    
            >
    
    121
    
              <Text style={styles.buttonText}>{loading ? 'Loading ...' : 'Update'}</Text>
    
    122
    
            </TouchableOpacity>
    
    123
    
          </View>
    
    124
    
    125
    
          <View style={styles.verticallySpaced}>
    
    126
    
            <TouchableOpacity style={styles.button} onPress={() => supabase.auth.signOut()}>
    
    127
    
              <Text style={styles.buttonText}>Sign Out</Text>
    
    128
    
            </TouchableOpacity>
    
    129
    
          </View>
    
    130
    
        </View>
    
    131
    
      )
    
    132
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/expo-user-management/components/Account.tsx>)

Now run the prebuild command to get the application working on your chosen platform.
[code] 
    1
    
    npx expo prebuild
[/code]

At this stage you have a fully functional application!