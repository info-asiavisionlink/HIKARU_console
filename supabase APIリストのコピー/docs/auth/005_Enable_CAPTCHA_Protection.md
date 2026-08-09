---
タイトル: Enable CAPTCHA Protection
URL: https://supabase.com/docs/guides/auth/auth-captcha
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, auth-captcha, captcha, enable, protection
---

# Enable CAPTCHA Protection

**URL:** https://supabase.com/docs/guides/auth/auth-captcha
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, auth-captcha, captcha, enable, protection

## 目次

- [Sign up for CAPTCHA#](#sign-up-for-captcha)
- [Enable CAPTCHA protection for your Supabase project#](#enable-captcha-protection-for-your-supabase-project)
- [Add the CAPTCHA frontend component#](#add-the-captcha-frontend-component)

## 概要

Add CAPTCHA Protection to your Supabase project

---

Supabase provides you with the option of adding CAPTCHA to your sign-in, sign-up, and password reset forms. This keeps your website safe from bots and malicious scripts. Supabase authentication has support for [hCaptcha](<https://www.hcaptcha.com/>) and [Cloudflare Turnstile](<https://www.cloudflare.com/application-services/products/turnstile/>).

## Sign up for CAPTCHA#

HCaptchaTurnstile

Go to the [hCaptcha](<https://www.hcaptcha.com/>) website and sign up for an account. On the Welcome page, copy the **Sitekey** and **Secret key**.

If you have already signed up and didn't copy this information from the Welcome page, you can get the **Secret key** from the Settings page.

![site_secret_settings.png](/docs/img/guides/auth-captcha/site_secret_settings.png)

The **Sitekey** can be found in the **Settings** of the active site you created.

![sites_dashboard.png](/docs/img/guides/auth-captcha/sites_dashboard.png)

In the Settings page, look for the **Sitekey** section and copy the key.

![sitekey_settings.png](/docs/img/guides/auth-captcha/sitekey_settings.png)

## Enable CAPTCHA protection for your Supabase project#

Navigate to the **[Auth](</dashboard/project/_/auth/protection>)** section of your Project Settings in the Supabase Dashboard and find the **Enable CAPTCHA protection** toggle under Settings > Authentication > Bot and Abuse Protection > Enable CAPTCHA protection.

Select your CAPTCHA provider from the dropdown, enter your CAPTCHA **Secret key** , and click **Save**.

## Add the CAPTCHA frontend component#

The frontend requires some changes to provide the CAPTCHA on-screen for the user. This example uses React and the corresponding CAPTCHA React component, but both CAPTCHA providers can be used with any JavaScript framework.

HCaptchaTurnstile

Install `@hcaptcha/react-hcaptcha` in your project as a dependency.
[code]
    1
    
    npm install @hcaptcha/react-hcaptcha
[/code]

Now import the `HCaptcha` component from the `@hcaptcha/react-hcaptcha` library.
[code]
    1
    
    import HCaptcha from '@hcaptcha/react-hcaptcha'
[/code]

Create an empty state to store the `captchaToken`
[code]
    1
    
    const [captchaToken, setCaptchaToken] = useState()
[/code]

Now lets add the `HCaptcha` component to the JSX section of our code
[code]
    1
    
    <HCaptcha />
[/code]

Pass it the sitekey we copied from the hCaptcha website as a property along with a `onVerify` property which takes a callback function. This callback function will have a token as one of its properties. Set the token in the state using `setCaptchaToken`
[code]
    1
    
    <HCaptcha
    
    2
    
      sitekey="your-sitekey"
    
    3
    
      onVerify={(token) => {
    
    4
    
        setCaptchaToken(token)
    
    5
    
      }}
    
    6
    
    />
[/code]

Now lets use the CAPTCHA token we receive in our Supabase signUp function.
[code]
    1
    
    await supabase.auth.signUp({
    
    2
    
      email,
    
    3
    
      password,
    
    4
    
      options: { captchaToken },
    
    5
    
    })
[/code]

We will also need to reset the CAPTCHA challenge after we have made a call to the function above.

Create a ref to use on our `HCaptcha` component.
[code]
    1
    
    const captcha = useRef()
[/code]

Add a `ref` attribute on the `HCaptcha` component and assign the `captcha` constant to it.
[code]
    1
    
    <HCaptcha
    
    2
    
      ref={captcha}
    
    3
    
      sitekey="your-sitekey"
    
    4
    
      onVerify={(token) => {
    
    5
    
        setCaptchaToken(token)
    
    6
    
      }}
    
    7
    
    />
[/code]

Reset the `captcha` after the signUp function is called using the following code:
[code]
    1
    
    captcha.current.resetCaptcha()
[/code]

In order to test that this works locally we will need to use something like [ngrok](<https://ngrok.com/>) or add an entry to your hosts file. You can read more about this in the [hCaptcha docs](<https://docs.hcaptcha.com/#local-development>).

Run the application and you should now be provided with a CAPTCHA challenge.