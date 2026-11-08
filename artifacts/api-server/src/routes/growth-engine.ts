import { getAuth } from "@clerk/express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ActivityItem,
  CreateOrganizationBody,
  CreateOrganizationResponse,
  CreateStoreBody,
  CreateStoreParams,
  CreateStoreResponse,
  DashboardSummary,
  FeatureDefinition,
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
  GetStoreParams,
  GetStoreResponse,
  ListFeaturesQueryParams,
  ListFeaturesResponse,
  ListOrganizationActivityParams,
  ListOrganizationActivityResponse,
  ListOrganizationsResponse,
  ListStoresParams,
  ListStoresResponse,
  ListStoreFeaturesParams,
  ListStoreFeaturesResponse,
  Organization,
  StoreFeature,
  StoreFeatureUpdate,
  StoreFeatureView,
  StorePlatform,
  StoreUpdate,
  UpdateOrganizationBody,
  UpdateOrganizationParams,
  UpdateOrganizationResponse,
  UpdateStoreBody,
  UpdateStoreFeatureBody,
  UpdateStoreFeatureParams,
  UpdateStoreFeatureResponse,
  UpdateStoreParams,
  UpdateStoreResponse,
} from "@workspace/api-zod";
import {
  auditLogsTable,
  db,
  featureRegistryTable,
  organizationMembersTable,
  organizationsTable,
  storesTable,
  storeFeaturesTable,
  usersTable,
} from "@workspace/db";
import { FEATURE_CATALOG } from "../lib/feature-catalog";

const router: IRouter = Router();

function errorResponse(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function requireAuthentication(
  req: Request,
  res: Response,
  next: () => void,
): void {
  if (!getAuth(req).userId) {
    errorResponse(res, 401, "A signed-in session is required.");
    return;
  }
  next();
}

router.use(requireAuthentication);

async function resolveUserId(clerkUserId: string): Promise<string> {
  const [user] = await db
    .insert(usersTable)
    .values({ clerkUserId })
    .onConflictDoUpdate({
      target: usersTable.clerkUserId,
      set: { clerkUserId },
    })
    .returning({ id: usersTable.id });

  return user.id;
}

async function getOrganizationRole(
  userId: string,
  organizationId: string,
): Promise<"owner" | "admin" | "member" | null> {
  const [membership] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.organizationId, organizationId),
        eq(organizationMembersTable.userId, userId),
      ),
    )
    .limit(1);

  return membership?.role ?? null;
}

async function requireOrganizationAccess(
  clerkUserId: string,
  organizationId: string,
  res: Response,
  write = false,
): Promise<string | null> {
  const userId = await resolveUserId(clerkUserId);
  const role = await getOrganizationRole(userId, organizationId);
  if (!role) {
    errorResponse(res, 404, "Organization not found.");
    return null;
  }
  if (write && role === "member") {
    errorResponse(res, 403, "This organization role cannot make changes.");
    return null;
  }
  return userId;
}

async function findStore(storeId: string) {
  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.id, storeId))
    .limit(1);
  return store ?? null;
}

async function requireStoreAccess(
  clerkUserId: string,
  storeId: string,
  res: Response,
  write = false,
): Promise<{ userId: string; organizationId: string } | null> {
  const store = await findStore(storeId);
  if (!store) {
    errorResponse(res, 404, "Store not found.");
    return null;
  }
  const userId = await requireOrganizationAccess(
    clerkUserId,
    store.organizationId,
    res,
    write,
  );
  return userId ? { userId, organizationId: store.organizationId } : null;
}

async function writeAuditLog(input: {
  organizationId: string;
  storeId?: string | null;
  userId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    organizationId: input.organizationId,
    storeId: input.storeId ?? null,
    userId: input.userId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    summary: input.summary,
  });
}

