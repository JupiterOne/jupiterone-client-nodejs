# Dependency Audit & EOL Remediation Plan

**Package:** `@jupiterone/jupiterone-client-nodejs` v2.1.2
**Date:** 2026-10-20
**Jira:** [TD-9488](https://jupiterone.atlassian.net/browse/TD-9488)
**Audit tool:** `yarn audit` (586 deps)

---

## 0. TD-9488 Scope

The ticket names two EOL items explicitly:

1. **`graphql@14.7.0`** — EOL. → Phase 2 (Apollo + GraphQL).
2. **`bunyan → mv → rimraf@2.4.5 → glob@6.0.4 → inflight@1.0.6` chain** — `inflight`
   is deprecated (memory leak, unmaintained). → Phase 1b below.

**Core:** these two items + the transitive critical/high resolutions (Phase 0).
**Follow-up:** full tooling/CLI fleet upgrade (Phases 1a, 3) — ship as a later release so
the core isn't blocked by broad churn.

### Phase 1b — Kill the `inflight` chain
Source: `bunyan-category@0.4.0` → `bunyan@1.8.15`. The `inflight` leak enters via
bunyan's **`optionalDependencies`** (`mv`, `moment`, `dtrace-provider`,
`safe-json-stringify`) — rotating-file logging we don't use. Options, cheapest first:

- **A (fast):** drop bunyan's optional deps — install `--ignore-optional` in CI, or add
  `resolutions` to force `mv`/`rimraf`/`glob` out of the tree. Keeps the logger API. Verify
  `src/index.ts:11` (`import Logger, { createLogger } from 'bunyan-category'`) still works.
- **B (clean):** replace `bunyan-category` logger with a maintained logger (e.g. `pino`).
  Kills the whole EOL bunyan tree; requires rewriting logger usage in `src/index.ts`.

Recommend **A** for the core release; file **B** as follow-up.

---

## 1. Vulnerability Summary

| Severity | Count |
|----------|-------|
| Critical | 13 |
| High | 186 |
| Moderate | 99 |
| Low | 24 |
| **Total** | **322** |

33 distinct advisories. Nearly all are **transitive** and clear with a lockfile
refresh + `resolutions`. Notable critical/high:

- `form-data` `>=3.0.0 <3.0.5` — unsafe random (critical)
- `@babel/traverse` `<7.23.2` — arbitrary code execution (critical)
- `cross-spawn`, `minimatch`, `ws`, `braces`, `semver`, `brace-expansion`,
  `lodash`, `js-yaml`, `tmp`, `flatted`, `picomatch` (high)

Root cause of the long tail: ancient direct deps pulling stale transitive trees.

---

## 2. EOL — Runtime

| Item | Current | Status | Target |
|------|---------|--------|--------|
| CI Node (`.github/workflows`) | 18.x | **EOL 2025-04-30** | **Node 22 LTS** |
| Local Node | 20.20.2 | EOL 2026-04 | Node 22 LTS |
| `.nvmrc` / `engines` | absent | unpinned drift | add both |

---

## 3. EOL — Direct Dependencies

| Package(s) | Current | Latest | Status | Notes |
|------------|---------|--------|--------|-------|
| `apollo-client` + `apollo-cache-inmemory` + `apollo-link` + `apollo-link-retry` + `apollo-link-batch-http` | 2.x | `@apollo/client` 4.3.5 | **EOL / unmaintained** | consolidate 5 → 1 pkg; needs graphql ≥16 |
| `graphql` | 14.6 | 17.0.2 | EOL | target **16** (Apollo 4 floor) |
| `typescript` | 3.8 (2020) | 5.9 | EOL | target **5.x** (7.0 = native preview, skip) |
| `eslint` | 8.8 | 10.13 | EOL 2024-10 | flat-config migration; target 9 |
| `@typescript-eslint/*` | 5.x | 8.72 | old | pairs with eslint 9 |
| `jest` / `ts-jest` / `@types/jest` | 27 | 30 / 29 | old | — |
| `@types/node` | 13 | 22 | EOL | match runtime |
| `js-yaml` | 3 | 4.x | **EOL (vuln)** | `safeLoad`→`load` rename |
| `husky` | 7 | 9.1 | old | config change |
| `dotenv` | 7 | 16 | ancient | — |
| `prettier` | 2 | 3.9 | old | reformats tree |
| `lint-staged` | 12 | 17 | old | config shape (partly broken already) |
| `commander` | 5 | 12 (CJS) | old | 12 still CJS-safe |
| `inquirer` | 8 | 14 | old | **ESM-only 9+** → stay at 8 |
| `node-fetch` | 2.6 | 3.3 | maintenance | **ESM-only 3+** → stay at 2 |
| `chalk` | 4 | 6 | old | **ESM-only 5+** → stay at 4 |

