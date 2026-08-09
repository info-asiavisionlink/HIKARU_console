---
タイトル: Customizing email templates
URL: https://supabase.com/docs/guides/local-development/customizing-email-templates
カテゴリ: cli
更新日: 2026-08-02
タグ: ai, cli, customizing, customizing-email-templates, email, local-development, templates
---

# Customizing email templates

**URL:** https://supabase.com/docs/guides/local-development/customizing-email-templates
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** ai, cli, customizing, customizing-email-templates, email, local-development, templates

## 目次

- [Configuring templates#](#configuring-templates)
  - [Authentication email templates#](#authentication-email-templates)
  - [Security notification email templates#](#security-notification-email-templates)
- [Available authentication email templates#](#available-authentication-email-templates)
  - [auth.email.template.invite#](#authemailtemplateinvite)
  - [auth.email.template.confirmation#](#authemailtemplateconfirmation)
  - [auth.email.template.recovery#](#authemailtemplaterecovery)
  - [auth.email.template.magic_link#](#authemailtemplatemagiclink)
  - [auth.email.template.email_change#](#authemailtemplateemailchange)
  - [auth.email.template.reauthentication#](#authemailtemplatereauthentication)
- [Available security notification email templates#](#available-security-notification-email-templates)
  - [auth.email.notification.password_changed#](#authemailnotificationpasswordchanged)
  - [auth.email.notification.email_changed#](#authemailnotificationemailchanged)
  - [auth.email.notification.phone_changed#](#authemailnotificationphonechanged)
  - [auth.email.notification.mfa_factor_enrolled#](#authemailnotificationmfafactorenrolled)
  - [auth.email.notification.mfa_factor_unenrolled#](#authemailnotificationmfafactorunenrolled)
  - [auth.email.notification.identity_linked#](#authemailnotificationidentitylinked)
  - [auth.email.notification.identity_unlinked#](#authemailnotificationidentityunlinked)
- [Template variables#](#template-variables)
  - [ConfirmationURL#](#confirmationurl)
  - [Token#](#token)
  - [TokenHash#](#tokenhash)
  - [SiteURL#](#siteurl)
  - [RedirectTo#](#redirectto)
  - [Data#](#data)

## 概要

Customize local email templates via the config file.

---

You can customize the email templates for local development by [editing the `config.toml` file](</docs/guides/local-development/cli/config#auth-config>).

This guide covers local development and CLI workflows. For hosted projects, use the [Email Templates](</dashboard/project/_/auth/templates>) page in the dashboard. See [Email templates](</docs/guides/auth/auth-email-templates>) for terminology, limitations, and customization patterns that apply in every environment.

For configuring a self-hosted Supabase instance, see [Custom Email Templates](</docs/guides/self-hosting/custom-email-templates>)

## Configuring templates#

You should provide a relative URL to the `content_path` parameter, pointing to an HTML file which contains the template. For example:

### Authentication email templates#

supabase/config.tomlsupabase/templates/invite.html
[code]
    1
    
    [auth.email.template.invite]
    
    2
    
    subject = "You are invited to Acme Inc"
    
    3
    
    content_path = "./supabase/templates/invite.html"
[/code]

### Security notification email templates#

supabase/config.tomltemplates/password_changed_notification.html
[code]
    1
    
    [auth.email.notification.password_changed]
    
    2
    
    enabled = true
    
    3
    
    subject = "Your password was changed"
    
    4
    
    content_path = "./templates/password_changed_notification.html"
[/code]

## Available authentication email templates#

There are several authentication-related email templates which can be configured. Each template serves a specific authentication flow:

### `auth.email.template.invite`#

**Default subject** : "You've been invited" **When sent** : When a user is invited to join your application via email invitation **Purpose** : Invite someone to create an account **Content** : Contains a link for the invited user to accept the invitation and create their account

### `auth.email.template.confirmation`#

**Default subject** : "Confirm your email address" **When sent** : When a user signs up and needs to verify their email address **Purpose** : Ask users to confirm their email address after signing up **Content** : Contains a confirmation link to verify the user's email address

### `auth.email.template.recovery`#

**Default subject** : "Reset your password" **When sent** : When a user requests a password reset **Purpose** : Send a password reset link or code **Content** : Contains a link to reset the user's password

### `auth.email.template.magic_link`#

**Default subject** : "Your sign-in link" **When sent** : When a user requests a magic link or email OTP for passwordless authentication **Purpose** : Send a one-time sign-in link or one-time password **Content** : Contains a secure link that automatically logs the user in when clicked

### `auth.email.template.email_change`#

**Default subject** : "Confirm your new email address" **When sent** : When a user requests to change their email address **Purpose** : Ask users to verify their new email address after changing it **Content** : Contains a confirmation link to verify the new email address

### `auth.email.template.reauthentication`#

**Default subject** : "`{{ .Token }} is your verification code`" **When sent** : When a user needs to re-authenticate for sensitive operations **Purpose** : Ask users to verify their identity before a sensitive operation **Content** : Contains a 8-digit OTP code for verification

## Available security notification email templates#

There are several security notification email templates which can be configured. These emails are only sent to users if the respective security notifications have been enabled at the project-level:

### `auth.email.notification.password_changed`#

**Default subject** : "Your password was changed" **When sent** : When a user's password is changed **Purpose** : Notify users when their password has changed **Content** : Confirms that the password for the account has been changed

### `auth.email.notification.email_changed`#

**Default subject** : "Your email address was changed" **When sent** : When a user's email address is changed **Purpose** : Notify users when their email address has changed **Content** : Confirms the change from the old email to the new email address

### `auth.email.notification.phone_changed`#

**Default subject** : "Your phone number was changed" **When sent** : When a user's phone number is changed **Purpose** : Notify users when their phone number has changed **Content** : Confirms the change from the old phone number to the new phone number

### `auth.email.notification.mfa_factor_enrolled`#

**Default subject** : "A new verification method was added to your account" **When sent** : When a new verification method is added to the user's account **Purpose** : Notify users when an MFA method has been added to their account **Content** : Confirms that a new verification method was added

### `auth.email.notification.mfa_factor_unenrolled`#

**Default subject** : "A verification method was removed from your account" **When sent** : When a verification method is removed from the user's account **Purpose** : Notify users when an MFA method has been removed from their account **Content** : Confirms that a verification method was removed

### `auth.email.notification.identity_linked`#

**Default subject** : "A sign-in method was linked to your account" **When sent** : When a sign-in method is linked to the account **Purpose** : Notify users when a sign-in method has been linked to their account **Content** : Confirms that a sign-in method was linked

### `auth.email.notification.identity_unlinked`#

**Default subject** : "A sign-in method was removed from your account" **When sent** : When a sign-in method is removed from the account **Purpose** : Notify users when a sign-in method has been removed from their account **Content** : Confirms that a sign-in method was removed

## Template variables#

The templating system provides the following variables for use:

### `ConfirmationURL`#

Contains the confirmation URL. For example, a signup confirmation URL would look like:
[code] 
    1
    
    https://project-ref.supabase.co/auth/v1/verify?token={{ .TokenHash }}&type=email&redirect_to=https://example.com/path
[/code]

**Usage**
[code] 
    1
    
    <p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
[/code]

### `Token`#

Contains a 8-digit One-Time-Password (OTP) that can be used instead of the `ConfirmationURL`.

**Usage**
[code] 
    1
    
    <p>Here is your one time password: {{ .Token }}</p>
[/code]

### `TokenHash`#

Contains a hashed version of the `Token`. This is useful for constructing your own email link in the email template.

**Usage**
[code] 
    1
    
    <p>Follow the link below to confirm this email address and finish signing up.</p>
    
    2
    
    <p>
    
    3
    
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
    
    4
    
        >Confirm email address</a
    
    5
    
      >
    
    6
    
    </p>
[/code]

### `SiteURL`#

Contains your application's Site URL. This can be configured in your project's [authentication settings](</dashboard/project/_/auth/url-configuration>).

**Usage**
[code] 
    1
    
    <p>Visit <a href="{{ .SiteURL }}">here</a> to log in.</p>
[/code]

### `RedirectTo`#

Contains the redirect URL passed as the `redirectTo` option in the auth method call.

**Usage**
[code] 
    1
    
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">
    
    2
    
      Confirm your email
    
    3
    
    </a>
[/code]

### `Data`#

Contains metadata from `auth.users.user_metadata`. Use this to personalize the email message.

**Usage**
[code] 
    1
    
    <p>Hello {{ .Data.first_name }}, please confirm your signup.</p>
[/code]

### `Email`#

Contains the user's email address.

**Usage**
[code] 
    1
    
    <p>A recovery request was sent to {{ .Email }}.</p>
[/code]

### `NewEmail`#

Contains the new user's email address. This is only available in the `email_change` email template.

**Usage**
[code] 
    1
    
    <p>You are requesting to update your email address to {{ .NewEmail }}.</p>
[/code]

### `OldEmail`#

Contains the user's old email address. This is only available in the `email_changed_notification` email template.

**Usage**
[code] 
    1
    
    <p>The email address for your account has been changed from {{ .OldEmail }} to {{ .Email }}.</p>
[/code]

### `Phone`#

Contains the user's new phone number. This is only available in the `phone_changed_notification` email template.

**Usage**
[code] 
    1
    
    <p>The phone number for your account has been changed from {{ .OldPhone }} to {{ .Phone }}.</p>
[/code]

### `OldPhone`#

Contains the user's old phone number. This is only available in the `phone_changed_notification` email template.

**Usage**
[code] 
    1
    
    <p>The phone number for your account has been changed from {{ .OldPhone }} to {{ .Phone }}.</p>
[/code]

### `Provider`#

Contains the provider of the linked or removed sign-in method. This is only available in the `identity_linked_notification` and `identity_unlinked_notification` email templates.

**Usage**
[code] 
    1
    
    <p>Your {{ .Provider }} account was linked as a sign-in method.</p>
[/code]

### `FactorType`#

Contains the type of verification method that was added or removed. This is only available in the `mfa_factor_enrolled_notification` and `mfa_factor_unenrolled_notification` email templates.

**Usage**
[code] 
    1
    
    <p>Sign-in verification method {{ .FactorType }} was added to your account.</p>
[/code]

## Deploying email templates#

These settings are for local development. To apply the changes locally, stop and restart the Supabase containers:
[code] 
    1
    
    supabase stop && supabase start
[/code]

For hosted projects managed by Supabase, copy the templates into the [Email Templates](</dashboard/project/_/auth/templates>) section of the Dashboard.