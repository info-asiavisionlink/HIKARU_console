---
タイトル: Build a User Management App with Flutter
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-flutter
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, flutter, getting-started, management, tutorials, user, with, with-flutter
---

# Build a User Management App with Flutter

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-flutter
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, flutter, getting-started, management, tutorials, user, with, with-flutter

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Initialize a Flutter app#](#initialize-a-flutter-app)
  - [Setup deep links#](#setup-deep-links)
  - [Main function#](#main-function)
  - [Set up a login page#](#set-up-a-login-page)
  - [Set up account page#](#set-up-account-page)
  - [Launch!#](#launch)
- [Bonus: Profile photos#](#bonus-profile-photos)
  - [Making sure we have a public bucket#](#making-sure-we-have-a-public-bucket)
  - [Adding image uploading feature to account page#](#adding-image-uploading-feature-to-account-page)
  - [Create an upload widget#](#create-an-upload-widget)
  - [Add the new widget#](#add-the-new-widget)
- [See also#](#see-also)

## 概要

Learn how to use Supabase in your Flutter App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/supabase-flutter-demo.png)

If you get stuck while working through this guide, refer to the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/flutter-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=flutter>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Build the Flutter app from scratch.

### Initialize a Flutter app#

We can use [`flutter create`](<https://flutter.dev/docs/get-started/test-drive>) to initialize an app called `supabase_quickstart`:
[code] 
    1
    
    flutter create supabase_quickstart
[/code]

Then install the only additional dependency: [`supabase_flutter`](<https://pub.dev/packages/supabase_flutter>)

Copy and paste the following line in your pubspec.yaml to install the package:
[code] 
    1
    
    supabase_flutter: ^2.0.0
[/code]

Run `flutter pub get` to install the dependencies.

### Setup deep links#

With dependencies installed, set up deep links. Setting up deep links is required to bring back the user to the app when they click on the magic link to sign in. We can setup deep links with a minor tweak on our Flutter application.

We have to use `io.supabase.flutterquickstart` as the scheme. In this example, we will use `login-callback` as the host for our deep link, but you can change it to whatever you would like.

First, add `io.supabase.flutterquickstart://login-callback/` as a new [redirect URL](</dashboard/project/_/auth/url-configuration>) in the Dashboard.

![Supabase console deep link setting](/docs/img/deeplink-setting.png)

That is it on Supabase's end and the rest are platform specific settings:

iOSAndroidWeb

Edit the `ios/Runner/Info.plist` file.

Add `CFBundleURLTypes` to enable deep linking:

ios/Runner/Info.plist
[code]
    1
    
    <!-- ... other tags -->
    
    2
    
    <plist>
    
    3
    
    <dict>
    
    4
    
      <!-- ... other tags -->
    
    5
    
    6
    
      <!-- Add this array for Deep Links -->
    
    7
    
      <key>CFBundleURLTypes</key>
    
    8
    
      <array>
    
    9
    
        <dict>
    
    10
    
          <key>CFBundleTypeRole</key>
    
    11
    
          <string>Editor</string>
    
    12
    
          <key>CFBundleURLSchemes</key>
    
    13
    
          <array>
    
    14
    
            <string>io.supabase.flutterquickstart</string>
    
    15
    
          </array>
    
    16
    
        </dict>
    
    17
    
      </array>
    
    18
    
      <!-- ... other tags -->
    
    19
    
    </dict>
    
    20
    
    </plist>
[/code]

### Main function#

With deep links configured, initialize the Supabase client inside the `main` function with the API credentials that you copied earlier. These variables will be exposed on the app, and that's completely fine since we have [Row Level Security](</docs/guides/auth#row-level-security>) enabled on our Database.

lib/main.dart
[code]
    1
    
    import 'package:flutter/material.dart';
    
    2
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    3
    
    4
    
    Future<void> main() async {
    
    5
    
      await Supabase.initialize(
    
    6
    
        url: 'YOUR_SUPABASE_URL',
    
    7
    
        publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    
    8
    
      );
    
    9
    
      runApp(const MyApp());
    
    10
    
    }
    
    11
    
    12
    
    final supabase = Supabase.instance.client;
    
    13
    
    14
    
    class MyApp extends StatelessWidget {
    
    15
    
      const MyApp({super.key});
    
    16
    
    17
    
      @override
    
    18
    
      Widget build(BuildContext context) {
    
    19
    
        return const MaterialApp(title: 'Supabase Flutter');
    
    20
    
      }
    
    21
    
    }
    
    22
    
    23
    
    extension ContextExtension on BuildContext {
    
    24
    
      void showSnackBar(String message, {bool isError = false}) {
    
    25
    
        ScaffoldMessenger.of(this).showSnackBar(
    
    26
    
          SnackBar(
    
    27
    
            content: Text(message),
    
    28
    
            backgroundColor: isError
    
    29
    
                ? Theme.of(this).colorScheme.error
    
    30
    
                : Theme.of(this).snackBarTheme.backgroundColor,
    
    31
    
          ),
    
    32
    
        );
    
    33
    
      }
    
    34
    
    }
[/code]

Notice that we have a `showSnackBar` extension method that we will use to show snack bars in the app. You could define this method in a separate file and import it where needed, but for simplicity, we will define it here.

### Set up a login page#

Create a Flutter widget to manage logins and sign ups. We will use Magic Links, so users can sign in with their email without using passwords.

Notice that this page sets up a listener on the user's auth state using `onAuthStateChange`. A new event will fire when the user comes back to the app by clicking their magic link, which this page can catch and redirect the user accordingly.

lib/pages/login_page.dart
[code]
    1
    
    import 'dart:async';
    
    2
    
    3
    
    import 'package:flutter/foundation.dart';
    
    4
    
    import 'package:flutter/material.dart';
    
    5
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    6
    
    import 'package:supabase_quickstart/main.dart';
    
    7
    
    import 'package:supabase_quickstart/pages/account_page.dart';
    
    8
    
    9
    
    class LoginPage extends StatefulWidget {
    
    10
    
      const LoginPage({super.key});
    
    11
    
    12
    
      @override
    
    13
    
      State<LoginPage> createState() => _LoginPageState();
    
    14
    
    }
    
    15
    
    16
    
    class _LoginPageState extends State<LoginPage> {
    
    17
    
      bool _isLoading = false;
    
    18
    
      bool _redirecting = false;
    
    19
    
      late final TextEditingController _emailController = TextEditingController();
    
    20
    
      late final StreamSubscription<AuthState> _authStateSubscription;
    
    21
    
    22
    
      Future<void> _signIn() async {
    
    23
    
        try {
    
    24
    
          setState(() {
    
    25
    
            _isLoading = true;
    
    26
    
          });
    
    27
    
          await supabase.auth.signInWithOtp(
    
    28
    
            email: _emailController.text.trim(),
    
    29
    
            emailRedirectTo:
    
    30
    
                kIsWeb ? null : 'io.supabase.flutterquickstart://login-callback/',
    
    31
    
          );
    
    32
    
          if (mounted) {
    
    33
    
            context.showSnackBar('Check your email for a login link!');
    
    34
    
    35
    
            _emailController.clear();
    
    36
    
          }
    
    37
    
        } on AuthException catch (error) {
    
    38
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    39
    
        } catch (error) {
    
    40
    
          if (mounted) {
    
    41
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    42
    
          }
    
    43
    
        } finally {
    
    44
    
          if (mounted) {
    
    45
    
            setState(() {
    
    46
    
              _isLoading = false;
    
    47
    
            });
    
    48
    
          }
    
    49
    
        }
    
    50
    
      }
    
    51
    
    52
    
      @override
    
    53
    
      void initState() {
    
    54
    
        _authStateSubscription = supabase.auth.onAuthStateChange.listen(
    
    55
    
          (data) {
    
    56
    
            if (_redirecting) return;
    
    57
    
            final session = data.session;
    
    58
    
            if (session != null) {
    
    59
    
              _redirecting = true;
    
    60
    
              Navigator.of(context).pushReplacement(
    
    61
    
                MaterialPageRoute(builder: (context) => const AccountPage()),
    
    62
    
              );
    
    63
    
            }
    
    64
    
          },
    
    65
    
          onError: (error) {
    
    66
    
            if (error is AuthException) {
    
    67
    
              context.showSnackBar(error.message, isError: true);
    
    68
    
            } else {
    
    69
    
              context.showSnackBar('Unexpected error occurred', isError: true);
    
    70
    
            }
    
    71
    
          },
    
    72
    
        );
    
    73
    
        super.initState();
    
    74
    
      }
    
    75
    
    76
    
      @override
    
    77
    
      void dispose() {
    
    78
    
        _emailController.dispose();
    
    79
    
        _authStateSubscription.cancel();
    
    80
    
        super.dispose();
    
    81
    
      }
    
    82
    
    83
    
      @override
    
    84
    
      Widget build(BuildContext context) {
    
    85
    
        return Scaffold(
    
    86
    
          appBar: AppBar(title: const Text('Sign In')),
    
    87
    
          body: ListView(
    
    88
    
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
    
    89
    
            children: [
    
    90
    
              const Text('Sign in via the magic link with your email below'),
    
    91
    
              const SizedBox(height: 18),
    
    92
    
              TextFormField(
    
    93
    
                controller: _emailController,
    
    94
    
                decoration: const InputDecoration(labelText: 'Email'),
    
    95
    
              ),
    
    96
    
              const SizedBox(height: 18),
    
    97
    
              ElevatedButton(
    
    98
    
                onPressed: _isLoading ? null : _signIn,
    
    99
    
                child: Text(_isLoading ? 'Sending...' : 'Send Magic Link'),
    
    100
    
              ),
    
    101
    
            ],
    
    102
    
          ),
    
    103
    
        );
    
    104
    
      }
    
    105
    
    }
[/code]

### Set up account page#

After a user is signed in we can allow them to edit their profile details and manage their account. Create a new widget called `account_page.dart`.

lib/pages/account_page.dart
[code]
    1
    
    import 'package:flutter/material.dart';
    
    2
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    3
    
    import 'package:supabase_quickstart/main.dart';
    
    4
    
    import 'package:supabase_quickstart/pages/login_page.dart';
    
    5
    
    6
    
    class AccountPage extends StatefulWidget {
    
    7
    
      const AccountPage({super.key});
    
    8
    
    9
    
      @override
    
    10
    
      State<AccountPage> createState() => _AccountPageState();
    
    11
    
    }
    
    12
    
    13
    
    class _AccountPageState extends State<AccountPage> {
    
    14
    
      final _usernameController = TextEditingController();
    
    15
    
      final _websiteController = TextEditingController();
    
    16
    
    17
    
      String? _avatarUrl;
    
    18
    
      var _loading = true;
    
    19
    
    20
    
      /// Called once a user id is received within `onAuthenticated()`
    
    21
    
      Future<void> _getProfile() async {
    
    22
    
        setState(() {
    
    23
    
          _loading = true;
    
    24
    
        });
    
    25
    
    26
    
        try {
    
    27
    
          final userId = supabase.auth.currentSession!.user.id;
    
    28
    
          final data =
    
    29
    
              await supabase.from('profiles').select().eq('id', userId).single();
    
    30
    
          _usernameController.text = (data['username'] ?? '') as String;
    
    31
    
          _websiteController.text = (data['website'] ?? '') as String;
    
    32
    
          _avatarUrl = (data['avatar_url'] ?? '') as String;
    
    33
    
        } on PostgrestException catch (error) {
    
    34
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    35
    
        } catch (error) {
    
    36
    
          if (mounted) {
    
    37
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    38
    
          }
    
    39
    
        } finally {
    
    40
    
          if (mounted) {
    
    41
    
            setState(() {
    
    42
    
              _loading = false;
    
    43
    
            });
    
    44
    
          }
    
    45
    
        }
    
    46
    
      }
    
    47
    
    48
    
      /// Called when user taps `Update` button
    
    49
    
      Future<void> _updateProfile() async {
    
    50
    
        setState(() {
    
    51
    
          _loading = true;
    
    52
    
        });
    
    53
    
        final userName = _usernameController.text.trim();
    
    54
    
        final website = _websiteController.text.trim();
    
    55
    
        final user = supabase.auth.currentUser;
    
    56
    
        final updates = {
    
    57
    
          'id': user!.id,
    
    58
    
          'username': userName,
    
    59
    
          'website': website,
    
    60
    
          'updated_at': DateTime.now().toIso8601String(),
    
    61
    
        };
    
    62
    
        try {
    
    63
    
          await supabase.from('profiles').upsert(updates);
    
    64
    
          if (mounted) context.showSnackBar('Successfully updated profile!');
    
    65
    
        } on PostgrestException catch (error) {
    
    66
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    67
    
        } catch (error) {
    
    68
    
          if (mounted) {
    
    69
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    70
    
          }
    
    71
    
        } finally {
    
    72
    
          if (mounted) {
    
    73
    
            setState(() {
    
    74
    
              _loading = false;
    
    75
    
            });
    
    76
    
          }
    
    77
    
        }
    
    78
    
      }
    
    79
    
    80
    
      Future<void> _signOut() async {
    
    81
    
        try {
    
    82
    
          await supabase.auth.signOut();
    
    83
    
        } on AuthException catch (error) {
    
    84
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    85
    
        } catch (error) {
    
    86
    
          if (mounted) {
    
    87
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    88
    
          }
    
    89
    
        } finally {
    
    90
    
          if (mounted) {
    
    91
    
            Navigator.of(context).pushReplacement(
    
    92
    
              MaterialPageRoute(builder: (_) => const LoginPage()),
    
    93
    
            );
    
    94
    
          }
    
    95
    
        }
    
    96
    
      }
    
    97
    
    98
    
      @override
    
    99
    
      void initState() {
    
    100
    
        super.initState();
    
    101
    
        _getProfile();
    
    102
    
      }
    
    103
    
    104
    
      @override
    
    105
    
      void dispose() {
    
    106
    
        _usernameController.dispose();
    
    107
    
        _websiteController.dispose();
    
    108
    
        super.dispose();
    
    109
    
      }
    
    110
    
    111
    
      @override
    
    112
    
      Widget build(BuildContext context) {
    
    113
    
        return Scaffold(
    
    114
    
          appBar: AppBar(title: const Text('Profile')),
    
    115
    
          body: ListView(
    
    116
    
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
    
    117
    
            children: [
    
    118
    
              TextFormField(
    
    119
    
                controller: _usernameController,
    
    120
    
                decoration: const InputDecoration(labelText: 'User Name'),
    
    121
    
              ),
    
    122
    
              const SizedBox(height: 18),
    
    123
    
              TextFormField(
    
    124
    
                controller: _websiteController,
    
    125
    
                decoration: const InputDecoration(labelText: 'Website'),
    
    126
    
              ),
    
    127
    
              const SizedBox(height: 18),
    
    128
    
              ElevatedButton(
    
    129
    
                onPressed: _loading ? null : _updateProfile,
    
    130
    
                child: Text(_loading ? 'Saving...' : 'Update'),
    
    131
    
              ),
    
    132
    
              const SizedBox(height: 18),
    
    133
    
              TextButton(onPressed: _signOut, child: const Text('Sign Out')),
    
    134
    
            ],
    
    135
    
          ),
    
    136
    
        );
    
    137
    
      }
    
    138
    
    }
[/code]

### Launch!#

With all components in place, update `lib/main.dart`. The `home` of the `MaterialApp`, meaning the initial page shown to the user, will be the `LoginPage` if the user is not authenticated, and the `AccountPage` if the user is authenticated. We also included some theming to make the app look a bit nicer.

lib/main.dart
[code]
    1
    
    import 'package:flutter/material.dart';
    
    2
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    3
    
    import 'package:supabase_quickstart/pages/account_page.dart';
    
    4
    
    import 'package:supabase_quickstart/pages/login_page.dart';
    
    5
    
    6
    
    Future<void> main() async {
    
    7
    
      await Supabase.initialize(
    
    8
    
        url: 'YOUR_SUPABASE_URL',
    
    9
    
        publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    
    10
    
      );
    
    11
    
      runApp(const MyApp());
    
    12
    
    }
    
    13
    
    14
    
    final supabase = Supabase.instance.client;
    
    15
    
    16
    
    class MyApp extends StatelessWidget {
    
    17
    
      const MyApp({super.key});
    
    18
    
    19
    
      @override
    
    20
    
      Widget build(BuildContext context) {
    
    21
    
        return MaterialApp(
    
    22
    
          title: 'Supabase Flutter',
    
    23
    
          theme: ThemeData.dark().copyWith(
    
    24
    
            primaryColor: Colors.green,
    
    25
    
            textButtonTheme: TextButtonThemeData(
    
    26
    
              style: TextButton.styleFrom(
    
    27
    
                foregroundColor: Colors.green,
    
    28
    
              ),
    
    29
    
            ),
    
    30
    
            elevatedButtonTheme: ElevatedButtonThemeData(
    
    31
    
              style: ElevatedButton.styleFrom(
    
    32
    
                foregroundColor: Colors.white,
    
    33
    
                backgroundColor: Colors.green,
    
    34
    
              ),
    
    35
    
            ),
    
    36
    
          ),
    
    37
    
          home: supabase.auth.currentSession == null
    
    38
    
              ? const LoginPage()
    
    39
    
              : const AccountPage(),
    
    40
    
        );
    
    41
    
      }
    
    42
    
    }
    
    43
    
    44
    
    extension ContextExtension on BuildContext {
    
    45
    
      void showSnackBar(String message, {bool isError = false}) {
    
    46
    
        ScaffoldMessenger.of(this).showSnackBar(
    
    47
    
          SnackBar(
    
    48
    
            content: Text(message),
    
    49
    
            backgroundColor: isError
    
    50
    
                ? Theme.of(this).colorScheme.error
    
    51
    
                : Theme.of(this).snackBarTheme.backgroundColor,
    
    52
    
          ),
    
    53
    
        );
    
    54
    
      }
    
    55
    
    }
[/code]

Once that's done, run this in a terminal window to launch on Android or iOS:
[code] 
    1
    
    flutter run
[/code]

Or for web, run the following command to launch it on `localhost:3000`
[code] 
    1
    
    flutter run -d web-server --web-hostname localhost --web-port 3000
[/code]

And then open the browser to [localhost:3000](<http://localhost:3000>) and you should see the completed app.

![Supabase User Management example](/docs/img/supabase-flutter-account-page.png)

## Bonus: Profile photos#

Every Supabase project is configured with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Making sure we have a public bucket#

We will be storing the image as a publicly sharable image. Make sure your `avatars` bucket is set to public, and if it is not, change the publicity by clicking the dot menu that appears when you hover over the bucket name. You should see an orange `Public` badge next to your bucket name if your bucket is set to public.

### Adding image uploading feature to account page#

We will use [`image_picker`](<https://pub.dev/packages/image_picker>) plugin to select an image from the device.

Add the following line in your pubspec.yaml file to install `image_picker`:
[code] 
    1
    
    image_picker: ^1.0.5
[/code]

Using [`image_picker`](<https://pub.dev/packages/image_picker>) requires some additional preparation depending on the platform. Follow the instruction on README.md of [`image_picker`](<https://pub.dev/packages/image_picker>) on how to set it up for the platform you are using.

Once you are done with all of the above, it is time to dive into coding.

### Create an upload widget#

Create an avatar so the user can upload a profile photo. We can start by creating a new component:

lib/components/avatar.dart
[code]
    1
    
    import 'package:flutter/material.dart';
    
    2
    
    import 'package:image_picker/image_picker.dart';
    
    3
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    4
    
    import 'package:supabase_quickstart/main.dart';
    
    5
    
    6
    
    class Avatar extends StatefulWidget {
    
    7
    
      const Avatar({
    
    8
    
        super.key,
    
    9
    
        required this.imageUrl,
    
    10
    
        required this.onUpload,
    
    11
    
      });
    
    12
    
    13
    
      final String? imageUrl;
    
    14
    
      final void Function(String) onUpload;
    
    15
    
    16
    
      @override
    
    17
    
      State<Avatar> createState() => _AvatarState();
    
    18
    
    }
    
    19
    
    20
    
    class _AvatarState extends State<Avatar> {
    
    21
    
      bool _isLoading = false;
    
    22
    
    23
    
      @override
    
    24
    
      Widget build(BuildContext context) {
    
    25
    
        return Column(
    
    26
    
          children: [
    
    27
    
            if (widget.imageUrl == null || widget.imageUrl!.isEmpty)
    
    28
    
              Container(
    
    29
    
                width: 150,
    
    30
    
                height: 150,
    
    31
    
                color: Colors.grey,
    
    32
    
                child: const Center(
    
    33
    
                  child: Text('No Image'),
    
    34
    
                ),
    
    35
    
              )
    
    36
    
            else
    
    37
    
              Image.network(
    
    38
    
                widget.imageUrl!,
    
    39
    
                width: 150,
    
    40
    
                height: 150,
    
    41
    
                fit: BoxFit.cover,
    
    42
    
              ),
    
    43
    
            ElevatedButton(
    
    44
    
              onPressed: _isLoading ? null : _upload,
    
    45
    
              child: const Text('Upload'),
    
    46
    
            ),
    
    47
    
          ],
    
    48
    
        );
    
    49
    
      }
    
    50
    
    51
    
      Future<void> _upload() async {
    
    52
    
        final picker = ImagePicker();
    
    53
    
        final imageFile = await picker.pickImage(
    
    54
    
          source: ImageSource.gallery,
    
    55
    
          maxWidth: 300,
    
    56
    
          maxHeight: 300,
    
    57
    
        );
    
    58
    
        if (imageFile == null) {
    
    59
    
          return;
    
    60
    
        }
    
    61
    
        setState(() => _isLoading = true);
    
    62
    
    63
    
        try {
    
    64
    
          final bytes = await imageFile.readAsBytes();
    
    65
    
          final fileExt = imageFile.path.split('.').last;
    
    66
    
          final fileName = '${DateTime.now().toIso8601String()}.$fileExt';
    
    67
    
          final filePath = fileName;
    
    68
    
          await supabase.storage.from('avatars').uploadBinary(
    
    69
    
                filePath,
    
    70
    
                bytes,
    
    71
    
                fileOptions: FileOptions(contentType: imageFile.mimeType),
    
    72
    
              );
    
    73
    
          final imageUrlResponse = await supabase.storage
    
    74
    
              .from('avatars')
    
    75
    
              .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
    
    76
    
          widget.onUpload(imageUrlResponse);
    
    77
    
        } on StorageException catch (error) {
    
    78
    
          if (mounted) {
    
    79
    
            context.showSnackBar(error.message, isError: true);
    
    80
    
          }
    
    81
    
        } catch (error) {
    
    82
    
          if (mounted) {
    
    83
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    84
    
          }
    
    85
    
        }
    
    86
    
    87
    
        setState(() => _isLoading = false);
    
    88
    
      }
    
    89
    
    }
[/code]

### Add the new widget#

And then we can add the widget to the Account page as well as some logic to update the `avatar_url` whenever the user uploads a new avatar.

lib/pages/account_page.dart
[code]
    1
    
    import 'package:flutter/material.dart';
    
    2
    
    import 'package:supabase_flutter/supabase_flutter.dart';
    
    3
    
    import 'package:supabase_quickstart/components/avatar.dart';
    
    4
    
    import 'package:supabase_quickstart/main.dart';
    
    5
    
    import 'package:supabase_quickstart/pages/login_page.dart';
    
    6
    
    7
    
    class AccountPage extends StatefulWidget {
    
    8
    
      const AccountPage({super.key});
    
    9
    
    10
    
      @override
    
    11
    
      State<AccountPage> createState() => _AccountPageState();
    
    12
    
    }
    
    13
    
    14
    
    class _AccountPageState extends State<AccountPage> {
    
    15
    
      final _usernameController = TextEditingController();
    
    16
    
      final _websiteController = TextEditingController();
    
    17
    
    18
    
      String? _avatarUrl;
    
    19
    
      var _loading = true;
    
    20
    
    21
    
      /// Called once a user id is received within `onAuthenticated()`
    
    22
    
      Future<void> _getProfile() async {
    
    23
    
        setState(() {
    
    24
    
          _loading = true;
    
    25
    
        });
    
    26
    
    27
    
        try {
    
    28
    
          final userId = supabase.auth.currentSession!.user.id;
    
    29
    
          final data =
    
    30
    
              await supabase.from('profiles').select().eq('id', userId).single();
    
    31
    
          _usernameController.text = (data['username'] ?? '') as String;
    
    32
    
          _websiteController.text = (data['website'] ?? '') as String;
    
    33
    
          _avatarUrl = (data['avatar_url'] ?? '') as String;
    
    34
    
        } on PostgrestException catch (error) {
    
    35
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    36
    
        } catch (error) {
    
    37
    
          if (mounted) {
    
    38
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    39
    
          }
    
    40
    
        } finally {
    
    41
    
          if (mounted) {
    
    42
    
            setState(() {
    
    43
    
              _loading = false;
    
    44
    
            });
    
    45
    
          }
    
    46
    
        }
    
    47
    
      }
    
    48
    
    49
    
      /// Called when user taps `Update` button
    
    50
    
      Future<void> _updateProfile() async {
    
    51
    
        setState(() {
    
    52
    
          _loading = true;
    
    53
    
        });
    
    54
    
        final userName = _usernameController.text.trim();
    
    55
    
        final website = _websiteController.text.trim();
    
    56
    
        final user = supabase.auth.currentUser;
    
    57
    
        final updates = {
    
    58
    
          'id': user!.id,
    
    59
    
          'username': userName,
    
    60
    
          'website': website,
    
    61
    
          'updated_at': DateTime.now().toIso8601String(),
    
    62
    
        };
    
    63
    
        try {
    
    64
    
          await supabase.from('profiles').upsert(updates);
    
    65
    
          if (mounted) context.showSnackBar('Successfully updated profile!');
    
    66
    
        } on PostgrestException catch (error) {
    
    67
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    68
    
        } catch (error) {
    
    69
    
          if (mounted) {
    
    70
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    71
    
          }
    
    72
    
        } finally {
    
    73
    
          if (mounted) {
    
    74
    
            setState(() {
    
    75
    
              _loading = false;
    
    76
    
            });
    
    77
    
          }
    
    78
    
        }
    
    79
    
      }
    
    80
    
    81
    
      Future<void> _signOut() async {
    
    82
    
        try {
    
    83
    
          await supabase.auth.signOut();
    
    84
    
        } on AuthException catch (error) {
    
    85
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    86
    
        } catch (error) {
    
    87
    
          if (mounted) {
    
    88
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    89
    
          }
    
    90
    
        } finally {
    
    91
    
          if (mounted) {
    
    92
    
            Navigator.of(context).pushReplacement(
    
    93
    
              MaterialPageRoute(builder: (_) => const LoginPage()),
    
    94
    
            );
    
    95
    
          }
    
    96
    
        }
    
    97
    
      }
    
    98
    
    99
    
      /// Called when image has been uploaded to Supabase storage from within Avatar widget
    
    100
    
      Future<void> _onUpload(String imageUrl) async {
    
    101
    
        try {
    
    102
    
          final userId = supabase.auth.currentUser!.id;
    
    103
    
          await supabase.from('profiles').upsert({
    
    104
    
            'id': userId,
    
    105
    
            'avatar_url': imageUrl,
    
    106
    
          });
    
    107
    
          if (mounted) {
    
    108
    
            const SnackBar(
    
    109
    
              content: Text('Updated your profile image!'),
    
    110
    
            );
    
    111
    
          }
    
    112
    
        } on PostgrestException catch (error) {
    
    113
    
          if (mounted) context.showSnackBar(error.message, isError: true);
    
    114
    
        } catch (error) {
    
    115
    
          if (mounted) {
    
    116
    
            context.showSnackBar('Unexpected error occurred', isError: true);
    
    117
    
          }
    
    118
    
        }
    
    119
    
        if (!mounted) {
    
    120
    
          return;
    
    121
    
        }
    
    122
    
    123
    
        setState(() {
    
    124
    
          _avatarUrl = imageUrl;
    
    125
    
        });
    
    126
    
      }
    
    127
    
    128
    
      @override
    
    129
    
      void initState() {
    
    130
    
        super.initState();
    
    131
    
        _getProfile();
    
    132
    
      }
    
    133
    
    134
    
      @override
    
    135
    
      void dispose() {
    
    136
    
        _usernameController.dispose();
    
    137
    
        _websiteController.dispose();
    
    138
    
        super.dispose();
    
    139
    
      }
    
    140
    
    141
    
      @override
    
    142
    
      Widget build(BuildContext context) {
    
    143
    
        return Scaffold(
    
    144
    
          appBar: AppBar(title: const Text('Profile')),
    
    145
    
          body: ListView(
    
    146
    
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
    
    147
    
            children: [
    
    148
    
              Avatar(
    
    149
    
                imageUrl: _avatarUrl,
    
    150
    
                onUpload: _onUpload,
    
    151
    
              ),
    
    152
    
              const SizedBox(height: 18),
    
    153
    
              TextFormField(
    
    154
    
                controller: _usernameController,
    
    155
    
                decoration: const InputDecoration(labelText: 'User Name'),
    
    156
    
              ),
    
    157
    
              const SizedBox(height: 18),
    
    158
    
              TextFormField(
    
    159
    
                controller: _websiteController,
    
    160
    
                decoration: const InputDecoration(labelText: 'Website'),
    
    161
    
              ),
    
    162
    
              const SizedBox(height: 18),
    
    163
    
              ElevatedButton(
    
    164
    
                onPressed: _loading ? null : _updateProfile,
    
    165
    
                child: Text(_loading ? 'Saving...' : 'Update'),
    
    166
    
              ),
    
    167
    
              const SizedBox(height: 18),
    
    168
    
              TextButton(onPressed: _signOut, child: const Text('Sign Out')),
    
    169
    
            ],
    
    170
    
          ),
    
    171
    
        );
    
    172
    
      }
    
    173
    
    }
[/code]

Congratulations, you've built a fully functional user management app using Flutter and Supabase!

## See also#

  * [Flutter Tutorial: building a Flutter chat app](</blog/flutter-tutorial-building-a-chat-app>)
  * [Flutter Tutorial - Part 2: Authentication and Authorization with RLS](</blog/flutter-authentication-and-authorization-with-rls>)