### ⚠️ ESM constraint
Build output is **CommonJS** (`tsconfig: module: commonjs`). `chalk 5+`,
`node-fetch 3+`, `inquirer 9+` are ESM-only. **Decision: Path A — stay CommonJS.**
Keep those on their last CJS major and patch to latest-in-major. No ESM conversion.

---

## 3b. Test Coverage Baseline (before any upgrade)

`jest --coverage` — 34 tests, 2 suites pass (after `yarn install` fixed a stale
`node_modules` missing `cli-progress`).

| File | % Stmts | % Branch | Risk |
|------|---------|----------|------|
| **`src/index.ts`** | **41.6** | 41.5 | ⚠️ Apollo client here; most graphClient methods untested |
| `networkRequest.ts` | 73.3 | 62.5 | moderate |
| `queries.ts` | 100 | 100 | safe |
| `util/query`, `util/getProp` | 100 | 83–100 | safe |
| **All files** | **51.5** | 47.5 | — |

- Apollo init (`index.ts:332-343`) **is** exercised — client-construction swap has a net.
- **~15 graphClient methods are untested** and migrate blind under Apollo 2→4:
  `queryGraphQL`, `mutateAlertRule`, `createEntity`, `updateEntity`, `deleteEntity`,
  `createRelationship`, `upsertEntityRawData`, `createQuestion`, `updateQuestion`,
  `deleteQuestion`, `getIntegrationDefinitions`, `getIntegrationInstances`,
  `getIntegrationInstance`, `createIntegrationInstance`, `updateIntegrationInstance`,
  `deleteIntegrationInstance`.