function createSlug(name: string): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "organization";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const candidate = value.trim().includes("://")
      ? value.trim()
      : `https://${value.trim()}`;
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function toFeatureDefinition(
  row: typeof featureRegistryTable.$inferSelect,
): FeatureDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    version: row.version,
    implementationStatus: row.implementationStatus,
    canActivate: row.canActivate,
    dependencies: row.dependencies,
    platformCompatibility: row.platformCompatibility as StorePlatform[],
    requiredPermissions: row.requiredPermissions,
    requiredData: row.requiredData,
    supportedEvents: row.supportedEvents,
    apiEndpoints: row.apiEndpoints,
    storefrontRequirements: row.storefrontRequirements,
    usageLimits: row.usageLimits,
    configurationSchema: row.configurationSchema,
    testingRequirements: row.testingRequirements,
  };
}

function toOrganization(
  row: typeof organizationsTable.$inferSelect,
  role: "owner" | "admin" | "member",
): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toStore(row: typeof storesTable.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    platform: row.platform,
    primaryDomain: row.primaryDomain,
    connectionStatus: row.connectionStatus,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toStoreFeature(
  row: typeof storeFeaturesTable.$inferSelect,
): StoreFeature {
  return {
    featureId: row.featureId,
    enabled: row.enabled,
    settings: row.settings,
    updatedAt: row.updatedAt,
  };
}

function toActivityItem(
  row: typeof auditLogsTable.$inferSelect,
): ActivityItem {
  return {
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    summary: row.summary,
    createdAt: row.createdAt,
  };
}

router.get("/organizations", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    errorResponse(res, 401, "A signed-in session is required.");
    return;
  }

  const userId = await resolveUserId(clerkUserId);
  const rows = await db
    .select({ organization: organizationsTable, role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .innerJoin(
      organizationsTable,
      eq(organizationMembersTable.organizationId, organizationsTable.id),
    )
    .where(eq(organizationMembersTable.userId, userId))
    .orderBy(asc(organizationsTable.name));

  res.json(
    ListOrganizationsResponse.parse(
      rows.map(({ organization, role }) => toOrganization(organization, role)),
    ),
  );
});

router.post("/organizations", async (req, res): Promise<void> => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    errorResponse(res, 400, parsed.error.message);
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    errorResponse(res, 401, "A signed-in session is required.");
    return;
  }

  const userId = await resolveUserId(clerkUserId);
  const name = parsed.data.name.trim();
  const created = await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizationsTable)
      .values({ name, slug: createSlug(name), createdBy: userId })
      .returning();
    await tx.insert(organizationMembersTable).values({
      organizationId: organization.id,
      userId,
      role: "owner",
    });
    await tx.insert(auditLogsTable).values({
      organizationId: organization.id,
      userId,
      action: "organization.created",
      targetType: "organization",
      targetId: organization.id,
      summary: `Created organization ${name}`,
    });
    return organization;
  });

  res
    .status(201)
    .json(CreateOrganizationResponse.parse(toOrganization(created, "owner")));
});

router.patch(
  "/organizations/:organizationId",
  async (req, res): Promise<void> => {
    const params = UpdateOrganizationParams.safeParse(req.params);
    const body = UpdateOrganizationBody.safeParse(req.body);
    if (!params.success) {
      errorResponse(res, 400, params.error.message);
      return;
    }
    if (!body.success) {
      errorResponse(res, 400, body.error.message);
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      errorResponse(res, 401, "A signed-in session is required.");
      return;
    }
    const userId = await requireOrganizationAccess(
      clerkUserId,
      params.data.organizationId,
      res,
      true,
    );
    if (!userId) return;

    const name = body.data.name.trim();
    const [organization] = await db
      .update(organizationsTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(organizationsTable.id, params.data.organizationId))
      .returning();
    if (!organization) {
      errorResponse(res, 404, "Organization not found.");
      return;
    }
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "organization.updated",
      targetType: "organization",
      targetId: organization.id,
      summary: `Updated organization name to ${name}`,
    });

    const role = await getOrganizationRole(userId, organization.id);
    res.json(
      UpdateOrganizationResponse.parse(
        toOrganization(organization, role ?? "owner"),
      ),
    );
  },
);

