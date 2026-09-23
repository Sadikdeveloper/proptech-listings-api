# Property Listings API

A small REST API for property listings — rent, sale and shortlet — with attribute
and **radius search**, built with **NestJS + Prisma + PostgreSQL**.

- Full CRUD for listings and their agents
- `GET /listings/search` filters by type, price, bedrooms, agent **and** returns only
  the listings within `X` km of a point, each annotated with `distanceKm`
- Offset pagination with a stable sort, strict input validation and one error envelope
- Swagger UI with typed request/response schemas
- 166 unit + integration tests (the e2e suite runs against a real PostgreSQL instance)

---

## Quick start

### 1. With Docker (recommended)

```bash
cp .env.example .env          # DATABASE_URL already matches docker-compose.yml
npm install
docker compose up -d          # PostgreSQL 16 on localhost:5432
npm run prisma:deploy         # applies prisma/migrations
npm run seed                  # 3 agents + 6 listings around Lagos/Abuja
npm run start:dev
```

### 2. With any PostgreSQL 14–17 server

```bash
cp .env.example .env          # then edit DATABASE_URL
npm install
npm run prisma:deploy
npm run seed
npm run start:dev
```

### 3. Without Docker or a system PostgreSQL

The repository ships an embedded PostgreSQL (npm package, no root required) for
locked-down machines:

```bash
npm install
npm run db:embedded           # boots PostgreSQL on :55432, applies migrations, writes .env
npm run seed                  # in a second terminal
npm run start:dev
```

- Swagger UI → <http://localhost:3000/docs>  (the API root redirects there)
- OpenAPI JSON → <http://localhost:3000/docs/json>
- Health → <http://localhost:3000/health>

### Tests

```bash
npm test           # everything, against a throwaway PostgreSQL instance
npm run test:unit  # pure unit tests, no database
npm run test:e2e   # HTTP tests against a real database
```

`npm test` boots an embedded PostgreSQL on port `55433` (override with
`TEST_DATABASE_PORT`), applies `prisma/migrations` and runs Jest with
`DATABASE_URL` pointed at it. To run against your own server instead:

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/proptech_test npm test
```

The runner truncates tables between tests, so it refuses to start unless the
database name ends in `_test` (bypass with `ALLOW_DESTRUCTIVE_TESTS=true`).

### Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | – | **Required.** `postgresql://user:password@host:5432/db?schema=public`. The app refuses to boot without it. |
| `PORT` | `3000` | HTTP port, bound to `0.0.0.0`. |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. |
| `LOG_LEVEL` | `log` | `error` \| `warn` \| `log` \| `debug` \| `verbose`. `debug` also logs SQL. |
| `DATABASE_CONNECTION_LIMIT` | `10` | Size of the `pg` pool used by the Prisma driver adapter. |
| `CORS_ORIGINS` | `*` | Comma separated allow-list, or `*` to reflect any origin. Restrict this in production. |
| `SWAGGER_ENABLED` | `true` | Swagger is off by default when `NODE_ENV=production` unless explicitly set to `true`. |

Everything sensitive lives in `.env` (git-ignored); `.env.example` documents the
keys, and the connection string is redacted before it is logged.

---

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness plus a database round-trip (`503` when unreachable). |
| `POST` | `/agents` | Create an agent. |
| `GET` | `/agents` | Paginated list, `search` matches name/email case-insensitively. |
| `GET` | `/agents/{id}` | Single agent, includes `listingsCount`. |
| `PATCH` | `/agents/{id}` | Partial update. |
| `DELETE` | `/agents/{id}` | `204`, or `409` when the agent still owns listings. |
| `POST` | `/listings` | Create a listing. |
| `GET` | `/listings` | Filter + paginate (`type`, price range, bedrooms, `agentId`). |
| `GET` | `/listings/search` | Same filters plus `lat`/`lng`/`radiusKm`. |
| `GET` | `/listings/{id}` | Single listing with its agent summary. |
| `PATCH` | `/listings/{id}` | Partial update. |
| `DELETE` | `/listings/{id}` | `204`. |

Sending an unknown query parameter or body property is a `400`; ids are validated
as UUIDs before they reach the database.

