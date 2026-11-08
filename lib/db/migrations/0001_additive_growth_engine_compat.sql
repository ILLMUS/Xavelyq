BEGIN;

-- Xavelyq 1.0.1: additive compatibility migration.
-- Preserve existing organizations, stores, profiles, modules and settings.
-- Do not drop or truncate legacy tables.

-- 1. Create the enum types required by the new schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_role') THEN
    CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'member');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_platform') THEN
    CREATE TYPE public.store_platform AS ENUM (
      'shopify', 'woocommerce', 'lovable', 'react_vite',
      'custom_javascript', 'custom_html', 'custom_backend', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_connection_status') THEN
    CREATE TYPE public.store_connection_status AS ENUM (
      'setup_required', 'awaiting_verification', 'connected', 'disconnected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_category') THEN
    CREATE TYPE public.feature_category AS ENUM (
      'foundation', 'sales_conversion', 'shopping_experience',
      'marketing_recovery', 'conversion_psychology',
      'analytics', 'retention', 'ai_intelligence'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'implementation_status') THEN
    CREATE TYPE public.implementation_status AS ENUM (
      'available', 'in_development', 'planned', 'not_available'
    );
  END IF;
END $$;

-- 2. Create users. Existing profile IDs are retained as user IDs.
-- The legacy Clerk identifier is a temporary placeholder to be linked
-- to the actual signed-in Clerk account in a later verified step.
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.users (id, clerk_user_id)
SELECT p.id, 'legacy:' || p.id::text
FROM public.profiles p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, clerk_user_id)
SELECT DISTINCT o.created_by, 'legacy:' || o.created_by::text
FROM public.organizations o
WHERE o.created_by IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, clerk_user_id)
SELECT DISTINCT m.user_id, 'legacy:' || m.user_id::text
FROM public.organization_memberships m
ON CONFLICT (id) DO NOTHING;

-- 3. Create the new organization membership table and preserve old memberships.
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id)
);

INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
SELECT
  m.organization_id,
  m.user_id,
  CASE
    WHEN lower(m.role) = 'owner' THEN 'owner'::public.organization_role
    WHEN lower(m.role) = 'admin' THEN 'admin'::public.organization_role
    ELSE 'member'::public.organization_role
  END,
  m.created_at
