import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

await c.connect();

try {
  const checks = [
    ["ORGANIZATIONS", "SELECT id, name, slug, created_by FROM organizations"],
    ["MEMBERSHIPS", "SELECT organization_id, user_id, role FROM organization_memberships"],
    ["PROFILES", "SELECT id, display_name FROM profiles"],
    ["STORES", "SELECT id, organization_id, name, platform, status FROM stores"],
    ["FEATURE KEYS", "SELECT module_key FROM feature_modules ORDER BY module_key"],
    ["STORE FEATURE LINKS", "SELECT store_id, module_key, enabled FROM store_features ORDER BY module_key"]
  ];

  for (const [label, query] of checks) {
    const result = await c.query(query);
    console.log("\n--- " + label + " ---");
    console.table(result.rows);
  }
} finally {
  await c.end();
}
