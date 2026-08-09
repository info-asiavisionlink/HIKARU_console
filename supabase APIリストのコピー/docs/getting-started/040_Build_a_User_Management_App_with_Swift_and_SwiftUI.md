---
タイトル: Build a User Management App with Swift and SwiftUI
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-swift
カテゴリ: getting-started
更新日: 2026-08-02
タグ: build, getting-started, management, swift, swiftui, tutorials, user, with, with-swift
---

# Build a User Management App with Swift and SwiftUI

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-swift
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** build, getting-started, management, swift, swiftui, tutorials, user, with, with-swift

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
- [Building the app#](#building-the-app)
  - [Create a SwiftUI app in Xcode#](#create-a-swiftui-app-in-xcode)
  - [Set up a login view#](#set-up-a-login-view)
  - [Account view#](#account-view)
  - [Models#](#models)
- [Profile photos#](#profile-photos)
  - [AddPhotosPicker#](#add-photospicker)
  - [Launch!#](#launch)

## 概要

Learn how to use Supabase in your SwiftUI App.

---

This tutorial demonstrates how to build a basic user management app. The app authenticates and identifies the user, stores their profile information in the database, and allows the user to log in, update their profile details, and upload a profile photo. The app uses:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- allow users to sign up and log in.
  * [Supabase Storage](</docs/guides/storage>) \- allow users to upload a profile photo.


![Supabase User Management example](/docs/img/supabase-swift-demo.png)

If you get stuck while working through this guide, you can find the [full example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/user-management/swift-user-management>).

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

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=swift>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

## Building the app#

Build the SwiftUI app from scratch.

### Create a SwiftUI app in Xcode#

Open Xcode and create a new SwiftUI project.

Add the [supabase-swift](<https://github.com/supabase/supabase-swift>) dependency.

Add the `https://github.com/supabase/supabase-swift` package to your app. For instructions, see the [Apple tutorial on adding package dependencies](<https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app>).

Create a helper file to initialize the Supabase client. You need the API URL and the key that you copied earlier. These variables will be exposed on the application, and that's completely fine since you have [Row Level Security](</docs/guides/auth#row-level-security>) enabled on your database.

Supabase.swift
[code]
    1
    
    import Foundation
    
    2
    
    import Supabase
    
    3
    
    4
    
    let supabase = SupabaseClient(
    
    5
    
      supabaseURL: URL(string: "YOUR_SUPABASE_URL")!,
    
    6
    
      supabaseKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
    
    7
    
    )
[/code]

### Set up a login view#

Set up a SwiftUI view to manage logins and sign ups. Users should be able to sign in using a magic link.

AuthView.swift
[code]
    1
    
    import SwiftUI
    
    2
    
    import Supabase
    
    3
    
    4
    
    struct AuthView: View {
    
    5
    
      @State var email = ""
    
    6
    
      @State var isLoading = false
    
    7
    
      @State var result: Result<Void, Error>?
    
    8
    
    9
    
      var body: some View {
    
    10
    
        Form {
    
    11
    
          Section {
    
    12
    
            TextField("Email", text: $email)
    
    13
    
              .textContentType(.emailAddress)
    
    14
    
              .textInputAutocapitalization(.never)
    
    15
    
              .autocorrectionDisabled()
    
    16
    
          }
    
    17
    
    18
    
          Section {
    
    19
    
            Button("Sign in") {
    
    20
    
              signInButtonTapped()
    
    21
    
            }
    
    22
    
    23
    
            if isLoading {
    
    24
    
              ProgressView()
    
    25
    
            }
    
    26
    
          }
    
    27
    
    28
    
          if let result {
    
    29
    
            Section {
    
    30
    
              switch result {
    
    31
    
              case .success:
    
    32
    
                Text("Check your inbox.")
    
    33
    
              case .failure(let error):
    
    34
    
                Text(error.localizedDescription).foregroundStyle(.red)
    
    35
    
              }
    
    36
    
            }
    
    37
    
          }
    
    38
    
        }
    
    39
    
        .onOpenURL(perform: { url in
    
    40
    
          Task {
    
    41
    
            do {
    
    42
    
              try await supabase.auth.session(from: url)
    
    43
    
            } catch {
    
    44
    
              self.result = .failure(error)
    
    45
    
            }
    
    46
    
          }
    
    47
    
        })
    
    48
    
      }
    
    49
    
    50
    
      func signInButtonTapped() {
    
    51
    
        Task {
    
    52
    
          isLoading = true
    
    53
    
          defer { isLoading = false }
    
    54
    
    55
    
          do {
    
    56
    
            try await supabase.auth.signInWithOTP(
    
    57
    
                email: email,
    
    58
    
                redirectTo: URL(string: "io.supabase.user-management://login-callback")
    
    59
    
            )
    
    60
    
            result = .success(())
    
    61
    
          } catch {
    
    62
    
            result = .failure(error)
    
    63
    
          }
    
    64
    
        }
    
    65
    
      }
    
    66
    
    }
[/code]

The example uses a custom `redirectTo` URL. For this to work, add a custom redirect URL to Supabase and a custom URL scheme to your SwiftUI application. Follow the guide on [implementing deep link handling](</docs/guides/auth/native-mobile-deep-linking?platform=swift>).

### Account view#

After a user is signed in, you can allow them to edit their profile details and manage their account.

Create a new view for that called `ProfileView.swift`.

ProfileView.swift
[code]
    1
    
    import SwiftUI
    
    2
    
    3
    
    struct ProfileView: View {
    
    4
    
      @State var username = ""
    
    5
    
      @State var fullName = ""
    
    6
    
      @State var website = ""
    
    7
    
    8
    
      @State var isLoading = false
    
    9
    
    10
    
      var body: some View {
    
    11
    
        NavigationStack {
    
    12
    
          Form {
    
    13
    
            Section {
    
    14
    
              TextField("Username", text: $username)
    
    15
    
                .textContentType(.username)
    
    16
    
                .textInputAutocapitalization(.never)
    
    17
    
              TextField("Full name", text: $fullName)
    
    18
    
                .textContentType(.name)
    
    19
    
              TextField("Website", text: $website)
    
    20
    
                .textContentType(.URL)
    
    21
    
                .textInputAutocapitalization(.never)
    
    22
    
            }
    
    23
    
    24
    
            Section {
    
    25
    
              Button("Update profile") {
    
    26
    
                updateProfileButtonTapped()
    
    27
    
              }
    
    28
    
              .bold()
    
    29
    
    30
    
              if isLoading {
    
    31
    
                ProgressView()
    
    32
    
              }
    
    33
    
            }
    
    34
    
          }
    
    35
    
          .navigationTitle("Profile")
    
    36
    
          .toolbar(content: {
    
    37
    
            ToolbarItem(placement: .topBarLeading){
    
    38
    
              Button("Sign out", role: .destructive) {
    
    39
    
                Task {
    
    40
    
                  try? await supabase.auth.signOut()
    
    41
    
                }
    
    42
    
              }
    
    43
    
            }
    
    44
    
          })
    
    45
    
        }
    
    46
    
        .task {
    
    47
    
          await getInitialProfile()
    
    48
    
        }
    
    49
    
      }
    
    50
    
    51
    
      func getInitialProfile() async {
    
    52
    
        do {
    
    53
    
          let currentUser = try await supabase.auth.session.user
    
    54
    
    55
    
          let profile: Profile =
    
    56
    
          try await supabase
    
    57
    
            .from("profiles")
    
    58
    
            .select()
    
    59
    
            .eq("id", value: currentUser.id)
    
    60
    
            .single()
    
    61
    
            .execute()
    
    62
    
            .value
    
    63
    
    64
    
          self.username = profile.username ?? ""
    
    65
    
          self.fullName = profile.fullName ?? ""
    
    66
    
          self.website = profile.website ?? ""
    
    67
    
    68
    
        } catch {
    
    69
    
          debugPrint(error)
    
    70
    
        }
    
    71
    
      }
    
    72
    
    73
    
      func updateProfileButtonTapped() {
    
    74
    
        Task {
    
    75
    
          isLoading = true
    
    76
    
          defer { isLoading = false }
    
    77
    
          do {
    
    78
    
            let currentUser = try await supabase.auth.session.user
    
    79
    
    80
    
            try await supabase
    
    81
    
              .from("profiles")
    
    82
    
              .update(
    
    83
    
                UpdateProfileParams(
    
    84
    
                  username: username,
    
    85
    
                  fullName: fullName,
    
    86
    
                  website: website
    
    87
    
                )
    
    88
    
              )
    
    89
    
              .eq("id", value: currentUser.id)
    
    90
    
              .execute()
    
    91
    
          } catch {
    
    92
    
            debugPrint(error)
    
    93
    
          }
    
    94
    
        }
    
    95
    
      }
    
    96
    
    }
[/code]

### Models#

In `ProfileView.swift`, you used 2 model types for deserializing the response and serializing the request to Supabase. Add those in a new `Models.swift` file.

Models.swift
[code]
    1
    
    struct Profile: Decodable {
    
    2
    
      let username: String?
    
    3
    
      let fullName: String?
    
    4
    
      let website: String?
    
    5
    
    6
    
      enum CodingKeys: String, CodingKey {
    
    7
    
        case username
    
    8
    
        case fullName = "full_name"
    
    9
    
        case website
    
    10
    
      }
    
    11
    
    }
    
    12
    
    13
    
    struct UpdateProfileParams: Encodable {
    
    14
    
      let username: String
    
    15
    
      let fullName: String
    
    16
    
      let website: String
    
    17
    
    18
    
      enum CodingKeys: String, CodingKey {
    
    19
    
        case username
    
    20
    
        case fullName = "full_name"
    
    21
    
        case website
    
    22
    
      }
    
    23
    
    }
[/code]

## Profile photos#

Next, add a way for users to upload a profile photo. Supabase configures every project with [Storage](</docs/guides/storage>) for managing large files like photos and videos.

### Add `PhotosPicker`#

Add support for the user to pick an image from the library and upload it. Start by creating a new type to hold the picked avatar image:

AvatarImage.swift
[code]
    1
    
    import SwiftUI
    
    2
    
    3
    
    struct AvatarImage: Transferable, Equatable {
    
    4
    
      let image: Image
    
    5
    
      let data: Data
    
    6
    
    7
    
      static var transferRepresentation: some TransferRepresentation {
    
    8
    
        DataRepresentation(importedContentType: .image) { data in
    
    9
    
          guard let image = AvatarImage(data: data) else {
    
    10
    
            throw TransferError.importFailed
    
    11
    
          }
    
    12
    
    13
    
          return image
    
    14
    
        }
    
    15
    
      }
    
    16
    
    }
    
    17
    
    18
    
    extension AvatarImage {
    
    19
    
      init?(data: Data) {
    
    20
    
        guard let uiImage = UIImage(data: data) else {
    
    21
    
          return nil
    
    22
    
        }
    
    23
    
    24
    
        let image = Image(uiImage: uiImage)
    
    25
    
        self.init(image: image, data: data)
    
    26
    
      }
    
    27
    
    }
    
    28
    
    29
    
    enum TransferError: Error {
    
    30
    
      case importFailed
    
    31
    
    }
[/code]

#### Add `PhotosPicker` to profile page#

ProfileView.swift
[code]
    1
    
    import PhotosUI
    
    2
    
    import Storage
    
    3
    
    import Supabase
    
    4
    
    import SwiftUI
    
    5
    
    6
    
    struct ProfileView: View {
    
    7
    
      @State var username = ""
    
    8
    
      @State var fullName = ""
    
    9
    
      @State var website = ""
    
    10
    
    11
    
      @State var isLoading = false
    
    12
    
    13
    
     @State var imageSelection: PhotosPickerItem?
    
    14
    
     @State var avatarImage: AvatarImage?
    
    15
    
    16
    
      var body: some View {
    
    17
    
        NavigationStack {
    
    18
    
          Form {
    
    19
    
            Section {
    
    20
    
              HStack {
    
    21
    
                Group {
    
    22
    
                  if let avatarImage {
    
    23
    
                    avatarImage.image.resizable()
    
    24
    
                  } else {
    
    25
    
                    Color.clear
    
    26
    
                  }
    
    27
    
                }
    
    28
    
                .scaledToFit()
    
    29
    
                .frame(width: 80, height: 80)
    
    30
    
    31
    
                Spacer()
    
    32
    
    33
    
                PhotosPicker(selection: $imageSelection, matching: .images) {
    
    34
    
                  Image(systemName: "pencil.circle.fill")
    
    35
    
                    .symbolRenderingMode(.multicolor)
    
    36
    
                    .font(.system(size: 30))
    
    37
    
                    .foregroundColor(.accentColor)
    
    38
    
                }
    
    39
    
              }
    
    40
    
            }
    
    41
    
    42
    
            Section {
    
    43
    
              TextField("Username", text: $username)
    
    44
    
                .textContentType(.username)
    
    45
    
                .textInputAutocapitalization(.never)
    
    46
    
              TextField("Full name", text: $fullName)
    
    47
    
                .textContentType(.name)
    
    48
    
              TextField("Website", text: $website)
    
    49
    
                .textContentType(.URL)
    
    50
    
                .textInputAutocapitalization(.never)
    
    51
    
            }
    
    52
    
    53
    
            Section {
    
    54
    
              Button("Update profile") {
    
    55
    
                updateProfileButtonTapped()
    
    56
    
              }
    
    57
    
              .bold()
    
    58
    
    59
    
              if isLoading {
    
    60
    
                ProgressView()
    
    61
    
              }
    
    62
    
            }
    
    63
    
          }
    
    64
    
          .navigationTitle("Profile")
    
    65
    
          .toolbar(content: {
    
    66
    
            ToolbarItem {
    
    67
    
              Button("Sign out", role: .destructive) {
    
    68
    
                Task {
    
    69
    
                  try? await supabase.auth.signOut()
    
    70
    
                }
    
    71
    
              }
    
    72
    
            }
    
    73
    
          })
    
    74
    
          .onChange(of: imageSelection) { _, newValue in
    
    75
    
            guard let newValue else { return }
    
    76
    
            loadTransferable(from: newValue)
    
    77
    
          }
    
    78
    
        }
    
    79
    
        .task {
    
    80
    
          await getInitialProfile()
    
    81
    
        }
    
    82
    
      }
    
    83
    
    84
    
      func getInitialProfile() async {
    
    85
    
        do {
    
    86
    
          let currentUser = try await supabase.auth.session.user
    
    87
    
    88
    
          let profile: Profile =
    
    89
    
          try await supabase
    
    90
    
            .from("profiles")
    
    91
    
            .select()
    
    92
    
            .eq("id", value: currentUser.id)
    
    93
    
            .single()
    
    94
    
            .execute()
    
    95
    
            .value
    
    96
    
    97
    
          username = profile.username ?? ""
    
    98
    
          fullName = profile.fullName ?? ""
    
    99
    
          website = profile.website ?? ""
    
    100
    
    101
    
          if let avatarURL = profile.avatarURL, !avatarURL.isEmpty {
    
    102
    
            try await downloadImage(path: avatarURL)
    
    103
    
          }
    
    104
    
    105
    
        } catch {
    
    106
    
          debugPrint(error)
    
    107
    
        }
    
    108
    
      }
    
    109
    
    110
    
      func updateProfileButtonTapped() {
    
    111
    
        Task {
    
    112
    
          isLoading = true
    
    113
    
          defer { isLoading = false }
    
    114
    
          do {
    
    115
    
            let imageURL = try await uploadImage()
    
    116
    
    117
    
            let currentUser = try await supabase.auth.session.user
    
    118
    
    119
    
            let updatedProfile = Profile(
    
    120
    
              username: username,
    
    121
    
              fullName: fullName,
    
    122
    
              website: website,
    
    123
    
              avatarURL: imageURL
    
    124
    
            )
    
    125
    
    126
    
            try await supabase
    
    127
    
              .from("profiles")
    
    128
    
              .update(updatedProfile)
    
    129
    
              .eq("id", value: currentUser.id)
    
    130
    
              .execute()
    
    131
    
          } catch {
    
    132
    
            debugPrint(error)
    
    133
    
          }
    
    134
    
        }
    
    135
    
      }
    
    136
    
    137
    
      private func loadTransferable(from imageSelection: PhotosPickerItem) {
    
    138
    
        Task {
    
    139
    
          do {
    
    140
    
            avatarImage = try await imageSelection.loadTransferable(type: AvatarImage.self)
    
    141
    
          } catch {
    
    142
    
            debugPrint(error)
    
    143
    
          }
    
    144
    
        }
    
    145
    
      }
    
    146
    
    147
    
      private func downloadImage(path: String) async throws {
    
    148
    
        let data = try await supabase.storage.from("avatars").download(path: path)
    
    149
    
        avatarImage = AvatarImage(data: data)
    
    150
    
      }
    
    151
    
    152
    
      private func uploadImage() async throws -> String? {
    
    153
    
        guard let data = avatarImage?.data else { return nil }
    
    154
    
    155
    
        let filePath = "\(UUID().uuidString).jpeg"
    
    156
    
    157
    
        try await supabase.storage
    
    158
    
          .from("avatars")
    
    159
    
          .upload(
    
    160
    
            filePath,
    
    161
    
            data: data,
    
    162
    
            options: FileOptions(contentType: "image/jpeg")
    
    163
    
          )
    
    164
    
    165
    
        return filePath
    
    166
    
      }
    
    167
    
    }
[/code]

Finally, update your Models.

Models.swift
[code]
    1
    
    struct Profile: Codable {
    
    2
    
      let username: String?
    
    3
    
      let fullName: String?
    
    4
    
      let website: String?
    
    5
    
      let avatarURL: String?
    
    6
    
    7
    
      enum CodingKeys: String, CodingKey {
    
    8
    
        case username
    
    9
    
        case fullName = "full_name"
    
    10
    
        case website
    
    11
    
        case avatarURL = "avatar_url"
    
    12
    
      }
    
    13
    
    }
[/code]

You no longer need the `UpdateProfileParams` struct, as you can now reuse the `Profile` struct for both request and response calls.

### Launch!#

With all the views in place, add an entry point for the application.

Add a new `AppView.swift` file.

AppView.swift
[code]
    1
    
    import SwiftUI
    
    2
    
    3
    
    struct AppView: View {
    
    4
    
      @State var isAuthenticated = false
    
    5
    
    6
    
      var body: some View {
    
    7
    
        Group {
    
    8
    
          if isAuthenticated {
    
    9
    
            ProfileView()
    
    10
    
          } else {
    
    11
    
            AuthView()
    
    12
    
          }
    
    13
    
        }
    
    14
    
        .task {
    
    15
    
          for await state in supabase.auth.authStateChanges {
    
    16
    
            if [.initialSession, .signedIn, .signedOut].contains(state.event) {
    
    17
    
              isAuthenticated = state.session != nil
    
    18
    
            }
    
    19
    
          }
    
    20
    
        }
    
    21
    
      }
    
    22
    
    }
[/code]

Update the entry point to the newly created `AppView`. Run in Xcode to launch your application in the simulator.

At this stage you have a fully functional application!