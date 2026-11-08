# E-Commerce Growth Engine

A platform-independent merchant workspace for managing store records and a truthful registry of commerce growth modules.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/growth-engine` — merchant dashboard and Clerk sign-in pages
- `artifacts/api-server` — authenticated REST API
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema` — Drizzle schema
- `lib/db/migrations` — generated SQL migrations
- `artifacts/api-server/src/lib/feature-catalog.ts` — all 45 feature definitions
- `docs/architecture.md` — architecture, security, roadmap, onboarding, operations
- `docs/feature-tracker.md` — module-by-module completion status

## Architecture decisions

- The Growth Engine owns a separate PostgreSQL database; connected stores remain their source of truth.
- Use a modular monolith with platform adapters, not Shopify-specific core logic or premature microservices.
- Clerk authenticates users; organization membership and roles are enforced by the API.
- A store record remains setup-required until a real connector verifies it.
- Planned module entries are visible but cannot be activated; target platforms are not claims of verified compatibility.

## Product

Phase 1 supports account access, organizations, store records, the complete 45-module registry, per-store settings for available modules, and audit activity. Platform connectors, storefront SDKs, event processing, automation, campaigns, analytics, retention, billing, and AI remain planned.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Keep the API contract in OpenAPI and regenerate with `pnpm --filter @workspace/api-spec run codegen` after every contract change.
- Browser API calls use same-origin Clerk session cookies; do not add bearer-token handling to the web client.
- Run `pnpm --filter @workspace/db run generate` before committing schema migrations; use `push` only for the development database.
- Registry platform compatibility lists are targets until a real adapter confirms each capability.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/architecture.md` and `docs/feature-tracker.md` for product documentation and implementation state
