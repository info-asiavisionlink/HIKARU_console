---
タイトル: Use Supabase Auth with Astro
URL: https://supabase.com/docs/guides/auth/quickstarts/astrojs
カテゴリ: auth
更新日: 2026-08-02
タグ: astro, astrojs, auth, quickstarts, supabase, with
---

# Use Supabase Auth with Astro

**URL:** https://supabase.com/docs/guides/auth/quickstarts/astrojs
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** astro, astrojs, auth, quickstarts, supabase, with

## 目次

  - [Get API details#](#get-api-details)
- [Learn more#](#learn-more)

## 概要

Learn how to configure Supabase Auth for Astro with server-side rendering.

---

1

Create a new Supabase project

Head over to [database.new](<https://database.new>) and create a new Supabase project.

Your new database has a table for storing your users. You can see that this table is currently empty by running some SQL in the [SQL Editor](</dashboard/project/_/sql/new>).

SQL_EDITOR
[code]
    1
    
    select * from auth.users;
[/code]

2

Create an Astro app

Create a new Astro app using the `npm create` command.

Explore drop-in UI components for your Supabase app.

UI components built on shadcn/ui that connect to Supabase via a single command.

[Explore Components](<https://supabase.com/ui>)

Terminal
[code]
    1
    
    npm create astro@latest my-app
    
    2
    
    cd my-app
[/code]

3

Install Supabase libraries and Node adapter

Install the `@supabase/supabase-js` client library, `@supabase/ssr` for server-side auth, and the `@astrojs/node` adapter to enable server-side rendering.

Terminal
[code]
    1
    
    npm install @supabase/supabase-js @supabase/ssr @astrojs/node
[/code]

4

Configure Astro for SSR

Update your `astro.config.mjs` to enable server-side rendering with the Node adapter.

astro.config.mjs
[code]
    1
    
    import { defineConfig } from "astro/config";
    
    2
    
    import node from "@astrojs/node";
    
    3
    
    4
    
    export default defineConfig({
    
    5
    
      output: "server",
    
    6
    
      adapter: node({
    
    7
    
        mode: "standalone",
    
    8
    
      }),
    
    9
    
    });
[/code]

5

Declare Supabase Environment Variables

Create a `.env.local` file and populate with your Supabase connection variables:

Project URL

No project found

Publishable key

No project found

.env.local
[code]
    1
    
    PUBLIC_SUPABASE_URL=your-project-url
    
    2
    
    PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_key
[/code]

### Get API details#

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](</docs/guides/api>), authenticating using the Project URL and key from [the project **Connect** dialog](</dashboard/project/_?showConnect=true&connectTab=frameworks&framework=astro>).

Project URL

No project found

Publishable key

No project found

[Read the API keys docs](</docs/guides/getting-started/api-keys>) for a full explanation of all key types, their uses, and where to find them.

6

Create a Supabase client helper

Create a utility file to initialize the Supabase client with SSR support:

src/lib/supabase.ts
[code]
    1
    
    import { createServerClient, parseCookieHeader } from "@supabase/ssr";
    
    2
    
    import type { AstroCookies } from "astro";
    
    3
    
    4
    
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
    
    5
    
    const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    
    6
    
    7
    
    export function createClient({
    
    8
    
      request,
    
    9
    
      cookies,
    
    10
    
    }: {
    
    11
    
      request: Request;
    
    12
    
      cookies: AstroCookies;
    
    13
    
    }) {
    
    14
    
      return createServerClient(
    
    15
    
        supabaseUrl,
    
    16
    
        supabasePublishableKey,
    
    17
    
        {
    
    18
    
          cookies: {
    
    19
    
            getAll() {
    
    20
    
              return parseCookieHeader(
    
    21
    
                request.headers.get("Cookie") ?? ""
    
    22
    
              );
    
    23
    
            },
    
    24
    
            setAll(cookiesToSet) {
    
    25
    
              cookiesToSet.forEach(({ name, value, options }) =>
    
    26
    
                cookies.set(name, value, options)
    
    27
    
              );
    
    28
    
            },
    
    29
    
          },
    
    30
    
        }
    
    31
    
      );
    
    32
    
    }
[/code]

7

Create authentication actions

Create a new file at `src/actions/index.ts` to define server-side authentication actions for signing up, signing in, and signing out:

src/actions/index.ts
[code]
    1
    
    import { defineAction } from "astro:actions";
    
    2
    
    import { z } from "astro/zod";
    
    3
    
    import { createClient } from "../lib/supabase";
    
    4
    
    5
    
    export const server = {
    
    6
    
      signUp: defineAction({
    
    7
    
        accept: "form",
    
    8
    
        input: z.object({
    
    9
    
          email: z.string().email(),
    
    10
    
          password: z.string().min(6),
    
    11
    
        }),
    
    12
    
        handler: async (input, context) => {
    
    13
    
          try {
    
    14
    
            const supabase = createClient({
    
    15
    
              request: context.request,
    
    16
    
              cookies: context.cookies,
    
    17
    
            });
    
    18
    
    19
    
            const { error } = await supabase.auth.signUp({
    
    20
    
              email: input.email,
    
    21
    
              password: input.password,
    
    22
    
              options: {
    
    23
    
                emailRedirectTo: "http://localhost:4321/auth/callback",
    
    24
    
              },
    
    25
    
            });
    
    26
    
    27
    
            if (error) {
    
    28
    
              return {
    
    29
    
                success: false,
    
    30
    
                message: error.message,
    
    31
    
              };
    
    32
    
            }
    
    33
    
    34
    
            return {
    
    35
    
              success: true,
    
    36
    
              message: "Check your email to confirm your account",
    
    37
    
            };
    
    38
    
          } catch (err) {
    
    39
    
            return {
    
    40
    
              success: false,
    
    41
    
              message: "Unexpected error",
    
    42
    
            };
    
    43
    
          }
    
    44
    
        },
    
    45
    
      }),
    
    46
    
      signIn: defineAction({
    
    47
    
        accept: "form",
    
    48
    
        input: z.object({
    
    49
    
          email: z.string().email(),
    
    50
    
          password: z.string(),
    
    51
    
        }),
    
    52
    
        handler: async (input, context) => {
    
    53
    
          try {
    
    54
    
            const supabase = createClient({
    
    55
    
              request: context.request,
    
    56
    
              cookies: context.cookies,
    
    57
    
            });
    
    58
    
    59
    
            const { error } = await supabase.auth.signInWithPassword({
    
    60
    
              email: input.email,
    
    61
    
              password: input.password,
    
    62
    
            });
    
    63
    
    64
    
            if (error) {
    
    65
    
              return {
    
    66
    
                success: false,
    
    67
    
                message: error.message,
    
    68
    
              };
    
    69
    
            }
    
    70
    
    71
    
            return {
    
    72
    
              success: true,
    
    73
    
              message: "Signed in successfully",
    
    74
    
            };
    
    75
    
          } catch (err) {
    
    76
    
            return {
    
    77
    
              success: false,
    
    78
    
              message: "Unexpected error",
    
    79
    
            };
    
    80
    
          }
    
    81
    
        },
    
    82
    
      }),
    
    83
    
      signOut: defineAction({
    
    84
    
        handler: async (_, context) => {
    
    85
    
          try {
    
    86
    
            const supabase = createClient({
    
    87
    
              request: context.request,
    
    88
    
              cookies: context.cookies,
    
    89
    
            });
    
    90
    
    91
    
            await supabase.auth.signOut();
    
    92
    
    93
    
            return {
    
    94
    
              success: true,
    
    95
    
            };
    
    96
    
          } catch (err) {
    
    97
    
            return {
    
    98
    
              success: false,
    
    99
    
              message: "Failed to sign out",
    
    100
    
            };
    
    101
    
          }
    
    102
    
        },
    
    103
    
      }),
    
    104
    
    };
[/code]

8

Customize email template

Before users can confirm their email, update the Supabase email template to send the token hash to your callback URL.

In your [Supabase project dashboard](</dashboard/project/_/auth/templates>):

  * Go to **Auth** > **Email Templates**
  * Select the **Confirm signup** template
  * Change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`.
  * Change your [Site URL](</dashboard/project/_/auth/url-configuration>) to `http://localhost:4321`


Email\
[code]
    1
    
    {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
[/code]

9

Create an auth callback page

Create a new file at `src/pages/auth/callback.astro` to handle the email confirmation callback. Extract the token from the URL and verify it with Supabase:

src/pages/auth/callback.astro
[code]
    1
    
    ---
    
    2
    
    import { createClient } from "../../lib/supabase";
    
    3
    
    import type { EmailOtpType } from "@supabase/supabase-js";
    
    4
    
    5
    
    const supabase = createClient({
    
    6
    
      request: Astro.request,
    
    7
    
      cookies: Astro.cookies,
    
    8
    
    });
    
    9
    
    10
    
    const requestUrl = new URL(Astro.request.url);
    
    11
    
    const token_hash = requestUrl.searchParams.get('token_hash');
    
    12
    
    const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
    
    13
    
    14
    
    if (token_hash && type) {
    
    15
    
      const { error } = await supabase.auth.verifyOtp({
    
    16
    
        token_hash,
    
    17
    
        type,
    
    18
    
      });
    
    19
    
    20
    
      if (!error) {
    
    21
    
        return Astro.redirect("/dashboard");
    
    22
    
      }
    
    23
    
    }
    
    24
    
    25
    
    return Astro.redirect("/auth/signin");
    
    26
    
    ---
    
    27
    
    28
    
    <html>
    
    29
    
      <head>
    
    30
    
        <title>Email Confirmation</title>
    
    31
    
      </head>
    
    32
    
      <body>
    
    33
    
        <p>Confirming your email...</p>
    
    34
    
      </body>
    
    35
    
    </html>
[/code]

10

Create a sign-up page

Create a new file at `src/pages/auth/signup.astro` with a sign-up form. Use a client-side event listener to handle form submission:

src/pages/auth/signup.astro
[code]
    1
    
    ---
    
    2
    
    import { createClient } from "../../lib/supabase";
    
    3
    
    4
    
    const supabase = createClient({
    
    5
    
      request: Astro.request,
    
    6
    
      cookies: Astro.cookies,
    
    7
    
    });
    
    8
    
    9
    
    const { data } = await supabase.auth.getUser();
    
    10
    
    11
    
    if (data?.user) {
    
    12
    
      return Astro.redirect("/dashboard");
    
    13
    
    }
    
    14
    
    ---
    
    15
    
    16
    
    <html>
    
    17
    
      <head>
    
    18
    
        <title>Sign Up</title>
    
    19
    
      </head>
    
    20
    
      <body>
    
    21
    
        <h1>Sign Up</h1>
    
    22
    
    23
    
        <div id="message"></div>
    
    24
    
    25
    
        <form id="signup-form">
    
    26
    
          <div>
    
    27
    
            <label for="email">Email</label>
    
    28
    
            <input
    
    29
    
              id="email"
    
    30
    
              type="email"
    
    31
    
              name="email"
    
    32
    
              placeholder="your@email.com"
    
    33
    
              required
    
    34
    
            />
    
    35
    
          </div>
    
    36
    
          <div>
    
    37
    
            <label for="password">Password</label>
    
    38
    
            <input
    
    39
    
              id="password"
    
    40
    
              type="password"
    
    41
    
              name="password"
    
    42
    
              placeholder="At least 6 characters"
    
    43
    
              required
    
    44
    
            />
    
    45
    
          </div>
    
    46
    
          <button type="submit" id="signup-btn">Sign Up</button>
    
    47
    
        </form>
    
    48
    
        <p>
    
    49
    
          Already have an account? <a href="/auth/signin">Sign in</a>
    
    50
    
        </p>
    
    51
    
      </body>
    
    52
    
    </html>
    
    53
    
    54
    
    <script>
    
    55
    
      import { actions } from "astro:actions";
    
    56
    
    57
    
      const form = document.querySelector("#signup-form") as HTMLFormElement;
    
    58
    
      const btn = document.getElementById("signup-btn") as HTMLButtonElement;
    
    59
    
      const messageEl = document.getElementById("message") as HTMLDivElement;
    
    60
    
    61
    
      form?.addEventListener("submit", async (e) => {
    
    62
    
        e.preventDefault();
    
    63
    
        btn.disabled = true;
    
    64
    
        btn.textContent = "Signing up...";
    
    65
    
        messageEl.textContent = "";
    
    66
    
    67
    
        try {
    
    68
    
          const formData = new FormData(form);
    
    69
    
          const result = await actions.signUp(formData);
    
    70
    
    71
    
          if (!result.data?.success) {
    
    72
    
            btn.disabled = false;
    
    73
    
            btn.textContent = "Sign Up";
    
    74
    
            messageEl.textContent = result.data?.message || "Sign up failed";
    
    75
    
            messageEl.style.color = "red";
    
    76
    
            return;
    
    77
    
          }
    
    78
    
    79
    
          messageEl.textContent = result.data.message;
    
    80
    
          messageEl.style.color = "green";
    
    81
    
          btn.textContent = "Sign Up";
    
    82
    
        } catch (error) {
    
    83
    
          btn.disabled = false;
    
    84
    
          btn.textContent = "Sign Up";
    
    85
    
          messageEl.textContent = "An error occurred. Please try again.";
    
    86
    
          messageEl.style.color = "red";
    
    87
    
          console.error(error);
    
    88
    
        }
    
    89
    
      });
    
    90
    
    </script>
[/code]

11

Create a sign-in page

Create a new file at `src/pages/auth/signin.astro` with a sign-in form. Use a client-side event listener to handle form submission:

src/pages/auth/signin.astro
[code]
    1
    
    ---
    
    2
    
    import { createClient } from "../../lib/supabase";
    
    3
    
    4
    
    const supabase = createClient({
    
    5
    
      request: Astro.request,
    
    6
    
      cookies: Astro.cookies,
    
    7
    
    });
    
    8
    
    9
    
    const { data } = await supabase.auth.getUser();
    
    10
    
    11
    
    if (data?.user) {
    
    12
    
      return Astro.redirect("/dashboard");
    
    13
    
    }
    
    14
    
    ---
    
    15
    
    16
    
    <html>
    
    17
    
      <head>
    
    18
    
        <title>Sign In</title>
    
    19
    
      </head>
    
    20
    
      <body>
    
    21
    
        <h1>Sign In</h1>
    
    22
    
    23
    
        <div id="message"></div>
    
    24
    
    25
    
        <form id="signin-form">
    
    26
    
          <div>
    
    27
    
            <label for="email">Email</label>
    
    28
    
            <input
    
    29
    
              id="email"
    
    30
    
              type="email"
    
    31
    
              name="email"
    
    32
    
              placeholder="your@email.com"
    
    33
    
              required
    
    34
    
            />
    
    35
    
          </div>
    
    36
    
          <div>
    
    37
    
            <label for="password">Password</label>
    
    38
    
            <input
    
    39
    
              id="password"
    
    40
    
              type="password"
    
    41
    
              name="password"
    
    42
    
              placeholder="Your password"
    
    43
    
              required
    
    44
    
            />
    
    45
    
          </div>
    
    46
    
          <button type="submit" id="signin-btn">Sign In</button>
    
    47
    
        </form>
    
    48
    
        <p>
    
    49
    
          Don't have an account? <a href="/auth/signup">Sign up</a>
    
    50
    
        </p>
    
    51
    
      </body>
    
    52
    
    </html>
    
    53
    
    54
    
    <script>
    
    55
    
      import { actions } from "astro:actions";
    
    56
    
    57
    
      const form = document.querySelector("#signin-form") as HTMLFormElement;
    
    58
    
      const btn = document.getElementById("signin-btn") as HTMLButtonElement;
    
    59
    
      const messageEl = document.getElementById("message") as HTMLDivElement;
    
    60
    
    61
    
      form?.addEventListener("submit", async (e) => {
    
    62
    
        e.preventDefault();
    
    63
    
        btn.disabled = true;
    
    64
    
        btn.textContent = "Signing in...";
    
    65
    
        messageEl.textContent = "";
    
    66
    
    67
    
        try {
    
    68
    
          const formData = new FormData(form);
    
    69
    
          const result = await actions.signIn(formData);
    
    70
    
    71
    
          if (!result.data?.success) {
    
    72
    
            btn.disabled = false;
    
    73
    
            btn.textContent = "Sign In";
    
    74
    
            messageEl.textContent = result.data?.message || "Sign in failed";
    
    75
    
            messageEl.style.color = "red";
    
    76
    
            return;
    
    77
    
          }
    
    78
    
    79
    
          // Redirect to dashboard on successful sign in
    
    80
    
          window.location.href = "/dashboard";
    
    81
    
        } catch (error) {
    
    82
    
          btn.disabled = false;
    
    83
    
          btn.textContent = "Sign In";
    
    84
    
          messageEl.textContent = "An error occurred. Please try again.";
    
    85
    
          messageEl.style.color = "red";
    
    86
    
          console.error(error);
    
    87
    
        }
    
    88
    
      });
    
    89
    
    </script>
[/code]

12

Create a dashboard page

Create a new file at `src/pages/dashboard.astro` to display the authenticated user's information. Use a client-side event listener for the sign-out button:

src/pages/dashboard.astro
[code]
    1
    
    ---
    
    2
    
    import { createClient } from "../lib/supabase";
    
    3
    
    4
    
    const supabase = createClient({
    
    5
    
      request: Astro.request,
    
    6
    
      cookies: Astro.cookies,
    
    7
    
    });
    
    8
    
    9
    
    const { data } = await supabase.auth.getUser();
    
    10
    
    const user = data?.user;
    
    11
    
    12
    
    if (!user) {
    
    13
    
      return Astro.redirect("/auth/signin");
    
    14
    
    }
    
    15
    
    ---
    
    16
    
    17
    
    <html>
    
    18
    
      <head>
    
    19
    
        <title>Dashboard</title>
    
    20
    
      </head>
    
    21
    
      <body>
    
    22
    
        <h1>Welcome!</h1>
    
    23
    
        <p>Email: {user.email}</p>
    
    24
    
        <p>User ID: {user.id}</p>
    
    25
    
    26
    
        <button id="signout-btn">Sign Out</button>
    
    27
    
      </body>
    
    28
    
    </html>
    
    29
    
    30
    
    <script>
    
    31
    
      import { actions } from "astro:actions";
    
    32
    
    33
    
      const btn = document.getElementById("signout-btn") as HTMLButtonElement;
    
    34
    
    35
    
      btn?.addEventListener("click", async (e) => {
    
    36
    
        e.preventDefault();
    
    37
    
        btn.disabled = true;
    
    38
    
        btn.textContent = "Signing out...";
    
    39
    
    40
    
        try {
    
    41
    
          const result = await actions.signOut();
    
    42
    
    43
    
          if (!result.data?.success) {
    
    44
    
            btn.disabled = false;
    
    45
    
            btn.textContent = "Sign Out";
    
    46
    
            alert("Failed to sign out");
    
    47
    
            return;
    
    48
    
          }
    
    49
    
    50
    
          // Redirect to signin page
    
    51
    
          window.location.href = "/auth/signin";
    
    52
    
        } catch (error) {
    
    53
    
          btn.disabled = false;
    
    54
    
          btn.textContent = "Sign Out";
    
    55
    
          console.error(error);
    
    56
    
        }
    
    57
    
      });
    
    58
    
    </script>
[/code]

13

Start the app

Start the development server, then navigate to <http://localhost:4321/auth/signup>[](<http://localhost:4321/auth/signup>) to test the authentication.

Terminal
[code]
    1
    
    npm run dev
[/code]

## Learn more#

  * [Supabase Auth docs](</docs/guides/auth#authentication>) for more Supabase authentication methods