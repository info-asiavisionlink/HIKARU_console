---
タイトル: Build a User Management App with Vue 3
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-vue-3
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, tutorials, user, vue, with, with-vue-3
---

# Build a User Management App with Vue 3

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-vue-3
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, tutorials, user, vue, with, with-vue-3

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Vue 3 app#](#initialize-a-vue-3-app)
  - [App styling (optional)#](#app-styling-optional)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the Account component#](#update-the-account-component)
  - [Launch!#](#launch)

## 概要

Learn how to use Supabase in your Vue 3 App.

---

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/vue3-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=vuejs>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start building the Vue 3 app from scratch.

### Initialize a Vue 3 app#

This guide uses [Vite with Vue 3 Template](<https://vitejs.dev/guide/#scaffolding-your-first-vite-project>) to initialize an app called `supabase-vue-3`:
[code] 
    1
    
    # npm 6.x
    
    2
    
    npm create vite@latest supabase-vue-3 --template vue
    
    3
    
    4
    
    # npm 7+, extra double-dash is needed:
    
    5
    
    npm create vite@latest supabase-vue-3 -- --template vue
    
    6
    
    7
    
    cd supabase-vue-3
[/code]

Then install the only additional dependency: [supabase-js](<https://github.com/supabase/supabase-js>)
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

And finally save the environment variables in a `.env` file, you need the API URL and the key that you copied earlier.

.env
[code]
    1
    
    VITE_SUPABASE_URL=YOUR_SUPABASE_URL
    
    2
    
    VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
[/code]

With the API credentials in place, create an `src/supabase.js` helper file to initialize the Supabase client. These variables are exposed on the browser, and that's fine since you have [Row Level Security](</docs/guides/auth#row-level-security>) enabled on the Database.

src/supabase.js
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
    
    export const supabase = createClient(supabaseUrl, supabasePublishableKey)
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/vue3-user-management/src/supabase.js>)

### App styling (optional)#

An optional step is to update the CSS file `src/style.css` to make the app look better. You can find the full contents of this file [in the example repository](<https://raw.githubusercontent.com/supabase/supabase/master/examples/user-management/vue3-user-management/src/style.css>).

### Set up a login component#

Set up an `src/components/Auth.vue` component to manage to add Magic Links as an option, so users can sign in with their email without using passwords.

src/components/Auth.vue
[code]
    1
    
    <script setup>
    
    2
    
    import { ref } from 'vue'
    
    3
    
    import { supabase } from '../supabase'
    
    4
    
    5
    
    const loading = ref(false)
    
    6
    
    const email = ref('')
    
    7
    
    8
    
    const handleLogin = async () => {
    
    9
    
        try {
    
    10
    
            loading.value = true
    
    11
    
            const { error } = await supabase.auth.signInWithOtp({ email: email.value })
    
    12
    
            if (error) throw error
    
    13
    
            alert('Check your email for the login link!')
    
    14
    
        } catch (error) {
    
    15
    
            if (error instanceof Error) {
    
    16
    
                alert(error.message)
    
    17
    
            }
    
    18
    
        } finally {
    
    19
    
            loading.value = false
    
    20
    
        }
    
    21
    
    }
    
    22
    
    </script>
    
    23
    
    24
    
    <template>
    
    25
    
        <form class="row flex-center flex" @submit.prevent="handleLogin">
    
    26
    
            <div class="col-6 form-widget">
    
    27
    
                <h1 class="header">Supabase + Vue 3</h1>
    
    28
    
                <p class="description">Sign in via magic link with your email below</p>
    
    29
    
                <div>
    
    30
    
                    <input class="inputField" type="email" placeholder="Your email" v-model="email" />
    
    31
    
                </div>
    
    32
    
                <div>
    
    33
    
                    <input type="submit" class="button block" :value="loading ? 'Loading' : 'Send magic link'"
    
    34
    
                        :disabled="loading" />
    
    35
    
                </div>
    
    36
    
            </div>
    
    37
    
        </form>
    
    38
    
    </template>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/vue3-user-management/src/components/Auth.vue>)

### Account page#

After a user signs in, allow them to edit their profile details and manage their account. Create a new `src/components/Account.vue` component to handle this.

src/components/Account.vue
[code]
    1
    
    <script setup>
    
    2
    
    import { supabase } from '../supabase'
    
    3
    
    import { onMounted, ref, toRefs } from 'vue'
    
    4
    
    5
    
    // ...
    
    6
    
    7
    
    8
    
    const props = defineProps(['claims'])
    
    9
    
    const { claims } = toRefs(props)
    
    10
    
    11
    
    const loading = ref(true)
    
    12
    
    const username = ref('')
    
    13
    
    const website = ref('')
    
    14
    
    const avatar_url = ref('')
    
    15
    
    16
    
    onMounted(() => {
    
    17
    
        getProfile()
    
    18
    
    })
    
    19
    
    20
    
    async function getProfile() {
    
    21
    
        try {
    
    22
    
            loading.value = true
    
    23
    
            let { data, error, status } = await supabase
    
    24
    
                .from('profiles')
    
    25
    
                .select(`username, website, avatar_url`)
    
    26
    
                .eq('id', claims.value.sub)
    
    27
    
                .single()
    
    28
    
    29
    
            if (error && status !== 406) throw error
    
    30
    
    31
    
            if (data) {
    
    32
    
                username.value = data.username
    
    33
    
                website.value = data.website
    
    34
    
                avatar_url.value = data.avatar_url
    
    35
    
            }
    
    36
    
        } catch (error) {
    
    37
    
            alert(error.message)
    
    38
    
        } finally {
    
    39
    
            loading.value = false
    
    40
    
        }
    
    41
    
    }
    
    42
    
    43
    
    async function updateProfile() {
    
    44
    
        try {
    
    45
    
            loading.value = true
    
    46
    
            const updates = {
    
    47
    
                id: claims.value.sub,
    
    48
    
                username: username.value,
    
    49
    
                website: website.value,
    
    50
    
                avatar_url: avatar_url.value,
    
    51
    
                updated_at: new Date(),
    
    52
    
            }
    
    53
    
    54
    
            let { error } = await supabase.from('profiles').upsert(updates)
    
    55
    
    56
    
            if (error) throw error
    
    57
    
        } catch (error) {
    
    58
    
            alert(error.message)
    
    59
    
        } finally {
    
    60
    
            loading.value = false
    
    61
    
        }
    
    62
    
    }
    
    63
    
    64
    
    async function signOut() {
    
    65
    
        try {
    
    66
    
            loading.value = true
    
    67
    
            let { error } = await supabase.auth.signOut()
    
    68
    
            if (error) throw error
    
    69
    
        } catch (error) {
    
    70
    
            alert(error.message)
    
    71
    
        } finally {
    
    72
    
            loading.value = false
    
    73
    
        }
    
    74
    
    }
    
    75
    
    </script>
    
    76
    
    77
    
    <template>
    
    78
    
        <form class="form-widget" @submit.prevent="updateProfile">
    
    79
    
    80
    
            // ...
    
    81
    
    82
    
            <div>
    
    83
    
                <label for="email">Email</label>
    
    84
    
                <input id="email" type="text" :value="claims.email" disabled />
    
    85
    
            </div>
    
    86
    
            <div>
    
    87
    
                <label for="username">Name</label>
    
    88
    
                <input id="username" type="text" v-model="username" />
    
    89
    
            </div>
    
    90
    
            <div>
    
    91
    
                <label for="website">Website</label>
    
    92
    
                <input id="website" type="url" v-model="website" />
    
    93
    
            </div>
    
    94
    
    95
    
            <div>
    
    96
    
                <input type="submit" class="button primary block" :value="loading ? 'Loading ...' : 'Update'"
    
    97
    
                    :disabled="loading" />
    
    98
    
            </div>
    
    99
    
    100
    
            <div>
    
    101
    
                <button class="button block" @click="signOut" :disabled="loading">
    
    102
    
                    Sign Out
    
    103
    
                </button>
    
    104
    
            </div>
    
    105
    
        </form>
    
    106
    
    </template>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/vue3-user-management/src/components/Account.vue>)

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Create a new `src/components/Avatar.vue` component that allows users to upload profile photos:

src/components/Avatar.vue
[code]
    1
    
    <script setup>
    
    2
    
    import { ref, toRefs, watch } from 'vue'
    
    3
    
    import { supabase } from '../supabase'
    
    4
    
    5
    
    const prop = defineProps(['path', 'size'])
    
    6
    
    const { path, size } = toRefs(prop)
    
    7
    
    8
    
    const emit = defineEmits(['upload', 'update:path'])
    
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
    
            const { data, error } = await supabase.storage
    
    16
    
                .from('avatars')
    
    17
    
                .download(path.value)
    
    18
    
            if (error) throw error
    
    19
    
            src.value = URL.createObjectURL(data)
    
    20
    
        } catch (error) {
    
    21
    
            console.error('Error downloading image: ', error.message)
    
    22
    
        }
    
    23
    
    }
    
    24
    
    25
    
    const uploadAvatar = async (evt) => {
    
    26
    
        files.value = evt.target.files
    
    27
    
        try {
    
    28
    
            uploading.value = true
    
    29
    
            if (!files.value || files.value.length === 0) {
    
    30
    
                throw new Error('You must select an image to upload.')
    
    31
    
            }
    
    32
    
    33
    
            const file = files.value[0]
    
    34
    
            const fileExt = file.name.split('.').pop()
    
    35
    
            const filePath = `${Math.random()}.${fileExt}`
    
    36
    
    37
    
            let { error: uploadError } = await supabase.storage
    
    38
    
                .from('avatars')
    
    39
    
                .upload(filePath, file)
    
    40
    
    41
    
            if (uploadError) throw uploadError
    
    42
    
            emit('update:path', filePath)
    
    43
    
            emit('upload')
    
    44
    
        } catch (error) {
    
    45
    
            alert(error.message)
    
    46
    
        } finally {
    
    47
    
            uploading.value = false
    
    48
    
        }
    
    49
    
    }
    
    50
    
    51
    
    watch(path, () => {
    
    52
    
        if (path.value) downloadImage()
    
    53
    
    })
    
    54
    
    </script>
    
    55
    
    56
    
    <template>
    
    57
    
        <div>
    
    58
    
            <img v-if="src" :src="src" alt="Avatar" class="avatar image"
    
    59
    
                :style="{ height: size + 'em', width: size + 'em' }" />
    
    60
    
            <div v-else class="avatar no-image" :style="{ height: size + 'em', width: size + 'em' }" />
    
    61
    
    62
    
            <div :style="{ width: size + 'em' }">
    
    63
    
                <label class="button primary block" for="single">
    
    64
    
                    {{ uploading ? "Uploading ..." : "Upload" }}
    
    65
    
                </label>
    
    66
    
                <input style="visibility: hidden; position: absolute" type="file" id="single" accept="image/*"
    
    67
    
                    @change="uploadAvatar" :disabled="uploading" />
    
    68
    
            </div>
    
    69
    
        </div>
    
    70
    
    </template>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/vue3-user-management/src/components/Avatar.vue>)

