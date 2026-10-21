# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to
[Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-10-20

End-of-life dependency remediation. Client methods, arguments, and return values are
unchanged — most codebases upgrade with no code changes. See
[`MIGRATING-v3.md`](./MIGRATING-v3.md) for a full before/after guide.

### ⚠️ Breaking Changes

- **Node.js 22 is now required** (`engines: ">=22"`). Node 18/20 are end-of-life.
- **Error message format changed.** Replacing Apollo Client 2 with `@apollo/client` 3
  drops the `"Network error: "` prefix on network errors — a failed request now throws
  e.g. `Response not successful: Received status code 401`. Only affects code that matches
  on the error message string.
- **`logger` option type changed** from the `bunyan-category` `Logger` to an exported
  structural `Logger` interface (`{ trace, debug, info, warn, error, fatal }`). Any
  bunyan/pino-style logger still satisfies it, so passing an existing logger keeps working.
  The default logger is now `pino` (JSON output, no `category` field).
- **Apollo type import source moved** from `apollo-client` to `@apollo/client/core`
  (affects `client.graphClient` and other directly-imported Apollo types). Related type-only
  renames: `queryGraphQL` returns `InteropApolloQueryResult` (same shape as
  `ApolloQueryResult`); `QueryResults<T>.errors` elements are `GraphQLFormattedError`.
  Runtime shapes unchanged.
- **CLI YAML parsing uses the YAML 1.2 schema** (`js-yaml` 3 → 4). Unquoted scalars like
  `0777` (now decimal `777`, was octal `511`) and `12:30` (now a string, was `750`) resolve
  differently. Affects `j1` CLI `.yml`/`.yaml` input only. See `MIGRATING-v3.md` §5.

### Changed

- Replaced `apollo-client` + `apollo-cache-inmemory` + `apollo-link*` (EOL) with
  `@apollo/client` 3, and `graphql` 14 → 16.
- Replaced `bunyan-category` with `pino`, removing the deprecated
  `mv → rimraf → glob → inflight` dependency chain.
- Upgraded toolchain: TypeScript 3.8 → 5, Jest 27 → 30, ESLint/`@typescript-eslint`,
  `js-yaml` 3 → 4; migrated the package manager from Yarn to npm; pinned CI to Node 22.
- **Production `npm audit`: 322 → 0 vulnerabilities.**

## [2.1.2] - 2025-04-03

- Remove potentially unwanted logging of request URLs

## [2.1.1] - 2025-02-17

- Adds a retry for status URL check

## [2.1.0] - 2024-07-23

- Update the `queryv1` function to use cursors instead of the legacy `LIMIT SKIP` pagination approach
- Add support for a progress bar

## [2.0.1] - 2024-07-02

- Converted `Content-Type` request header to lower case. This conforms to https://www.rfc-editor.org/rfc/rfc7540#section-8.1.2. And also addresses an issue where Content-Type and content-type headers were both being added.
 Thanks SrdjanCosicPrica for the contribution!

## [2.0.0] - 2024-05-13

- Removed the `ingestEntities` and `ingestCommitRange` methods

## [1.1.0] - 2024-02-15

- Added `abortSyncJob` and `publishEvents` methods

## [1.0.1] - 2023-10-26

- Improved error handling when calling `networkRequest`
  
## [1.0.0] - 2023-10-23

- Removed Cognito `authenticateUser` method

## [0.26.2] - 2022-04-05

### Added

- Both the CLI and the `JupiterOneClient` constructor now accept an optional
  parameter that allows users to specify a base URL to use during execution.

## [0.26.1] - 2022-02-17

### Updated

- Fix detection of inline question rule bodies when creating/updating alert
  rules

## [0.26.0] - 2022-02-07

### Breaking Change

The `integrationDefinitions.list` return data structure changed from:

```
{
  definitions: [{...}, ...],
  pageInfo: { key: value }
}
```

to:

```
{
  data: [{...}, ...],
  errors: [{...}, ...]
}
```

### Updated

- Re-named get-prop.ts to getProp.ts
- Updated integrationDefinitions.list to use standardized query function
  - Added necessary types
  - Updated related tests

## [0.25.2] - 2022-02-07

### Added

- Helper function to easily query GraphQL queries with a cursor
- IntegrationInstances.list unit tests

### Updated

- Resolve TypeError when calling integrationInstances.list without an argument

## [0.25.1] - 2022-02-03

### Added

- IntegrationDefinitions list method

### Updated

- {} types with Record<string, unknown>
- Packages that had vulnerabilities
- Replace jest config in package.json with additional config in jest.config.js

## [0.25.0] - 2021-12-15

### Added

- bulkUpload unit tests

### Updated

- bulkUpload method signature

## [0.24.2] - 2021-12-15

### Added

- Unit test to check for all exposed properties on the J1 Client

## [0.24.1] - 2021-12-08

### Added

- Upgrade
- j1 sdk jest configuration
- j1 sdk prettier configuration
- code coverage package.json command
- test for queryV1

### Updated

- husky to v7
- Abstract fetch calls in queryV1 to helper

### Added

## [0.24.0] - 2021-11-15

- Changed GraphQL mutation for creation and update of Question Rule Instances to
  use new fields.
- Added automatic logic for referenced question rule instances. Rule instances
  with a `question` will use old logic. Instances that omit `question` can use
  `questionName` or `questionId` to reference a question instead.

## [0.23.7] - 2021-11-10

### Added

- Added the following methods to `JupiterOneClient`:

  ```ts
  const client = await new JupiterOneClient(options).init();

  await client.integrationInstances.list();
  await client.integrationInstances.get(id);
  await client.integrationInstances.create(instance);
  await client.integrationInstances.update(id, update);
  await client.integrationInstances.delete(id);
  ```

## 0.23.6

- Replace deleteEntity with deleteEntityV2
- Add typings and resolve typing errors
- Remove entity property in `uploadGraphObjectsForDeleteSyncJob`
