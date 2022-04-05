# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to
[Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