### Test tooling decision
- `@pollyjs/*` is unmaintained. **Keep existing PollyJS tests as-is** (don't rewrite).
- **New coverage uses `nock`** (maintained, CJS-native — no friction with jest 27 /
  ts-jest CJS build; intercepts node-fetch 2's HTTP calls). Works now, no upgrade needed.
  **`nock` is pinned to `^11` on this branch as an interim** — nock 14's type declarations
  don't parse under TypeScript 3.8. It is bumped to `^14` in Phase 1a once TS 5.x lands.
- `msw` / `undici MockAgent` deferred — ESM-first / native-fetch-only, revisit post-upgrade.

---

## 4. Revised Execution Order

1. **Coverage net (nock)** — ✅ **DONE.** `src/index.nock.test.ts`, 38 tests, all 15 graphClient methods (success + error). `index.ts` coverage 41.6% → **64.6%** stmts, funcs 34% → 68%. 72 tests total (34 PollyJS + 38 nock) green. 3 Apollo-4-sensitive behaviors pinned in `PUBLIC-API.md` §6a.
2. **Migrate yarn → npm** (Section 4a) — ✅ **DONE.** `yarn.lock` removed, `package-lock.json` generated. Scripts/CI/husky/lint-staged swapped. Added `.npmrc` `legacy-peer-deps=true` (bunyan-category's exact `@types/bunyan@1.8.6` peer — removed once Phase 1b lands). CI bumped to Node 22 + setup-node@v4. `npm test` → 72 pass; `npm run build` emits d.ts. npm audit: 322 → **35** (dedup from fresh install).
3. **Phase 0** — ✅ **DONE.** `.nvmrc` (22), `engines: >=22`, `js-yaml 3.13.1 → 4.3.2`
   (`safeLoad`→`load` at `j1cli.ts:207`; removes the js-yaml high). Contract unchanged,
   72 tests green, build clean (TS 3.8 intact). **Transitive-vuln `overrides` deferred to
   Phase 1a** — `npm audit fix` overreached into the dev tree and pulled a modern
   `@types/babel__traverse` that TS 3.8 can't parse (TS1005). Clean fix requires the TS
   upgrade first. Residual **prod** vulns (0 critical, 4 high) map to later phases:
   `lodash`→Phase 2 (apollo), `moment`→Phase 1b (bunyan optionals), `tmp`/`inquirer`/
   `external-editor`→Phase 1a (inquirer), `brace-expansion`/`minimatch`→Phase 1a overrides.
4. **Phase 1b** — ✅ **DONE.** Replaced `bunyan-category` with `pino ^8.21.0` (pino 8 types
   parse under TS 3.8). `inflight` + `mv`/`rimraf@2`/`glob@6` **gone from prod tree**. `Logger`
   now an exported structural interface (`JupiterOneClientOptions.logger` backward-compatible) —
   approved contract change, baseline updated (see `PUBLIC-API.md` §6b). Removed `.npmrc`
   `legacy-peer-deps` (no longer needed — bunyan-category's `@types/bunyan` peer was the cause).
   Prod vulns 7 → **4**. 72 tests green, build clean.
5. **Phase 2** — Apollo + graphql (TD-9488 core). Verified by step 1's nock tests.
6. **Phase 1a** — ✅ **DONE** (promoted ahead of Phase 2 — Apollo 3 types need modern TS).
   `typescript 3.8 → 5.9` (the `^5.5` range resolves to 5.9.x), `@types/node 13 → 22`,
   `jest/@types/jest 27 → 30` + `ts-jest 27 → 29` (ts-jest's peer range covers jest 30),
   `@typescript-eslint 5 → 8`, `eslint 8.8 → 8.57` (stayed 8.x — no flat-config churn),
   `eslint-plugin-jest 23 → 28`, `eslint-config-prettier 6 → 9` (dropped removed
   `prettier/@typescript-eslint`). v8 rules `no-explicit-any` / `no-require-imports` /
   `no-unused-vars` pinned to `warn`, with `--max-warnings` on the lint script so the
   current count is a ratchet (new violations fail). Also bumps `pino 8 → 10` and
   `nock 11 → 14` now that TS 5.9 parses their types. 75 tests green,
   lint 0 errors, baseline regenerated under TS 5 (emission-style only). Total audit 44 → 35.
7. **Phase 2** — ✅ **DONE.** Replaced 5 `apollo-*` packages with `@apollo/client ^3.14`,
   `graphql 14.6 → 16.9`, `graphql-tag → 2.12.6`. Imports use `@apollo/client/core` +
   `/link/retry` + `/link/batch-http` (classic node resolution, CJS-safe). Only `index.ts`
   imports + the link setup + the `util/query` `ApolloQueryResult`/`GraphQLFormattedError`
   types changed. **Production `npm audit` → 0.** 72 tests green (one PollyJS retry assertion
   updated — Apollo 3 dropped the `"Network error: "` prefix). Contract changes approved +
   baselined (`PUBLIC-API.md` §6c). TD-9488 graphql@14.7.0 line closed.
8. **Phase 3** — CLI fleet (chalk/node-fetch/inquirer patch) — follow-up.

### 4a. Yarn → npm migration
- Delete `yarn.lock`; generate `package-lock.json` (`npm install`).
- `package.json`: `resolutions` → **`overrides`** (npm equivalent).
- Scripts: `yarn X` → `npm run X`; `copydist` copies `package-lock.json` not `yarn.lock`;
  `audit:fix` `npx yarn-audit-fix` → `npm audit fix`.
- CI workflows: `yarn install --frozen-lockfile` → `npm ci`; `yarn X` → `npm run X`;
  `setup-node` cache `yarn` → `npm`.
- `.husky/*` + `lint-staged` (`yarn format`) → npm.
- README install snippet.

---

## 4b. Remediation Plan (phased detail)

### Phase 0 — Quick wins (low risk)
- Add `.nvmrc` (`22`) + `"engines": { "node": ">=22" }` to `package.json`.
- CI: `actions/setup-node@v4`, `node-version: 22`.
- `js-yaml` 3 → 4 (fixes high vuln; `safeLoad`→`load`, `safeDump`→`dump`).
- Add `resolutions` for transitive critical/high: `form-data`, `@babel/traverse`,
  `cross-spawn`, `minimatch`, `ws`, `braces`, `semver`, `brace-expansion`, `tmp`.
- Regenerate `yarn.lock`.
- Fix `${NPM_TOKEN}` npmrc breakage blocking audit tooling.

### Phase 1 — Tooling (dev-only, no API surface change)
- `typescript` 3.8 → 5.x; `@types/node` 13 → 22.
- `jest` 27 → 30, `ts-jest` → 29, `@types/jest` → 30.
- `eslint` 8 → 9 (flat config) + `@typescript-eslint` 5 → 8.
- `prettier` 2 → 3; `husky` 7 → 9; `lint-staged` 12 → 17; `dotenv` 7 → 16.

### Phase 2 — Apollo + GraphQL (runtime, core risk)
- Replace 5 `apollo-*` pkgs with `@apollo/client` 4 + `graphql` 16.
- Rewrite only `src/index.ts:1-5` (imports) and `src/index.ts:332-343`
  (ApolloLink / RetryLink / BatchHttpLink / InMemoryCache setup — ~15 isolated lines).
- Preserve batch-http + retry behavior.
- Validate against `src/index.test.ts` + `src/index.new.test.ts` (PollyJS fixtures).

### Phase 3 — CLI deps (Path A — CJS)
- `commander` 5 → 12.
- Patch to latest-in-major: `chalk@4`, `node-fetch@2`, `inquirer@8`.
- No ESM conversion.

### Phase 4 — Verify & release
- `yarn audit` → expect near-zero high/critical.
- `yarn test` (lint + type-check + jest) green.
- `yarn build` + smoke-test `bin/j1`.
- Release **v3.0.0** (Node 22 floor + Apollo swap = breaking).

---

## 5. Risk Notes
- **Phase 2 is the only runtime-behavior risk.** Apollo 2→4 cache/link API changed;
  rely on existing PollyJS wire fixtures to catch regressions.
- **Path B (ESM conversion)** deferred — would drop `node-fetch` for native `fetch`
  (Node 22 global) and take latest chalk/inquirer, but breaks CJS consumers. Separate effort.
- Phases 0–1 shippable independently as a patch release before the v3 breaking bundle.
