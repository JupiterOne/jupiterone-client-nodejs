# TL;DR

If you want to form a relationship using a `_key`, you must include the
`_source` and `_scope` of the entity that already exists in the graph.

Assuming that the entity you are uploading is the `to` and the entity that you
are forming a relationship with already exists in the graph and therefore is the
`from`:

This will _NOT_ work:

```
{
    _fromEntityKey: entityFrom.entity._key,
    _toEntityKey: entityTo.entity._key,
}
```

This will work:

```
{
    _fromEntitySource: entityFrom.entity._source,
    _fromEntityScope: entityFrom.entity._integrationInstanceId,
    _fromEntityKey: entityFrom.entity._key,
    _toEntityKey: entityTo.entity._key,
}
```

# Creating Relationships Between Entities You Own And Entities You Do Not

Our goal here is to create relationships from one entity to another that you
might not own.

While this appears trivial, without knowing the details around how to form
relationships, you might wonder why your data doesn't appear in the graph.

This is due to the concept of ownership with the JupiterOne software. When we
look at the graph in JupiterOne, it magically appears before us. We don’t have
to worry about where the graph starts or where it might end. We type in a query
and view the results. What’s not obvious from viewing the graph is that the
graph we see is the aggregation of many subgraphs. There are subgraphs for the
AWS integration and the system mapper and API ingested data amongst everything
else. All of these different subgraphs come together to give us our cohesive set
of results. These "Sub-graphs" are what denote “ownership”. When we say that
Sub-graph 1 “owns” entity A, we mean that entity A is in Sub-graph 1. Ownership
is important because it is how the software understands the state of the world.

When interacting with entities that owned by various sources, we must be
specific in our interactions so the end graph looks how we expect it to.

At the end of this experiment, we should be able to run this query:

```
FIND CodeModule
WITH displayName = ('hizurur' OR 'carnud' OR 'vici' OR 'iti' OR 'jifguilo' OR 'kiwoj' OR 'juvhove')
AND from = 'testing'
THAT USES << CodeRepo
```

and see our entities in the graph with the expected relationships formed.

This experiment outlines a common use-case:

You want to add new data to the JupiterOne graph and you want to form
relationships with that data.

What makes this use-case stand out is that you do not have an ID for your entity
yet.

This means to form a relationship with one sync job you've got to utilize the
`_key` property of your entity! The catch is that you must be specific in how
you do so.

Let's dig in.

## Acquiring Data in the Graph to Form Our Relationships

Assuming you already have your data prepared and ready to send to J1, the next
thing to do is to gather the entities that already exist in the JupiterOne graph
so that you can form relationships with them.

Writing our query is straightforward enough:

```
FIND github_repo
    WITH displayName = ('graph-veracode' OR 'graph-knowbe4' OR 'graph-azure' OR 'graph-wazuh' OR 'graph-enrichment-examples' OR 'graph-whois' OR 'graph-zeit')
```

Sweet! We have `CodeRepos` that we're going to form relationships with.

Here's an example query response payload:

```
{
    "_class": [
        "CodeRepo"
    ],
    "_type": [
        "github_repo"
    ],
    "_key": "MDEwOlJlcG9zaXRvcnkxNjkzMzI3NTQ=",
    "displayName": "graph-veracode",
    "_integrationType": "github",
    "_integrationClass": [
        "ITS",
        "SCM",
        "VCS",
        "VersionControl"
    ],
    "_integrationDefinitionId": "1babe084-d58d-4ff0-9d98-e0d9bb8499be",
    "_integrationName": "JupiterOne",
    "_beginOn": "2022-01-19T20:26:17.842Z",
    "_id": "2218b983-139b-4447-9889-f04f48761b15",
    "_integrationInstanceId": "40d8cd20-054e-4b77-82bd-f01af7593170",
    "_rawDataHashes": "eyJkZWZhdWx0IjoiMUlKVFNaT00vM2FwQmtWTWt0alYxcml6ZjZsRGFNa1VTRHBvakxIR2sxVT0ifQ==",
    "_version": 18,
    "_accountId": "j1dev",
    "_deleted": false,
    "_source": "integration-managed",
    "_createdOn": "2020-03-23T19:10:09.298Z"
}
```

## Forming The Relationship

Looking at the options for creating a relationship, we have a two primary
choices:

```
{
    _fromEntityKey: string;
    _toEntityKey: string;
    _fromEntityId: string;
    _toEntityId: string;
}
```

We can form the relationship in the following ways:

- `CodeRepo` `_key` -> `CodeModule` `_key`
- `CodeRepo` `_id` -> `CodeModule` `_key`

Remember the comment from earlier: we do not have the `CodeModule` `_id` yet!
This is important because these two options are _NOT_ equal in how they behave.
Forming a relationship using the `_id` of the `CodeRepo` and the `_key` of the
CodeModule will work because the `_id` is unique amongst all of the data in your
account. The `_key` value is _NOT_ globally unique (i.e. two entities can have
the same `_key`).

When you form a relationship with two `_key` values and you do not specify the
`source` and the `scope` of the data that already exists in the graph, the
JupiterOne software does not understand what entity you're talking about and
ultimately doesn't create the relationship. Since two entities could have the
same `_key`, the software needs more information in order to identify the entity
you're referencing.

### How do you get more information?

Use the `source` and `scope` of your JupiterOne data alongside the `_key`!

```
{
    _fromEntitySource: string;
    _toEntitySource: string;
    _fromEntityScope: string;
    _toEntityScope: string;
}
```

This:

- `CodeRepo` `_key` -> `CodeModule` `_key`
- `CodeRepo` `_id` -> `CodeModule` `_key`

Must actually be:

- `CodeRepo` `_key`, `_source`, `_scope` -> `CodeModule` `_key`
- `CodeRepo` `_id` -> `CodeModule` `_key`

In JSON, it looks like this:

```
{
    _fromEntitySource: entityFrom.entity._source,
    _fromEntityScope: entityFrom.entity._integrationInstanceId,
    _fromEntityKey: entityFrom.entity._key,
    _toEntityKey: entityTo.entity._key,
}
```

## Using This Example

This example is set up so that you can run quick experiments to observe the
behavior of different scenarios.

To run:

```
Ensure your environment variables are set:

J1_API_TOKEN=
J1_ACCOUNT=
J1_DEV_ENABLED=false

Syntax: ts-node src/index.ts <relationship_connection>

relationship_connection values:
    - ID_TO_KEY // WILL WORK
    - KEY_TO_KEY // WILL NOT WORK
    - KEY_WITH_SCOPE_AND_SOURCE_TO_KEY // WILL WORK


$ ts-node src/index.ts ID_TO_KEY

or compile to JavaScript and run with JavaScript:

$ npm run build
$ node dist/index.js
```
