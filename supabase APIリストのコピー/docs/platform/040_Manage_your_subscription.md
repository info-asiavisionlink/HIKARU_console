---
タイトル: Manage your subscription
URL: https://supabase.com/docs/guides/platform/aws-marketplace/manage-your-subscription
カテゴリ: platform
更新日: 2026-08-02
タグ: aws-marketplace, manage, manage-your-subscription, platform, subscription, your
---

# Manage your subscription

**URL:** https://supabase.com/docs/guides/platform/aws-marketplace/manage-your-subscription
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** aws-marketplace, manage, manage-your-subscription, platform, subscription, your

## 目次

- [Manage your subscription plan#](#manage-your-subscription-plan)
  - [Upgrade#](#upgrade)
  - [Downgrade#](#downgrade)
- [Manage your payment methods#](#manage-your-payment-methods)
- [Manage your billing details#](#manage-your-billing-details)

## 概要

Searchdocs...

---

## Manage your subscription plan#

Plan changes are not made on the Supabase dashboard, but instead through the AWS Marketplace. The easiest way to navigate to the corresponding page on the marketplace is through the Supabase dashboard.

  1. On the [organization's billing page](</dashboard/org/_/billing>), go to section **Subscription Plan**
  2. Click **Change subscription plan**
  3. On the side panel, follow the link to the AWS Marketplace


### Upgrade#

You can upgrade your plan at any time. The new plan will be active immediately, and you will be charged a prorated amount for the remainder of the current billing cycle. The charge for the upgrade also factors in the upfront payment you have already made for your existing plan.

![AWS Marketplace modify contract page](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-change-plan.png&w=3840&q=75)

### Downgrade#

Downgrades are only possible at the end of the billing cycle, not in the middle of a billing cycle.

#### Downgrade to the Free Plan#

If you want your subscription to be downgraded to the Free Plan at the end of the current billing cycle, you need to disable auto-renewal for the marketplace subscription.

If the downgrade causes you to exceed the [free projects limit](</docs/guides/platform/billing-on-supabase#free-plan>), **all** projects within the organization will be paused. We do not make the decision about which projects continue to run and which are paused. You must then decide which projects you want to keep active and manually reactivate them through the Supabase dashboard.

![AWS Marketplace modify contract page](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Faws-marketplace-configure-auto-renewal.png&w=3840&q=75)

#### Downgrade to a paid plan#

A downgrade to a paid plan (Pro Plan / Team Plan) involves two steps.

**Step 1:** Let the current subscription on the higher plan expire, meaning turn off auto-renewal **Step 2:** Start a new subscription on the lower plan

## Manage your payment methods#

You can manage your payment methods through the [AWS Billing and Cost Management console](<https://console.aws.amazon.com/billing>).

## Manage your billing details#

You can manage billing details, such as the billing address or tax ID, through the [AWS Billing and Cost Management console](<https://console.aws.amazon.com/billing>).