---
タイトル: Email Templates
URL: https://supabase.com/docs/guides/auth/auth-email-templates
カテゴリ: auth
更新日: 2026-08-02
タグ: ai, auth, auth-email-templates, email, templates
---

# Email Templates

**URL:** https://supabase.com/docs/guides/auth/auth-email-templates
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** ai, auth, auth-email-templates, email, templates

## 目次

- [Terminology#](#terminology)
- [Editing email templates#](#editing-email-templates)
  - [Hosted projects#](#hosted-projects)
  - [Local development and self-hosted#](#local-development-and-self-hosted)
- [Mobile deep linking#](#mobile-deep-linking)
- [Limitations#](#limitations)
  - [Email prefetching#](#email-prefetching)
  - [Email tracking#](#email-tracking)
  - [Redirecting the user to a server-side endpoint#](#redirecting-the-user-to-a-server-side-endpoint)
- [Customization#](#customization)
  - [Send different email to early access users#](#send-different-email-to-early-access-users)

## 概要

Learn how to manage the email templates in Supabase.

---

Email templates in Supabase fall into two categories: authentication and security notifications.

Authentication emails:

  * Confirm sign up
  * Invite user
  * Magic link or OTP
  * Change email address
  * Reset password
  * Reauthentication


Security notification emails:

  * Password changed
  * Email address changed
  * Phone number changed
  * Sign-in method linked
  * Sign-in method removed
  * Verification method added
  * Verification method removed


Security emails are only sent to users if the respective security notifications have been enabled at a project-level.

## Terminology#

The templating system provides the following variables for use:

Name| Description  
---|---  
`{{ .ConfirmationURL }}`| Contains the confirmation URL. For example, a signup confirmation URL would look like: `https://project-ref.supabase.co/auth/v1/verify?token={{ .TokenHash }}&type=email&redirect_to=https://example.com/path`.  
`{{ .Token }}`| Contains a 6-digit One-Time-Password (OTP) that can be used instead of the `{{. ConfirmationURL }}`.  
`{{ .TokenHash }}`| Contains a hashed version of the `{{ .Token }}`. This is useful for constructing your own email link in the email template.  
`{{ .SiteURL }}`| Contains your application's Site URL. This can be configured in your project's [authentication settings](</dashboard/project/_/auth/url-configuration>).  
`{{ .RedirectTo }}`| Contains the redirect URL passed when `signUp`, `signInWithOtp`, `signInWithOAuth`, `resetPasswordForEmail` or `inviteUserByEmail` is called. The redirect URL allow list can be configured in your project's [authentication settings](</dashboard/project/_/auth/url-configuration>).  
`{{ .Data }}`| Contains metadata from `auth.users.user_metadata`. Use this to personalize the email message.  
`{{ .Email }}`| Contains the original email address of the user. Empty when trying to [link an email address to an anonymous user](</docs/guides/auth/auth-anonymous#link-an-email--phone-identity>).  
`{{ .NewEmail }}`| Contains the new email address of the user. This variable is only supported in the "Change email address" template.  
`{{ .OldEmail }}`| Contains the old email address of the user. This variable is only supported in the "Email address changed notification" template.  
`{{ .Phone }}`| Contains the new phone number of the user. This variable is only supported in the "Phone number changed notification" template.  
`{{ .OldPhone }}`| Contains the old phone address of the user. This variable is only supported in the "Phone number changed notification" template.  
`{{ .Provider }}`| Contains the provider of the linked or removed sign-in method. This variable is only supported in the "Sign-in method linked" and "Sign-in method removed" notification templates.  
`{{ .FactorType }}`| Contains the type of verification method that was added or removed. This variable is only supported in the "Verification method added" and "Verification method removed" notification templates.  
  
## Editing email templates#

Where you edit templates depends on how you run Supabase.

### Hosted projects#

Edit templates on the [Email Templates](</dashboard/project/_/auth/templates>) page in the dashboard. The template builder uses the same terminology and variables documented on this page.

### Local development and self-hosted#

The dashboard template builder **does not apply** when running [local development with CLI](</docs/guides/local-development>) or [self-hosted Supabase](</docs/guides/self-hosting>). Customize templates in `supabase/config.toml` and local HTML files instead.

Customizing templates locally

See [Customizing email templates](</docs/guides/local-development/customizing-email-templates>) for:

  * [`config.toml` keys and HTML file paths](</docs/guides/local-development/customizing-email-templates#configuring-templates>)
  * [Template variables](</docs/guides/local-development/customizing-email-templates#template-variables>) — the same placeholders as the terminology table above
  * Default subjects and behavior for each [authentication](</docs/guides/local-development/customizing-email-templates#available-authentication-email-templates>) and [security notification](</docs/guides/local-development/customizing-email-templates#available-security-notification-email-templates>) template


For self-hosted deployments, refer to [Custom email templates](</docs/guides/self-hosting/custom-email-templates>).

You can also manage email templates using the Management API:
[code] 
    1
    
    # Get your access token from https://supabase.com/dashboard/account/tokens
    
    2
    
    export SUPABASE_ACCESS_TOKEN="your-access-token"
    
    3
    
    export PROJECT_REF="your-project-ref"
    
    4
    
    5
    
    # Get current email templates
    
    6
    
    curl -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    7
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    8
    
      | jq 'to_entries | map(select(.key | startswith("mailer_templates"))) | from_entries'
    
    9
    
    10
    
    # Update email templates
    
    11
    
    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
    
    12
    
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    
    13
    
      -H "Content-Type: application/json" \
    
    14
    
      -d '{
    
    15
    
          "mailer_subjects_confirmation": "Confirm your email address",
    
    16
    
          "mailer_templates_confirmation_content": "<h2>Confirm your email address</h2><p>Follow the link below to confirm this email address and finish signing up.</p><p><a href=\"{{ .ConfirmationURL }}\">Confirm email address</a></p>",
    
    17
    
          "mailer_subjects_magic_link": "Your sign-in link",
    
    18
    
          "mailer_templates_magic_link_content": "<h2>Your sign-in link</h2><p>Follow the link below to sign in. This link expires shortly and can only be used once.</p><p><a href=\"{{ .ConfirmationURL }}\">Sign in</a></p>",
    
    19
    
          "mailer_subjects_recovery": "Reset your password",
    
    20
    
          "mailer_templates_recovery_content": "<h2>Reset your password</h2><p>We received a request to reset your password. Follow the link below to choose a new one.</p><p><a href=\"{{ .ConfirmationURL }}\">Reset password</a></p><p>If you didn't request this, you can safely ignore this email.</p>",
    
    21
    
          "mailer_subjects_invite": "You've been invited",
    
    22
    
          "mailer_templates_invite_content": "<h2>You've been invited</h2><p>You've been invited to create an account. Follow the link below to accept.</p><p><a href=\"{{ .ConfirmationURL }}\">Accept invitation</a></p>",
    
    23
    
          "mailer_subjects_reauthentication": "{{ .Token }} is your verification code",
    
    24
    
          "mailer_templates_reauthentication_content": "<h2>Your verification code</h2><p>Use the code below to verify your identity. It expires shortly.</p><p>{{ .Token }}</p>",
    
    25
    
          "mailer_subjects_email_change": "Confirm your new email address",
    
    26
    
          "mailer_templates_email_change_content": "<h2>Confirm your new email address</h2><p>Follow the link below to confirm {{ .NewEmail }} as your new email address.</p><p><a href=\"{{ .ConfirmationURL }}\">Confirm new email address</a></p><p>If you didn't request this change, you can safely ignore this email.</p>",
    
    27
    
          "mailer_notifications_password_changed_enabled": true,
    
    28
    
          "mailer_subjects_password_changed_notification": "Your password was changed",
    
    29
    
          "mailer_templates_password_changed_notification_content": "<h2>Your password was changed</h2>\n\n<p>The password for your account was recently changed.</p>\n<p>If you didn't make this change, reset your password and contact support immediately.</p>",
    
    30
    
          "mailer_notifications_email_changed_enabled": true,
    
    31
    
          "mailer_subjects_email_changed_notification": "Your email address was changed",
    
    32
    
          "mailer_templates_email_changed_notification_content": "<h2>Your email address was changed</h2>\n\n<p>The email address for your account was changed from {{ .OldEmail }} to {{ .Email }}.</p>\n<p>If you didn't make this change, contact support immediately.</p>",
    
    33
    
          "mailer_notifications_phone_changed_enabled": true,
    
    34
    
          "mailer_subjects_phone_changed_notification": "Your phone number was changed",
    
    35
    
          "mailer_templates_phone_changed_notification_content": "<h2>Your phone number was changed</h2>\n\n<p>The phone number for your account was changed from {{ .OldPhone }} to {{ .Phone }}.</p>\n<p>If you didn't make this change, contact support immediately.</p>",
    
    36
    
          "mailer_notifications_mfa_factor_enrolled_enabled": true,
    
    37
    
          "mailer_subjects_mfa_factor_enrolled_notification": "A new verification method was added to your account",
    
    38
    
          "mailer_templates_mfa_factor_enrolled_notification_content": "<h2>A new verification method was added</h2>\n\n<p>Sign-in verification method {{ .FactorType }} was added to your account.</p>\n<p>If you didn't make this change, contact support immediately.</p>",
    
    39
    
          "mailer_notifications_mfa_factor_unenrolled_enabled": true,
    
    40
    
          "mailer_subjects_mfa_factor_unenrolled_notification": "A verification method was removed from your account",
    
    41
    
          "mailer_templates_mfa_factor_unenrolled_notification_content": "<h2>A verification method was removed</h2>\n\n<p>Sign-in verification method {{ .FactorType }} was removed from your account.</p>\n<p>If you didn't make this change, contact support immediately.</p>",
    
    42
    
          "mailer_notifications_identity_linked_enabled": true,
    
    43
    
          "mailer_subjects_identity_linked_notification": "A sign-in method was linked to your account",
    
    44
    
          "mailer_templates_identity_linked_notification_content": "<h2>A sign-in method was linked</h2>\n\n<p>Your {{ .Provider }} account was linked as a sign-in method for {{ .Email }}.</p>\n<p>If you didn't make this change, contact support immediately.</p>",
    
    45
    
          "mailer_notifications_identity_unlinked_enabled": true,
    
    46
    
          "mailer_subjects_identity_unlinked_notification": "A sign-in method was removed from your account",
    
    47
    
          "mailer_templates_identity_unlinked_notification_content": "<h2>A sign-in method was removed</h2>\n\n<p>Your {{ .Provider }} account was removed as a sign-in method for {{ .Email }}.</p>\n<p>If you didn't make this change, contact support immediately.</p>"
    
    48
    
      }'
[/code]

## Mobile deep linking#

For mobile applications, you might need to link or redirect to a specific page within your app. See the [Mobile Deep Linking guide](</docs/guides/auth/native-mobile-deep-linking>) to set this up.

## Limitations#

### Email prefetching#

Certain email providers may have spam detection or other security features that prefetch URL links from incoming emails (e.g. [Safe Links in Microsoft Defender for Office 365](<https://learn.microsoft.com/en-us/microsoft-365/security/office-365-security/safe-links-about?view=o365-worldwide>)). In this scenario, the `{{ .ConfirmationURL }}` sent will be consumed instantly which leads to a "Token has expired or is invalid" error. To guard against this there are the options below:

**Option 1**

  * Use an email OTP instead by including `{{ .Token }}` in the email template
  * Create your own custom email link to redirect the user to a page where they can enter their email and token to sign in


[code] 
    1
    
    <a href="{{ .SiteURL }}/confirm-signup">Confirm email address</a>
[/code]

  * Log them in by verifying the OTP token value with their email e.g. with [`supabase.auth.verifyOtp`](</docs/reference/javascript/auth-verifyotp>) show below


[code] 
    1
    
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
[/code]

**Option 2**

  * Create your own custom email link to redirect the user to a page where they can click on a button to confirm the action


[code] 
    1
    
    <a href="{{ .SiteURL }}/confirm-signup?confirmation_url={{ .ConfirmationURL }}">
    
    2
    
      Confirm email address
    
    3
    
    </a>
[/code]

  * The button should contain the actual confirmation link which can be obtained from parsing the `confirmation_url={{ .ConfirmationURL }}` query parameter in the URL.


### Email tracking#

If you are using an external email provider that enables "email tracking", the links inside the Supabase email templates will be overwritten and won't perform as expected. We recommend disabling email tracking to ensure email links are not overwritten.

### Redirecting the user to a server-side endpoint#

If you intend to use [Server-side rendering](</docs/guides/auth/server-side/advanced-guide>), you might want the email link to redirect the user to a server-side endpoint to check if they are authenticated before returning the page. However, the default email link will redirect the user after verification to the redirect URL with the session in the query fragments. Since the session is returned in the query fragments by default, you won't be able to access it on the server-side.

You can customize the email link in the email template to redirect the user to a server-side endpoint successfully. For example:
[code] 
    1
    
    <a
    
    2
    
      href="https://api.example.com/v1/authenticate?token_hash={{ .TokenHash }}&type=invite&redirect_to={{ .RedirectTo }}"
    
    3
    
    >
    
    4
    
      Accept the invite
    
    5
    
    </a>
[/code]

When the user clicks on the link, the request will hit `https://api.example.com/v1/authenticate` and you can grab the `token_hash`, `type` and `redirect_to` query parameters from the URL. Then, you can call the [`verifyOtp`](</docs/reference/javascript/auth-verifyotp>) method to get back an authenticated session before redirecting the user back to the client. Since the `verifyOtp` method makes a `POST` request to Supabase Auth to verify the user, the session will be returned in the response body, which can be read by the server. For example:
[code] 
    1
    
    import { createClient, type EmailOtpType } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    const { token_hash, type } = Object.fromEntries(new URLSearchParams(window.location.search))
    
    7
    
    const {
    
    8
    
      data: { session },
    
    9
    
      error,
    
    10
    
    } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
    
    11
    
    12
    
    // subsequently redirect the user back to the client using the redirect_to param
    
    13
    
    // ...
[/code]

## Customization#

Supabase Auth makes use of [Go Templates](<https://pkg.go.dev/text/template>). This means it is possible to conditionally render information based on template properties.

### Send different email to early access users#

Send a different email to users who signed up via an early access domain (`https://www.earlyaccess.trial.com`).
[code] 
    1
    
    {{ if eq .Data.Domain "https://www.example.com" }}
    
    2
    
    <h1>Welcome to Our Database Service!</h1>
    
    3
    
      <p>Dear Developer,</p>
    
    4
    
      <p>Welcome to Billy, the scalable developer platform!</p>
    
    5
    
      <p>Best Regards,<br>
    
    6
    
    Billy Team</p>
    
    7
    
    {{ else if eq .Data.Domain "https://www.earlyaccess.trial.com" }}
    
    8
    
    <h1>Welcome to Our Database Service!</h1>
    
    9
    
      <p>Dear Developer,</p>
    
    10
    
      <p>Welcome Billy, the scalable developer platform!</p>
    
    11
    
      <p> As an early access member, you have access to select features like Point To Space Restoration.</p>
    
    12
    
      <p>Best Regards,<br>
    
    13
    
    Billy Team</p>
    
    14
    
    {{ end }}
[/code]