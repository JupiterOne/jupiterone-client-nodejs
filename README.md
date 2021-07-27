# jupiterone-client-nodejs

A node.js client wrapper and CLI utility for JupiterOne public API.

This is currently an experimental project and subject to change.

## Installation

To install the client local to the current project:

```bash
npm install @jupiterone/jupiterone-client-nodejs
```

To install the client globally:

```bash
npm install @jupiterone/jupiterone-client-nodejs -g
```

## Using the J1 CLI

Usage:

```bash
$ j1 --help
Usage: j1 [options]

Options:
  -v, --version             output the version number
  -a, --account <name>      JupiterOne account name.
  -u, --user <email>        JupiterOne user email.
  -k, --key <apiToken>      JupiterOne API access token.
  -q, --query <j1ql>        Execute a query.
  -o, --operation <action>  Supported operations: create, update, upsert, delete, bulk-delete, provision-alert-rule-pack
  --entity                  Specifies entity operations.
  --relationship            Specifies relationship operations.
  --alert                   Specifies alert rule operations.
  -f, --file <dir>          Input JSON file. Or the filename of the alert rule pack.
  -h, --help                output usage information
```

#### Relevant Environment Variables

J1_DEV_ENABLED - Alters the base url. Valid values: 'true' | 'false' (string)

## Examples

### Run a J1QL query

```bash
j1 -a j1dev -q 'Find jupiterone_account'
Validating inputs...
Authenticating with JupiterOne... OK
[
  {
    "id": "06ab12cd-a402-406c-8582-abcdef001122",
    "entity": {
      "_beginOn": 1553777431867,
      "_createdOn": 1553366320704,
      "_deleted": false,
      "displayName": "YCO, Inc.",
      "_type": [
        "jupiterone_account"
      ],
      "_key": "1a2b3c4d-44ce-4a2f-8cd8-99dd88cc77bb",
      "_accountId": "j1dev",
      "_source": "api",
      "_id": "1a2b3c4d-44ce-4a2f-8cd8-99dd88cc77bb",
      "_class": [
        "Account"
      ],
      "_version": 6
    },
    "properties": {
      "emailDomain": "yourcompany.com",
      "phoneNumber": "877-555-4321",
      "webURL": "https://yourcompany.com/",
      "name": "YCO"
    }
  }
]
Done!
```

#### Advanced Node Usage

You are able to pass in Apollo Query Options into the `queryV1` method. This is
beneficial when you need to change how the cache behaves, for example. More
information about what data you can provide found here:
https://www.apollographql.com/docs/react/data/queries/#setting-a-fetch-policy

To do so:

```

  // Pass in options like shown below:

  const options = {
    'fetchPolicy': 'network-only'
  }

  j1.queryV1('FIND jupiterone_account', options)

```

### Create or update entities from a JSON input file

```bash
j1 -o create --entity -a j1dev -f ./local/entities.json
Validating inputs...
Authenticating with JupiterOne... Authenticated!
Created entity 12345678-fe34-44ee-b3b0-abcdef123456.
Created entity 12345678-e75f-40d6-858e-123456abcdef.
Done!

j1 -o update --entity -a j1dev -f ./local/entities.json
Validating inputs...
Authenticating with JupiterOne... Authenticated!
Updated entity 12345678-fe34-44ee-b3b0-abcdef123456.
Updated entity 12345678-e75f-40d6-858e-123456abcdef.
Done!
```

**NOTE:** the `create` operation will also update an existing entity, if an
entity matching the provided Key, Type, and Class already exists in JupiterOne.
The `update` operation will fail unless that entity Id already exists.

The input JSON file is a single entity or an array of entities. For example:

```json
[
  {
    "entityId": "12345678-fe34-44ee-b3b0-abcdef123456",
    "entityKey": "test:entity:1",
    "entityType": "generic_resource",
    "entityClass": "Resource",
    "properties": {
      "name": "Test Entity Resource 1",
      "displayName": "TER1"
    }
  },
  {
    "entityId": "12345678-e75f-40d6-858e-123456abcdef",
    "entityKey": "test:entity:3",
    "entityType": "generic_resource",
    "entityClass": "Resource",
    "properties": {
      "name": "Test Entity Resource 2",
      "displayName": "TER2"
    }
  }
]
```

The `entityId` property is only necessary for `update` operations.

### Create or update alert rules from a JSON input file

```bash
j1 -o create --alert -a j1dev -f ./local/alerts.json
Validating inputs...
Authenticating with JupiterOne... OK
Created alert rule <uuid>.
Done!
```

The input JSON file is one or an array of alert rule instances. The following is
an example of a single alert rule instance:

```json
{
  "instance": {
    "name": "unencrypted-prod-data",
    "description": "Data stores in production tagged critical and unencrypted",
    "specVersion": 1,
    "pollingInterval": "ONE_DAY",
    "outputs": ["alertLevel"],
    "operations": [
      {
        "when": {
          "type": "FILTER",
          "specVersion": 1,
          "condition": [
            "AND",
            ["queries.unencryptedCriticalData.total", "!=", 0]
          ]
        },
        "actions": [
          {
            "type": "SET_PROPERTY",
            "targetProperty": "alertLevel",
            "targetValue": "CRITICAL"
          },
          {
            "type": "CREATE_ALERT"
          }
        ]
      }
    ],
    "question": {
      "queries": [
        {
          "query": "Find DataStore with (production=true or tag.Production=true) and classification='critical' and encrypted!=true as d return d.tag.AccountName as Account, d.displayName as UnencryptedDataStores, d._type as Type, d.encrypted as Encrypted",
          "version": "v1",
          "name": "unencryptedCriticalData"
        }
      ]
    }
  }
}
```

Add `"id": "<uuid>"` property to the instance JSON when updating an alert rule.

### Bulk Delete

```bash
j1 -q 'Find SomeDataClass with someProp="some value"'
j1 -e -o bulk-delete -f ./results.json
```

The first CLI command queries data using a J1QL query and saves the data locally
to `results.json`. The second CLI command takes `results.json` as input and bulk
deletes all the entities in the file.

### Provision Alert Rules from Rule Pack

The following command will provision all the default alert rules from
`jupiterone-alert-rules` with the rule pack name `aws-config`:

```bash
j1 -a <j1AccountId> -u <j1Username> -o provision-alert-rule-pack --alert -f aws-config
```

You can specify your own rule pack to provision as well, by specifying the full
file path to the `rule-pack.json` file:

```bash
j1 -a <j1AccountId> -u <j1Username> -o provision-alert-rule-pack --alert -f path/to/your/rule-pack.json
```

For more details about the rules and rule packs, see the
`jupiterone-alert-rules` project.
