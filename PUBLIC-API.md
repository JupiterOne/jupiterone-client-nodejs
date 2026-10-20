# Public API Contract — `@jupiterone/jupiterone-client-nodejs`

**Frozen at:** v2.1.2 (2026-10-20), commit baseline before TD-9488 dep upgrades.
**Purpose:** Pin the consumer-facing surface so post-upgrade changes can be diffed
against this. **Nothing here may change** through the EOL upgrade (Apollo 2→4, graphql
14→16, node-fetch, etc.). Any divergence = breaking change → requires a major bump +
changelog note.

> Validation: after each phase, re-derive this surface and diff against the frozen baseline:
> ```sh
> npm run build                                   # emits dist/index.d.ts
> diff PUBLIC-API.baseline.d.ts dist/index.d.ts   # must be empty, OR every diff consciously approved
> ```
> `PUBLIC-API.baseline.d.ts` = the generated `.d.ts` snapshot (regenerated under TS 5 in
> Phase 1a — emission-style only: `export type` vs `export declare type`, `<TConfig>` vs
> `<TConfig_1>`, symbolic `Omit<…>` vs TS-3.8's expanded `Pick<…>`. Semantically identical).
> Expected intentional diffs under the upgrade: the import sources on lines 1-3
> (`apollo-client`→`@apollo/client`, `node-fetch` type path). Any OTHER diff = unplanned break.

---

## 1. Package entry points

| Field | Value |
|-------|-------|
| `main` | `dist/index.js` (CommonJS) |
| `types` | `dist/index.d.ts` |
| `bin` | `j1` → `bin/j1` → `require('../dist/j1cli.js')` |
| Module format | **CommonJS** (`tsconfig: module: commonjs`, `target: es2018`) |

Import path for consumers: `import { JupiterOneClient, ... } from '@jupiterone/jupiterone-client-nodejs'`

---

## 2. Programmatic API — exported symbols (from `src/index.ts`)

### Classes
- `class JupiterOneClient` — main client (see §3).
- `class FetchError extends Error` — fields: `httpStatusCode: number`, `responseBody: string`, `response: FetchResponse`, `method: string`, `url: string`.

### Interfaces
- `JupiterOneClientOptions` — constructor arg (see §3.1).
- `JupiterOneEntityMetadata` — `_createdOn, _beginOn, _version, _accountId, _deleted, _source, _id, _key, _class: string[], _type: string | string[]`, …
- `JupiterOneEntity` — `{ entity: JupiterOneEntityMetadata; properties: any }`.
- `QueryResult` — `{ id: string; entity: object; properties: object }`.

### Enums
- `SyncJobStatus` — `AWAITING_UPLOADS | FINALIZE_PENDING | FINALIZING_ENTITIES | FINALIZING_RELATIONSHIPS | ABORTED | FINISHED | UNKNOWN | ERROR_BAD_DATA | ERROR_UNEXPECTED_FAILURE`.
- `SyncJobSources` — `API = 'api' | INTEGRATION_MANAGED = 'integration-managed'`.
- `SyncJobModes` — `DIFF = 'DIFF' | CREATE_OR_UPDATE = 'CREATE_OR_UPDATE'`.

### Types
- `SyncJob` — large metric-counter object (entity/relationship/rawData create/update/delete counts). See `src/index.ts:196`.
- `SyncJobOptions` — `{ source?: SyncJobSources; scope?: string; syncMode?: string; integrationInstanceId?: string }`.
- `SyncJobResponse` — `{ job: SyncJob }`.
- `PublishEventsResponse` — `{ events: Array<{ id; name; description; createDate: number }> }`.
- `ObjectDeletion` — `{ _id: string }`.
- `GraphObjectDeletionPayload` — `{ deleteEntities: ObjectDeletion[]; deleteRelationships: ObjectDeletion[] }`.
- `SyncJobResult` — `{ syncJobId: string; finalizeResult: SyncJobResponse }`.

### Re-exported from `src/types.ts`
`EntityPropertyValuePrimitive`, `EntityPropertyValue`, `EntityAdditionalProperties`,
`Entity`, `RelationshipPropertyValuePrimitive`, `RelationshipPropertyValue`,
`RelationshipAdditionalProperties`, `Relationship`, `GraphObject`, `EntitySource`,
`EntityForSync`, `RelationshipForSync`, `IntegrationPollingInterval`,
`IntegrationPollingIntervalCronExpression`, `IntegrationInstanceConfig`,
`IntegrationDefinition`, `ListIntegrationDefinitions`, `IntegrationInstance<TConfig>`,
`ListIntegrationInstancesOptions`, `PageInfo`, `ListIntegrationInstances`.

---

## 3. `JupiterOneClient` class

### 3.1 Constructor
```ts
new JupiterOneClient(options: JupiterOneClientOptions)

interface JupiterOneClientOptions {
  account: string;
  accessToken?: string;
  dev?: boolean;              // true → https://api.dev.jupiterone.io
  useRulesEndpoint?: boolean; // true → /rules/graphql instead of /graphql
  apiBaseUrl?: string;        // overrides dev/prod base URL
  logger?: Logger;            // bunyan-category Logger
}
```
Public fields: `graphClient: ApolloClient<any>`, `headers?`, `account`, `accessToken`,
`useRulesEndpoint`, `apiUrl`, `queryEndpoint`, `rulesEndpoint`, `logger`.

⚠️ **`graphClient: ApolloClient<any>` is a public field.** Apollo 2→4 changes the
`ApolloClient` type. If any consumer touches `client.graphClient` directly, that is a
breaking type change — flag it. (Recommend: keep the field name/shape, accept the type swap.)

### 3.2 Lifecycle
- `init(): Promise<JupiterOneClient>` — builds headers + Apollo link (RetryLink + BatchHttpLink) + InMemoryCache. **Must be awaited before any method.** Usage: `await new JupiterOneClient({...}).init()`.

### 3.3 Query methods
- `queryV1(j1ql: string, options?: QueryOptions | Record<string, unknown>, showProgress?: boolean, stopAfter?: number, ...): Promise<...>` — primary J1QL query (handles deferred S3 responses). `stopAfter` **@deprecated**.
- `queryGraphQL(query: any): Promise<any>` — raw GraphQL passthrough.

### 3.4 Entity / relationship mutations
- `createEntity(key: string, type: string, classLabels: string[], properties: any): Promise<object>` → `data.createEntity`.
- `updateEntity(entityId: string, properties: any): Promise<object>`.
- `deleteEntity(entityId: string, hardDelete?: boolean): Promise<object>`.
- `createRelationship(relationshipKey, relationshipType, relationshipClass, fromEntityId, toEntityId, properties): Promise<object>` → `data.createRelationship`.
- `upsertEntityRawData(entityId: string, name: string, contentType: string, data: any): Promise<string>` → `data.upsertEntityRawData.status`.

### 3.5 Alert rule / question mutations
- `mutateAlertRule(rule: any, update: any): Promise<any>`.
- `createQuestion(question: any): Promise<any>`.
- `updateQuestion(question: any): Promise<any>`.
- `deleteQuestion(questionId: string): Promise<any>`.

### 3.6 Integration namespaces (object properties, not methods)
- `integrationDefinitions.list(): Promise<QueryResults<IntegrationDefinition>>`.
- `integrationInstances.list(options?): Promise<QueryResults<IntegrationInstance>>`.
- `integrationInstances.get<TConfig>(id: string)`.
- `integrationInstances.create<TConfig>(instance: Omit<IntegrationInstance<TConfig>, 'id' | 'accountId'>)`.
- `integrationInstances.update<TConfig>(id, instance: Partial<Omit<..., 'id'|'accountId'|'integrationDefinitionId'>>)`.
- `integrationInstances.delete(id: string)` → `{ success?: boolean }`.

### 3.7 Sync-job methods (REST via `makeFetchRequest`, not Apollo)
- `startSyncJob(options: SyncJobOptions): Promise<SyncJobResponse>`.
- `uploadGraphObjectsForSyncJob(options: { syncJobId: string; entities?: EntityForSync[]; relationships?: RelationshipForSync[] }): Promise<SyncJobResponse>`.
- `uploadGraphObjectsForDeleteSyncJob(options: { syncJobId: string; entities?: Entity[]; relationships?: Relationship[] }): Promise<SyncJobResponse>`.
- `finalizeSyncJob(options: { syncJobId: string }): Promise<SyncJobResponse>`.
- `abortSyncJob(options: { syncJobId: string; reason: string }): Promise<SyncJobResponse>`.
- `publishEvents(options: { syncJobId: string; events: Array<{ name: string; description: string }> }): Promise<PublishEventsResponse>`.
- `fetchSyncJobStatus(options: { syncJobId: string }): Promise<SyncJobResponse>`.
- `bulkUpload(data: { syncJobOptions: SyncJobOptions; entities?: EntityForSync[]; relationships?: RelationshipForSync[] }): Promise<SyncJobResult | undefined>`.
- `bulkDelete(data: { entities?: Entity[]; relationships?: Relationship[] }): Promise<SyncJobResult | undefined>`.

---

## 4. HTTP wire contract (must not change)

Apollo swap + node-fetch change could alter request shape. Lock these:

### GraphQL (Apollo `BatchHttpLink`)
- `POST {apiUrl}/graphql` (or `/rules/graphql` when `useRulesEndpoint`).
- **Batched**: request body is a JSON **array** of operations; response is a JSON **array** of results.
- Headers: `Authorization: Bearer <token>`, `JupiterOne-Account: <account>`, `content-type: application/json`.
- RetryLink: initial 2000ms, max 5000ms, jitter.

### REST (sync/persister, via `makeFetchRequest` / node-fetch)
- `POST {apiUrl}/persister/synchronization/jobs` — start.
- `POST .../jobs/{syncJobId}/upload` — upload objects.
- `POST .../jobs/{syncJobId}/finalize` — finalize.
- `POST .../jobs/{syncJobId}/abort` — abort.
- `POST .../jobs/{syncJobId}/events` — publish events.
- `GET  .../jobs/{syncJobId}` — status.

### Base URLs
- prod: `https://api.us.jupiterone.io` · dev: `https://api.dev.jupiterone.io` · override: `apiBaseUrl`.

---

## 5. CLI contract — `j1` (`src/j1cli.ts`)

Supported operations (`-o/--operation`): `create`, `update`, `upsert` (entities only),
`delete`, `bulk-delete`, `provision-alert-rule-pack`.

Flags (commander):
| Flag | Meaning |
|------|---------|
| `-a, --account <name>` | account name |
| `-u, --user <email>` | user email |
| `-k, --key <apiToken>` | API token (or env `J1_API_TOKEN`) |
| `-q, --query <j1ql>` | execute a query |
| `-o, --operation <action>` | one of the supported operations |
| `-e, --entity` | entity operations |
| `-r, --relationship` | relationship operations |
| `-l, --alert` | alert rule operations |
| `-w, --question` | question operations |
| `-f, --input-file <dir>` | input JSON / alert-rule-pack filename |
| `--hard-delete` | force hard delete |
| `--delete-duplicates` | delete duplicate entities w/ identical keys |
| `--output-file <file>` | write query result (default `results.json`) |
| `--api-base-url <url>` | override base URL |

---

## 6. Known-sensitive-to-upgrade items (watch during diff)
1. `graphClient: ApolloClient<any>` public field type — Apollo 2→4 type change.
2. GraphQL batched array request/response shape — BatchHttpLink behavior.
3. Return shapes `res.data.<field>` unwrapping — Apollo 4 may change `errors`/`data` nullability.
4. `queryV1` deferred-S3 flow — node-fetch version swap affects the S3 GET.
5. `Logger` type in `JupiterOneClientOptions` — tied to `bunyan-category` (inflight chain).

### 6a. Pinned current behaviors (verified by `src/index.nock.test.ts`, 2.1.2)
These are **current observable behaviors** — including quirks/bugs. The contract is to
NOT change them silently in the upgrade. If the Apollo 4 swap alters any, call it out.
- **`deleteEntity` resolves to `undefined` on success.** Method reads `res.data.deleteEntity`
  but the mutation's root field is `deleteEntityV2`, so the read is always `undefined`.
  Pre-existing bug; pinned so the migration doesn't accidentally "fix" (change) it.
- **GraphQL error paths reject with the underlying `ApolloError`, not the client's
  `throw new Error('JupiterOne returned error(s)...')` wrapper.** Apollo default
  `errorPolicy: 'none'` rejects before the `if (res.errors)` guard runs → those wrapper
  branches are dead code. **Exception:** `upsertEntityRawData` catches + re-wraps as
  `Unable to store raw template data for ...`. Apollo 4 error semantics may shift this.
- **`integrationInstances.update` / `.delete` pass the `query` keyword into `mutate()`.**
  apollo-client 2.6 tolerates it; **Apollo 4 is stricter and may reject** — explicit upgrade risk.
- `integrationDefinitions.list` uses `errorPolicy: 'all'` → collects partial errors without throwing.

### 6c. Approved contract changes — Phase 2 (apollo-client 2 → @apollo/client 3)
**Baseline `.d.ts` updated.** `graphql 14 → 16`; the 5 `apollo-*` packages replaced by
`@apollo/client ^3.14`. Consumer-visible changes:
- **Type import source:** `ApolloClient` / `QueryOptions` now from `@apollo/client/core`
  (was `apollo-client`). `graphClient: ApolloClient<any>` field type updated accordingly.
- **`queryGraphQL` return type:** `ApolloQueryResult<any>` → `InteropApolloQueryResult<any>`
  (@apollo/client 3 naming). Same runtime shape (`{ data, errors, loading, networkStatus }`).
- **Error message string:** @apollo/client 3 dropped the `"Network error: "` prefix on
  network-error messages — a thrown error is now e.g. `Response not successful: Received
  status code 401` (was `Network error: Response not successful...`). Consumers matching on
  that prefix must adjust. (PollyJS retry test updated to match.)
- **`QueryResults<T>.errors`** element type changed `GraphQLError` → `GraphQLFormattedError`
  (graphql 16 split the full error object from its serialized form; apollo returns the
  formatted one). Affects `integrationDefinitions.list` / `integrationInstances.list` return
  types. Runtime values unchanged — same `{ message, locations, path }` shape.
- Production `npm audit` is now **0** (apollo removal cleared the lodash/minimatch chain).

### 6b. Approved contract change — Phase 1b (bunyan → pino)
**Baseline `.d.ts` updated** to reflect this. `bunyan-category` replaced with `pino` to
remove the `mv → rimraf → glob → inflight` chain from the consumer tree (TD-9488).
- **Before:** `logger?: Logger` where `Logger` = default import from `bunyan-category` (not exported).
- **After:** `Logger` is a **structural interface exported from the package**
  (`{ trace, debug, info, warn, error, fatal }`, each `(objOrMsg, msg?) => void`), plus
  exported `LogFn`. Any bunyan/pino-style logger still satisfies it.
- **Break risk:** only a consumer who imported bunyan's `Logger` type and used
  bunyan methods beyond those six. Runtime log output drops the bunyan `category` field.
