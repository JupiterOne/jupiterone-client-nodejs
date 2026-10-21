# Migrating to `@jupiterone/jupiterone-client-nodejs` v3

v3 is a maintenance release that removes end-of-life dependencies (Apollo Client 2,
GraphQL 14, the `bunyan`/`inflight` chain) and raises the Node floor. **The client's
methods, arguments, and return values are unchanged** — most codebases upgrade with no code
changes at all. Below is the complete list of breaking changes and exactly what, if
anything, you need to touch.

> TL;DR: If you (a) run Node ≥ 22, (b) don't match on error message strings, and
> (c) don't import Apollo/bunyan types from this package, **you need no code changes.**

---

## 1. Node.js 22 is now required

The package now declares `"engines": { "node": ">=22" }`. Node 18 and 20 are end-of-life.

**What to do:** upgrade your runtime (and CI) to Node 22 LTS or newer.

```jsonc
// package.json — if you pin Node for your project
{
  "engines": { "node": ">=22" }
}
```
```yaml
# .github/workflows/*.yml
- uses: actions/setup-node@v4
  with:
    node-version: 22
```

---

## 2. Error messages: the `"Network error: "` prefix is gone

Upgrading from Apollo Client 2 to `@apollo/client` 3 changed how network errors are
stringified. A failed request previously threw a message like
`Network error: Response not successful: Received status code 401`; it is now
`Response not successful: Received status code 401`.

**This only affects you if you match on the error message text.** The error is still thrown,
still an `Error`, still carries the status code in the text.

```ts
// ❌ Before — brittle prefix match, will no longer match
try {
  await client.queryV1(myQuery);
} catch (err) {
  if (/^Network error:/.test(err.message)) {
    handleNetworkError(err);
  }
}

// ✅ After — match on the stable part of the message, or the status code
try {
  await client.queryV1(myQuery);
} catch (err) {
  if (/Received status code (\d+)/.test(err.message)) {
    handleNetworkError(err);
  }
}
```

If you can, prefer not to parse messages at all — catch and inspect the thrown
`ApolloError` / `FetchError` object instead.

---

## 3. The `logger` option: `bunyan` → structural interface

`bunyan-category` was replaced with `pino` to eliminate the deprecated
`mv → rimraf → glob → inflight` dependency chain. The `logger` option on the constructor
now accepts a **minimal structural `Logger` interface** that this package exports:

```ts
export type LogFn = (objOrMsg: unknown, msg?: string) => void;
export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
}
```

Both `bunyan` and `pino` loggers satisfy this interface, so **passing your existing logger
keeps working** with no change:

```ts
// ✅ Still valid — any bunyan/pino-style logger is accepted
const client = new JupiterOneClient({
  account,
  accessToken,
  logger: myExistingLogger, // bunyan, pino, or anything with info/warn/error/etc.
});
```

You only need to change code if you **imported the `Logger` type from `bunyan-category`
via this package**, or relied on the default logger's output format:

```ts
// ❌ Before — the type came from bunyan-category
import Logger from 'bunyan-category';
function makeClient(logger: Logger) { /* ... */ }

// ✅ After — import the exported structural type from this package
import { Logger } from '@jupiterone/jupiterone-client-nodejs';
function makeClient(logger: Logger) { /* ... */ }
```

> Output note: the default logger no longer emits the bunyan `category` field, and log
> lines are now pino-formatted JSON. If you parse this package's own log output, adjust
> your parser. (If you pass your own `logger`, your format is unaffected.)

---

## 4. Apollo type imports moved to `@apollo/client`

If you import Apollo types **from this package's surface** — most commonly by referencing
`client.graphClient` or the return type of `queryGraphQL` — the underlying type source moved
from `apollo-client` to `@apollo/client`.

```ts
// ❌ Before
import { ApolloClient } from 'apollo-client';
const raw: ApolloClient<any> = client.graphClient;

// ✅ After
import { ApolloClient } from '@apollo/client/core';
const raw: ApolloClient<any> = client.graphClient;
```

Related type-only renames (same runtime shape, no behavior change — only matters if you
annotate these explicitly):

- `queryGraphQL()` now returns `InteropApolloQueryResult<T>` (was `ApolloQueryResult<T>`).
- `QueryResults<T>.errors` elements are now `GraphQLFormattedError` (was `GraphQLError`).
  The runtime objects are unchanged (`{ message, locations, path }`).

Most consumers never touch these types — they call the typed methods
(`createEntity`, `queryV1`, `integrationInstances.list`, etc.), whose signatures are
**unchanged**.

---

## What did NOT change

- Every `JupiterOneClient` method — names, arguments, return values — is identical.
- `queryV1`, entity/relationship/question CRUD, integration-instance methods, and all
  sync-job methods behave the same.
- The CLI (`j1`) flags and operations are unchanged.
- Authentication, endpoints, and request/response payloads are unchanged.

---

## Upgrade checklist

1. Move your runtime and CI to **Node ≥ 22**.
2. `npm install @jupiterone/jupiterone-client-nodejs@^3`
3. Search your code for error-message matches containing `Network error:` → update them.
4. If you import `Logger` from `bunyan-category` or Apollo types from `apollo-client` in
   code that touches this client, repoint them (sections 3 and 4).
5. Build and run your tests. If none of the above applied, you're done.