router.get(
  "/organizations/:organizationId/stores",
  async (req, res): Promise<void> => {
    const params = ListStoresParams.safeParse(req.params);
    if (!params.success) {
      errorResponse(res, 400, params.error.message);
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      errorResponse(res, 401, "A signed-in session is required.");
      return;
    }
    const userId = await requireOrganizationAccess(
      clerkUserId,
      params.data.organizationId,
      res,
    );
    if (!userId) return;

    const stores = await db
      .select()
      .from(storesTable)
      .where(eq(storesTable.organizationId, params.data.organizationId))
      .orderBy(desc(storesTable.isDefault), asc(storesTable.name));
    res.json(ListStoresResponse.parse(stores.map(toStore)));
  },
);

router.post(
  "/organizations/:organizationId/stores",
  async (req, res): Promise<void> => {
    const params = CreateStoreParams.safeParse(req.params);
    const body = CreateStoreBody.safeParse(req.body);
    if (!params.success) {
      errorResponse(res, 400, params.error.message);
      return;
    }
    if (!body.success) {
      errorResponse(res, 400, body.error.message);
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      errorResponse(res, 401, "A signed-in session is required.");
      return;
    }
    const userId = await requireOrganizationAccess(
      clerkUserId,
      params.data.organizationId,
      res,
      true,
    );
    if (!userId) return;
    const domain = normalizeDomain(body.data.primaryDomain);
    if (body.data.primaryDomain && !domain) {
      errorResponse(res, 400, "Enter a valid domain without a path or credentials.");
      return;
    }
    const name = body.data.name.trim();

    const store = await db.transaction(async (tx) => {
      if (body.data.isDefault) {
        await tx
          .update(storesTable)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(storesTable.organizationId, params.data.organizationId));
      }
      const [created] = await tx
        .insert(storesTable)
        .values({
          organizationId: params.data.organizationId,
          name,
          platform: body.data.platform,
          primaryDomain: domain,
          isDefault: body.data.isDefault ?? false,
          connectionStatus: "setup_required",
        })
        .returning();
      await tx.insert(storeFeaturesTable).values(
        FEATURE_CATALOG.map((definition) => ({
          storeId: created.id,
          featureId: definition.id,
          enabled: false,
          settings: {},
        })),
      );
      await tx.insert(auditLogsTable).values({
        organizationId: params.data.organizationId,
        storeId: created.id,
        userId,
        action: "store.created",
        targetType: "store",
        targetId: created.id,
        summary: `Added ${name} as a ${body.data.platform} store`,
      });
      return created;
    });

    res.status(201).json(CreateStoreResponse.parse(toStore(store)));
  },
);

router.get("/stores/:storeId", async (req, res): Promise<void> => {
  const params = GetStoreParams.safeParse(req.params);
  if (!params.success) {
    errorResponse(res, 400, params.error.message);
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    errorResponse(res, 401, "A signed-in session is required.");
    return;
  }
  const access = await requireStoreAccess(clerkUserId, params.data.storeId, res);
  if (!access) return;
  const store = await findStore(params.data.storeId);
  if (!store) {
    errorResponse(res, 404, "Store not found.");
    return;
  }
  res.json(GetStoreResponse.parse(toStore(store)));
});

router.patch("/stores/:storeId", async (req, res): Promise<void> => {
  const params = UpdateStoreParams.safeParse(req.params);
  const body = UpdateStoreBody.safeParse(req.body);
  if (!params.success) {
    errorResponse(res, 400, params.error.message);
    return;
  }
  if (!body.success) {
    errorResponse(res, 400, body.error.message);
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    errorResponse(res, 401, "A signed-in session is required.");
    return;
  }
  const access = await requireStoreAccess(
    clerkUserId,
    params.data.storeId,
    res,
    true,
  );
  if (!access) return;

  const update: Partial<typeof storesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.data.name !== undefined) update.name = body.data.name.trim();
  if (body.data.primaryDomain !== undefined) {
    const domain = normalizeDomain(body.data.primaryDomain);
    if (body.data.primaryDomain && !domain) {
      errorResponse(res, 400, "Enter a valid domain without a path or credentials.");
      return;
    }
    update.primaryDomain = domain;
  }
  if (body.data.isDefault !== undefined) {
    update.isDefault = body.data.isDefault;
  }

  const store = await db.transaction(async (tx) => {
    if (body.data.isDefault) {
      await tx
        .update(storesTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(storesTable.organizationId, access.organizationId));
    }
    const [updated] = await tx
      .update(storesTable)
      .set(update)
      .where(eq(storesTable.id, params.data.storeId))
      .returning();
    return updated ?? null;
  });
  if (!store) {
    errorResponse(res, 404, "Store not found.");
    return;
  }
  await writeAuditLog({
    organizationId: store.organizationId,
    storeId: store.id,
    userId: access.userId,
    action: "store.updated",
    targetType: "store",
    targetId: store.id,
    summary: `Updated store ${store.name}`,
  });
  res.json(UpdateStoreResponse.parse(toStore(store)));
});