### Update the Account component#

With the Avatar component created, update `src/components/Account.vue` to include it:

src/components/Account.vue
[code]
    1
    
    <script setup>
    
    2
    
    import { supabase } from '../supabase'
    
    3
    
    import { onMounted, ref, toRefs } from 'vue'
    
    4
    
    import Avatar from './Avatar.vue';
    
    5
    
    6
    
    const props = defineProps(['claims'])
    
    7
    
    const { claims } = toRefs(props)
    
    8
    
    9
    
    const loading = ref(true)
    
    10
    
    const username = ref('')
    
    11
    
    const website = ref('')
    
    12
    
    const avatar_url = ref('')
    
    13
    
    14
    
    onMounted(() => {
    
    15
    
        getProfile()
    
    16
    
    })
    
    17
    
    18
    
    async function getProfile() {
    
    19
    
        try {
    
    20
    
            loading.value = true
    
    21
    
            let { data, error, status } = await supabase
    
    22
    
                .from('profiles')
    
    23
    
                .select(`username, website, avatar_url`)
    
    24
    
                .eq('id', claims.value.sub)
    
    25
    
                .single()
    
    26
    
    27
    
            if (error && status !== 406) throw error
    
    28
    
    29
    
            if (data) {
    
    30
    
                username.value = data.username
    
    31
    
                website.value = data.website
    
    32
    
                avatar_url.value = data.avatar_url
    
    33
    
            }
    
    34
    
        } catch (error) {
    
    35
    
            alert(error.message)
    
    36
    
        } finally {
    
    37
    
            loading.value = false
    
    38
    
        }
    
    39
    
    }
    
    40
    
    41
    
    async function updateProfile() {
    
    42
    
        try {
    
    43
    
            loading.value = true
    
    44
    
            const updates = {
    
    45
    
                id: claims.value.sub,
    
    46
    
                username: username.value,
    
    47
    
                website: website.value,
    
    48
    
                avatar_url: avatar_url.value,
    
    49
    
                updated_at: new Date(),
    
    50
    
            }
    
    51
    
    52
    
            let { error } = await supabase.from('profiles').upsert(updates)
    
    53
    
    54
    
            if (error) throw error
    
    55
    
        } catch (error) {
    
    56
    
            alert(error.message)
    
    57
    
        } finally {
    
    58
    
            loading.value = false
    
    59
    
        }
    
    60
    
    }
    
    61
    
    62
    
    async function signOut() {
    
    63
    
        try {
    
    64
    
            loading.value = true
    
    65
    
            let { error } = await supabase.auth.signOut()
    
    66
    
            if (error) throw error
    
    67
    
        } catch (error) {
    
    68
    
            alert(error.message)
    
    69
    
        } finally {
    
    70
    
            loading.value = false
    
    71
    
        }
    
    72
    
    }
    
    73
    
    </script>
    
    74
    
    75
    
    <template>
    
    76
    
        <form class="form-widget" @submit.prevent="updateProfile">
    
    77
    
            <Avatar v-model:path="avatar_url" @upload="updateProfile" size="10" />
    
    78
    
            <div>
    
    79
    
                <label for="email">Email</label>
    
    80
    
                <input id="email" type="text" :value="claims.email" disabled />
    
    81
    
            </div>
    
    82
    
            <div>
    
    83
    
                <label for="username">Name</label>
    
    84
    
                <input id="username" type="text" v-model="username" />
    
    85
    
            </div>
    
    86
    
            <div>
    
    87
    
                <label for="website">Website</label>
    
    88
    
                <input id="website" type="url" v-model="website" />
    
    89
    
            </div>
    
    90
    
    91
    
            <div>
    
    92
    
                <input type="submit" class="button primary block" :value="loading ? 'Loading ...' : 'Update'"
    
    93
    
                    :disabled="loading" />
    
    94
    
            </div>
    
    95
    
    96
    
            <div>
    
    97
    
                <button class="button block" @click="signOut" :disabled="loading">
    
    98
    
                    Sign Out
    
    99
    
                </button>
    
    100
    
            </div>
    
    101
    
        </form>
    
    102
    
    </template>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/vue3-user-management/src/components/Account.vue>)

