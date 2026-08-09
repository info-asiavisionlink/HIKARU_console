---
タイトル: Build a User Management App with Angular
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-angular
カテゴリ: getting-started
更新日: 2026-08-02
タグ: angular, build, getting-started, management, tutorials, user, with, with-angular
---

# Build a User Management App with Angular

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-angular
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** angular, build, getting-started, management, tutorials, user, with, with-angular

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize an Angular app#](#initialize-an-angular-app)
  - [Set up a login component#](#set-up-a-login-component)
  - [Account page#](#account-page)
- [Profile photos#](#profile-photos)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Update the Account component#](#update-the-account-component)
  - [Launch!#](#launch)
  - [Summary of the methods#](#summary-of-the-methods)

## 概要

Learn how to use Supabase in your Angular App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/user-management-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/angular-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=ionicangular>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Start with building the Angular app from scratch.

### Initialize an Angular app#

Use the [Angular CLI](<https://angular.io/cli>) to initialize an app called `supabase-angular` setting some defaults that you can change to suit your needs:
[code] 
    1
    
    npx ng new supabase-angular --routing false --style css --standalone false --ssr false
    
    2
    
    cd supabase-angular
[/code]

Install [supabase-js](<https://github.com/supabase/supabase-js>):
[code] 
    1
    
    npm install @supabase/supabase-js
[/code]

Create a `src/environments` directory and save API URL and key that you copied earlier as environment variables in a new `src/environments/environment.ts` file.

The application exposes these variables in the browser, and that's fine as Supabase enables [Row Level Security](</docs/guides/database/postgres/row-level-security>) by default on all tables.

src/environments/environment.ts
[code]
    1
    
    export const environment = {
    
    2
    
      production: false,
    
    3
    
      supabaseUrl: 'YOUR_SUPABASE_URL',
    
    4
    
      supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    
    5
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/environments/environment.ts>)

With the API credentials in place, create a `SupabaseService` with `ng g s supabase` and add the following code to initialize the Supabase client and implement functions to communicate with the Supabase API.

src/app/supabase.service.ts
[code]
    1
    
    import { Injectable } from '@angular/core'
    
    2
    
    import { AuthChangeEvent, createClient, Session, SupabaseClient, User } from '@supabase/supabase-js'
    
    3
    
    import { environment } from '../environments/environment'
    
    4
    
    5
    
    export interface Profile {
    
    6
    
      id?: string
    
    7
    
      username: string
    
    8
    
      website: string
    
    9
    
      avatar_url: string
    
    10
    
    }
    
    11
    
    12
    
    @Injectable({
    
    13
    
      providedIn: 'root',
    
    14
    
    })
    
    15
    
    export class SupabaseService {
    
    16
    
      private supabase: SupabaseClient
    
    17
    
    18
    
      constructor() {
    
    19
    
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey)
    
    20
    
      }
    
    21
    
    22
    
      async getUser(): Promise<User | null> {
    
    23
    
        const { data, error } = await this.supabase.auth.getUser()
    
    24
    
        if (error) {
    
    25
    
          return null
    
    26
    
        }
    
    27
    
        return data.user
    
    28
    
      }
    
    29
    
    30
    
      profile(user: User) {
    
    31
    
        return this.supabase
    
    32
    
          .from('profiles')
    
    33
    
          .select(`username, website, avatar_url`)
    
    34
    
          .eq('id', user.id)
    
    35
    
          .single()
    
    36
    
      }
    
    37
    
    38
    
      authChanges(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    
    39
    
        return this.supabase.auth.onAuthStateChange(callback)
    
    40
    
      }
    
    41
    
    42
    
      signIn(email: string) {
    
    43
    
        return this.supabase.auth.signInWithOtp({ email })
    
    44
    
      }
    
    45
    
    46
    
      signOut() {
    
    47
    
        return this.supabase.auth.signOut()
    
    48
    
      }
    
    49
    
    50
    
      updateProfile(profile: Profile) {
    
    51
    
        const update = {
    
    52
    
          ...profile,
    
    53
    
          updated_at: new Date(),
    
    54
    
        }
    
    55
    
    56
    
        return this.supabase.from('profiles').upsert(update)
    
    57
    
      }
    
    58
    
    59
    
      downLoadImage(path: string) {
    
    60
    
        return this.supabase.storage.from('avatars').download(path)
    
    61
    
      }
    
    62
    
    63
    
      uploadAvatar(filePath: string, file: File) {
    
    64
    
        return this.supabase.storage.from('avatars').upload(filePath, file)
    
    65
    
      }
    
    66
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/supabase.service.ts>)

Optionally, update `src/styles.css` to style the app. You can find the full contents of this file [in the example repository](<https://github.com/supabase/supabase/tree/master/examples/user-management/angular-user-management/src/styles.css>).

### Set up a login component#

You need an Angular component to manage logins and sign ups. The component uses [Magic Links](</docs/guides/auth/auth-email-passwordless#with-magic-link>), so users can sign in with their email without using passwords.

Did you know?

You can customize other emails sent out to new users, including the email's looks, content, and query parameters from [the **Authentication > Email**](</dashboard/project/_/auth/templates>) section of the Dashboard.

Create an `AuthComponent` with the `ng g c auth` Angular CLI command and add the following code.

src/app/auth/auth.component.tssrc/app/auth/auth.component.html
[code]
    1
    
    import { Component } from '@angular/core'
    
    2
    
    import { FormBuilder, FormGroup } from '@angular/forms'
    
    3
    
    import { SupabaseService } from '../supabase.service'
    
    4
    
    5
    
    @Component({
    
    6
    
      selector: 'app-auth',
    
    7
    
      templateUrl: './auth.component.html',
    
    8
    
      styleUrls: ['./auth.component.css'],
    
    9
    
      standalone: false,
    
    10
    
    })
    
    11
    
    export class AuthComponent {
    
    12
    
      loading = false
    
    13
    
      signInForm: FormGroup
    
    14
    
    15
    
      constructor(
    
    16
    
        private readonly supabase: SupabaseService,
    
    17
    
        private readonly formBuilder: FormBuilder
    
    18
    
      ) {
    
    19
    
        this.signInForm = this.formBuilder.group({
    
    20
    
          email: '',
    
    21
    
        })
    
    22
    
      }
    
    23
    
    24
    
      async onSubmit(): Promise<void> {
    
    25
    
        try {
    
    26
    
          this.loading = true
    
    27
    
          const email = this.signInForm.value.email as string
    
    28
    
          const { error } = await this.supabase.signIn(email)
    
    29
    
          if (error) throw error
    
    30
    
          alert('Check your email for the login link!')
    
    31
    
        } catch (error) {
    
    32
    
          if (error instanceof Error) {
    
    33
    
            alert(error.message)
    
    34
    
          }
    
    35
    
        } finally {
    
    36
    
          this.signInForm.reset()
    
    37
    
          this.loading = false
    
    38
    
        }
    
    39
    
      }
    
    40
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/auth/auth.component.ts>)

### Account page#

Users also need a way to edit their profile details and manage their accounts after signing in. Create an `AccountComponent` with the `ng g c account` Angular CLI command and add the following code.

src/app/account/account.component.tssrc/app/account/account.component.html
[code]
    1
    
    import { Component, Input, OnInit } from '@angular/core'
    
    2
    
    import { FormBuilder, FormGroup } from '@angular/forms'
    
    3
    
    import { User } from '@supabase/supabase-js'
    
    4
    
    import { Profile, SupabaseService } from '../supabase.service'
    
    5
    
    6
    
    @Component({
    
    7
    
      selector: 'app-account',
    
    8
    
      templateUrl: './account.component.html',
    
    9
    
      styleUrls: ['./account.component.css'],
    
    10
    
      standalone: false,
    
    11
    
    })
    
    12
    
    export class AccountComponent implements OnInit {
    
    13
    
      loading = false
    
    14
    
      profile!: Profile
    
    15
    
      updateProfileForm!: FormGroup
    
    16
    
    17
    
    18
    
    // ...
    
    19
    
    20
    
    21
    
      @Input()
    
    22
    
      user!: User
    
    23
    
    24
    
      constructor(
    
    25
    
        private readonly supabase: SupabaseService,
    
    26
    
        private formBuilder: FormBuilder
    
    27
    
      ) {
    
    28
    
        this.updateProfileForm = this.formBuilder.group({
    
    29
    
          username: '',
    
    30
    
          website: '',
    
    31
    
          avatar_url: '',
    
    32
    
        })
    
    33
    
      }
    
    34
    
    35
    
      async ngOnInit(): Promise<void> {
    
    36
    
        await this.getProfile()
    
    37
    
    38
    
        const { username, website, avatar_url } = this.profile
    
    39
    
        this.updateProfileForm.patchValue({
    
    40
    
          username,
    
    41
    
          website,
    
    42
    
          avatar_url,
    
    43
    
        })
    
    44
    
      }
    
    45
    
    46
    
      async getProfile() {
    
    47
    
        try {
    
    48
    
          this.loading = true
    
    49
    
          const { data: profile, error, status } = await this.supabase.profile(this.user)
    
    50
    
    51
    
          if (error && status !== 406) {
    
    52
    
            throw error
    
    53
    
          }
    
    54
    
    55
    
          if (profile) {
    
    56
    
            this.profile = profile
    
    57
    
          }
    
    58
    
        } catch (error) {
    
    59
    
          if (error instanceof Error) {
    
    60
    
            alert(error.message)
    
    61
    
          }
    
    62
    
        } finally {
    
    63
    
          this.loading = false
    
    64
    
        }
    
    65
    
      }
    
    66
    
    67
    
      async updateProfile(): Promise<void> {
    
    68
    
        try {
    
    69
    
          this.loading = true
    
    70
    
    71
    
          const username = this.updateProfileForm.value.username as string
    
    72
    
          const website = this.updateProfileForm.value.website as string
    
    73
    
          const avatar_url = this.updateProfileForm.value.avatar_url as string
    
    74
    
    75
    
          const { error } = await this.supabase.updateProfile({
    
    76
    
            id: this.user.id,
    
    77
    
            username,
    
    78
    
            website,
    
    79
    
            avatar_url,
    
    80
    
          })
    
    81
    
          if (error) throw error
    
    82
    
        } catch (error) {
    
    83
    
          if (error instanceof Error) {
    
    84
    
            alert(error.message)
    
    85
    
          }
    
    86
    
        } finally {
    
    87
    
          this.loading = false
    
    88
    
        }
    
    89
    
      }
    
    90
    
    91
    
      async signOut() {
    
    92
    
        await this.supabase.signOut()
    
    93
    
      }
    
    94
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/account/account.component.ts>)

## Profile photos#

Add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Create an upload widget#

Create an `AvatarComponent` with the `ng g c avatar` Angular CLI command and add the following code.

src/app/avatar/avatar.component.tssrc/app/avatar/avatar.component.html
[code]
    1
    
    import { Component, EventEmitter, Input, Output } from '@angular/core'
    
    2
    
    import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser'
    
    3
    
    import { SupabaseService } from '../supabase.service'
    
    4
    
    5
    
    @Component({
    
    6
    
      selector: 'app-avatar',
    
    7
    
      templateUrl: './avatar.component.html',
    
    8
    
      styleUrls: ['./avatar.component.css'],
    
    9
    
      standalone: false,
    
    10
    
    })
    
    11
    
    export class AvatarComponent {
    
    12
    
      _avatarUrl: SafeResourceUrl | undefined
    
    13
    
      uploading = false
    
    14
    
    15
    
      @Input()
    
    16
    
      set avatarUrl(url: string | null) {
    
    17
    
        if (url) {
    
    18
    
          this.downloadImage(url)
    
    19
    
        }
    
    20
    
      }
    
    21
    
    22
    
      @Output() upload = new EventEmitter<string>()
    
    23
    
    24
    
      constructor(
    
    25
    
        private readonly supabase: SupabaseService,
    
    26
    
        private readonly dom: DomSanitizer
    
    27
    
      ) {}
    
    28
    
    29
    
      async downloadImage(path: string) {
    
    30
    
        try {
    
    31
    
          const { data } = await this.supabase.downLoadImage(path)
    
    32
    
          if (data instanceof Blob) {
    
    33
    
            this._avatarUrl = this.dom.bypassSecurityTrustResourceUrl(URL.createObjectURL(data))
    
    34
    
          }
    
    35
    
        } catch (error) {
    
    36
    
          if (error instanceof Error) {
    
    37
    
            console.error('Error downloading image: ', error.message)
    
    38
    
          }
    
    39
    
        }
    
    40
    
      }
    
    41
    
    42
    
      async uploadAvatar(event: any) {
    
    43
    
        try {
    
    44
    
          this.uploading = true
    
    45
    
          if (!event.target.files || event.target.files.length === 0) {
    
    46
    
            throw new Error('You must select an image to upload.')
    
    47
    
          }
    
    48
    
    49
    
          const file = event.target.files[0]
    
    50
    
          const fileExt = file.name.split('.').pop()
    
    51
    
          const filePath = `${Math.random()}.${fileExt}`
    
    52
    
    53
    
          await this.supabase.uploadAvatar(filePath, file)
    
    54
    
          this.upload.emit(filePath)
    
    55
    
        } catch (error) {
    
    56
    
          if (error instanceof Error) {
    
    57
    
            alert(error.message)
    
    58
    
          }
    
    59
    
        } finally {
    
    60
    
          this.uploading = false
    
    61
    
        }
    
    62
    
      }
    
    63
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/avatar/avatar.component.ts>)

### Update the Account component#

With the Avatar component created, update `AccountComponent` to include it:

src/app/account/account.component.tssrc/app/account/account.component.html
[code]
    1
    
    import { Component, Input, OnInit } from '@angular/core'
    
    2
    
    import { FormBuilder, FormGroup } from '@angular/forms'
    
    3
    
    import { User } from '@supabase/supabase-js'
    
    4
    
    import { Profile, SupabaseService } from '../supabase.service'
    
    5
    
    6
    
    @Component({
    
    7
    
      selector: 'app-account',
    
    8
    
      templateUrl: './account.component.html',
    
    9
    
      styleUrls: ['./account.component.css'],
    
    10
    
      standalone: false,
    
    11
    
    })
    
    12
    
    export class AccountComponent implements OnInit {
    
    13
    
      loading = false
    
    14
    
      profile!: Profile
    
    15
    
      updateProfileForm!: FormGroup
    
    16
    
    17
    
      get avatarUrl() {
    
    18
    
        return this.updateProfileForm.value.avatar_url as string
    
    19
    
      }
    
    20
    
    21
    
      async updateAvatar(event: string): Promise<void> {
    
    22
    
        this.updateProfileForm.patchValue({
    
    23
    
          avatar_url: event,
    
    24
    
        })
    
    25
    
        await this.updateProfile()
    
    26
    
      }
    
    27
    
    28
    
      @Input()
    
    29
    
      user!: User
    
    30
    
    31
    
      constructor(
    
    32
    
        private readonly supabase: SupabaseService,
    
    33
    
        private formBuilder: FormBuilder
    
    34
    
      ) {
    
    35
    
        this.updateProfileForm = this.formBuilder.group({
    
    36
    
          username: '',
    
    37
    
          website: '',
    
    38
    
          avatar_url: '',
    
    39
    
        })
    
    40
    
      }
    
    41
    
    42
    
      async ngOnInit(): Promise<void> {
    
    43
    
        await this.getProfile()
    
    44
    
    45
    
        const { username, website, avatar_url } = this.profile
    
    46
    
        this.updateProfileForm.patchValue({
    
    47
    
          username,
    
    48
    
          website,
    
    49
    
          avatar_url,
    
    50
    
        })
    
    51
    
      }
    
    52
    
    53
    
      async getProfile() {
    
    54
    
        try {
    
    55
    
          this.loading = true
    
    56
    
          const { data: profile, error, status } = await this.supabase.profile(this.user)
    
    57
    
    58
    
          if (error && status !== 406) {
    
    59
    
            throw error
    
    60
    
          }
    
    61
    
    62
    
          if (profile) {
    
    63
    
            this.profile = profile
    
    64
    
          }
    
    65
    
        } catch (error) {
    
    66
    
          if (error instanceof Error) {
    
    67
    
            alert(error.message)
    
    68
    
          }
    
    69
    
        } finally {
    
    70
    
          this.loading = false
    
    71
    
        }
    
    72
    
      }
    
    73
    
    74
    
      async updateProfile(): Promise<void> {
    
    75
    
        try {
    
    76
    
          this.loading = true
    
    77
    
    78
    
          const username = this.updateProfileForm.value.username as string
    
    79
    
          const website = this.updateProfileForm.value.website as string
    
    80
    
          const avatar_url = this.updateProfileForm.value.avatar_url as string
    
    81
    
    82
    
          const { error } = await this.supabase.updateProfile({
    
    83
    
            id: this.user.id,
    
    84
    
            username,
    
    85
    
            website,
    
    86
    
            avatar_url,
    
    87
    
          })
    
    88
    
          if (error) throw error
    
    89
    
        } catch (error) {
    
    90
    
          if (error instanceof Error) {
    
    91
    
            alert(error.message)
    
    92
    
          }
    
    93
    
        } finally {
    
    94
    
          this.loading = false
    
    95
    
        }
    
    96
    
      }
    
    97
    
    98
    
      async signOut() {
    
    99
    
        await this.supabase.signOut()
    
    100
    
      }
    
    101
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/account/account.component.ts>)

You also need to change `app.module.ts` to include the `ReactiveFormsModule` from the `@angular/forms` package.

src/app/app.module.ts
[code]
    1
    
    import { NgModule } from '@angular/core'
    
    2
    
    import { BrowserModule } from '@angular/platform-browser'
    
    3
    
    import { ReactiveFormsModule } from '@angular/forms'
    
    4
    
    5
    
    import { AppComponent } from './app.component'
    
    6
    
    import { AuthComponent } from './auth/auth.component'
    
    7
    
    import { AccountComponent } from './account/account.component'
    
    8
    
    import { AvatarComponent } from './avatar/avatar.component'
    
    9
    
    10
    
    @NgModule({
    
    11
    
      declarations: [AppComponent, AuthComponent, AccountComponent, AvatarComponent],
    
    12
    
      imports: [BrowserModule, ReactiveFormsModule],
    
    13
    
      providers: [],
    
    14
    
      bootstrap: [AppComponent],
    
    15
    
    })
    
    16
    
    export class AppModule {}
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/app.module.ts>)

### Launch!#

With all the components in place, change the contents of `AppComponent` to include the new components and Auth logic:

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods#

  * Use [`getClaims`](</docs/reference/javascript/auth-getclaims>) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](<https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
  * [`getUser`](</docs/reference/javascript/auth-getuser>) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
  * [`getSession`](</docs/reference/javascript/auth-getsession>) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.


**In summary** : use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

src/app/app.component.tssrc/app/app.component.html
[code]
    1
    
    import { Component, OnInit } from '@angular/core'
    
    2
    
    import { User } from '@supabase/supabase-js'
    
    3
    
    import { SupabaseService } from './supabase.service'
    
    4
    
    5
    
    @Component({
    
    6
    
      selector: 'app-root',
    
    7
    
      templateUrl: './app.component.html',
    
    8
    
      styleUrls: ['./app.component.css'],
    
    9
    
      standalone: false,
    
    10
    
    })
    
    11
    
    export class AppComponent implements OnInit {
    
    12
    
      constructor(private readonly supabase: SupabaseService) {}
    
    13
    
    14
    
      title = 'angular-user-management'
    
    15
    
      user: User | null = null
    
    16
    
    17
    
      async ngOnInit() {
    
    18
    
        this.user = await this.supabase.getUser()
    
    19
    
        this.supabase.authChanges(async () => {
    
    20
    
          this.user = await this.supabase.getUser()
    
    21
    
        })
    
    22
    
      }
    
    23
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/user-management/angular-user-management/src/app/app.component.ts>)

Now run the application in a terminal:
[code] 
    1
    
    npm run start
[/code]

Open the browser to [localhost:4200](<http://localhost:4200>) and you should see the completed app.

![Screenshot of the Supabase Angular application running in a browser](/docs/img/supabase-angular-demo.png)

At this stage you have a fully functional application!