router.get("/features", async (req, res): Promise<void> => {
  const params = ListFeaturesQueryParams.safeParse(req.query);
  if (!params.success) {
    errorResponse(res, 400, params.error.message);
    return;
  }
  const filters = [];
  if (params.data.category) {
    filters.push(eq(featureRegistryTable.category, params.data.category));
  }
  if (params.data.implementationStatus) {
    filters.push(
      eq(
        featureRegistryTable.implementationStatus,
        params.data.implementationStatus,
      ),
    );
  }
  if (params.data.search) {
    const search = `%${params.data.search}%`;
    filters.push(
      or(
        ilike(featureRegistryTable.name, search),
        ilike(featureRegistryTable.description, search),
      ),
    );
  }
  const query = db
    .select()
    .from(featureRegistryTable)
    .orderBy(asc(featureRegistryTable.category), asc(featureRegistryTable.name));
  const rows = filters.length ? await query.where(and(...filters)) : await query;
  res.json(
    ListFeaturesResponse.parse(rows.map((row) => toFeatureDefinition(row))),
  );
});

router.get(
  "/stores/:storeId/features",
  async (req, res): Promise<void> => {
    const params = ListStoreFeaturesParams.safeParse(req.params);
    if (!params.success) {
      errorResponse(res, 400, params.error.message);
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      errorResponse(res, 401, "A signed-in session is required.");
      return;
    }
    const access = await requireStoreAccess(
      clerkUserId,
      params.data.storeId,
      res,
    );
    if (!access) return;

    const rows = await db
      .select({ definition: featureRegistryTable, setting: storeFeaturesTable })
      .from(storeFeaturesTable)
      .innerJoin(
        featureRegistryTable,
        eq(storeFeaturesTable.featureId, featureRegistryTable.id),
      )
      .where(eq(storeFeaturesTable.storeId, params.data.storeId))
      .orderBy(
        asc(featureRegistryTable.category),
        asc(featureRegistryTable.name),
      );
    const data: StoreFeatureView[] = rows.map(({ definition, setting }) => ({
      feature: toFeatureDefinition(definition),
      configuration: toStoreFeature(setting),
    }));
    res.json(ListStoreFeaturesResponse.parse(data));
  },
);

