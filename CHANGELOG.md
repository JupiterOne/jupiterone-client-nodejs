# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to
[Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
