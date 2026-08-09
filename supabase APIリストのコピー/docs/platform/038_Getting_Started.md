---
タイトル: Getting Started
URL: https://supabase.com/docs/guides/platform/aws-marketplace/getting-started
カテゴリ: platform
更新日: 2026-08-02
タグ: aws-marketplace, edge, getting, getting-started, platform, started
---

# Getting Started

**URL:** https://supabase.com/docs/guides/platform/aws-marketplace/getting-started
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** aws-marketplace, edge, getting, getting-started, platform, started

## 目次

- [Before you start#](#before-you-start)
- [Purchase Supabase through the AWS Marketplace#](#purchase-supabase-through-the-aws-marketplace)

## 概要

Searchdocs...

---

## Before you start#

Depending on whether a Supabase organization is managed and billed through the AWS Marketplace or directly through the Supabase platform, there are differences. To help you make an informed decision about which approach is better suited for your needs, you can find an overview of these differences in the table below.

Feature/Aspect| Managed via AWS Marketplace| Managed directly via Supabase platform  
---|---|---  
Available Plans| Pro, Team, Enterprise| Free, Pro, Team, Enterprise  
Mid-cycle downgrades| No| Yes  
Cost Control| Spend Cap not available| Spend Cap available  
Downgrade Behaviour| If a downgrade to the Free Plan causes you to exceed the [free projects limit](</docs/guides/platform/billing-on-supabase#free-plan>), all projects will be paused.| If a downgrade to the Free Plan causes you to exceed the [free projects limit](</docs/guides/platform/billing-on-supabase#free-plan>), you have the option to prevent pausing by transferring projects.  
Invoicing| Separate invoices, one for fixed costs and one for usage costs| One invoice for both fixed costs and usage costs  
  
## Purchase Supabase through the AWS Marketplace#

Purchasing Supabase through the AWS Marketplace involves two steps. First, you purchase the corresponding subscription on the marketplace. Then, to complete the setup, you must link this subscription to a Supabase organization on the Supabase platform.

For more details on completing the setup and what it means to link an organization, see our [Account Setup guide](<./account-setup>).

1

Go to the AWS Marketplace

Go to the [Supabase product page on the AWS Marketplace](<https://aws.amazon.com/marketplace/pp/prodview-zjciuce2qsb3q>) and click "View purchase options".

![Supabase product overview on the AWS Marketplace](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-listing-overview.png&w=3840&q=75)

2

Configure the subscription

Select the desired plan (Pro Plan or Team Plan) and configure whether the subscription should automatically renew after one month.

Disabling auto-renewal means that the subscription will be downgraded to the Free Plan after one month.

If the downgrade causes you to exceed the [free projects limit](</docs/guides/platform/billing-on-supabase#free-plan>), **all** projects within the organization will be paused. We do not make the decision about which projects continue to run and which are paused. You must then decide which projects you want to keep active and manually reactivate them through the Supabase dashboard.

![Supabase purchase options on the AWS Marketplace](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-listing-purchase-options.png&w=3840&q=75)

3

Subscribe

Click "Subscribe" at the bottom of the page.

![Supabase product subscribe](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-listing-subscribe.png&w=3840&q=75)

4

Go to the Supabase platform

After the payment has been confirmed and your marketplace subscription is active, click "Set up your account" to be redirected to the Supabase platform.

![Supabase product subscribe](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-listing-success.png&w=3840&q=75)

5

Complete the setup on the Supabase platform

Complete the setup by linking a Supabase organization to the AWS Marketplace subscription.

![Supabase product subscribe](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-onboarding-page--light.png&w=3840&q=75)