router.put(
  "/stores/:storeId/features/:featureId",
  async (req, res): Promise<void> => {
    const params = UpdateStoreFeatureParams.safeParse(req.params);
    const body = UpdateStoreFeatureBody.safeParse(req.body);
    if (!params.success) {
      errorResponse(res, 400, params.error.message);
      return;
    }
    if (!body.success) {
      errorResponse(res, 400, body.error.message);
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      errorResponse(res, 401, "A signed-in session is required.");
      return;
    }
    const access = await requireStoreAccess(
      clerkUserId,
      params.data.storeId,
      res,
      true,
    );
    if (!access) return;
    if (JSON.stringify(body.data.settings).length > 16000) {
      errorResponse(res, 400, "Feature settings exceed the supported size.");
      return;
    }

    const [definition] = await db
      .select()
      .from(featureRegistryTable)
      .where(eq(featureRegistryTable.id, params.data.featureId))
      .limit(1);
    if (!definition) {
      errorResponse(res, 404, "Feature not found.");
      return;
    }
    if (body.data.enabled && !definition.canActivate) {
      errorResponse(res, 409, "This feature is not available for activation yet.");
      return;
    }
    if (body.data.enabled && definition.dependencies.length > 0) {
      const enabledDependencies = await db
        .select({ featureId: storeFeaturesTable.featureId })
        .from(storeFeaturesTable)
        .where(
          and(
            eq(storeFeaturesTable.storeId, params.data.storeId),
            eq(storeFeaturesTable.enabled, true),
            inArray(storeFeaturesTable.featureId, definition.dependencies),
          ),
        );
      const enabledIds = new Set(
        enabledDependencies.map((dependency) => dependency.featureId),
      );
      const missingDependency = definition.dependencies.find(
        (dependency) => !enabledIds.has(dependency),
      );
      if (missingDependency) {
        errorResponse(
          res,
          409,
          `Enable required feature ${missingDependency} first.`,
        );
        return;
      }
    }

    const [saved] = await db
      .insert(storeFeaturesTable)
      .values({
        storeId: params.data.storeId,
        featureId: params.data.featureId,
        enabled: body.data.enabled,
        settings: body.data.settings,
      })
      .onConflictDoUpdate({
        target: [storeFeaturesTable.storeId, storeFeaturesTable.featureId],
        set: {
          enabled: body.data.enabled,
          settings: body.data.settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    await writeAuditLog({
      organizationId: access.organizationId,
      storeId: params.data.storeId,
      userId: access.userId,
      action: body.data.enabled ? "feature.enabled" : "feature.disabled",
      targetType: "feature",
      targetId: params.data.featureId,
      summary: `${body.data.enabled ? "Enabled" : "Disabled"} ${definition.name}`,
    });
    res.json(UpdateStoreFeatureResponse.parse(toStoreFeature(saved)));
  },
);

router.get(
  "/organizations/:organizationId/activity",
  async (req, res): Promise<void> => {
    const params = ListOrganizationActivityParams.safeParse(req.params);
    if (!params.success) {
      errorResponse(res, 400, params.error.message);
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      errorResponse(res, 401, "A signed-in session is required.");
      return;
    }
    const userId = await requireOrganizationAccess(
      clerkUserId,
      params.data.organizationId,
      res,
    );
    if (!userId) return;
    const rows = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.organizationId, params.data.organizationId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(20);
    res.json(
      ListOrganizationActivityResponse.parse(rows.map(toActivityItem)),
    );
  },
);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    errorResponse(res, 400, params.error.message);
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    errorResponse(res, 401, "A signed-in session is required.");
    return;
  }
  const userId = await requireOrganizationAccess(
    clerkUserId,
    params.data.organizationId,
    res,
  );
  if (!userId) return;

  const [stores, definitions, enabledFeatures, activity] = await Promise.all([
    db
      .select()
      .from(storesTable)
      .where(eq(storesTable.organizationId, params.data.organizationId)),
    db.select().from(featureRegistryTable),
    db
      .select({ total: count() })
      .from(storeFeaturesTable)
      .innerJoin(storesTable, eq(storeFeaturesTable.storeId, storesTable.id))
      .where(
        and(
          eq(storesTable.organizationId, params.data.organizationId),
          eq(storeFeaturesTable.enabled, true),
        ),
      ),
    db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.organizationId, params.data.organizationId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(5),
  ]);
  const connectedStoreCount = stores.filter(
    (store) => store.connectionStatus === "connected",
  ).length;
  const summary = {
    organizationId: params.data.organizationId,
    storeCount: stores.length,
    connectedStoreCount,
    enabledFeatureCount: enabledFeatures[0]?.total ?? 0,
    availableFeatureCount: definitions.filter(
      (definition) => definition.implementationStatus === "available",
    ).length,
    inDevelopmentFeatureCount: definitions.filter(
      (definition) => definition.implementationStatus === "in_development",
    ).length,
    plannedFeatureCount: definitions.filter(
      (definition) => definition.implementationStatus === "planned",
    ).length,
    setupState:
      stores.length === 0
        ? "needs_store"
        : connectedStoreCount > 0
          ? "connected"
          : "setup_required",
    recentActivity: activity.map(toActivityItem),
  } as const;
  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
