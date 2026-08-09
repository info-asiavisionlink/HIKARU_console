---
タイトル: Build a User Management App with Nuxt 3
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-nuxt-3
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, nuxt, tutorials, user, with, with-nuxt-3
---

# Build a User Management App with Nuxt 3

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-nuxt-3
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, nuxt, tutorials, user, with, with-nuxt-3

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Nuxt 3 app#](#initialize-a-nuxt-3-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Set up Auth component#](#set-up-auth-component)
  - [User state#](#user-state)
  - [Account component#](#account-component)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Launch!#](#launch)
- [Add a server route#](#add-a-server-route)

## 概要

Learn how to use Supabase in your Nuxt 3 App.

---

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/nuxt3-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=nuxt>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Build the Vue 3 app from scratch.

### Initialize a Nuxt 3 app#

We can use [`nuxi init`](<https://nuxt.com/docs/getting-started/installation>) to create an app called `nuxt-user-management`:
[code] 
    1
    
    npx nuxi init nuxt-user-management
    
    2
    
    3
    
    cd nuxt-user-management
[/code]

Then install the only additional dependency: [Nuxt Supabase](<https://supabase.nuxtjs.org/>). We only need to import Nuxt Supabase as a dev dependency.
[code] 
    1
    
    npm install @nuxtjs/supabase --save-dev
[/code]

And finally we want to save the environment variables in a `.env`. All we need are the API URL and the key that you copied earlier.

.env
[code]
    1
    
    SUPABASE_URL="YOUR_SUPABASE_URL"
    
    2
    
    SUPABASE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
[/code]

These variables will be exposed on the browser, and that's completely fine since we have [Row Level Security](</docs/guides/auth#row-level-security>) enabled on our Database. Amazing thing about [Nuxt Supabase](<https://supabase.nuxtjs.org/>) is that setting environment variables is all we need to do in order to start using Supabase. No need to initialize Supabase. The library will take care of it automatically.

### App styling (optional)#

An optional step is to update the CSS file `assets/main.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://github.com/supabase-community/nuxt3-quickstarter/blob/main/assets/main.css>).

nuxt.config.ts
[code]
    1
    
    import { defineNuxtConfig } from 'nuxt'
    
    2
    
    3
    
    // https://v3.nuxtjs.org/api/configuration/nuxt.config
    
    4
    
    export default defineNuxtConfig({
    
    5
    
      modules: ['@nuxtjs/supabase'],
    
    6
    
      css: ['@/assets/main.css'],
    
    7
    
    })
[/code]

### Set up Auth component#

Set up a Vue component to manage logins and sign ups. We'll use Magic Links, so users can sign in with their email without using passwords.

/components/Auth.vue
[code]
    1
    
    <script setup>
    
    2
    
    const supabase = useSupabaseClient()
    
    3
    
    4
    
    const loading = ref(false)
    
    5
    
    const email = ref('')
    
    6
    
    7
    
    const handleLogin = async () => {
    
    8
    
      try {
    
    9
    
        loading.value = true
    
    10
    
        const { error } = await supabase.auth.signInWithOtp({ email: email.value })
    
    11
    
        if (error) throw error
    
    12
    
        alert('Check your email for the login link!')
    
    13
    
      } catch (error) {
    
    14
    
        alert(error.error_description || error.message)
    
    15
    
      } finally {
    
    16
    
        loading.value = false
    
    17
    
      }
    
    18
    
    }
    
    19
    
    </script>
    
    20
    
    21
    
    <template>
    
    22
    
      <form class="row flex-center flex" @submit.prevent="handleLogin">
    
    23
    
        <div class="col-6 form-widget">
    
    24
    
          <h1 class="header">Supabase + Nuxt 3</h1>
    
    25
    
          <p class="description">Sign in via magic link with your email below</p>
    
    26
    
          <div>
    
    27
    
            <input class="inputField" type="email" placeholder="Your email" v-model="email" />
    
    28
    
          </div>
    
    29
    
          <div>
    
    30
    
            <input
    
    31
    
              type="submit"
    
    32
    
              class="button block"
    
    33
    
              :value="loading ? 'Loading' : 'Send magic link'"
    
    34
    
              :disabled="loading"
    
    35
    
            />
    
    36
    
          </div>
    
    37
    
        </div>
    
    38
    
      </form>
    
    39
    
    </template>
[/code]

### User state#

To access the user information, use the composable [`useSupabaseUser`](<https://supabase.nuxtjs.org/composables/usesupabaseuser>) provided by the Supabase Nuxt module.

### Account component#

After a user is signed in we can allow them to edit their profile details and manage their account. Create a new component called `Account.vue`.

components/Account.vue
[code]
    1
    
    <script setup>
    
    2
    
    const supabase = useSupabaseClient()
    
    3
    
    4
    
    const loading = ref(true)
    
    5
    
    const username = ref('')
    
    6
    
    const website = ref('')
    
    7
    
    const avatar_path = ref('')
    
    8
    
    9
    
    loading.value = true
    
    10
    
    const user = useSupabaseUser()
    
    11
    
    12
    
    const { data } = await supabase
    
    13
    
      .from('profiles')
    
    14
    
      .select(`username, website, avatar_url`)
    
    15
    
      .eq('id', user.value.id)
    
    16
    
      .single()
    
    17
    
    18
    
    if (data) {
    
    19
    
      username.value = data.username
    
    20
    
      website.value = data.website
    
    21
    
      avatar_path.value = data.avatar_url
    
    22
    
    }
    
    23
    
    24
    
    loading.value = false
    
    25
    
    26
    
    async function updateProfile() {
    
    27
    
      try {
    
    28
    
        loading.value = true
    
    29
    
        const user = useSupabaseUser()
    
    30
    
    31
    
        const updates = {
    
    32
    
          id: user.value.id,
    
    33
    
          username: username.value,
    
    34
    
          website: website.value,
    
    35
    
          avatar_url: avatar_path.value,
    
    36
    
          updated_at: new Date(),
    
    37
    
        }
    
    38
    
    39
    
        const { error } = await supabase.from('profiles').upsert(updates, {
    
    40
    
          returning: 'minimal', // Don't return the value after inserting
    
    41
    
        })
    
    42
    
        if (error) throw error
    
    43
    
      } catch (error) {
    
    44
    
        alert(error.message)
    
    45
    
      } finally {
    
    46
    
        loading.value = false
    
    47
    
      }
    
    48
    
    }
    
    49
    
    50
    
    async function signOut() {
    
    51
    
      try {
    
    52
    
        loading.value = true
    
    53
    
        const { error } = await supabase.auth.signOut()
    
    54
    
        if (error) throw error
    
    55
    
        user.value = null
    
    56
    
      } catch (error) {
    
    57
    
        alert(error.message)
    
    58
    
      } finally {
    
    59
    
        loading.value = false
    
    60
    
      }
    
    61
    
    }
    
    62
    
    </script>
    
    63
    
    64
    
    <template>
    
    65
    
      <form class="form-widget" @submit.prevent="updateProfile">
    
    66
    
        <div>
    
    67
    
          <label for="email">Email</label>
    
    68
    
          <input id="email" type="text" :value="user.email" disabled />
    
    69
    
        </div>
    
    70
    
        <div>
    
    71
    
          <label for="username">Username</label>
    
    72
    
          <input id="username" type="text" v-model="username" />
    
    73
    
        </div>
    
    74
    
        <div>
    
    75
    
          <label for="website">Website</label>
    
    76
    
          <input id="website" type="url" v-model="website" />
    
    77
    
        </div>
    
    78
    
    79
    
        <div>
    
    80
    
          <input
    
    81
    
            type="submit"
    
    82
    
            class="button primary block"
    
    83
    
            :value="loading ? 'Loading ...' : 'Update'"
    
    84
    
            :disabled="loading"
    
    85
    
          />
    
    86
    
        </div>
    
    87
    
    88
    
        <div>
    
    89
    
          <button class="button block" @click="signOut" :disabled="loading">Sign Out</button>
    
    90
    
        </div>
    
    91
    
      </form>
    
    92
    
    </template>
[/code]

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Start by creating a new component:

components/Avatar.vue
[code]
    1
    
    <script setup>
    
    2
    
    const props = defineProps(['path'])
    
    3
    
    const { path } = toRefs(props)
    
    4
    
    5
    
    const emit = defineEmits(['update:path', 'upload'])
    
    6
    
    7
    
    const supabase = useSupabaseClient()
    
    8
    
    9
    
    const uploading = ref(false)
    
    10
    
    const src = ref('')
    
    11
    
    const files = ref()
    
    12
    
    13
    
    const downloadImage = async () => {
    
    14
    
      try {
    
    15
    
        const { data, error } = await supabase.storage.from('avatars').download(path.value)
    
    16
    
        if (error) throw error
    
    17
    
        src.value = URL.createObjectURL(data)
    
    18
    
      } catch (error) {
    
    19
    
        console.error('Error downloading image: ', error.message)
    
    20
    
      }
    
    21
    
    }
    
    22
    
    23
    
    const uploadAvatar = async (evt) => {
    
    24
    
      files.value = evt.target.files
    
    25
    
      try {
    
    26
    
        uploading.value = true
    
    27
    
    28
    
        if (!files.value || files.value.length === 0) {
    
    29
    
          throw new Error('You must select an image to upload.')
    
    30
    
        }
    
    31
    
    32
    
        const file = files.value[0]
    
    33
    
        const fileExt = file.name.split('.').pop()
    
    34
    
        const fileName = `${Math.random()}.${fileExt}`
    
    35
    
        const filePath = `${fileName}`
    
    36
    
    37
    
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    
    38
    
    39
    
        if (uploadError) throw uploadError
    
    40
    
    41
    
        emit('update:path', filePath)
    
    42
    
        emit('upload')
    
    43
    
      } catch (error) {
    
    44
    
        alert(error.message)
    
    45
    
      } finally {
    
    46
    
        uploading.value = false
    
    47
    
      }
    
    48
    
    }
    
    49
    
    50
    
    downloadImage()
    
    51
    
    52
    
    watch(path, () => {
    
    53
    
      if (path.value) {
    
    54
    
        downloadImage()
    
    55
    
      }
    
    56
    
    })
    
    57
    
    </script>
    
    58
    
    59
    
    <template>
    
    60
    
      <div>
    
    61
    
        <img
    
    62
    
          v-if="src"
    
    63
    
          :src="src"
    
    64
    
          alt="Avatar"
    
    65
    
          class="avatar image"
    
    66
    
          style="width: 10em; height: 10em;"
    
    67
    
        />
    
    68
    
        <div v-else class="avatar no-image" :style="{ height: size, width: size }" />
    
    69
    
    70
    
        <div style="width: 10em; position: relative;">
    
    71
    
          <label class="button primary block" for="single">
    
    72
    
            {{ uploading ? 'Uploading ...' : 'Upload' }}
    
    73
    
          </label>
    
    74
    
          <input
    
    75
    
            style="position: absolute; visibility: hidden;"
    
    76
    
            type="file"
    
    77
    
            id="single"
    
    78
    
            accept="image/*"
    
    79
    
            @change="uploadAvatar"
    
    80
    
            :disabled="uploading"
    
    81
    
          />
    
    82
    
        </div>
    
    83
    
      </div>
    
    84
    
    </template>
[/code]

### Launch!#

With all the components in place, update `app.vue`:

app.vue
[code]
    1
    
    <script setup>
    
    2
    
    const user = useSupabaseUser()
    
    3
    
    </script>
    
    4
    
    5
    
    <template>
    
    6
    
      <div class="container" style="padding: 50px 0 100px 0">
    
    7
    
        <Account v-if="user" />
    
    8
    
        <Auth v-else />
    
    9
    
      </div>
    
    10
    
    </template>
[/code]

Once that's done, run this in a terminal window:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:3000](<http://localhost:3000>) and you should see the completed app.

![Supabase Nuxt 3](/docs/img/supabase-vue-3-demo.png)

At this stage you have a fully functional application!

## Add a server route#

So far the app authenticates the user on the client. For protected API endpoints or server-rendered data, you need a server route that verifies the session.

[`@supabase/server`](<https://supabase.github.io/server/>) handles the full flow through a single middleware: it validates the JWT locally (using your project's asymmetric signing keys, no round-trip to the Auth server), attaches an RLS-scoped Supabase client and the user's claims to the request, and rejects unauthenticated requests with a 401 before your handler runs.
[code] 
    1
    
    npm install @supabase/server
[/code]

server/api/profile.get.ts
[code]
    1
    
    import { withSupabase } from '@supabase/server/adapters/h3'
    
    2
    
    import { defineHandler } from 'h3'
    
    3
    
    4
    
    export default defineHandler({
    
    5
    
      middleware: [withSupabase({ auth: 'user' })],
    
    6
    
      handler: async (event) => {
    
    7
    
        const { supabase, userClaims } = event.context.supabaseContext
    
    8
    
    9
    
        const { data, error } = await supabase
    
    10
    
          .from('profiles')
    
    11
    
          .select('username, website, avatar_url')
    
    12
    
          .eq('id', userClaims.id)
    
    13
    
          .single()
    
    14
    
    15
    
        if (error) {
    
    16
    
          throw createError({ statusCode: 500, statusMessage: error.message })
    
    17
    
        }
    
    18
    
    19
    
        return data
    
    20
    
      },
    
    21
    
    })
[/code]

For an unauthenticated route, pass `auth: 'none'`. For app-wide auth, register `withSupabase({ auth: 'user' })` as a Nuxt server middleware at `server/middleware/supabase.ts` instead. See the [h3/Nuxt adapter docs](<https://supabase.github.io/server/adapters/h3>) for typing, route overrides, and the full API.