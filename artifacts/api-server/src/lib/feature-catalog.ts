import type { FeatureDefinition } from "@workspace/api-zod";

type FeatureSeed = Pick<
  FeatureDefinition,
  "id" | "name" | "description" | "category"
> &
  Partial<
    Pick<
      FeatureDefinition,
      | "implementationStatus"
      | "canActivate"
      | "dependencies"
      | "platformCompatibility"
      | "requiredPermissions"
      | "requiredData"
      | "supportedEvents"
      | "apiEndpoints"
      | "storefrontRequirements"
      | "usageLimits"
      | "configurationSchema"
      | "testingRequirements"
    >
  >;

const targetPlatforms: FeatureDefinition["platformCompatibility"] = [
  "shopify",
  "woocommerce",
  "lovable",
  "react_vite",
  "custom_javascript",
  "custom_html",
  "custom_backend",
];

function feature(input: FeatureSeed): FeatureDefinition {
  return {
    version: "1.0.0",
    implementationStatus: "planned",
    canActivate: false,
    dependencies: [],
    platformCompatibility: targetPlatforms,
    requiredPermissions: ["store:read"],
    requiredData: [],
    supportedEvents: [],
    apiEndpoints: [],
    storefrontRequirements: [],
    usageLimits: {},
    configurationSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    testingRequirements: [
      "Tenant isolation and authorization",
      "Configuration persistence",
      "Platform capability validation",
    ],
    ...input,
  };
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
  feature({
    id: "core.central-growth-engine",
    name: "Central Growth Engine",
    description:
      "Shared tenant, store, feature, permission, and service foundation for all growth modules.",
    category: "foundation",
    implementationStatus: "in_development",
    canActivate: false,
    requiredData: ["organizations", "stores", "feature_registry"],
    apiEndpoints: ["/organizations", "/organizations/{organizationId}/stores"],
  }),
  feature({
    id: "core.feature-configuration-manager",
    name: "Feature Configuration Manager",
    description:
      "Browse the registry, inspect dependencies and platform targets, and save per-store settings for available modules.",
    category: "foundation",
    implementationStatus: "available",
    canActivate: true,
    requiredPermissions: ["store:read", "store.features:write"],
    requiredData: ["feature_registry", "store_features"],
    apiEndpoints: [
      "/features",
      "/stores/{storeId}/features",
      "/stores/{storeId}/features/{featureId}",
    ],
  }),
  feature({
    id: "intelligence.customer-behaviour-tracking",
    name: "Customer Behaviour Tracking",
    description:
      "Consent-aware collection and deduplication of permitted storefront and campaign events.",
    category: "foundation",
    dependencies: ["core.central-growth-engine"],
    requiredData: ["consent", "anonymous_sessions", "tracking_events"],
    supportedEvents: [
      "page.viewed",
      "product.viewed",
      "product.searched",
      "cart.updated",
      "checkout.started",
      "order.paid",
    ],
    storefrontRequirements: ["JavaScript SDK", "Consent state"],
  }),
  feature({
    id: "automation.rules-engine",
    name: "Automation Rules Engine",
    description:
      "Trigger-condition-action workflows with safeguards, execution history, retries, and failure reporting.",
    category: "foundation",
    dependencies: [
      "intelligence.customer-behaviour-tracking",
      "intelligence.customer-segmentation",
      "messaging.unified-notification-engine",
    ],
    requiredData: ["automation_workflows", "automation_executions"],
    supportedEvents: ["automation.triggered", "automation.completed"],
  }),
  feature({
    id: "intelligence.customer-segmentation",
    name: "Customer Segmentation Engine",
    description:
      "Dynamic and static customer groups based on purchases, spending, interests, activity, engagement, and consented signals.",
    category: "foundation",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["customers", "orders", "tracking_events", "consent"],
    supportedEvents: ["customer.segment_changed"],
  }),
  feature({
    id: "messaging.unified-notification-engine",
    name: "Unified Notification Engine",
    description:
      "Shared, preference-aware delivery, templates, suppression, retries, and delivery records across supported channels.",
    category: "foundation",
    requiredData: ["notification_preferences", "notification_templates"],
    supportedEvents: ["notification.delivered", "notification.failed"],
  }),
  feature({
    id: "sales.product-reviews-ratings",
    name: "Product Reviews and Ratings",
    description:
      "Verified-purchase reviews, ratings, moderation, storefront display, and review-request workflows.",
    category: "sales_conversion",
    dependencies: ["messaging.unified-notification-engine"],
    requiredData: ["products", "orders", "reviews"],
    supportedEvents: ["review.submitted", "review.moderated"],
    storefrontRequirements: ["Review collection and display widget"],
  }),
  feature({
    id: "sales.smart-product-recommendations",
    name: "Smart Product Recommendations",
    description:
      "Product suggestions based on catalog relationships and permitted browsing and purchase signals.",
    category: "sales_conversion",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["products", "product_views", "orders"],
    storefrontRequirements: ["Recommendation widget", "Product catalog access"],
  }),
  feature({
    id: "sales.product-bundling",
    name: "Product Bundling",
    description:
      "Merchant-configured product groups, bundle presentation, and supported bundle pricing.",
    category: "sales_conversion",
    requiredData: ["products", "product_variants"],
    storefrontRequirements: ["Bundle widget", "Platform pricing capability"],
  }),
  feature({
    id: "sales.upselling-cross-selling",
    name: "Upselling and Cross-selling",
    description:
      "Relevant upgrades and complementary products at supported shopping journey touchpoints.",
    category: "sales_conversion",
    dependencies: ["sales.smart-product-recommendations"],
    requiredData: ["products", "orders", "cart_items"],
    storefrontRequirements: ["Product and cart widgets"],
  }),
  feature({
    id: "sales.discount-promotion-engine",
    name: "Discount and Promotion Engine",
    description:
      "Scheduled promotions with eligibility, usage, spend, product, and customer restrictions.",
    category: "sales_conversion",
    requiredData: ["products", "customers", "discount_capabilities"],
    storefrontRequirements: ["Platform discount capability"],
    testingRequirements: [
      "Tenant authorization",
      "Eligibility and date-boundary tests",
      "Platform capability validation",
    ],
  }),
  feature({
    id: "sales.volume-discounts",
    name: "Volume Discounts",
    description:
      "Quantity-based offers and tiered pricing where the connected platform supports them.",
    category: "sales_conversion",
    dependencies: ["sales.discount-promotion-engine"],
    requiredData: ["products", "product_variants", "discount_capabilities"],
  }),
  feature({
    id: "sales.free-gift-offers",
    name: "Free Gift Offers",
    description:
      "Qualifying cart or order rules that unlock a configured gift product.",
    category: "sales_conversion",
    dependencies: ["sales.discount-promotion-engine"],
    requiredData: ["products", "cart_items", "discount_capabilities"],
  }),
  feature({
    id: "sales.frequently-bought-together",
    name: "Frequently Bought Together",
    description:
      "Product combinations computed from supported order data and displayed as optional recommendations.",
    category: "sales_conversion",
    dependencies: ["sales.smart-product-recommendations"],
    requiredData: ["orders", "order_items", "products"],
  }),
  feature({
    id: "shopping.wishlist",
    name: "Wishlist",
    description:
      "Customer or consent-aware visitor lists of saved products.",
    category: "shopping_experience",
    requiredData: ["customers", "products", "consent"],
    supportedEvents: ["wishlist.item_added", "wishlist.item_removed"],
    storefrontRequirements: ["Wishlist widget", "Visitor identity where permitted"],
  }),
  feature({
    id: "shopping.recently-viewed",
    name: "Recently Viewed Products",
    description:
      "Recently viewed product lists using consent-aware session or customer storage.",
    category: "shopping_experience",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["product_views", "consent"],
    storefrontRequirements: ["JavaScript SDK", "Recently viewed widget"],
  }),
  feature({
    id: "shopping.product-comparison",
    name: "Product Comparison",
    description:
      "Side-by-side product comparison using attributes available from the connected catalog.",
    category: "shopping_experience",
    requiredData: ["products", "product_attributes"],
    storefrontRequirements: ["Comparison widget", "Catalog attribute access"],
  }),
  feature({
    id: "shopping.quick-product-view",
    name: "Quick Product View",
    description:
      "Product previews that let shoppers inspect catalog details without leaving a listing.",
    category: "shopping_experience",
    requiredData: ["products", "product_variants"],
    storefrontRequirements: ["Product catalog access", "Quick-view widget"],
  }),
  feature({
    id: "shopping.smart-product-search",
    name: "Smart Product Search",
    description:
      "Product discovery with relevant results, filters, suggestions, and search analytics.",
    category: "shopping_experience",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["products", "collections", "search_events"],
    supportedEvents: ["product.searched"],
    storefrontRequirements: ["Search interface integration", "Catalog access"],
  }),
  feature({
    id: "shopping.sticky-add-to-cart",
    name: "Sticky Add-to-Cart",
    description:
      "Persistent product-page purchase controls on stores where cart operations are supported.",
    category: "shopping_experience",
    requiredData: ["products", "cart_capabilities"],
    storefrontRequirements: ["Product context", "Cart API capability"],
  }),
  feature({
    id: "shopping.cart-drawer-optimization",
    name: "Cart Drawer and Cart Optimization",
    description:
      "Cart drawer interfaces and configurable improvements using supported cart APIs.",
    category: "shopping_experience",
    dependencies: ["sales.upselling-cross-selling"],
    requiredData: ["cart_items", "products", "cart_capabilities"],
    storefrontRequirements: ["Cart API capability", "Cart widget"],
  }),
  feature({
    id: "shopping.product-personalization",
    name: "Product Personalization",
    description:
      "Product choices and personalization inputs where the underlying store can accept them.",
    category: "shopping_experience",
    requiredData: ["products", "product_option_capabilities"],
    storefrontRequirements: ["Product option and cart metadata capability"],
  }),
  feature({
    id: "marketing.email-capture",
    name: "Email Capture",
    description:
      "Configurable subscriber forms with stored consent and suppression preferences.",
    category: "marketing_recovery",
    requiredData: ["email_subscribers", "consent"],
    supportedEvents: ["customer.subscribed", "customer.unsubscribed"],
    storefrontRequirements: ["Form widget", "Consent disclosure"],
  }),
  feature({
    id: "marketing.exit-intent-popups",
    name: "Exit-Intent Pop-ups",
    description:
      "Consent-aware exit-intent messages where browser behavior allows reliable detection.",
    category: "marketing_recovery",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    storefrontRequirements: ["JavaScript SDK", "Popup widget"],
  }),
  feature({
    id: "marketing.promotional-popups",
    name: "Promotional Pop-ups",
    description:
      "Timed, targeted, and behavior-based promotional messages with frequency controls.",
    category: "marketing_recovery",
    dependencies: ["intelligence.customer-segmentation"],
    storefrontRequirements: ["JavaScript SDK", "Popup widget"],
  }),
  feature({
    id: "marketing.email-campaigns",
    name: "Email Marketing Campaigns",
    description:
      "Campaign creation, templates, scheduling, segmentation, delivery integration, tracking, and unsubscribes.",
    category: "marketing_recovery",
    dependencies: [
      "intelligence.customer-segmentation",
      "messaging.unified-notification-engine",
    ],
    requiredData: ["email_subscribers", "campaigns", "consent"],
    supportedEvents: ["campaign.sent", "notification.delivered"],
    requiredPermissions: ["customers:read", "marketing:send"],
  }),
  feature({
    id: "marketing.abandoned-cart-recovery",
    name: "Abandoned-Cart Recovery",
    description:
      "Eligible cart recovery workflows that respect consent, platform rules, and customer preferences.",
    category: "marketing_recovery",
    dependencies: [
      "automation.rules-engine",
      "messaging.unified-notification-engine",
    ],
    requiredData: ["carts", "customers", "consent"],
    supportedEvents: ["cart.abandoned", "cart.recovered"],
    requiredPermissions: ["customers:read", "marketing:send"],
  }),
  feature({
    id: "marketing.browser-push",
    name: "Browser Push Notifications",
    description:
      "Permission-based browser subscriptions, campaigns, and delivery tracking.",
    category: "marketing_recovery",
    dependencies: ["messaging.unified-notification-engine"],
    requiredData: ["push_subscriptions", "consent"],
    supportedEvents: ["push.subscribed", "notification.delivered"],
    storefrontRequirements: ["Service worker", "Explicit browser permission"],
  }),
  feature({
    id: "marketing.customer-segment-campaigns",
    name: "Customer Segment Campaigns",
    description:
      "Targeted campaigns for eligible customer segments and consented channels.",
    category: "marketing_recovery",
    dependencies: [
      "intelligence.customer-segmentation",
      "marketing.email-campaigns",
    ],
    requiredData: ["customer_segments", "campaigns", "consent"],
    requiredPermissions: ["customers:read", "marketing:send"],
  }),
  feature({
    id: "conversion.countdown-timers",
    name: "Countdown Timers",
    description:
      "Promotional timers with server-defined expiry and accurate end behavior.",
    category: "conversion_psychology",
    requiredData: ["promotions", "promotion_schedule"],
    storefrontRequirements: ["Countdown widget"],
  }),
  feature({
    id: "conversion.low-stock-notifications",
    name: "Low-Stock Notifications",
    description:
      "Displays genuine inventory signals only when the connected platform exposes them.",
    category: "conversion_psychology",
    requiredData: ["inventory", "inventory_capabilities"],
    supportedEvents: ["inventory.changed"],
    storefrontRequirements: ["Trusted inventory sync"],
    testingRequirements: [
      "Tenant authorization",
      "Inventory-source verification",
      "Never fabricate scarcity",
    ],
  }),
  feature({
    id: "conversion.social-proof-notifications",
    name: "Social Proof Notifications",
    description:
      "Shows verified activity or permitted popularity data without fabricated purchases or reviews.",
    category: "conversion_psychology",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["verified_orders", "verified_reviews", "consent"],
    storefrontRequirements: ["Verified activity widget"],
    testingRequirements: [
      "Tenant authorization",
      "Source-data verification",
      "Never fabricate activity",
    ],
  }),
  feature({
    id: "conversion.announcement-bars",
    name: "Announcement Bars",
    description:
      "Merchant-configured informational or promotional storefront banners.",
    category: "conversion_psychology",
    storefrontRequirements: ["Announcement widget"],
  }),
  feature({
    id: "conversion.free-shipping-progress",
    name: "Free-Shipping Progress Bars",
    description:
      "Shows progress toward a merchant-defined shipping threshold using accurate cart totals and currency.",
    category: "conversion_psychology",
    requiredData: ["cart_total", "currency", "shipping_threshold"],
    storefrontRequirements: ["Accurate cart totals", "Currency-aware widget"],
  }),
  feature({
    id: "analytics.visitor-analytics",
    name: "Visitor Analytics",
    description:
      "Privacy-aware visitor, session, source, product-interest, and engagement reporting.",
    category: "analytics",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["tracking_events", "event_sessions", "consent"],
  }),
  feature({
    id: "analytics.heatmaps",
    name: "Heatmaps",
    description:
      "Privacy-conscious interaction maps where browser instrumentation supports them.",
    category: "analytics",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["masked_interaction_events", "consent"],
    storefrontRequirements: ["Consent-aware interaction instrumentation"],
  }),
  feature({
    id: "analytics.session-recordings",
    name: "Session Recordings",
    description:
      "Restricted, consent-based session playback with sensitive-field masking and retention limits.",
    category: "analytics",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["masked_session_events", "consent", "retention_policy"],
    storefrontRequirements: ["Consent-aware recorder", "Sensitive-field masking"],
    testingRequirements: [
      "Tenant authorization",
      "Sensitive-field masking",
      "Consent and retention enforcement",
    ],
  }),
  feature({
    id: "analytics.conversion-tracking",
    name: "Conversion Tracking",
    description:
      "Deduplicated funnel and conversion measurement from supported store and storefront events.",
    category: "analytics",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["tracking_events", "orders", "campaign_attribution"],
    supportedEvents: ["checkout.started", "order.created", "order.paid"],
  }),
  feature({
    id: "analytics.sales-performance-reports",
    name: "Sales Performance Reports",
    description:
      "Store-sourced revenue and product metrics separated from Growth Engine estimates.",
    category: "analytics",
    dependencies: ["analytics.conversion-tracking"],
    requiredData: ["orders", "order_items", "campaigns", "analytics_daily"],
    requiredPermissions: ["orders:read", "analytics:read"],
  }),
  feature({
    id: "retention.loyalty-points",
    name: "Loyalty Points",
    description:
      "Merchant-defined points for qualifying activities and eligible purchases.",
    category: "retention",
    dependencies: ["intelligence.customer-behaviour-tracking"],
    requiredData: ["customers", "loyalty_accounts", "loyalty_transactions"],
    supportedEvents: ["loyalty.points_awarded"],
  }),
  feature({
    id: "retention.back-in-stock",
    name: "Back-in-Stock Notifications",
    description:
      "Customer subscriptions and alerts when trusted inventory data shows a restock.",
    category: "retention",
    dependencies: ["messaging.unified-notification-engine"],
    requiredData: ["inventory", "back_in_stock_subscriptions", "consent"],
    supportedEvents: ["inventory.changed", "notification.delivered"],
  }),
  feature({
    id: "retention.referral-rewards",
    name: "Referral Rewards",
    description:
      "Referral links, attribution, eligibility checks, and reward records.",
    category: "retention",
    requiredData: ["customers", "referral_programs", "referral_records"],
    supportedEvents: ["referral.attributed", "reward.issued"],
  }),
  feature({
    id: "retention.customer-rewards",
    name: "Customer Rewards",
    description:
      "Merchant-managed rewards with explicit qualification and redemption rules.",
    category: "retention",
    requiredData: ["customers", "reward_records"],
    supportedEvents: ["reward.issued", "reward.redeemed"],
  }),
  feature({
    id: "ai.shopping-assistant",
    name: "AI Shopping Assistant",
    description:
      "Product questions, discovery, comparisons, and recommendations grounded in approved catalog data.",
    category: "ai_intelligence",
    dependencies: ["sales.smart-product-recommendations"],
    requiredData: ["products", "product_attributes", "inventory_capabilities"],
    storefrontRequirements: ["Assistant widget", "Approved catalog context"],
    testingRequirements: [
      "Tenant authorization",
      "Grounded answers",
      "No invented price, inventory, or order status",
    ],
  }),
  feature({
    id: "ai.marketing-sales-intelligence",
    name: "AI Marketing and Sales Intelligence",
    description:
      "Grounded performance summaries, customer and product analysis, campaign suggestions, and actionable reports.",
    category: "ai_intelligence",
    dependencies: ["analytics.sales-performance-reports"],
    requiredData: ["analytics_daily", "orders", "campaigns", "automation_executions"],
    requiredPermissions: ["analytics:read", "customers:read"],
    testingRequirements: [
      "Tenant authorization",
      "Grounded observations and predictions",
      "Source data cited in generated reports",
    ],
  }),
];
