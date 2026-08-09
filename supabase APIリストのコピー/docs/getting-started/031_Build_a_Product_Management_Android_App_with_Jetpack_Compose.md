---
タイトル: Build a Product Management Android App with Jetpack Compose
URL: https://supabase.com/docs/guides/getting-started/tutorials/with-kotlin
カテゴリ: getting-started
更新日: 2026-08-02
タグ: android, build, compose, getting-started, jetpack, kotlin, management, product, tutorials, with, with-kotlin
---

# Build a Product Management Android App with Jetpack Compose

**URL:** https://supabase.com/docs/guides/getting-started/tutorials/with-kotlin
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** android, build, compose, getting-started, jetpack, kotlin, management, product, tutorials, with, with-kotlin

## 目次

- [Project setup#](#project-setup)
  - [Create a project#](#create-a-project)
  - [Set up the database schema#](#set-up-the-database-schema)
  - [Get API details#](#get-api-details)
  - [Set up Google authentication#](#set-up-google-authentication)
- [Building the app#](#building-the-app)
  - [Create new Android project#](#create-new-android-project)
  - [Set up API key and secret securely#](#set-up-api-key-and-secret-securely)
  - [Set up Supabase dependencies#](#set-up-supabase-dependencies)
  - [Set up Hilt for dependency injection#](#set-up-hilt-for-dependency-injection)
  - [Provide Supabase instances with Hilt#](#provide-supabase-instances-with-hilt)
  - [Create a data transfer object#](#create-a-data-transfer-object)
  - [Implement repositories#](#implement-repositories)
  - [Implement screens#](#implement-screens)
  - [Implement theMainActivity#](#implement-the-mainactivity)
  - [Create the success screen#](#create-the-success-screen)

## 概要

Learn how to use Supabase in your Android Kotlin App.

---

This tutorial demonstrates how to build a basic product management app. The app demonstrates management operations, photo upload, account creation and authentication using:

  * [Supabase Database](</docs/guides/database/overview>) \- a Postgres database for storing your user data and [Row Level Security](</docs/guides/auth#row-level-security>) so data is protected and users can only access their own information.
  * [Supabase Auth](</docs/guides/auth>) \- users log in through magic links sent to their email (without having to set up a password).
  * [Supabase Storage](</docs/guides/storage>) \- users can upload a profile photo.


![manage-product-cover](/docs/img/guides/kotlin/manage-product-cover.png)

If you get stuck while working through this guide, refer to the [full example on GitHub](<https://github.com/hieuwu/product-sample-supabase-kt>).

## Project setup#

Before building, you must set up your Database and API with a new Project in Supabase and then create a "schema" inside the database.

### Create a project#

  1. [Create a new project](<https://app.supabase.com>) in the Supabase Dashboard.
  2. Enter your project details.
  3. Wait for the new database to launch.


### Set up the database schema#

Now we are going to set up the database schema. You can copy/paste the SQL from below and run it yourself.

SQL
[code]
    1
    
    -- Create a table for public profiles
    
    2
    
    3
    
    create table
    
    4
    
      public.products (
    
    5
    
        id uuid not null default gen_random_uuid (),
    
    6
    
        name text not null,
    
    7
    
        price real not null,
    
    8
    
        image text null,
    
    9
    
        constraint products_pkey primary key (id)
    
    10
    
      ) tablespace pg_default;
    
    11
    
    12
    
    -- Set up Storage!
    
    13
    
    insert into storage.buckets (id, name)
    
    14
    
      values ('Product Image', 'Product Image');
    
    15
    
    16
    
    -- Set up access controls for storage.
    
    17
    
    -- See https://supabase.com/docs/guides/storage/security/access-control#policy-examples for more details.
    
    18
    
    CREATE POLICY "Enable read access for all users" ON "storage"."objects"
    
    19
    
    AS PERMISSIVE FOR SELECT
    
    20
    
    TO public
    
    21
    
    USING (true)
    
    22
    
    23
    
    CREATE POLICY "Enable insert for all users" ON "storage"."objects"
    
    24
    
    AS PERMISSIVE FOR INSERT
    
    25
    
    TO authenticated, anon
    
    26
    
    WITH CHECK (true)
    
    27
    
    28
    
    CREATE POLICY "Enable update for all users" ON "storage"."objects"
    
    29
    
    AS PERMISSIVE FOR UPDATE
    
    30
    
    TO public
    
    31
    
    USING (true)
    
    32
    
    WITH CHECK (true)
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=mobiles&framework=androidkotlin>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

### Set up Google authentication#

From the [Google Console](<https://console.developers.google.com/apis/library>), create a new project and add OAuth2 credentials.

![Create Google OAuth credentials](/docs/img/guides/kotlin/google-cloud-oauth-credentials-create.png)

In your [Supabase Auth settings](<https://app.supabase.com/project/_/auth/providers>) enable Google as a provider and set the required credentials as outlined in the [auth docs](</docs/guides/auth/social-login/auth-google>).

## Building the app#

### Create new Android project#

Open Android Studio > New Project > Base Activity (Jetpack Compose).

![Android Studio new project](/docs/img/guides/kotlin/android-studio-new-project.png)

### Set up API key and secret securely#

#### Create local environment secret#

Create or edit the `local.properties` file at the root (same level as `build.gradle`) of your project.

> **Note** : Do not commit this file to your source control, for example, by adding it to your `.gitignore` file!
[code] 
    1
    
    SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
    
    2
    
    SUPABASE_URL=YOUR_SUPABASE_URL
[/code]

#### Read and set value to `BuildConfig`#

In your `build.gradle` (app) file, create a `Properties` object and read the values from your `local.properties` file by calling the `buildConfigField` method:
[code] 
    1
    
    defaultConfig {
    
    2
    
       applicationId "com.example.manageproducts"
    
    3
    
       minSdkVersion 22
    
    4
    
       targetSdkVersion 33
    
    5
    
       versionCode 5
    
    6
    
       versionName "1.0"
    
    7
    
       testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    
    8
    
    9
    
       // Set value part
    
    10
    
       Properties properties = new Properties()
    
    11
    
       properties.load(project.rootProject.file("local.properties").newDataInputStream())
    
    12
    
       buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"${properties.getProperty("SUPABASE_PUBLISHABLE_KEY")}\"")
    
    13
    
       buildConfigField("String", "SECRET", "\"${properties.getProperty("SECRET")}\"")
    
    14
    
       buildConfigField("String", "SUPABASE_URL", "\"${properties.getProperty("SUPABASE_URL")}\"")
    
    15
    
    }
[/code]

#### Use value from `BuildConfig`#

Read the value from `BuildConfig`:
[code] 
    1
    
    val url = BuildConfig.SUPABASE_URL
    
    2
    
    val apiKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
[/code]

### Set up Supabase dependencies#

![Gradle dependencies](/docs/img/guides/kotlin/gradle-dependencies.png)

In the `build.gradle` (app) file, add these dependencies then press "Sync now." Replace the dependency version placeholders `$supabase_version` and `$ktor_version` with their respective latest versions.
[code] 
    1
    
    implementation "io.github.jan-tennert.supabase:postgrest-kt:$supabase_version"
    
    2
    
    implementation "io.github.jan-tennert.supabase:storage-kt:$supabase_version"
    
    3
    
    implementation "io.github.jan-tennert.supabase:auth-kt:$supabase_version"
    
    4
    
    implementation "io.ktor:ktor-client-android:$ktor_version"
    
    5
    
    implementation "io.ktor:ktor-client-core:$ktor_version"
    
    6
    
    implementation "io.ktor:ktor-utils:$ktor_version"
[/code]

Also in the `build.gradle` (app) file, add the plugin for serialization. The version of this plugin should be the same as your Kotlin version.
[code] 
    1
    
    plugins {
    
    2
    
        ...
    
    3
    
        id 'org.jetbrains.kotlin.plugin.serialization' version '$kotlin_version'
    
    4
    
        ...
    
    5
    
    }
[/code]

### Set up Hilt for dependency injection#

In the `build.gradle` (app) file, add the following:
[code] 
    1
    
    implementation "com.google.dagger:hilt-android:$hilt_version"
    
    2
    
    annotationProcessor "com.google.dagger:hilt-compiler:$hilt_version"
    
    3
    
    implementation("androidx.hilt:hilt-navigation-compose:1.0.0")
[/code]

Create a new `ManageProductApplication.kt` class extending Application with `@HiltAndroidApp` annotation:
[code] 
    1
    
    // ManageProductApplication.kt
    
    2
    
    @HiltAndroidApp
    
    3
    
    class ManageProductApplication: Application()
[/code]

Open the `AndroidManifest.xml` file, update name property of Application tag:
[code] 
    1
    
    <application
    
    2
    
    ...
    
    3
    
        android:name=".ManageProductApplication"
    
    4
    
    ...
    
    5
    
    </application>
[/code]

Create the `MainActivity`:
[code] 
    1
    
    @AndroidEntryPoint
    
    2
    
    class MainActivity : ComponentActivity() {
    
    3
    
        //This will come later
    
    4
    
    }
[/code]

### Provide Supabase instances with Hilt#

To make the app easier to test, create a `SupabaseModule.kt` file as follows:
[code] 
    1
    
    @InstallIn(SingletonComponent::class)
    
    2
    
    @Module
    
    3
    
    object SupabaseModule {
    
    4
    
    5
    
        @Provides
    
    6
    
        @Singleton
    
    7
    
        fun provideSupabaseClient(): SupabaseClient {
    
    8
    
            return createSupabaseClient(
    
    9
    
                supabaseUrl = BuildConfig.SUPABASE_URL,
    
    10
    
                supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
    
    11
    
            ) {
    
    12
    
                install(Postgrest)
    
    13
    
                install(Auth) {
    
    14
    
                    flowType = FlowType.PKCE
    
    15
    
                    scheme = "app"
    
    16
    
                    host = "supabase.com"
    
    17
    
                }
    
    18
    
                install(Storage)
    
    19
    
            }
    
    20
    
        }
    
    21
    
    22
    
        @Provides
    
    23
    
        @Singleton
    
    24
    
        fun provideSupabaseDatabase(client: SupabaseClient): Postgrest {
    
    25
    
            return client.postgrest
    
    26
    
        }
    
    27
    
    28
    
        @Provides
    
    29
    
        @Singleton
    
    30
    
        fun provideSupabaseAuth(client: SupabaseClient): Auth {
    
    31
    
            return client.auth
    
    32
    
        }
    
    33
    
    34
    
    35
    
        @Provides
    
    36
    
        @Singleton
    
    37
    
        fun provideSupabaseStorage(client: SupabaseClient): Storage {
    
    38
    
            return client.storage
    
    39
    
        }
    
    40
    
    41
    
    }
[/code]

### Create a data transfer object#

Create a `ProductDto.kt` class and use annotations to parse data from Supabase:
[code] 
    1
    
    @Serializable
    
    2
    
    data class ProductDto(
    
    3
    
    4
    
        @SerialName("name")
    
    5
    
        val name: String,
    
    6
    
    7
    
        @SerialName("price")
    
    8
    
        val price: Double,
    
    9
    
    10
    
        @SerialName("image")
    
    11
    
        val image: String?,
    
    12
    
    13
    
        @SerialName("id")
    
    14
    
        val id: String,
    
    15
    
    )
[/code]

Create a Domain object in `Product.kt` expose the data in your view:
[code] 
    1
    
    data class Product(
    
    2
    
        val id: String,
    
    3
    
        val name: String,
    
    4
    
        val price: Double,
    
    5
    
        val image: String?
    
    6
    
    )
[/code]

### Implement repositories#

Create a `ProductRepository` interface and its implementation named `ProductRepositoryImpl`. This holds the logic to interact with data sources from Supabase. Do the same with the `AuthenticationRepository`.

Create the Product Repository:
[code] 
    1
    
    interface ProductRepository {
    
    2
    
        suspend fun createProduct(product: Product): Boolean
    
    3
    
        suspend fun getProducts(): List<ProductDto>?
    
    4
    
        suspend fun getProduct(id: String): ProductDto
    
    5
    
        suspend fun deleteProduct(id: String)
    
    6
    
        suspend fun updateProduct(
    
    7
    
            id: String, name: String, price: Double, imageName: String, imageFile: ByteArray
    
    8
    
        )
    
    9
    
    }
[/code]
[code] 
    1
    
    class ProductRepositoryImpl @Inject constructor(
    
    2
    
        private val postgrest: Postgrest,
    
    3
    
        private val storage: Storage,
    
    4
    
    ) : ProductRepository {
    
    5
    
        override suspend fun createProduct(product: Product): Boolean {
    
    6
    
            return try {
    
    7
    
                withContext(Dispatchers.IO) {
    
    8
    
                    val productDto = ProductDto(
    
    9
    
                        name = product.name,
    
    10
    
                        price = product.price,
    
    11
    
                    )
    
    12
    
                    postgrest.from("products").insert(productDto)
    
    13
    
                    true
    
    14
    
                }
    
    15
    
                true
    
    16
    
            } catch (e: java.lang.Exception) {
    
    17
    
                throw e
    
    18
    
            }
    
    19
    
        }
    
    20
    
    21
    
        override suspend fun getProducts(): List<ProductDto>? {
    
    22
    
            return withContext(Dispatchers.IO) {
    
    23
    
                val result = postgrest.from("products")
    
    24
    
                    .select().decodeList<ProductDto>()
    
    25
    
                result
    
    26
    
            }
    
    27
    
        }
    
    28
    
    29
    
    30
    
        override suspend fun getProduct(id: String): ProductDto {
    
    31
    
            return withContext(Dispatchers.IO) {
    
    32
    
                postgrest.from("products").select {
    
    33
    
                    filter {
    
    34
    
                        eq("id", id)
    
    35
    
                    }
    
    36
    
                }.decodeSingle<ProductDto>()
    
    37
    
            }
    
    38
    
        }
    
    39
    
    40
    
        override suspend fun deleteProduct(id: String) {
    
    41
    
            return withContext(Dispatchers.IO) {
    
    42
    
                postgrest.from("products").delete {
    
    43
    
                    filter {
    
    44
    
                        eq("id", id)
    
    45
    
                    }
    
    46
    
                }
    
    47
    
            }
    
    48
    
        }
    
    49
    
    50
    
        override suspend fun updateProduct(
    
    51
    
            id: String,
    
    52
    
            name: String,
    
    53
    
            price: Double,
    
    54
    
            imageName: String,
    
    55
    
            imageFile: ByteArray
    
    56
    
        ) {
    
    57
    
            withContext(Dispatchers.IO) {
    
    58
    
                if (imageFile.isNotEmpty()) {
    
    59
    
                    val imageUrl =
    
    60
    
                        storage.from("Product%20Image").upload(
    
    61
    
                            path = "$imageName.png",
    
    62
    
                            data = imageFile,
    
    63
    
                            upsert = true
    
    64
    
                        )
    
    65
    
                    postgrest.from("products").update({
    
    66
    
                        set("name", name)
    
    67
    
                        set("price", price)
    
    68
    
                        set("image", buildImageUrl(imageFileName = imageUrl))
    
    69
    
                    }) {
    
    70
    
                        filter {
    
    71
    
                            eq("id", id)
    
    72
    
                        }
    
    73
    
                    }
    
    74
    
                } else {
    
    75
    
                    postgrest.from("products").update({
    
    76
    
                        set("name", name)
    
    77
    
                        set("price", price)
    
    78
    
                    }) {
    
    79
    
                        filter {
    
    80
    
                            eq("id", id)
    
    81
    
                        }
    
    82
    
                    }
    
    83
    
                }
    
    84
    
            }
    
    85
    
        }
    
    86
    
    87
    
        // Because I named the bucket as "Product Image" so when it turns to an url, it is "%20"
    
    88
    
        // For better approach, you should create your bucket name without space symbol
    
    89
    
        private fun buildImageUrl(imageFileName: String) =
    
    90
    
            "${BuildConfig.SUPABASE_URL}/storage/v1/object/public/${imageFileName}".replace(" ", "%20")
    
    91
    
    }
[/code]

Create the Authentication Repository:
[code] 
    1
    
    interface AuthenticationRepository {
    
    2
    
        suspend fun signIn(email: String, password: String): Boolean
    
    3
    
        suspend fun signUp(email: String, password: String): Boolean
    
    4
    
        suspend fun signInWithGoogle(): Boolean
    
    5
    
    }
[/code]
[code] 
    1
    
    class AuthenticationRepositoryImpl @Inject constructor(
    
    2
    
        private val auth: Auth
    
    3
    
    ) : AuthenticationRepository {
    
    4
    
        override suspend fun signIn(email: String, password: String): Boolean {
    
    5
    
            return try {
    
    6
    
                auth.signInWith(Email) {
    
    7
    
                    this.email = email
    
    8
    
                    this.password = password
    
    9
    
                }
    
    10
    
                true
    
    11
    
            } catch (e: Exception) {
    
    12
    
                false
    
    13
    
            }
    
    14
    
        }
    
    15
    
    16
    
        override suspend fun signUp(email: String, password: String): Boolean {
    
    17
    
            return try {
    
    18
    
                auth.signUpWith(Email) {
    
    19
    
                    this.email = email
    
    20
    
                    this.password = password
    
    21
    
                }
    
    22
    
                true
    
    23
    
            } catch (e: Exception) {
    
    24
    
                false
    
    25
    
            }
    
    26
    
        }
    
    27
    
    28
    
        override suspend fun signInWithGoogle(): Boolean {
    
    29
    
            return try {
    
    30
    
                auth.signInWith(Google)
    
    31
    
                true
    
    32
    
            } catch (e: Exception) {
    
    33
    
                false
    
    34
    
            }
    
    35
    
        }
    
    36
    
    }
[/code]

### Implement screens#

To navigate screens, use the AndroidX navigation library. For routes, implement a `Destination` interface:
[code] 
    1
    
    interface Destination {
    
    2
    
        val route: String
    
    3
    
        val title: String
    
    4
    
    }
    
    5
    
    6
    
    7
    
    object ProductListDestination : Destination {
    
    8
    
        override val route = "product_list"
    
    9
    
        override val title = "Product List"
    
    10
    
    }
    
    11
    
    12
    
    object ProductDetailsDestination : Destination {
    
    13
    
        override val route = "product_details"
    
    14
    
        override val title = "Product Details"
    
    15
    
        const val productId = "product_id"
    
    16
    
        val arguments = listOf(navArgument(name = productId) {
    
    17
    
            type = NavType.StringType
    
    18
    
        })
    
    19
    
        fun createRouteWithParam(productId: String) = "$route/${productId}"
    
    20
    
    }
    
    21
    
    22
    
    object AddProductDestination : Destination {
    
    23
    
        override val route = "add_product"
    
    24
    
        override val title = "Add Product"
    
    25
    
    }
    
    26
    
    27
    
    object AuthenticationDestination: Destination {
    
    28
    
        override val route = "authentication"
    
    29
    
        override val title = "Authentication"
    
    30
    
    }
    
    31
    
    32
    
    object SignUpDestination: Destination {
    
    33
    
        override val route = "signup"
    
    34
    
        override val title = "Sign Up"
    
    35
    
    }
[/code]

This will help later for navigating between screens.

Create a `ProductListViewModel`:
[code] 
    1
    
    @HiltViewModel
    
    2
    
    class ProductListViewModel @Inject constructor(
    
    3
    
    private val productRepository: ProductRepository,
    
    4
    
    ) : ViewModel() {
    
    5
    
    6
    
        private val _productList = MutableStateFlow<List<Product>?>(listOf())
    
    7
    
        val productList: Flow<List<Product>?> = _productList
    
    8
    
    9
    
    10
    
        private val _isLoading = MutableStateFlow(false)
    
    11
    
        val isLoading: Flow<Boolean> = _isLoading
    
    12
    
    13
    
        init {
    
    14
    
            getProducts()
    
    15
    
        }
    
    16
    
    17
    
        fun getProducts() {
    
    18
    
            viewModelScope.launch {
    
    19
    
                val products = productRepository.getProducts()
    
    20
    
                _productList.emit(products?.map { it -> it.asDomainModel() })
    
    21
    
            }
    
    22
    
        }
    
    23
    
    24
    
        fun removeItem(product: Product) {
    
    25
    
            viewModelScope.launch {
    
    26
    
                val newList = mutableListOf<Product>().apply { _productList.value?.let { addAll(it) } }
    
    27
    
                newList.remove(product)
    
    28
    
                _productList.emit(newList.toList())
    
    29
    
                // Call api to remove
    
    30
    
                productRepository.deleteProduct(id = product.id)
    
    31
    
                // Then fetch again
    
    32
    
                getProducts()
    
    33
    
            }
    
    34
    
        }
    
    35
    
    36
    
        private fun ProductDto.asDomainModel(): Product {
    
    37
    
            return Product(
    
    38
    
                id = this.id,
    
    39
    
                name = this.name,
    
    40
    
                price = this.price,
    
    41
    
                image = this.image
    
    42
    
            )
    
    43
    
        }
    
    44
    
    45
    
    }
[/code]

Create the `ProductListScreen.kt`:
[code] 
    1
    
    @OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterialApi::class)
    
    2
    
    @Composable
    
    3
    
    fun ProductListScreen(
    
    4
    
        modifier: Modifier = Modifier,
    
    5
    
        navController: NavController,
    
    6
    
        viewModel: ProductListViewModel = hiltViewModel(),
    
    7
    
    ) {
    
    8
    
        val isLoading by viewModel.isLoading.collectAsState(initial = false)
    
    9
    
        val swipeRefreshState = rememberSwipeRefreshState(isRefreshing = isLoading)
    
    10
    
        SwipeRefresh(state = swipeRefreshState, onRefresh = { viewModel.getProducts() }) {
    
    11
    
            Scaffold(
    
    12
    
                topBar = {
    
    13
    
                    TopAppBar(
    
    14
    
                        backgroundColor = MaterialTheme.colorScheme.primary,
    
    15
    
                        title = {
    
    16
    
                            Text(
    
    17
    
                                text = stringResource(R.string.product_list_text_screen_title),
    
    18
    
                                color = MaterialTheme.colorScheme.onPrimary,
    
    19
    
                            )
    
    20
    
                        },
    
    21
    
                    )
    
    22
    
                },
    
    23
    
                floatingActionButton = {
    
    24
    
                    AddProductButton(onClick = { navController.navigate(AddProductDestination.route) })
    
    25
    
                }
    
    26
    
            ) { padding ->
    
    27
    
                val productList = viewModel.productList.collectAsState(initial = listOf()).value
    
    28
    
                if (!productList.isNullOrEmpty()) {
    
    29
    
                    LazyColumn(
    
    30
    
                        modifier = modifier.padding(padding),
    
    31
    
                        contentPadding = PaddingValues(5.dp)
    
    32
    
                    ) {
    
    33
    
                        itemsIndexed(
    
    34
    
                            items = productList,
    
    35
    
                            key = { _, product -> product.name }) { _, item ->
    
    36
    
                            val state = rememberDismissState(
    
    37
    
                                confirmStateChange = {
    
    38
    
                                    if (it == DismissValue.DismissedToStart) {
    
    39
    
                                        // Handle item removed
    
    40
    
                                        viewModel.removeItem(item)
    
    41
    
                                    }
    
    42
    
                                    true
    
    43
    
                                }
    
    44
    
                            )
    
    45
    
                            SwipeToDismiss(
    
    46
    
                                state = state,
    
    47
    
                                background = {
    
    48
    
                                    val color by animateColorAsState(
    
    49
    
                                        targetValue = when (state.dismissDirection) {
    
    50
    
                                            DismissDirection.StartToEnd -> MaterialTheme.colorScheme.primary
    
    51
    
                                            DismissDirection.EndToStart -> MaterialTheme.colorScheme.primary.copy(
    
    52
    
                                                alpha = 0.2f
    
    53
    
                                            )
    
    54
    
                                            null -> Color.Transparent
    
    55
    
                                        }
    
    56
    
                                    )
    
    57
    
                                    Box(
    
    58
    
                                        modifier = modifier
    
    59
    
                                            .fillMaxSize()
    
    60
    
                                            .background(color = color)
    
    61
    
                                            .padding(16.dp),
    
    62
    
                                    ) {
    
    63
    
                                        Icon(
    
    64
    
                                            imageVector = Icons.Filled.Delete,
    
    65
    
                                            contentDescription = null,
    
    66
    
                                            tint = MaterialTheme.colorScheme.primary,
    
    67
    
                                            modifier = modifier.align(Alignment.CenterEnd)
    
    68
    
                                        )
    
    69
    
                                    }
    
    70
    
    71
    
                                },
    
    72
    
                                dismissContent = {
    
    73
    
                                    ProductListItem(
    
    74
    
                                        product = item,
    
    75
    
                                        modifier = modifier,
    
    76
    
                                        onClick = {
    
    77
    
                                            navController.navigate(
    
    78
    
                                                ProductDetailsDestination.createRouteWithParam(
    
    79
    
                                                    item.id
    
    80
    
                                                )
    
    81
    
                                            )
    
    82
    
                                        },
    
    83
    
                                    )
    
    84
    
                                },
    
    85
    
                                directions = setOf(DismissDirection.EndToStart),
    
    86
    
                            )
    
    87
    
                        }
    
    88
    
                    }
    
    89
    
                } else {
    
    90
    
                    Text("Product list is empty!")
    
    91
    
                }
    
    92
    
    93
    
            }
    
    94
    
        }
    
    95
    
    }
    
    96
    
    97
    
    @Composable
    
    98
    
    private fun AddProductButton(
    
    99
    
        modifier: Modifier = Modifier,
    
    100
    
        onClick: () -> Unit,
    
    101
    
    ) {
    
    102
    
        FloatingActionButton(
    
    103
    
            modifier = modifier,
    
    104
    
            onClick = onClick,
    
    105
    
            containerColor = MaterialTheme.colorScheme.primary,
    
    106
    
            contentColor = MaterialTheme.colorScheme.onPrimary
    
    107
    
        ) {
    
    108
    
            Icon(
    
    109
    
                imageVector = Icons.Filled.Add,
    
    110
    
                contentDescription = null,
    
    111
    
            )
    
    112
    
        }
    
    113
    
    }
[/code]

Create the `ProductDetailsViewModel.kt`:
[code] 
    1
    
    @HiltViewModel
    
    2
    
    class ProductDetailsViewModel @Inject constructor(
    
    3
    
        private val productRepository: ProductRepository,
    
    4
    
        savedStateHandle: SavedStateHandle,
    
    5
    
        ) : ViewModel() {
    
    6
    
    7
    
        private val _product = MutableStateFlow<Product?>(null)
    
    8
    
        val product: Flow<Product?> = _product
    
    9
    
    10
    
        private val _name = MutableStateFlow("")
    
    11
    
        val name: Flow<String> = _name
    
    12
    
    13
    
        private val _price = MutableStateFlow(0.0)
    
    14
    
        val price: Flow<Double> = _price
    
    15
    
    16
    
        private val _imageUrl = MutableStateFlow("")
    
    17
    
        val imageUrl: Flow<String> = _imageUrl
    
    18
    
    19
    
        init {
    
    20
    
            val productId = savedStateHandle.get<String>(ProductDetailsDestination.productId)
    
    21
    
            productId?.let {
    
    22
    
                getProduct(productId = it)
    
    23
    
            }
    
    24
    
        }
    
    25
    
    26
    
        private fun getProduct(productId: String) {
    
    27
    
            viewModelScope.launch {
    
    28
    
               val result = productRepository.getProduct(productId).asDomainModel()
    
    29
    
                _product.emit(result)
    
    30
    
                _name.emit(result.name)
    
    31
    
                _price.emit(result.price)
    
    32
    
            }
    
    33
    
        }
    
    34
    
    35
    
        fun onNameChange(name: String) {
    
    36
    
            _name.value = name
    
    37
    
        }
    
    38
    
    39
    
        fun onPriceChange(price: Double) {
    
    40
    
            _price.value = price
    
    41
    
        }
    
    42
    
    43
    
        fun onSaveProduct(image: ByteArray) {
    
    44
    
            viewModelScope.launch {
    
    45
    
                productRepository.updateProduct(
    
    46
    
                    id = _product.value?.id,
    
    47
    
                    price = _price.value,
    
    48
    
                    name = _name.value,
    
    49
    
                    imageFile = image,
    
    50
    
                    imageName = "image_${_product.value.id}",
    
    51
    
                )
    
    52
    
            }
    
    53
    
        }
    
    54
    
    55
    
        fun onImageChange(url: String) {
    
    56
    
            _imageUrl.value = url
    
    57
    
        }
    
    58
    
    59
    
        private fun ProductDto.asDomainModel(): Product {
    
    60
    
            return Product(
    
    61
    
                id = this.id,
    
    62
    
                name = this.name,
    
    63
    
                price = this.price,
    
    64
    
                image = this.image
    
    65
    
            )
    
    66
    
        }
    
    67
    
    }
[/code]

Create the `ProductDetailsScreen.kt`:
[code] 
    1
    
    @OptIn(ExperimentalCoilApi::class)
    
    2
    
    @SuppressLint("UnusedMaterialScaffoldPaddingParameter")
    
    3
    
    @Composable
    
    4
    
    fun ProductDetailsScreen(
    
    5
    
        modifier: Modifier = Modifier,
    
    6
    
        viewModel: ProductDetailsViewModel = hiltViewModel(),
    
    7
    
        navController: NavController,
    
    8
    
        productId: String?,
    
    9
    
    ) {
    
    10
    
        val snackBarHostState = remember { SnackbarHostState() }
    
    11
    
        val coroutineScope = rememberCoroutineScope()
    
    12
    
    13
    
        Scaffold(
    
    14
    
            snackbarHost = { SnackbarHost(snackBarHostState) },
    
    15
    
            topBar = {
    
    16
    
                TopAppBar(
    
    17
    
                    navigationIcon = {
    
    18
    
                        IconButton(onClick = {
    
    19
    
                            navController.navigateUp()
    
    20
    
                        }) {
    
    21
    
                            Icon(
    
    22
    
                                imageVector = Icons.Filled.ArrowBack,
    
    23
    
                                contentDescription = null,
    
    24
    
                                tint = MaterialTheme.colorScheme.onPrimary
    
    25
    
                            )
    
    26
    
                        }
    
    27
    
                    },
    
    28
    
                    backgroundColor = MaterialTheme.colorScheme.primary,
    
    29
    
                    title = {
    
    30
    
                        Text(
    
    31
    
                            text = stringResource(R.string.product_details_text_screen_title),
    
    32
    
                            color = MaterialTheme.colorScheme.onPrimary,
    
    33
    
                        )
    
    34
    
                    },
    
    35
    
                )
    
    36
    
            }
    
    37
    
        ) {
    
    38
    
            val name = viewModel.name.collectAsState(initial = "")
    
    39
    
            val price = viewModel.price.collectAsState(initial = 0.0)
    
    40
    
            var imageUrl = Uri.parse(viewModel.imageUrl.collectAsState(initial = null).value)
    
    41
    
            val contentResolver = LocalContext.current.contentResolver
    
    42
    
    43
    
            Column(
    
    44
    
                modifier = modifier
    
    45
    
                    .padding(16.dp)
    
    46
    
                    .fillMaxSize()
    
    47
    
            ) {
    
    48
    
                val galleryLauncher =
    
    49
    
                    rememberLauncherForActivityResult(ActivityResultContracts.GetContent())
    
    50
    
                    { uri ->
    
    51
    
                        uri?.let {
    
    52
    
                            if (it.toString() != imageUrl.toString()) {
    
    53
    
                                viewModel.onImageChange(it.toString())
    
    54
    
                            }
    
    55
    
                        }
    
    56
    
                    }
    
    57
    
    58
    
                Image(
    
    59
    
                    painter = rememberImagePainter(imageUrl),
    
    60
    
                    contentScale = ContentScale.Fit,
    
    61
    
                    contentDescription = null,
    
    62
    
                    modifier = Modifier
    
    63
    
                        .padding(16.dp, 8.dp)
    
    64
    
                        .size(100.dp)
    
    65
    
                        .align(Alignment.CenterHorizontally)
    
    66
    
                )
    
    67
    
                IconButton(modifier = modifier.align(alignment = Alignment.CenterHorizontally),
    
    68
    
                    onClick = {
    
    69
    
                        galleryLauncher.launch("image/*")
    
    70
    
                    }) {
    
    71
    
                    Icon(
    
    72
    
                        imageVector = Icons.Filled.Edit,
    
    73
    
                        contentDescription = null,
    
    74
    
                        tint = MaterialTheme.colorScheme.primary
    
    75
    
                    )
    
    76
    
                }
    
    77
    
                OutlinedTextField(
    
    78
    
                    label = {
    
    79
    
                        Text(
    
    80
    
                            text = "Product name",
    
    81
    
                            color = MaterialTheme.colorScheme.primary,
    
    82
    
                            style = MaterialTheme.typography.titleMedium
    
    83
    
                        )
    
    84
    
                    },
    
    85
    
                    maxLines = 2,
    
    86
    
                    shape = RoundedCornerShape(32),
    
    87
    
                    modifier = modifier.fillMaxWidth(),
    
    88
    
                    value = name.value,
    
    89
    
                    onValueChange = {
    
    90
    
                        viewModel.onNameChange(it)
    
    91
    
                    },
    
    92
    
                )
    
    93
    
                Spacer(modifier = modifier.height(12.dp))
    
    94
    
                OutlinedTextField(
    
    95
    
                    label = {
    
    96
    
                        Text(
    
    97
    
                            text = "Product price",
    
    98
    
                            color = MaterialTheme.colorScheme.primary,
    
    99
    
                            style = MaterialTheme.typography.titleMedium
    
    100
    
                        )
    
    101
    
                    },
    
    102
    
                    maxLines = 2,
    
    103
    
                    shape = RoundedCornerShape(32),
    
    104
    
                    modifier = modifier.fillMaxWidth(),
    
    105
    
                    value = price.value.toString(),
    
    106
    
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    
    107
    
                    onValueChange = {
    
    108
    
                        viewModel.onPriceChange(it.toDouble())
    
    109
    
                    },
    
    110
    
                )
    
    111
    
                Spacer(modifier = modifier.weight(1f))
    
    112
    
                Button(
    
    113
    
                    modifier = modifier.fillMaxWidth(),
    
    114
    
                    onClick = {
    
    115
    
                        if (imageUrl.host?.contains("supabase") == true) {
    
    116
    
                            viewModel.onSaveProduct(image = byteArrayOf())
    
    117
    
                        } else {
    
    118
    
                            val image = uriToByteArray(contentResolver, imageUrl)
    
    119
    
                            viewModel.onSaveProduct(image = image)
    
    120
    
                        }
    
    121
    
                        coroutineScope.launch {
    
    122
    
                            snackBarHostState.showSnackbar(
    
    123
    
                                message = "Product updated successfully !",
    
    124
    
                                duration = SnackbarDuration.Short
    
    125
    
                            )
    
    126
    
                        }
    
    127
    
                    }) {
    
    128
    
                    Text(text = "Save changes")
    
    129
    
                }
    
    130
    
                Spacer(modifier = modifier.height(12.dp))
    
    131
    
                OutlinedButton(
    
    132
    
                    modifier = modifier
    
    133
    
                        .fillMaxWidth(),
    
    134
    
                    onClick = {
    
    135
    
                        navController.navigateUp()
    
    136
    
                    }) {
    
    137
    
                    Text(text = "Cancel")
    
    138
    
                }
    
    139
    
    140
    
            }
    
    141
    
    142
    
        }
    
    143
    
    }
    
    144
    
    145
    
    146
    
    private fun getBytes(inputStream: InputStream): ByteArray {
    
    147
    
        val byteBuffer = ByteArrayOutputStream()
    
    148
    
        val bufferSize = 1024
    
    149
    
        val buffer = ByteArray(bufferSize)
    
    150
    
        var len = 0
    
    151
    
        while (inputStream.read(buffer).also { len = it } != -1) {
    
    152
    
            byteBuffer.write(buffer, 0, len)
    
    153
    
        }
    
    154
    
        return byteBuffer.toByteArray()
    
    155
    
    }
    
    156
    
    157
    
    158
    
    private fun uriToByteArray(contentResolver: ContentResolver, uri: Uri): ByteArray {
    
    159
    
        if (uri == Uri.EMPTY) {
    
    160
    
            return byteArrayOf()
    
    161
    
        }
    
    162
    
        val inputStream = contentResolver.openInputStream(uri)
    
    163
    
        if (inputStream != null) {
    
    164
    
            return getBytes(inputStream)
    
    165
    
        }
    
    166
    
        return byteArrayOf()
    
    167
    
    }
[/code]

Create a `AddProductScreen`:
[code] 
    1
    
    @SuppressLint("UnusedMaterial3ScaffoldPaddingParameter")
    
    2
    
    @OptIn(ExperimentalMaterial3Api::class)
    
    3
    
    @Composable
    
    4
    
    fun AddProductScreen(
    
    5
    
        modifier: Modifier = Modifier,
    
    6
    
        navController: NavController,
    
    7
    
        viewModel: AddProductViewModel = hiltViewModel(),
    
    8
    
    ) {
    
    9
    
        Scaffold(
    
    10
    
            topBar = {
    
    11
    
                TopAppBar(
    
    12
    
                    navigationIcon = {
    
    13
    
                        IconButton(onClick = {
    
    14
    
                            navController.navigateUp()
    
    15
    
                        }) {
    
    16
    
                            Icon(
    
    17
    
                                imageVector = Icons.Filled.ArrowBack,
    
    18
    
                                contentDescription = null,
    
    19
    
                                tint = MaterialTheme.colorScheme.onPrimary
    
    20
    
                            )
    
    21
    
                        }
    
    22
    
                    },
    
    23
    
                    backgroundColor = MaterialTheme.colorScheme.primary,
    
    24
    
                    title = {
    
    25
    
                        Text(
    
    26
    
                            text = stringResource(R.string.add_product_text_screen_title),
    
    27
    
                            color = MaterialTheme.colorScheme.onPrimary,
    
    28
    
                        )
    
    29
    
                    },
    
    30
    
                )
    
    31
    
            }
    
    32
    
        ) { padding ->
    
    33
    
            val navigateAddProductSuccess =
    
    34
    
                viewModel.navigateAddProductSuccess.collectAsState(initial = null).value
    
    35
    
            val isLoading =
    
    36
    
                viewModel.isLoading.collectAsState(initial = null).value
    
    37
    
            if (isLoading == true) {
    
    38
    
                LoadingScreen(message = "Adding Product",
    
    39
    
                    onCancelSelected = {
    
    40
    
                        navController.navigateUp()
    
    41
    
                    })
    
    42
    
            } else {
    
    43
    
                SuccessScreen(
    
    44
    
                    message = "Product added",
    
    45
    
                    onMoreAction = {
    
    46
    
                        viewModel.onAddMoreProductSelected()
    
    47
    
                    },
    
    48
    
                    onNavigateBack = {
    
    49
    
                        navController.navigateUp()
    
    50
    
                    })
    
    51
    
            }
    
    52
    
    53
    
        }
    
    54
    
    }
[/code]

Create the `AddProductViewModel.kt`:
[code] 
    1
    
    @HiltViewModel
    
    2
    
    class AddProductViewModel @Inject constructor(
    
    3
    
        private val productRepository: ProductRepository,
    
    4
    
    ) : ViewModel() {
    
    5
    
    6
    
        private val _isLoading = MutableStateFlow(false)
    
    7
    
        val isLoading: Flow<Boolean> = _isLoading
    
    8
    
    9
    
        private val _showSuccessMessage = MutableStateFlow(false)
    
    10
    
        val showSuccessMessage: Flow<Boolean> = _showSuccessMessage
    
    11
    
    12
    
        fun onCreateProduct(name: String, price: Double) {
    
    13
    
            if (name.isEmpty() || price <= 0) return
    
    14
    
            viewModelScope.launch {
    
    15
    
                _isLoading.value = true
    
    16
    
                val product = Product(
    
    17
    
                    id = UUID.randomUUID().toString(),
    
    18
    
                    name = name,
    
    19
    
                    price = price,
    
    20
    
                )
    
    21
    
                productRepository.createProduct(product = product)
    
    22
    
                _isLoading.value = false
    
    23
    
                _showSuccessMessage.emit(true)
    
    24
    
    25
    
            }
    
    26
    
        }
    
    27
    
    }
[/code]

Create a `SignUpViewModel`:
[code] 
    1
    
    @HiltViewModel
    
    2
    
    class SignUpViewModel @Inject constructor(
    
    3
    
        private val authenticationRepository: AuthenticationRepository
    
    4
    
    ) : ViewModel() {
    
    5
    
    6
    
        private val _email = MutableStateFlow("")
    
    7
    
        val email: Flow<String> = _email
    
    8
    
    9
    
        private val _password = MutableStateFlow("")
    
    10
    
        val password = _password
    
    11
    
    12
    
        fun onEmailChange(email: String) {
    
    13
    
            _email.value = email
    
    14
    
        }
    
    15
    
    16
    
        fun onPasswordChange(password: String) {
    
    17
    
            _password.value = password
    
    18
    
        }
    
    19
    
    20
    
        fun onSignUp() {
    
    21
    
            viewModelScope.launch {
    
    22
    
                authenticationRepository.signUp(
    
    23
    
                    email = _email.value,
    
    24
    
                    password = _password.value
    
    25
    
                )
    
    26
    
            }
    
    27
    
        }
    
    28
    
    }
[/code]

Create the `SignUpScreen.kt`:
[code] 
    1
    
    @Composable
    
    2
    
    fun SignUpScreen(
    
    3
    
        modifier: Modifier = Modifier,
    
    4
    
        navController: NavController,
    
    5
    
        viewModel: SignUpViewModel = hiltViewModel()
    
    6
    
    ) {
    
    7
    
        val snackBarHostState = remember { SnackbarHostState() }
    
    8
    
        val coroutineScope = rememberCoroutineScope()
    
    9
    
        Scaffold(
    
    10
    
            snackbarHost = { androidx.compose.material.SnackbarHost(snackBarHostState) },
    
    11
    
            topBar = {
    
    12
    
                TopAppBar(
    
    13
    
                    navigationIcon = {
    
    14
    
                        IconButton(onClick = {
    
    15
    
                            navController.navigateUp()
    
    16
    
                        }) {
    
    17
    
                            Icon(
    
    18
    
                                imageVector = Icons.Filled.ArrowBack,
    
    19
    
                                contentDescription = null,
    
    20
    
                                tint = MaterialTheme.colorScheme.onPrimary
    
    21
    
                            )
    
    22
    
                        }
    
    23
    
                    },
    
    24
    
                    backgroundColor = MaterialTheme.colorScheme.primary,
    
    25
    
                    title = {
    
    26
    
                        Text(
    
    27
    
                            text = "Sign Up",
    
    28
    
                            color = MaterialTheme.colorScheme.onPrimary,
    
    29
    
                        )
    
    30
    
                    },
    
    31
    
                )
    
    32
    
            }
    
    33
    
        ) { paddingValues ->
    
    34
    
            Column(
    
    35
    
                modifier = modifier
    
    36
    
                    .padding(paddingValues)
    
    37
    
                    .padding(20.dp)
    
    38
    
            ) {
    
    39
    
                val email = viewModel.email.collectAsState(initial = "")
    
    40
    
                val password = viewModel.password.collectAsState()
    
    41
    
                OutlinedTextField(
    
    42
    
                    label = {
    
    43
    
                        Text(
    
    44
    
                            text = "Email",
    
    45
    
                            color = MaterialTheme.colorScheme.primary,
    
    46
    
                            style = MaterialTheme.typography.titleMedium
    
    47
    
                        )
    
    48
    
                    },
    
    49
    
                    maxLines = 1,
    
    50
    
                    shape = RoundedCornerShape(32),
    
    51
    
                    modifier = modifier.fillMaxWidth(),
    
    52
    
                    value = email.value,
    
    53
    
                    onValueChange = {
    
    54
    
                        viewModel.onEmailChange(it)
    
    55
    
                    },
    
    56
    
                )
    
    57
    
                OutlinedTextField(
    
    58
    
                    label = {
    
    59
    
                        Text(
    
    60
    
                            text = "Password",
    
    61
    
                            color = MaterialTheme.colorScheme.primary,
    
    62
    
                            style = MaterialTheme.typography.titleMedium
    
    63
    
                        )
    
    64
    
                    },
    
    65
    
                    maxLines = 1,
    
    66
    
                    shape = RoundedCornerShape(32),
    
    67
    
                    modifier = modifier
    
    68
    
                        .fillMaxWidth()
    
    69
    
                        .padding(top = 12.dp),
    
    70
    
                    value = password.value,
    
    71
    
                    onValueChange = {
    
    72
    
                        viewModel.onPasswordChange(it)
    
    73
    
                    },
    
    74
    
                )
    
    75
    
                val localSoftwareKeyboardController = LocalSoftwareKeyboardController.current
    
    76
    
                Button(modifier = modifier
    
    77
    
                    .fillMaxWidth()
    
    78
    
                    .padding(top = 12.dp),
    
    79
    
                    onClick = {
    
    80
    
                        localSoftwareKeyboardController?.hide()
    
    81
    
                        viewModel.onSignUp()
    
    82
    
                        coroutineScope.launch {
    
    83
    
                            snackBarHostState.showSnackbar(
    
    84
    
                                message = "Create account successfully. Sign in now!",
    
    85
    
                                duration = SnackbarDuration.Long
    
    86
    
                            )
    
    87
    
                        }
    
    88
    
                    }) {
    
    89
    
                    Text("Sign up")
    
    90
    
                }
    
    91
    
            }
    
    92
    
        }
    
    93
    
    }
[/code]

Create a `SignInViewModel`:
[code] 
    1
    
    @HiltViewModel
    
    2
    
    class SignInViewModel @Inject constructor(
    
    3
    
        private val authenticationRepository: AuthenticationRepository
    
    4
    
    ) : ViewModel() {
    
    5
    
    6
    
        private val _email = MutableStateFlow("")
    
    7
    
        val email: Flow<String> = _email
    
    8
    
    9
    
        private val _password = MutableStateFlow("")
    
    10
    
        val password = _password
    
    11
    
    12
    
        fun onEmailChange(email: String) {
    
    13
    
            _email.value = email
    
    14
    
        }
    
    15
    
    16
    
        fun onPasswordChange(password: String) {
    
    17
    
            _password.value = password
    
    18
    
        }
    
    19
    
    20
    
        fun onSignIn() {
    
    21
    
            viewModelScope.launch {
    
    22
    
                authenticationRepository.signIn(
    
    23
    
                    email = _email.value,
    
    24
    
                    password = _password.value
    
    25
    
                )
    
    26
    
            }
    
    27
    
        }
    
    28
    
    29
    
        fun onGoogleSignIn() {
    
    30
    
            viewModelScope.launch {
    
    31
    
                authenticationRepository.signInWithGoogle()
    
    32
    
            }
    
    33
    
        }
    
    34
    
    35
    
    }
[/code]

Create the `SignInScreen.kt`:
[code] 
    1
    
    @OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
    
    2
    
    @Composable
    
    3
    
    fun SignInScreen(
    
    4
    
        modifier: Modifier = Modifier,
    
    5
    
        navController: NavController,
    
    6
    
        viewModel: SignInViewModel = hiltViewModel()
    
    7
    
    ) {
    
    8
    
        val snackBarHostState = remember { SnackbarHostState() }
    
    9
    
        val coroutineScope = rememberCoroutineScope()
    
    10
    
        Scaffold(
    
    11
    
            snackbarHost = { androidx.compose.material.SnackbarHost(snackBarHostState) },
    
    12
    
            topBar = {
    
    13
    
                TopAppBar(
    
    14
    
                    navigationIcon = {
    
    15
    
                        IconButton(onClick = {
    
    16
    
                            navController.navigateUp()
    
    17
    
                        }) {
    
    18
    
                            Icon(
    
    19
    
                                imageVector = Icons.Filled.ArrowBack,
    
    20
    
                                contentDescription = null,
    
    21
    
                                tint = MaterialTheme.colorScheme.onPrimary
    
    22
    
                            )
    
    23
    
                        }
    
    24
    
                    },
    
    25
    
                    backgroundColor = MaterialTheme.colorScheme.primary,
    
    26
    
                    title = {
    
    27
    
                        Text(
    
    28
    
                            text = "Login",
    
    29
    
                            color = MaterialTheme.colorScheme.onPrimary,
    
    30
    
                        )
    
    31
    
                    },
    
    32
    
                )
    
    33
    
            }
    
    34
    
        ) { paddingValues ->
    
    35
    
            Column(
    
    36
    
                modifier = modifier
    
    37
    
                    .padding(paddingValues)
    
    38
    
                    .padding(20.dp)
    
    39
    
            ) {
    
    40
    
                val email = viewModel.email.collectAsState(initial = "")
    
    41
    
                val password = viewModel.password.collectAsState()
    
    42
    
                androidx.compose.material.OutlinedTextField(
    
    43
    
                    label = {
    
    44
    
                        Text(
    
    45
    
                            text = "Email",
    
    46
    
                            color = MaterialTheme.colorScheme.primary,
    
    47
    
                            style = MaterialTheme.typography.titleMedium
    
    48
    
                        )
    
    49
    
                    },
    
    50
    
                    maxLines = 1,
    
    51
    
                    shape = RoundedCornerShape(32),
    
    52
    
                    modifier = modifier.fillMaxWidth(),
    
    53
    
                    value = email.value,
    
    54
    
                    onValueChange = {
    
    55
    
                        viewModel.onEmailChange(it)
    
    56
    
                    },
    
    57
    
                )
    
    58
    
                androidx.compose.material.OutlinedTextField(
    
    59
    
                    label = {
    
    60
    
                        Text(
    
    61
    
                            text = "Password",
    
    62
    
                            color = MaterialTheme.colorScheme.primary,
    
    63
    
                            style = MaterialTheme.typography.titleMedium
    
    64
    
                        )
    
    65
    
                    },
    
    66
    
                    maxLines = 1,
    
    67
    
                    shape = RoundedCornerShape(32),
    
    68
    
                    modifier = modifier
    
    69
    
                        .fillMaxWidth()
    
    70
    
                        .padding(top = 12.dp),
    
    71
    
                    value = password.value,
    
    72
    
                    onValueChange = {
    
    73
    
                        viewModel.onPasswordChange(it)
    
    74
    
                    },
    
    75
    
                )
    
    76
    
                val localSoftwareKeyboardController = LocalSoftwareKeyboardController.current
    
    77
    
                Button(modifier = modifier
    
    78
    
                    .fillMaxWidth()
    
    79
    
                    .padding(top = 12.dp),
    
    80
    
                    onClick = {
    
    81
    
                        localSoftwareKeyboardController?.hide()
    
    82
    
                        viewModel.onGoogleSignIn()
    
    83
    
                    }) {
    
    84
    
                    Text("Sign in with Google")
    
    85
    
                }
    
    86
    
                Button(modifier = modifier
    
    87
    
                    .fillMaxWidth()
    
    88
    
                    .padding(top = 12.dp),
    
    89
    
                    onClick = {
    
    90
    
                        localSoftwareKeyboardController?.hide()
    
    91
    
                        viewModel.onSignIn()
    
    92
    
                        coroutineScope.launch {
    
    93
    
                            snackBarHostState.showSnackbar(
    
    94
    
                                message = "Sign in successfully !",
    
    95
    
                                duration = SnackbarDuration.Long
    
    96
    
                            )
    
    97
    
                        }
    
    98
    
                    }) {
    
    99
    
                    Text("Sign in")
    
    100
    
                }
    
    101
    
                OutlinedButton(modifier = modifier
    
    102
    
                    .fillMaxWidth()
    
    103
    
                    .padding(top = 12.dp), onClick = {
    
    104
    
                    navController.navigate(SignUpDestination.route)
    
    105
    
                }) {
    
    106
    
                    Text("Sign up")
    
    107
    
                }
    
    108
    
            }
    
    109
    
        }
    
    110
    
    }
[/code]

### Implement the `MainActivity`#

In the `MainActivity` you created earlier, show your newly created screens:
[code] 
    1
    
    @AndroidEntryPoint
    
    2
    
    class MainActivity : ComponentActivity() {
    
    3
    
        @Inject
    
    4
    
        lateinit var supabaseClient: SupabaseClient
    
    5
    
    6
    
        @OptIn(ExperimentalMaterial3Api::class)
    
    7
    
        override fun onCreate(savedInstanceState: Bundle?) {
    
    8
    
            super.onCreate(savedInstanceState)
    
    9
    
            setContent {
    
    10
    
                ManageProductsTheme {
    
    11
    
                    // A surface container using the 'background' color from the theme
    
    12
    
                    val navController = rememberNavController()
    
    13
    
                    val currentBackStack by navController.currentBackStackEntryAsState()
    
    14
    
                    val currentDestination = currentBackStack?.destination
    
    15
    
                    Scaffold { innerPadding ->
    
    16
    
                        NavHost(
    
    17
    
                            navController,
    
    18
    
                            startDestination = ProductListDestination.route,
    
    19
    
                            Modifier.padding(innerPadding)
    
    20
    
                        ) {
    
    21
    
                            composable(ProductListDestination.route) {
    
    22
    
                                ProductListScreen(
    
    23
    
                                    navController = navController
    
    24
    
                                )
    
    25
    
                            }
    
    26
    
    27
    
                            composable(AuthenticationDestination.route) {
    
    28
    
                                SignInScreen(
    
    29
    
                                    navController = navController
    
    30
    
                                )
    
    31
    
                            }
    
    32
    
    33
    
                            composable(SignUpDestination.route) {
    
    34
    
                                SignUpScreen(
    
    35
    
                                    navController = navController
    
    36
    
                                )
    
    37
    
                            }
    
    38
    
    39
    
                            composable(AddProductDestination.route) {
    
    40
    
                                AddProductScreen(
    
    41
    
                                    navController = navController
    
    42
    
                                )
    
    43
    
                            }
    
    44
    
    45
    
                            composable(
    
    46
    
                                route = "${ProductDetailsDestination.route}/{${ProductDetailsDestination.productId}}",
    
    47
    
                                arguments = ProductDetailsDestination.arguments
    
    48
    
                            ) { navBackStackEntry ->
    
    49
    
                                val productId =
    
    50
    
                                    navBackStackEntry.arguments?.getString(ProductDetailsDestination.productId)
    
    51
    
                                ProductDetailsScreen(
    
    52
    
                                    productId = productId,
    
    53
    
                                    navController = navController,
    
    54
    
                                )
    
    55
    
                            }
    
    56
    
                        }
    
    57
    
                    }
    
    58
    
                }
    
    59
    
            }
    
    60
    
        }
    
    61
    
    }
[/code]

### Create the success screen#

To handle OAuth and OTP signins, create a new activity to handle the deep link you set in `AndroidManifest.xml`:
[code] 
    1
    
    <?xml version="1.0" encoding="utf-8"?>
    
    2
    
    <manifest xmlns:android="http://schemas.android.com/apk/res/android"
    
    3
    
        xmlns:tools="http://schemas.android.com/tools">
    
    4
    
        <uses-permission android:name="android.permission.INTERNET" />
    
    5
    
        <application
    
    6
    
            android:name=".ManageProductApplication"
    
    7
    
            android:allowBackup="true"
    
    8
    
            android:dataExtractionRules="@xml/data_extraction_rules"
    
    9
    
            android:enableOnBackInvokedCallback="true"
    
    10
    
            android:fullBackupContent="@xml/backup_rules"
    
    11
    
            android:icon="@mipmap/ic_launcher"
    
    12
    
            android:label="@string/app_name"
    
    13
    
            android:supportsRtl="true"
    
    14
    
            android:theme="@style/Theme.ManageProducts"
    
    15
    
            tools:targetApi="31">
    
    16
    
            <activity
    
    17
    
                android:name=".DeepLinkHandlerActivity"
    
    18
    
                android:exported="true"
    
    19
    
                android:theme="@style/Theme.ManageProducts" >
    
    20
    
                <intent-filter android:autoVerify="true">
    
    21
    
                    <action android:name="android.intent.action.VIEW" />
    
    22
    
                    <category android:name="android.intent.category.DEFAULT" />
    
    23
    
                    <category android:name="android.intent.category.BROWSABLE" />
    
    24
    
                    <data
    
    25
    
                        android:host="supabase.com"
    
    26
    
                        android:scheme="app" />
    
    27
    
                </intent-filter>
    
    28
    
            </activity>
    
    29
    
            <activity
    
    30
    
                android:name=".MainActivity"
    
    31
    
                android:exported="true"
    
    32
    
                android:label="@string/app_name"
    
    33
    
                android:theme="@style/Theme.ManageProducts">
    
    34
    
                <intent-filter>
    
    35
    
                    <action android:name="android.intent.action.MAIN" />
    
    36
    
                    <category android:name="android.intent.category.LAUNCHER" />
    
    37
    
                </intent-filter>
    
    38
    
            </activity>
    
    39
    
        </application>
    
    40
    
    </manifest>
[/code]

Then create the `DeepLinkHandlerActivity`:
[code] 
    1
    
    @AndroidEntryPoint
    
    2
    
    class DeepLinkHandlerActivity : ComponentActivity() {
    
    3
    
    4
    
        @Inject
    
    5
    
        lateinit var supabaseClient: SupabaseClient
    
    6
    
    7
    
        private lateinit var callback: (String, String) -> Unit
    
    8
    
    9
    
        override fun onCreate(savedInstanceState: Bundle?) {
    
    10
    
            super.onCreate(savedInstanceState)
    
    11
    
            supabaseClient.handleDeeplinks(intent = intent,
    
    12
    
                onSessionSuccess = { userSession ->
    
    13
    
                    Log.d("LOGIN", "Log in successfully with user info: ${userSession.user}")
    
    14
    
                    userSession.user?.apply {
    
    15
    
                        callback(email ?: "", createdAt.toString())
    
    16
    
                    }
    
    17
    
                })
    
    18
    
            setContent {
    
    19
    
                val navController = rememberNavController()
    
    20
    
                val emailState = remember { mutableStateOf("") }
    
    21
    
                val createdAtState = remember { mutableStateOf("") }
    
    22
    
                LaunchedEffect(Unit) {
    
    23
    
                    callback = { email, created ->
    
    24
    
                        emailState.value = email
    
    25
    
                        createdAtState.value = created
    
    26
    
                    }
    
    27
    
                }
    
    28
    
                ManageProductsTheme {
    
    29
    
                    Surface(
    
    30
    
                        modifier = Modifier.fillMaxSize(),
    
    31
    
                        color = MaterialTheme.colorScheme.background
    
    32
    
                    ) {
    
    33
    
                        SignInSuccessScreen(
    
    34
    
                            modifier = Modifier.padding(20.dp),
    
    35
    
                            navController = navController,
    
    36
    
                            email = emailState.value,
    
    37
    
                            createdAt = createdAtState.value,
    
    38
    
                            onClick = { navigateToMainApp() }
    
    39
    
                        )
    
    40
    
                    }
    
    41
    
                }
    
    42
    
            }
    
    43
    
        }
    
    44
    
    45
    
        private fun navigateToMainApp() {
    
    46
    
            val intent = Intent(this, MainActivity::class.java).apply {
    
    47
    
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
    
    48
    
            }
    
    49
    
            startActivity(intent)
    
    50
    
        }
    
    51
    
    }
[/code]