### Create a listing

```bash
curl -X POST http://localhost:3000/listings \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "3 bedroom flat in Ikoyi",
    "description": "Renovated flat with a private garden.",
    "price": 4500,
    "type": "rent",
    "bedrooms": 3,
    "location": { "latitude": 6.4521, "longitude": 3.4345 },
    "agentId": "<agent-uuid>",
    "currency": "NGN"
  }'
```

```json
{
  "id": "b0f1f1c6-1f1e-4a1e-9c2a-5b6d7e8f9012",
  "title": "3 bedroom flat in Ikoyi",
  "description": "Renovated flat with a private garden.",
  "price": 4500,
  "currency": "NGN",
  "type": "rent",
  "bedrooms": 3,
  "agentId": "6f1e...",
  "location": { "latitude": 6.4521, "longitude": 3.4345 },
  "agent": { "id": "6f1e...", "name": "Ada Obi", "email": "ada@agency.example", "phone": "+234..." },
  "createdAt": "2026-01-01T10:00:00.000Z",
  "updatedAt": "2026-01-01T10:00:00.000Z"
}
```

`type` accepts `rent` / `sale` / `shortlet` (case-insensitive, stored as an enum).
`location` is nested on purpose: a listing can never be stored with half a
coordinate pair, because both fields are validated together.

### Radius search

```bash
curl 'http://localhost:3000/listings/search?lat=6.4281&lng=3.4219&radiusKm=5&type=rent&maxPrice=5000&limit=10'
```

```json
{
  "data": [
    {
      "id": "…",
      "title": "3 bedroom flat in Ikoyi",
      "price": 4500,
      "type": "rent",
      "bedrooms": 3,
      "location": { "latitude": 6.4521, "longitude": 3.4345 },
      "distanceKm": 3.01,
      "agent": { "…": "…" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
}
```

Search rules:

- `lat` and `lng` must be sent together; `radiusKm` (max 20 km default 5) requires both.
  Anything else is a `400` with a field-level `details` array.
- Results are sorted by distance ascending unless `sortBy` is given explicitly.
  `distanceKm` is rounded to 3 decimals (metre precision).
- The distance check is an inclusive `<= radiusKm`, and pagination/`meta.total`
  are computed in the database over the same filter, so pages never drift.
- Without a centre, `/listings/search` behaves exactly like `GET /listings`.

### Errors

One envelope for every failure, including validation and Prisma errors:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "maxPrice", "messages": ["maxPrice must be greater than or equal to minPrice"] },
    { "field": "location.latitude", "messages": ["location.latitude must be a valid latitude between -90 and 90"] }
  ],
  "path": "/listings",
  "method": "GET",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

`VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`, `SERVICE_UNAVAILABLE`
and `INTERNAL_ERROR` are the machine-readable `code` values. Unexpected errors are
logged with a stack trace and answered with a generic message — internals never
reach the client. Prisma failures are translated (`P2002` duplicate → `409`,
`P2003` foreign key → `409`, `P2025` missing row → `404`, unreachable database → `503`).

---

## Design choices

**One module, one types file.** Each feature module keeps its contracts in a
`*.types.ts` file (`listings.types.ts`, `agents.types.ts`, …), so domain types are
never declared inline. Request shapes live in `dto/`, entity mappers convert rows
to API entities, and controllers/services stay thin.

**Two validation layers.** `class-validator` DTOs cover per-field rules (types,
ranges, enums, nested `location`), while cross-field rules that decorators cannot
express — inverted price ranges, half a coordinate pair, a radius without a centre
— live in `collectSearchQueryErrors` and are applied by `ListingQueryValidationPipe`
on both listing endpoints. Both layers produce the same `details` array, so clients
only parse one error shape. Malformed UUIDs are rejected by `ParseUUIDPipe` before
any query runs.

**Driver adapter instead of a native query engine.** `engineType = "client"` plus
`@prisma/adapter-pg` means the build ships no binary engine: the pool size is
configured in code, the same `pg` driver serves the app and the migration tooling,
and the API can be deployed to environments where native binaries are awkward
(serverless, restricted CI). It also keeps the runtime honest — the connection
string is validated once at boot (`src/modules/config/env.validation.ts`) and the app
refuses to start with a missing or malformed `DATABASE_URL`.

