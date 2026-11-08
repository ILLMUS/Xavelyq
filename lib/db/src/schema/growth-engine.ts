import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
]);

export const storePlatformEnum = pgEnum("store_platform", [
  "shopify",
  "woocommerce",
  "lovable",
  "react_vite",
  "custom_javascript",
  "custom_html",
  "custom_backend",
  "other",
]);

export const storeConnectionStatusEnum = pgEnum("store_connection_status", [
  "setup_required",
  "awaiting_verification",
  "connected",
  "disconnected",
]);

export const featureCategoryEnum = pgEnum("feature_category", [
  "foundation",
  "sales_conversion",
  "shopping_experience",
  "marketing_recovery",
  "conversion_psychology",
  "analytics",
  "retention",
  "ai_intelligence",
]);

export const implementationStatusEnum = pgEnum("implementation_status", [
  "available",
  "in_development",
  "planned",
  "not_available",
]);

export const usersTable = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
});

export const organizationsTable = pgTable("organizations", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
});

export const organizationMembersTable = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_idx").on(table.userId),
  ],
);

export const storesTable = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    platform: storePlatformEnum("platform").notNull(),
    primaryDomain: text("primary_domain"),
    connectionStatus: storeConnectionStatusEnum("connection_status")
      .notNull()
      .default("setup_required"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stores_organization_id_idx").on(table.organizationId),
    uniqueIndex("stores_org_domain_unique")
      .on(table.organizationId, table.primaryDomain)
      .where(sql`${table.primaryDomain} is not null`),
    uniqueIndex("stores_org_default_unique")
      .on(table.organizationId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const featureRegistryTable = pgTable(
  "feature_registry",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: featureCategoryEnum("category").notNull(),
    version: text("version").notNull().default("1.0.0"),
    implementationStatus: implementationStatusEnum(
      "implementation_status",
    ).notNull(),
    canActivate: boolean("can_activate").notNull().default(false),
    dependencies: jsonb("dependencies")
      .$type<string[]>()
      .notNull()
      .default([]),
    platformCompatibility: jsonb("platform_compatibility")
      .$type<string[]>()
      .notNull()
      .default([]),
    requiredPermissions: jsonb("required_permissions")
      .$type<string[]>()
      .notNull()
      .default([]),
    requiredData: jsonb("required_data").$type<string[]>().notNull().default([]),
    supportedEvents: jsonb("supported_events")
      .$type<string[]>()
      .notNull()
      .default([]),
    apiEndpoints: jsonb("api_endpoints")
      .$type<string[]>()
      .notNull()
      .default([]),
    storefrontRequirements: jsonb("storefront_requirements")
      .$type<string[]>()
      .notNull()
      .default([]),
    usageLimits: jsonb("usage_limits")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    configurationSchema: jsonb("configuration_schema")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    testingRequirements: jsonb("testing_requirements")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("feature_registry_category_idx").on(table.category)],
);

export const storeFeaturesTable = pgTable(
  "store_features",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => featureRegistryTable.id, { onDelete: "restrict" }),
    enabled: boolean("enabled").notNull().default(false),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("store_features_store_feature_unique").on(
      table.storeId,
      table.featureId,
    ),
    index("store_features_store_idx").on(table.storeId),
  ],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => storesTable.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_store_created_idx").on(table.storeId, table.createdAt),
  ],
);

export type User = typeof usersTable.$inferSelect;
export type Organization = typeof organizationsTable.$inferSelect;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
export type Store = typeof storesTable.$inferSelect;
export type FeatureRegistryEntry = typeof featureRegistryTable.$inferSelect;
export type StoreFeature = typeof storeFeaturesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
