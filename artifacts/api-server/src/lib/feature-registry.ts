import { sql } from "drizzle-orm";
import { db, featureRegistryTable } from "@workspace/db";
import { FEATURE_CATALOG } from "./feature-catalog";

export async function seedFeatureRegistry(): Promise<void> {
  const updates = {
    name: sql`excluded.name`,
    description: sql`excluded.description`,
    category: sql`excluded.category`,
    version: sql`excluded.version`,
    implementationStatus: sql`excluded.implementation_status`,
    canActivate: sql`excluded.can_activate`,
    dependencies: sql`excluded.dependencies`,
    platformCompatibility: sql`excluded.platform_compatibility`,
    requiredPermissions: sql`excluded.required_permissions`,
    requiredData: sql`excluded.required_data`,
    supportedEvents: sql`excluded.supported_events`,
    apiEndpoints: sql`excluded.api_endpoints`,
    storefrontRequirements: sql`excluded.storefront_requirements`,
    usageLimits: sql`excluded.usage_limits`,
    configurationSchema: sql`excluded.configuration_schema`,
    testingRequirements: sql`excluded.testing_requirements`,
    updatedAt: new Date(),
  };

  await db
    .insert(featureRegistryTable)
    .values(FEATURE_CATALOG)
    .onConflictDoUpdate({
      target: featureRegistryTable.id,
      set: updates,
    });
}