**Geo search in SQL.** Radius search is one raw query built with `Prisma.sql`
(parameterised, no string interpolation of user input) that computes the haversine
distance for every row, filters `distance <= radiusKm` and orders by distance.
A bounding-box pre-filter — including the two-range case for circles that cross the
antimeridian, and no longitude constraint at all near the poles — keeps the
`(latitude, longitude)` index useful. Doing the math in the database (instead of
filtering in Node) is what keeps `meta.total` and pagination correct and bounded.

**Pagination that does not repeat rows.** Offset pagination with a hard cap
(`page` ≤ 10 000, `limit` ≤ 100) and `id ASC` appended to every `ORDER BY`, so rows
with equal prices or timestamps cannot shuffle between pages.

**Money as `Decimal` in the database, number in JSON.** Prices are
`DECIMAL(14,2)` and validated to two decimal places, so no float drift is stored.
The API returns them as JSON numbers for client ergonomics; the README in a
higher-stakes system would return minor units or a string instead.

**Agents own listings.** The foreign key is `onDelete: Restrict`; deleting an agent
that still has listings returns `409` with the count instead of silently orphaning
data. Email uniqueness is checked before the insert (clear `409` message) and the
DB constraint remains as the race-condition backstop.

**Deterministic failure modes.** `ValidationPipe` uses `whitelist` +
`forbidNonWhitelisted`, so typos are reported instead of ignored; the exception
filter handles Express middleware errors (for example a body over the parser
limit) as `413` rather than `500`; and non-HTTP exceptions are rethrown untouched
so background contexts keep their own error handling.

---

## Tests

| Suite | What it covers |
| --- | --- |
| `test/e2e/health.e2e.spec.ts` | Liveness, OpenAPI document, root redirect, unknown route. |
| `test/e2e/agents.e2e.spec.ts` | Agent CRUD, pagination/search/sort, duplicate email `409`, delete-with-listings `409`, `404`s, validation errors. |
| `test/e2e/listings.e2e.spec.ts` | Listing CRUD, nested location validation, filters (type/price/bedrooms/agent), sorting, paging past the end, unknown params, unknown agent `404`. |
| `test/e2e/search.e2e.spec.ts` | Radius inclusion/exclusion, default radius, distance ordering and `distanceKm`, combined filters, radius pagination, parity with `/listings`, boundary handling, invalid geo queries. |
| `test/unit/*.spec.ts` | Haversine + bounding box (property-checked over ~17 500 sampled points, antimeridian and poles included), pagination maths, cross-field query rules, Prisma filter mapping, DTO transforms, the exception filter's status mapping, and the services with a mocked Prisma client. |

Every endpoint in the table above is exercised over HTTP against a real PostgreSQL
database, which is why the suite is worth running as a whole (`npm test`).

### Restricted networks

`prisma generate` downloads engine binaries from `binaries.prisma.sh` on first use.
With `engineType = "client"` the generated client never loads that library, so if
that host is blocked it is enough to point Prisma at any existing file and continue:

```bash
touch /tmp/prisma-engine-placeholder
PRISMA_SCHEMA_ENGINE_BINARY=/tmp/prisma-engine-placeholder \
  PRISMA_QUERY_ENGINE_LIBRARY=/tmp/prisma-engine-placeholder \
  npm run prisma:generate
```

Migrations are the same story: `npm run prisma:deploy` (the standard command) needs
the schema engine binary, and `npm run db:apply` is a dependency-free fallback that
applies the very same `prisma/migrations/**/migration.sql` files through the `pg`
driver and records them in `_prisma_migrations`, so a later `prisma migrate deploy`
sees everything applied. The test runner uses that applier.

---

## What I would improve with more time

1. **PostGIS and real spatial indexing.** `geography(Point, 4326)` with a GiST index
   and `ST_DWithin` beats computing haversine per row: the bounding box stays, but
   the index does the real work. The current haversine query is exact (it is the
   source of truth in the tests), so it is a drop-in replacement.
