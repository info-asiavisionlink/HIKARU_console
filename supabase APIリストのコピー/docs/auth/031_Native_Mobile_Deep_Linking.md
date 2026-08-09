---
タイトル: Native Mobile Deep Linking
URL: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, deep, linking, mobile, native, native-mobile-deep-linking
---

# Native Mobile Deep Linking

**URL:** https://supabase.com/docs/guides/auth/native-mobile-deep-linking
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, deep, linking, mobile, native, native-mobile-deep-linking

## 目次

- [Setting up deep linking#](#setting-up-deep-linking)

## 概要

Set up Deep Linking for mobile applications.

---

Many Auth methods involve a redirect to your app. For example:

  * Signup confirmation emails, Magic Link signins, and password reset emails contain a link that redirects to your app.
  * In OAuth signins, an automatic redirect occurs to your app.


With Deep Linking, you can configure this redirect to open a specific page. This is necessary if, for example, you need to display a form for [password reset](</docs/guides/auth/passwords#resetting-a-users-password-forgot-password>), or to manually exchange a token hash.

## Setting up deep linking#

Expo React NativeFlutterSwiftAndroid Kotlin

To link to your development build or standalone app, you need to specify a custom URL scheme for your app. You can register a scheme in your app config (app.json, app.config.js) by adding a string under the `scheme` key:
[code]
    1
    
    {
    
    2
    
      "expo": {
    
    3
    
        "scheme": "com.supabase"
    
    4
    
      }
    
    5
    
    }
[/code]

In your project's [auth settings](</dashboard/project/_/auth/url-configuration>) add the redirect URL, e.g. `com.supabase://**`.

Finally, implement the OAuth and linking handlers. See the [supabase-js reference](</docs/reference/javascript/initializing?example=react-native-options-async-storage>) for instructions on initializing the supabase-js client in React Native.
[code]
    1
    
    import { Button } from "react-native";
    
    2
    
    import { makeRedirectUri } from "expo-auth-session";
    
    3
    
    import * as QueryParams from "expo-auth-session/build/QueryParams";
    
    4
    
    import * as WebBrowser from "expo-web-browser";
    
    5
    
    import * as Linking from "expo-linking";
    
    6
    
    import { supabase } from "app/utils/supabase";
    
    7
    
    8
    
    WebBrowser.maybeCompleteAuthSession(); // required for web only
    
    9
    
    const redirectTo = makeRedirectUri();
    
    10
    
    11
    
    const createSessionFromUrl = async (url: string) => {
    
    12
    
      const { params, errorCode } = QueryParams.getQueryParams(url);
    
    13
    
    14
    
      if (errorCode) throw new Error(errorCode);
    
    15
    
      const { access_token, refresh_token } = params;
    
    16
    
    17
    
      if (!access_token) return;
    
    18
    
    19
    
      const { data, error } = await supabase.auth.setSession({
    
    20
    
        access_token,
    
    21
    
        refresh_token,
    
    22
    
      });
    
    23
    
      if (error) throw error;
    
    24
    
      return data.session;
    
    25
    
    };
    
    26
    
    27
    
    const performOAuth = async () => {
    
    28
    
      const { data, error } = await supabase.auth.signInWithOAuth({
    
    29
    
        provider: "github",
    
    30
    
        options: {
    
    31
    
          redirectTo,
    
    32
    
          skipBrowserRedirect: true,
    
    33
    
        },
    
    34
    
      });
    
    35
    
      if (error) throw error;
    
    36
    
    37
    
      const res = await WebBrowser.openAuthSessionAsync(
    
    38
    
        data?.url ?? "",
    
    39
    
        redirectTo
    
    40
    
      );
    
    41
    
    42
    
      if (res.type === "success") {
    
    43
    
        const { url } = res;
    
    44
    
        await createSessionFromUrl(url);
    
    45
    
      }
    
    46
    
    };
    
    47
    
    48
    
    const sendMagicLink = async () => {
    
    49
    
      const { error } = await supabase.auth.signInWithOtp({
    
    50
    
        email: "valid.email@supabase.io",
    
    51
    
        options: {
    
    52
    
          emailRedirectTo: redirectTo,
    
    53
    
        },
    
    54
    
      });
    
    55
    
    56
    
      if (error) throw error;
    
    57
    
      // Email sent.
    
    58
    
    };
    
    59
    
    60
    
    export default function Auth() {
    
    61
    
      // Handle linking into app from email app.
    
    62
    
      const url = Linking.useLinkingURL();
    
    63
    
      if (url) createSessionFromUrl(url);
    
    64
    
    65
    
      return (
    
    66
    
        <>
    
    67
    
          <Button onPress={performOAuth} title="Sign in with GitHub" />
    
    68
    
          <Button onPress={sendMagicLink} title="Send Magic Link" />
    
    69
    
        </>
    
    70
    
      );
    
    71
    
    }
[/code]

For the best user experience it is recommended to use universal links which require a more elaborate setup. You can find the detailed setup instructions in the [Expo docs](<https://docs.expo.dev/guides/deep-linking/>).