FROM public.organization_memberships m
ON CONFLICT (organization_id, user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS organization_members_user_id_idx
  ON public.organization_members(user_id);

-- 4. Preserve the original store platform values before converting the column.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS legacy_platform text;

UPDATE public.stores
SET legacy_platform = platform
WHERE legacy_platform IS NULL;

-- Normalize legacy platform values to the new enum values.
ALTER TABLE public.stores
  ALTER COLUMN platform TYPE public.store_platform
  USING (
    CASE lower(platform::text)
      WHEN 'shopify' THEN 'shopify'
      WHEN 'woocommerce' THEN 'woocommerce'
      WHEN 'lovable' THEN 'lovable'
      WHEN 'react_vite' THEN 'react_vite'
      WHEN 'custom_javascript' THEN 'custom_javascript'
      WHEN 'custom_html' THEN 'custom_html'
      WHEN 'custom' THEN 'custom_backend'
      WHEN 'custom_backend' THEN 'custom_backend'
      ELSE 'other'
    END
  )::public.store_platform;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS primary_domain text,
  ADD COLUMN IF NOT EXISTS connection_status public.store_connection_status
    NOT NULL DEFAULT 'setup_required',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

UPDATE public.stores
SET connection_status =
  CASE
    WHEN lower(coalesce(status, '')) = 'active'
      THEN 'connected'::public.store_connection_status
    WHEN lower(coalesce(status, '')) = 'disconnected'
      THEN 'disconnected'::public.store_connection_status
    ELSE 'setup_required'::public.store_connection_status
  END;

CREATE INDEX IF NOT EXISTS stores_organization_id_idx
  ON public.stores(organization_id);

-- 5. Create the new feature registry.
CREATE TABLE IF NOT EXISTS public.feature_registry (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category public.feature_category NOT NULL DEFAULT 'foundation',
  version text NOT NULL DEFAULT '1.0.0',
  implementation_status public.implementation_status NOT NULL DEFAULT 'planned',
  can_activate boolean NOT NULL DEFAULT false,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  platform_compatibility jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  api_endpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  storefront_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  testing_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_registry_category_idx
  ON public.feature_registry(category);

-- 6. Explicit mapping from the existing 45 legacy module keys to new catalog IDs.
CREATE TEMP TABLE xavelyq_feature_key_map (
  legacy_key text PRIMARY KEY,
  feature_id text NOT NULL UNIQUE,
  category public.feature_category NOT NULL
) ON COMMIT DROP;

INSERT INTO xavelyq_feature_key_map (legacy_key, feature_id, category) VALUES
('central_engine', 'core.central-growth-engine', 'foundation'),
('feature_configuration', 'core.feature-configuration-manager', 'foundation'),
('behavior_tracking', 'intelligence.customer-behaviour-tracking', 'ai_intelligence'),
('automation_engine', 'automation.rules-engine', 'foundation'),
('customer_segmentation', 'intelligence.customer-segmentation', 'ai_intelligence'),
('notifications', 'messaging.unified-notification-engine', 'foundation'),
('reviews', 'sales.product-reviews-ratings', 'sales_conversion'),
('recommendations', 'sales.smart-product-recommendations', 'sales_conversion'),
('product_bundles', 'sales.product-bundling', 'sales_conversion'),
('upsell_cross_sell', 'sales.upselling-cross-selling', 'sales_conversion'),
('discounts_promotions', 'sales.discount-promotion-engine', 'sales_conversion'),
('volume_discounts', 'sales.volume-discounts', 'sales_conversion'),
('free_gifts', 'sales.free-gift-offers', 'sales_conversion'),
('frequently_bought_together', 'sales.frequently-bought-together', 'sales_conversion'),
('wishlist', 'shopping.wishlist', 'shopping_experience'),
('recently_viewed', 'shopping.recently-viewed', 'shopping_experience'),
('product_comparison', 'shopping.product-comparison', 'shopping_experience'),
('quick_view', 'shopping.quick-product-view', 'shopping_experience'),
('smart_search', 'shopping.smart-product-search', 'shopping_experience'),
('sticky_add_to_cart', 'shopping.sticky-add-to-cart', 'shopping_experience'),
('cart_optimization', 'shopping.cart-drawer-optimization', 'shopping_experience'),
('personalization', 'shopping.product-personalization', 'shopping_experience'),
('email_capture', 'marketing.email-capture', 'marketing_recovery'),
('exit_intent', 'marketing.exit-intent-popups', 'marketing_recovery'),
('promotional_popups', 'marketing.promotional-popups', 'marketing_recovery'),
('email_marketing', 'marketing.email-campaigns', 'marketing_recovery'),
('abandoned_cart', 'marketing.abandoned-cart-recovery', 'marketing_recovery'),
('browser_push', 'marketing.browser-push', 'marketing_recovery'),
('segment_campaigns', 'marketing.customer-segment-campaigns', 'marketing_recovery'),
('countdown_timers', 'conversion.countdown-timers', 'conversion_psychology'),
('low_stock_alerts', 'conversion.low-stock-notifications', 'conversion_psychology'),
('social_proof', 'conversion.social-proof-notifications', 'conversion_psychology'),
('announcement_bars', 'conversion.announcement-bars', 'conversion_psychology'),
('free_shipping_progress', 'conversion.free-shipping-progress', 'conversion_psychology'),
('visitor_analytics', 'analytics.visitor-analytics', 'analytics'),
('heatmaps', 'analytics.heatmaps', 'analytics'),
('session_recordings', 'analytics.session-recordings', 'analytics'),
('conversion_tracking', 'analytics.conversion-tracking', 'analytics'),
('sales_reports', 'analytics.sales-performance-reports', 'analytics'),
('loyalty_points', 'retention.loyalty-points', 'retention'),
('back_in_stock', 'retention.back-in-stock', 'retention'),
('referral_rewards', 'retention.referral-rewards', 'retention'),
('customer_rewards', 'retention.customer-rewards', 'retention'),
('ai_shopping_assistant', 'ai.shopping-assistant', 'ai_intelligence'),
('ai_marketing_intelligence', 'ai.marketing-sales-intelligence', 'ai_intelligence');

-- Stop safely if any existing module key has no explicit mapping.
DO $$
DECLARE unmapped_count integer;
BEGIN
  SELECT count(*) INTO unmapped_count
  FROM public.feature_modules fm
  LEFT JOIN xavelyq_feature_key_map m ON m.legacy_key = fm.module_key
  WHERE m.legacy_key IS NULL;

  IF unmapped_count > 0 THEN
    RAISE EXCEPTION
      'Migration stopped: % legacy feature_modules keys have no mapping. No changes committed.',
      unmapped_count;
  END IF;
END $$;

-- Seed registry rows from existing module descriptions.
-- The API feature-catalog seeder can subsequently enrich/update these records.
INSERT INTO public.feature_registry (
  id, name, description, category, implementation_status, can_activate
)
SELECT
  m.feature_id,
  fm.name,
  coalesce(fm.description, ''),
  m.category,
  CASE WHEN coalesce(fm.is_active, false)
    THEN 'available'::public.implementation_status
    ELSE 'planned'::public.implementation_status
  END,
  coalesce(fm.is_active, false)
FROM public.feature_modules fm
JOIN xavelyq_feature_key_map m ON m.legacy_key = fm.module_key
ON CONFLICT (id) DO NOTHING;

-- 7. Add new feature fields while retaining module_key and config.
ALTER TABLE public.store_features
  ADD COLUMN IF NOT EXISTS feature_id text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.store_features sf
SET
  feature_id = m.feature_id,
  settings = coalesce(sf.config, '{}'::jsonb)
FROM xavelyq_feature_key_map m
WHERE sf.module_key = m.legacy_key
  AND sf.feature_id IS NULL;

-- Do not silently leave existing store features disconnected.
DO $$
DECLARE unmapped_count integer;
BEGIN
  SELECT count(*) INTO unmapped_count
  FROM public.store_features
  WHERE feature_id IS NULL;

  IF unmapped_count > 0 THEN
    RAISE EXCEPTION
      'Migration stopped: % store_features rows could not be mapped. No changes committed.',
      unmapped_count;
  END IF;
END $$;

ALTER TABLE public.store_features
  ALTER COLUMN feature_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS store_features_store_feature_unique
  ON public.store_features(store_id, feature_id);

CREATE INDEX IF NOT EXISTS store_features_store_id_idx
  ON public.store_features(store_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_features_feature_id_feature_registry_id_fk'
  ) THEN
    ALTER TABLE public.store_features
      ADD CONSTRAINT store_features_feature_id_feature_registry_id_fk
      FOREIGN KEY (feature_id)
      REFERENCES public.feature_registry(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 8. Create audit logs.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_organization_created_idx
  ON public.audit_logs(organization_id, created_at);

CREATE INDEX IF NOT EXISTS audit_logs_store_created_idx
  ON public.audit_logs(store_id, created_at);

COMMIT;