2. **Cursor pagination** for the search endpoint. Offset pages are fine at this
   size but degrade with deep pages and mutating data; keyset pagination on
   `(distance, id)` is the standard fix.
3. **Auth and ownership.** Right now anyone can create, update or delete any
   listing. Real estate data wants JWT/API-key auth, an agency tenancy scope and
   per-resource authorisation, plus rate limiting on the write endpoints.
4. **Money as minor units.** Store and return integer minor units (or a string) so
   currency handling is exact, and add a `currency`-aware price filter.
5. **Listing lifecycle.** Draft/published states, soft deletes with `deletedAt`,
   an audit trail of price changes, and a background job to expire shortlets.
6. **More search surface.** Full-text search on title/description, amenities,
   availability windows, and multi-polygon areas ("within this suburb") instead of
   only a radius.
7. **Observability and delivery.** Structured JSON logs with correlation ids,
   Prometheus metrics for latency per route, a Dockerfile, and CI that runs
   lint/typecheck/tests against a service container on every push.
8. **Caching and scaling.** Cache hot searches keyed by filter hash with a short
   TTL, and read replicas for the search path once read traffic dominates.
9. **Contract tests for the OpenAPI document.** Snapshot the generated schema so a
   breaking change to a DTO fails CI instead of surprising clients.

## Project layout

Every Nest module lives under `src/modules/<feature>/` with its own controller,
service, module file, types file and `dto/` folder. Code that is not a module —
shared helpers, filters, pipes, types, config plumbing and the Swagger setup —
stays outside so the module tree only contains features.

```
prisma/
  schema.prisma                 # models, enums, indexes
  migrations/                   # committed SQL migrations
  seed.ts                       # dev seed (upserts agents, skips when listings exist)
scripts/                        # test runner, offline migration applier, embedded PostgreSQL
src/
  main.ts                       # bootstrap: helmet, CORS, docs, listen
  app.module.ts                 # module graph + global pipe/filter
  modules/
    agents/
      agents.controller.ts      # POST/GET/PATCH/DELETE /agents
      agents.service.ts
      agents.module.ts
      agents.types.ts           # AgentEntity, sort fields, paginated type
      agents.mapper.ts          # Prisma row -> API entity
      dto/
        create-agent.dto.ts
        update-agent.dto.ts
        agent-query.dto.ts
        agent-response.dto.ts
    listings/
      listings.controller.ts    # CRUD + /listings/search
      listings.service.ts
      listings.module.ts
      listings.types.ts         # ListingEntity, enums, price/bedroom limits
      listings.mapper.ts
      listings.filters.ts       # query DTO -> Prisma where/orderBy
      listings.query.ts         # raw radius SQL (haversine + bounding box)
      dto/
        create-listing.dto.ts
        update-listing.dto.ts
        listings-query.dto.ts
        search-listings-query.dto.ts
        geo-point.dto.ts
        listing-response.dto.ts
    health/                     # liveness endpoint
      health.controller.ts
      health.module.ts
      health.types.ts
    prisma/                     # PrismaService (pg driver adapter) + global module
      prisma.service.ts
      prisma.module.ts
    config/                     # env validation + typed AppConfigService (global module)
      app-config.module.ts
      app-config.service.ts
      config.types.ts
      configuration.ts
      env.validation.ts
  common/                       # not modules: shared building blocks
    geo/                        # haversine + bounding box maths
    types/                      # api.types.ts, geo.types.ts
    dto/                        # pagination DTOs, error/pagination response DTOs
    filters/                    # AllExceptionsFilter
    pipes/                      # ListingQueryValidationPipe (cross-field query rules)
    validation/                 # validation pipe factory, error flattening, query rules
    decorators/                 # Swagger helpers (paginated + error responses)
    utils/                      # pagination helpers, connection-string redaction
  docs/                         # Swagger/OpenAPI setup (no module: bootstrapped in main.ts)
test/
  e2e/                          # HTTP tests per endpoint group
  unit/                         # unit tests (geo, pagination, validation, filters, services)
  support/                      # app factory, fixtures, database helpers
```
