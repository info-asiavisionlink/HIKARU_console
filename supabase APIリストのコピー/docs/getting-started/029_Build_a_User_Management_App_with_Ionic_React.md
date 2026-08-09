---
タイトル: Build a User Management App with Ionic React
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-ionic-react
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, ionic, management, react, tutorials, user, with, with-ionic-react
---

# Build a User Management App with Ionic React

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-ionic-react
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, ionic, management, react, tutorials, user, with, with-ionic-react

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize an Ionic React app#](#initialize-an-ionic-react-app)
  - [Set up a login route#](#set-up-a-login-route)
  - [Account page#](#account-page)
  - [Launch!#](#launch)
- [Bonus: Profile photos#](#bonus-profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Add the new widget#](#add-the-new-widget)

## 概要

Learn how to use Supabase in your Ionic React App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/ionic-demos/ionic-angular-account.png)

If you get stuck while working through this guide, refer to the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/ionic-react-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=ionicreact>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the React app from scratch.

### Initialize an Ionic React app#

Use the [Ionic CLI](<https://ionicframework.com/docs/cli>) to initialize an app called `supabase-ionic-react`:
[code] 
    1
    
    npm install -g @ionic/cli
    
    2
    
    ionic start supabase-ionic-react blank --type react
    
    3
    
    cd supabase-ionic-react
[/code]

Install the only additional dependency: [supabase-js](<https://github.com/supabase/supabase-js>)
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

Save the environment variables in a `.env`. You need the API URL and the key that you copied earlier.

.env
[code]
    1
    
    VITE_SUPABASE_URL=YOUR_SUPABASE_URL
    
    2
    
    VITE_SUPABASE_KEY=YOUR_SUPABASE_KEY
[/code]

With the API credentials in place, create a helper file to initialize the Supabase client. These variables will be exposed in the browser, which is safe because they use a restricted publishable key and the SQL quickstart enables [Row Level Security](</docs/guides/auth#row-level-security>) on the `profiles` table.

src/supabaseClient.ts
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    4
    
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    5
    
    6
    
    if (!supabaseUrl || !supabasePublishableKey) {
    
    7
    
      throw new Error(
    
    8
    
        'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set.'
    
    9
    
      )
    
    10
    
    }
    
    11
    
    12
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey)
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/supabaseClient.ts>)

### Set up a login route#

Set up a React component to manage logins and sign ups which uses Magic Links, so users can sign in with their email without using passwords.

src/pages/Login.tsx
[code]
    1
    
    import { useState } from 'react'
    
    2
    
    import type React from 'react'
    
    3
    
    import {
    
    4
    
      IonButton,
    
    5
    
      IonContent,
    
    6
    
      IonHeader,
    
    7
    
      IonInput,
    
    8
    
      IonItem,
    
    9
    
      IonList,
    
    10
    
      IonPage,
    
    11
    
      IonTitle,
    
    12
    
      IonToolbar,
    
    13
    
      useIonToast,
    
    14
    
      useIonLoading,
    
    15
    
    } from '@ionic/react'
    
    16
    
    import { supabase } from '../supabaseClient'
    
    17
    
    18
    
    export function LoginPage() {
    
    19
    
      const [email, setEmail] = useState('')
    
    20
    
    21
    
      const [showLoading, hideLoading] = useIonLoading()
    
    22
    
      const [showToast] = useIonToast()
    
    23
    
      const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    
    24
    
        e.preventDefault()
    
    25
    
        await showLoading()
    
    26
    
        try {
    
    27
    
          const { error } = await supabase.auth.signInWithOtp({ email })
    
    28
    
          if (error) throw error
    
    29
    
          await showToast({ message: 'Check your email for the login link!' })
    
    30
    
        } catch (e: any) {
    
    31
    
          await showToast({ message: e.error_description || e.message, duration: 5000 })
    
    32
    
        } finally {
    
    33
    
          await hideLoading()
    
    34
    
        }
    
    35
    
      }
    
    36
    
      return (
    
    37
    
        <IonPage>
    
    38
    
          <IonHeader>
    
    39
    
            <IonToolbar>
    
    40
    
              <IonTitle>Login</IonTitle>
    
    41
    
            </IonToolbar>
    
    42
    
          </IonHeader>
    
    43
    
    44
    
          <IonContent>
    
    45
    
            <div className="ion-padding">
    
    46
    
              <h1>Supabase + Ionic React</h1>
    
    47
    
              <p>Sign in via magic link with your email below</p>
    
    48
    
            </div>
    
    49
    
            <IonList inset={true}>
    
    50
    
              <form onSubmit={handleLogin}>
    
    51
    
                <IonItem>
    
    52
    
                  <IonInput
    
    53
    
                    value={email}
    
    54
    
                    name="email"
    
    55
    
                    onIonInput={(e) => setEmail(e.detail.value ?? '')}
    
    56
    
                    type="email"
    
    57
    
                    label="Email"
    
    58
    
                    labelPlacement="stacked"
    
    59
    
                  ></IonInput>
    
    60
    
                </IonItem>
    
    61
    
                <div className="ion-text-center">
    
    62
    
                  <IonButton type="submit" fill="clear">
    
    63
    
                    Login
    
    64
    
                  </IonButton>
    
    65
    
                </div>
    
    66
    
              </form>
    
    67
    
            </IonList>
    
    68
    
          </IonContent>
    
    69
    
        </IonPage>
    
    70
    
      )
    
    71
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/pages/Login.tsx>)

### Account page#

After a user signs in, they should be able to edit their profile details and manage their account.

Create a new component for that called `Account.tsx`.

src/pages/Account.tsx
[code]
    1
    
    import {
    
    2
    
      IonButton,
    
    3
    
      IonContent,
    
    4
    
      IonHeader,
    
    5
    
      IonInput,
    
    6
    
      IonItem,
    
    7
    
      IonLabel,
    
    8
    
      IonPage,
    
    9
    
      IonTitle,
    
    10
    
      IonToolbar,
    
    11
    
      useIonLoading,
    
    12
    
      useIonToast,
    
    13
    
      useIonRouter,
    
    14
    
    } from '@ionic/react'
    
    15
    
    import { useEffect, useState } from 'react'
    
    16
    
    17
    
    // ...
    
    18
    
    19
    
    import { supabase } from '../supabaseClient'
    
    20
    
    21
    
    export function AccountPage() {
    
    22
    
      const [showLoading, hideLoading] = useIonLoading()
    
    23
    
      const [showToast] = useIonToast()
    
    24
    
      const router = useIonRouter()
    
    25
    
      const [email, setEmail] = useState('')
    
    26
    
      const [profile, setProfile] = useState({
    
    27
    
        username: '',
    
    28
    
        website: '',
    
    29
    
        avatar_url: '',
    
    30
    
      })
    
    31
    
    32
    
      useEffect(() => {
    
    33
    
        getProfile()
    
    34
    
      }, [])
    
    35
    
    36
    
      const getProfile = async () => {
    
    37
    
        await showLoading()
    
    38
    
        try {
    
    39
    
          const { data: authData } = await supabase.auth.getClaims()
    
    40
    
          if (!authData?.claims) throw new Error('No user logged in')
    
    41
    
          const { claims } = authData
    
    42
    
    43
    
          setEmail(claims.email as string)
    
    44
    
    45
    
          const { data, error, status } = await supabase
    
    46
    
            .from('profiles')
    
    47
    
            .select(`username, website, avatar_url`)
    
    48
    
            .eq('id', claims.sub)
    
    49
    
            .single()
    
    50
    
    51
    
          if (error && status !== 406) {
    
    52
    
            throw error
    
    53
    
          }
    
    54
    
    55
    
          if (data) {
    
    56
    
            setProfile({
    
    57
    
              username: data.username,
    
    58
    
              website: data.website,
    
    59
    
              avatar_url: data.avatar_url,
    
    60
    
            })
    
    61
    
          }
    
    62
    
        } catch (error: any) {
    
    63
    
          showToast({ message: error.message, duration: 5000 })
    
    64
    
        } finally {
    
    65
    
          await hideLoading()
    
    66
    
        }
    
    67
    
      }
    
    68
    
    69
    
      const signOut = async () => {
    
    70
    
        await supabase.auth.signOut()
    
    71
    
        router.push('/', 'forward', 'replace')
    
    72
    
      }
    
    73
    
    74
    
      const updateProfile = async (e?: any, avatar_url?: string) => {
    
    75
    
        e?.preventDefault()
    
    76
    
    77
    
        await showLoading()
    
    78
    
    79
    
        try {
    
    80
    
          const { data } = await supabase.auth.getClaims()
    
    81
    
          if (!data?.claims) throw new Error('No user logged in')
    
    82
    
          const { claims } = data
    
    83
    
    84
    
          const updates = {
    
    85
    
            id: claims.sub,
    
    86
    
            ...profile,
    
    87
    
            ...(avatar_url !== undefined ? { avatar_url } : {}),
    
    88
    
            updated_at: new Date(),
    
    89
    
          }
    
    90
    
    91
    
          const { error } = await supabase.from('profiles').upsert(updates)
    
    92
    
    93
    
          if (error) {
    
    94
    
            throw error
    
    95
    
          }
    
    96
    
    97
    
          // Ensure local profile state reflects the updated avatar URL
    
    98
    
          if (avatar_url !== undefined) {
    
    99
    
            setProfile((prev) => ({
    
    100
    
              ...prev,
    
    101
    
              avatar_url,
    
    102
    
            }))
    
    103
    
          }
    
    104
    
    105
    
          if (avatar_url !== undefined) {
    
    106
    
            setProfile((current) => ({
    
    107
    
              ...current,
    
    108
    
              avatar_url,
    
    109
    
            }))
    
    110
    
          }
    
    111
    
        } catch (error: any) {
    
    112
    
          showToast({ message: error.message, duration: 5000 })
    
    113
    
        } finally {
    
    114
    
          await hideLoading()
    
    115
    
        }
    
    116
    
      }
    
    117
    
    118
    
      return (
    
    119
    
        <IonPage>
    
    120
    
          <IonHeader>
    
    121
    
            <IonToolbar>
    
    122
    
              <IonTitle>Account</IonTitle>
    
    123
    
            </IonToolbar>
    
    124
    
          </IonHeader>
    
    125
    
    126
    
          <IonContent>
    
    127
    
    128
    
            {/* ... */}
    
    129
    
    130
    
            <form onSubmit={updateProfile}>
    
    131
    
              <IonItem>
    
    132
    
                <IonLabel>
    
    133
    
                  <p>Email</p>
    
    134
    
                  <p>{email}</p>
    
    135
    
                </IonLabel>
    
    136
    
              </IonItem>
    
    137
    
    138
    
              <IonItem>
    
    139
    
                <IonInput
    
    140
    
                  type="text"
    
    141
    
                  name="username"
    
    142
    
                  value={profile.username}
    
    143
    
                  onIonInput={(e) => setProfile({ ...profile, username: e.detail.value ?? '' })}
    
    144
    
                  label="Name"
    
    145
    
                  labelPlacement="stacked"
    
    146
    
                ></IonInput>
    
    147
    
              </IonItem>
    
    148
    
    149
    
              <IonItem>
    
    150
    
                <IonInput
    
    151
    
                  type="url"
    
    152
    
                  name="website"
    
    153
    
                  value={profile.website}
    
    154
    
                  onIonInput={(e) => setProfile({ ...profile, website: e.detail.value ?? '' })}
    
    155
    
                  label="Website"
    
    156
    
                  labelPlacement="stacked"
    
    157
    
                ></IonInput>
    
    158
    
              </IonItem>
    
    159
    
              <div className="ion-text-center">
    
    160
    
                <IonButton fill="clear" type="submit">
    
    161
    
                  Update Profile
    
    162
    
                </IonButton>
    
    163
    
              </div>
    
    164
    
            </form>
    
    165
    
    166
    
            <div className="ion-text-center">
    
    167
    
              <IonButton fill="clear" onClick={signOut}>
    
    168
    
                Log Out
    
    169
    
              </IonButton>
    
    170
    
            </div>
    
    171
    
          </IonContent>
    
    172
    
        </IonPage>
    
    173
    
      )
    
    174
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/pages/Account.tsx>)

### Launch!#

Now that you have all the components in place, update `App.tsx`:

src/App.tsx
[code]
    1
    
    import { Redirect, Route } from 'react-router-dom'
    
    2
    
    import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react'
    
    3
    
    import { IonReactRouter } from '@ionic/react-router'
    
    4
    
    import { supabase } from './supabaseClient'
    
    5
    
    6
    
    import '@ionic/react/css/ionic.bundle.css'
    
    7
    
    8
    
    /* Theme variables */
    
    9
    
    import './theme/variables.css'
    
    10
    
    import { LoginPage } from './pages/Login'
    
    11
    
    import { AccountPage } from './pages/Account'
    
    12
    
    import { useEffect, useState } from 'react'
    
    13
    
    import type { FC } from 'react'
    
    14
    
    15
    
    setupIonicReact()
    
    16
    
    17
    
    const App: FC = () => {
    
    18
    
      const [claims, setClaims] = useState<any>(null)
    
    19
    
    20
    
      useEffect(() => {
    
    21
    
        supabase.auth.getClaims().then(({ data }) => {
    
    22
    
          if (data) {
    
    23
    
            setClaims(data.claims)
    
    24
    
          }
    
    25
    
        })
    
    26
    
    27
    
        const {
    
    28
    
          data: { subscription },
    
    29
    
        } = supabase.auth.onAuthStateChange(() => {
    
    30
    
          supabase.auth.getClaims().then(({ data }) => {
    
    31
    
            if (data) {
    
    32
    
              setClaims(data.claims)
    
    33
    
            }
    
    34
    
          })
    
    35
    
        })
    
    36
    
    37
    
        return () => subscription.unsubscribe()
    
    38
    
      }, [])
    
    39
    
    40
    
      return (
    
    41
    
        <IonApp>
    
    42
    
          <IonReactRouter>
    
    43
    
            <IonRouterOutlet>
    
    44
    
              <Route
    
    45
    
                exact
    
    46
    
                path="/"
    
    47
    
                render={() => {
    
    48
    
                  return claims ? <Redirect to="/account" /> : <LoginPage />
    
    49
    
                }}
    
    50
    
              />
    
    51
    
              <Route
    
    52
    
                exact
    
    53
    
                path="/account"
    
    54
    
                render={() => (claims ? <AccountPage /> : <Redirect to="/" />)}
    
    55
    
              />
    
    56
    
            </IonRouterOutlet>
    
    57
    
          </IonReactRouter>
    
    58
    
        </IonApp>
    
    59
    
      )
    
    60
    
    }
    
    61
    
    62
    
    export default App
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/App.tsx>)

Once that's done, run this in a terminal window:
[code] 
    1
    
    ionic serve
[/code]

Then open your browser to the URL printed by `ionic serve` (by default, <http://localhost:8100>[](<http://localhost:8100>)) and you should see the completed app.

![Supabase Ionic React](/docs/img/ionic-demos/ionic-react.png)

## Bonus: Profile photos#

Every Supabase project is configured with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

First install two packages in order to interact with the user's camera.
[code] 
    1
    
    npm install @ionic/pwa-elements @capacitor/camera
[/code]

[Capacitor](<https://capacitorjs.com>) is a cross platform native runtime from Ionic that enables web apps to be deployed through the app store and provides access to native device API.

Ionic PWA elements is a companion package that will polyfill certain browser APIs that provide no user interface with custom Ionic UI.

With those packages installed update `index.tsx` to include an additional bootstrapping call for the Ionic PWA Elements.

src/index.tsx
[code]
    1
    
    import React from 'react'
    
    2
    
    import { createRoot } from 'react-dom/client'
    
    3
    
    import App from './App'
    
    4
    
    import { defineCustomElements } from '@ionic/pwa-elements/loader'
    
    5
    
    6
    
    defineCustomElements(window)
    
    7
    
    8
    
    const container = document.getElementById('root')
    
    9
    
    const root = createRoot(container!)
    
    10
    
    root.render(
    
    11
    
      <React.StrictMode>
    
    12
    
        <App />
    
    13
    
      </React.StrictMode>
    
    14
    
    )
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/index.tsx>)

Then create an `AvatarComponent`.

src/components/Avatar.tsx
[code]
    1
    
    import { IonIcon } from '@ionic/react'
    
    2
    
    import { person } from 'ionicons/icons'
    
    3
    
    import { Camera, CameraResultType } from '@capacitor/camera'
    
    4
    
    import { useEffect, useState } from 'react'
    
    5
    
    import { supabase } from '../supabaseClient'
    
    6
    
    import './Avatar.css'
    
    7
    
    8
    
    export function Avatar({
    
    9
    
      url,
    
    10
    
      onUpload,
    
    11
    
    }: {
    
    12
    
      url: string
    
    13
    
      onUpload: (file: string) => Promise<void>
    
    14
    
    }) {
    
    15
    
      const [avatarUrl, setAvatarUrl] = useState<string | undefined>()
    
    16
    
    17
    
      useEffect(() => {
    
    18
    
        if (url) {
    
    19
    
          downloadImage(url)
    
    20
    
        }
    
    21
    
      }, [url])
    
    22
    
    23
    
      const uploadAvatar = async () => {
    
    24
    
        try {
    
    25
    
          const photo = await Camera.getPhoto({
    
    26
    
            resultType: CameraResultType.DataUrl,
    
    27
    
          })
    
    28
    
    29
    
          const file = await fetch(photo.dataUrl!)
    
    30
    
            .then((res) => res.blob())
    
    31
    
            .then((blob) => new File([blob], 'my-file', { type: `image/${photo.format}` }))
    
    32
    
    33
    
          const fileName = `${Math.random()}-${new Date().getTime()}.${photo.format}`
    
    34
    
          const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
    
    35
    
          if (uploadError) {
    
    36
    
            throw uploadError
    
    37
    
          }
    
    38
    
          await onUpload(fileName)
    
    39
    
        } catch (error) {
    
    40
    
          console.log(error)
    
    41
    
        }
    
    42
    
      }
    
    43
    
    44
    
      const downloadImage = async (path: string) => {
    
    45
    
        try {
    
    46
    
          const { data, error } = await supabase.storage.from('avatars').download(path)
    
    47
    
          if (error) {
    
    48
    
            throw error
    
    49
    
          }
    
    50
    
          const url = URL.createObjectURL(data)
    
    51
    
          setAvatarUrl(url)
    
    52
    
        } catch (error: any) {
    
    53
    
          console.log('Error downloading image: ', error.message)
    
    54
    
        }
    
    55
    
      }
    
    56
    
    57
    
      useEffect(() => {
    
    58
    
        return () => {
    
    59
    
          if (avatarUrl) {
    
    60
    
            URL.revokeObjectURL(avatarUrl)
    
    61
    
          }
    
    62
    
        }
    
    63
    
      }, [avatarUrl])
    
    64
    
    65
    
      return (
    
    66
    
        <div className="avatar">
    
    67
    
          <button type="button" className="avatar_wrapper" onClick={uploadAvatar}>
    
    68
    
            {avatarUrl ? (
    
    69
    
              <img src={avatarUrl} alt="User avatar" />
    
    70
    
            ) : (
    
    71
    
              <IonIcon icon={person} className="no-avatar" />
    
    72
    
            )}
    
    73
    
          </button>
    
    74
    
        </div>
    
    75
    
      )
    
    76
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/components/Avatar.tsx>)

### Add the new widget#

And then add the widget to the Account page:

src/pages/Account.tsx
[code]
    1
    
    import {
    
    2
    
      IonButton,
    
    3
    
      IonContent,
    
    4
    
      IonHeader,
    
    5
    
      IonInput,
    
    6
    
      IonItem,
    
    7
    
      IonLabel,
    
    8
    
      IonPage,
    
    9
    
      IonTitle,
    
    10
    
      IonToolbar,
    
    11
    
      useIonLoading,
    
    12
    
      useIonToast,
    
    13
    
      useIonRouter,
    
    14
    
    } from '@ionic/react'
    
    15
    
    import { useEffect, useState } from 'react'
    
    16
    
    import { Avatar } from '../components/Avatar'
    
    17
    
    import { supabase } from '../supabaseClient'
    
    18
    
    19
    
    export function AccountPage() {
    
    20
    
      const [showLoading, hideLoading] = useIonLoading()
    
    21
    
      const [showToast] = useIonToast()
    
    22
    
      const router = useIonRouter()
    
    23
    
      const [email, setEmail] = useState('')
    
    24
    
      const [profile, setProfile] = useState({
    
    25
    
        username: '',
    
    26
    
        website: '',
    
    27
    
        avatar_url: '',
    
    28
    
      })
    
    29
    
    30
    
      useEffect(() => {
    
    31
    
        getProfile()
    
    32
    
      }, [])
    
    33
    
    34
    
      const getProfile = async () => {
    
    35
    
        await showLoading()
    
    36
    
        try {
    
    37
    
          const { data: authData } = await supabase.auth.getClaims()
    
    38
    
          if (!authData?.claims) throw new Error('No user logged in')
    
    39
    
          const { claims } = authData
    
    40
    
    41
    
          setEmail(claims.email as string)
    
    42
    
    43
    
          const { data, error, status } = await supabase
    
    44
    
            .from('profiles')
    
    45
    
            .select(`username, website, avatar_url`)
    
    46
    
            .eq('id', claims.sub)
    
    47
    
            .single()
    
    48
    
    49
    
          if (error && status !== 406) {
    
    50
    
            throw error
    
    51
    
          }
    
    52
    
    53
    
          if (data) {
    
    54
    
            setProfile({
    
    55
    
              username: data.username,
    
    56
    
              website: data.website,
    
    57
    
              avatar_url: data.avatar_url,
    
    58
    
            })
    
    59
    
          }
    
    60
    
        } catch (error: any) {
    
    61
    
          showToast({ message: error.message, duration: 5000 })
    
    62
    
        } finally {
    
    63
    
          await hideLoading()
    
    64
    
        }
    
    65
    
      }
    
    66
    
    67
    
      const signOut = async () => {
    
    68
    
        await supabase.auth.signOut()
    
    69
    
        router.push('/', 'forward', 'replace')
    
    70
    
      }
    
    71
    
    72
    
      const updateProfile = async (e?: any, avatar_url?: string) => {
    
    73
    
        e?.preventDefault()
    
    74
    
    75
    
        await showLoading()
    
    76
    
    77
    
        try {
    
    78
    
          const { data } = await supabase.auth.getClaims()
    
    79
    
          if (!data?.claims) throw new Error('No user logged in')
    
    80
    
          const { claims } = data
    
    81
    
    82
    
          const updates = {
    
    83
    
            id: claims.sub,
    
    84
    
            ...profile,
    
    85
    
            ...(avatar_url !== undefined ? { avatar_url } : {}),
    
    86
    
            updated_at: new Date(),
    
    87
    
          }
    
    88
    
    89
    
          const { error } = await supabase.from('profiles').upsert(updates)
    
    90
    
    91
    
          if (error) {
    
    92
    
            throw error
    
    93
    
          }
    
    94
    
    95
    
          // Ensure local profile state reflects the updated avatar URL
    
    96
    
          if (avatar_url !== undefined) {
    
    97
    
            setProfile((prev) => ({
    
    98
    
              ...prev,
    
    99
    
              avatar_url,
    
    100
    
            }))
    
    101
    
          }
    
    102
    
    103
    
          if (avatar_url !== undefined) {
    
    104
    
            setProfile((current) => ({
    
    105
    
              ...current,
    
    106
    
              avatar_url,
    
    107
    
            }))
    
    108
    
          }
    
    109
    
        } catch (error: any) {
    
    110
    
          showToast({ message: error.message, duration: 5000 })
    
    111
    
        } finally {
    
    112
    
          await hideLoading()
    
    113
    
        }
    
    114
    
      }
    
    115
    
    116
    
      return (
    
    117
    
        <IonPage>
    
    118
    
          <IonHeader>
    
    119
    
            <IonToolbar>
    
    120
    
              <IonTitle>Account</IonTitle>
    
    121
    
            </IonToolbar>
    
    122
    
          </IonHeader>
    
    123
    
    124
    
          <IonContent>
    
    125
    
            <Avatar
    
    126
    
              url={profile.avatar_url}
    
    127
    
              onUpload={(fileName) => updateProfile(undefined, fileName)}
    
    128
    
            ></Avatar>
    
    129
    
            <form onSubmit={updateProfile}>
    
    130
    
              <IonItem>
    
    131
    
                <IonLabel>
    
    132
    
                  <p>Email</p>
    
    133
    
                  <p>{email}</p>
    
    134
    
                </IonLabel>
    
    135
    
              </IonItem>
    
    136
    
    137
    
              <IonItem>
    
    138
    
                <IonInput
    
    139
    
                  type="text"
    
    140
    
                  name="username"
    
    141
    
                  value={profile.username}
    
    142
    
                  onIonInput={(e) => setProfile({ ...profile, username: e.detail.value ?? '' })}
    
    143
    
                  label="Name"
    
    144
    
                  labelPlacement="stacked"
    
    145
    
                ></IonInput>
    
    146
    
              </IonItem>
    
    147
    
    148
    
              <IonItem>
    
    149
    
                <IonInput
    
    150
    
                  type="url"
    
    151
    
                  name="website"
    
    152
    
                  value={profile.website}
    
    153
    
                  onIonInput={(e) => setProfile({ ...profile, website: e.detail.value ?? '' })}
    
    154
    
                  label="Website"
    
    155
    
                  labelPlacement="stacked"
    
    156
    
                ></IonInput>
    
    157
    
              </IonItem>
    
    158
    
              <div className="ion-text-center">
    
    159
    
                <IonButton fill="clear" type="submit">
    
    160
    
                  Update Profile
    
    161
    
                </IonButton>
    
    162
    
              </div>
    
    163
    
            </form>
    
    164
    
    165
    
            <div className="ion-text-center">
    
    166
    
              <IonButton fill="clear" onClick={signOut}>
    
    167
    
                Log Out
    
    168
    
              </IonButton>
    
    169
    
            </div>
    
    170
    
          </IonContent>
    
    171
    
        </IonPage>
    
    172
    
      )
    
    173
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/ionic-react-user-management/src/pages/Account.tsx>)

At this stage you have a fully functional application!