### Launch!#

With all the components in place, update `App.vue`:

src/App.vue
[code]
    1
    
    <script setup>
    
    2
    
    import { onMounted, ref } from 'vue'
    
    3
    
    import Account from './components/Account.vue'
    
    4
    
    import Auth from './components/Auth.vue'
    
    5
    
    import { supabase } from './supabase'
    
    6
    
    7
    
    const claims = ref()
    
    8
    
    9
    
    onMounted(() => {
    
    10
    
      supabase.auth.getClaims().then(({ data }) => {
    
    11
    
        claims.value = data.claims
    
    12
    
      })
    
    13
    
    14
    
      supabase.auth.onAuthStateChange(async () => {
    
    15
    
        const { data } = await supabase.auth.getClaims()
    
    16
    
        claims.value = data.claims
    
    17
    
      })
    
    18
    
    })
    
    19
    
    </script>
    
    20
    
    21
    
    <template>
    
    22
    
      <div class="container" style="padding: 50px 0 100px 0">
    
    23
    
        <Account v-if="claims" :claims="claims" />
    
    24
    
        <Auth v-else />
    
    25
    
      </div>
    
    26
    
    </template>
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/vue3-user-management/src/App.vue>)

Once that's done, run this in a terminal window:
[code] 
    1
    
    npm run dev
[/code]

And then open the browser to [localhost:5173](<http://localhost:5173>) and you should see the completed app.

![Supabase Vue 3](/docs/img/supabase-vue-3-demo.png)

At this stage you have a fully functional application!