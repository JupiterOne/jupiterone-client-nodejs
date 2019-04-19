'use strict';

const JupiterOneClient = require('./j1client');
const { prompt } = require('inquirer');
const program = require('commander');
const error = require('./util/error');
const fs = require('fs');
const yaml = require('js-yaml');
const { defaultAlertSettings } = require('@jupiterone/jupiterone-alert-rules');

const J1_USER_POOL_ID = process.env.J1_USER_POOL_ID || 'us-east-2_9fnMVHuxD';
const J1_CLIENT_ID = process.env.J1_CLIENT_ID || '1hcv141pqth5f49df7o28ngq1u';
const J1_API_TOKEN = process.env.J1_API_TOKEN;
const EUSAGEERROR = 126;

const SUPPORTED_OPERATIONS = [
  'create',
  'update',
  'provision-alert-rule-pack'
]

async function main () {
  program
    .version(require('../package').version, '-v, --version')
    .usage('[options]')
    .option('-a, --account <name>', 'JupiterOne account name.')
    .option('-u, --user <email>', 'JupiterOne user email.')
    .option('-k, --key <apiToken>', 'JupiterOne API access token.')
    .option('-q, --query <j1ql>', 'Execute a query.')
    .option('-o, --operation <action>', `Supported operations: ${SUPPORTED_OPERATIONS}`)
    .option('--entity', 'Specifies entity operations.')
    .option('--relationship', 'Specifies relationship operations.')
    .option('--alert', 'Specifies alert rule operations.')
    .option('-f, --file <dir>', 'Input JSON file. Or the filename of the alert rule pack.')
    .parse(process.argv);

  try {
    const data = await validateInputs();
    const j1Client = await initializeJ1Client();

    if (program.query) {
      const res = await j1Client.queryV1(program.query);
      console.log(JSON.stringify(res, null, 2));
    }
    else {
      const update = program.operation === 'update';
      if (program.entity) {
        await mutateEntities(j1Client, Array.isArray(data) ? data : [data], update);
      } else if (program.relationship) {
        await mutateRelationships(j1Client, Array.isArray(data) ? data : [data], update);
      } else if (program.alert) {
        if (program.operation === 'provision-alert-rule-pack') {
          await provisionRulePackAlerts(j1Client, data, defaultAlertSettings)
        }
        else {
          await mutateAlertRules(j1Client, Array.isArray(data) ? data : [data], update);
        }
      }
    }
  } catch (err) {
    error.fatal(`Unexpected error: ${err}`);
  }
  console.log('Done!');
}

// ensure user supplied necessary params
async function validateInputs () {
  process.stdout.write('Validating inputs... ');
  if (!program.account || program.account === '') {
    error.fatal('Missing -a|--account flag!', EUSAGEERROR);
  }

  let data;

  if (!program.query || program.query === '') {
    if (!program.entity && !program.relationship && !program.alert) {
      error.fatal('Must specify a query (using -q|--query) or an entity/relationship/rule operation (--entity or --relationship or --alert)', EUSAGEERROR);
    } else if (!program.operation || program.operation === '') {
      error.fatal('Must specify command action for entity or rule operation (-o|--operation)', EUSAGEERROR);
    } else if (SUPPORTED_OPERATIONS.indexOf(program.operation) < 0) {
      error.fatal(`Unsupported operation: ${program.operation}`);
    } else if (!program.file || program.file === '') {
      error.fatal('Must specify input JSON file with -f|--file)', EUSAGEERROR);
    } else {
      let filePath = program.file;
      if (!fs.existsSync(filePath)) {
        if (program.operation === 'provision-alert-rule-pack') {
          filePath = `node_modules/@jupiterone/jupiterone-alert-rules/rule-packs/${program.file}.json`;
          if (!fs.existsSync(filePath)) {
            error.fatal(`Could not find input JSON file (${filePath}). Specify the correct file path or alert-rule-pack name with '-f|--file'.`);
          }
        }
      }

      data = jParse(filePath);
      if (!data) {
        error.fatal(`Could not parse input JSON file (${filePath}).`);
      }
  }
  }
  
  if ((!program.key || program.key === '') && !J1_API_TOKEN) {
    if (!program.user || program.user === '') {
      error.fatal('Must authenticate with either the API key (using -k|--key) or username/password (using -u|--user)', EUSAGEERROR);
    } else {
      await gatherPassword();
    }
  }

  console.log('OK');
  return data;
}

function jParse (file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    if (file.split('.').pop().toLowerCase() === 'yml') {
      return yaml.safeLoad(data);
    } else {
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(err);
    return null;
  }
}

// Note: this will happily read from STDIN if data is piped in...
// e.g. if lastpass is installed:
// lpass show MyJ1Password | psp publish -u my.user@domain.tld -a myaccount
async function gatherPassword () {
  const answer = await prompt([
    {
      type: 'password',
      name: 'password',
      message: 'JupiterOne password:'
    }
  ]);
  program.password = answer.password;
}

async function initializeJ1Client () {
  process.stdout.write('Authenticating with JupiterOne... ');
  const j1Client = 
    await (new JupiterOneClient(
      program.account,
      program.user,
      program.password,
      J1_USER_POOL_ID,
      J1_CLIENT_ID,
      program.key || J1_API_TOKEN
    )).init(program.alert);
  console.log('OK');
  return j1Client;
}

async function createEntity(j1Client, e) {
  const classLabels = Array.isArray(e.entityClass) ? e.class : [e.entityClass];
  const res = await j1Client.createEntity(
    e.entityKey,
    e.entityType,
    classLabels,
    e.properties
  );
  return res.vertex.entity._id;
}

async function updateEntity(j1Client, entityId, properties) {
  await j1Client.updateEntity(entityId, properties);
  return entityId;
}

async function mutateEntities(j1Client, entities, update) {
  const promises = [];
  if (update) {
    for (const e of entities) {
      promises.push(updateEntity(j1Client, e.entityId, e.properties));
    }
  } else {
    for (const e of entities) {
      promises.push(createEntity(j1Client, e));
    }
  }
  const entityIds = await Promise.all(promises);
  update
    ? console.log(`Updated ${entityIds.length} entities:\n${JSON.stringify(entityIds, null, 2)}`)
    : console.log(`Created ${entityIds.length} entities:\n${JSON.stringify(entityIds, null, 2)}`);
}

async function createRelationship(j1Client, r) {
  const res = await j1Client.createRelationship(
    r.relationshipKey,
    r.relationshipType,
    r.relationshipClass,
    r.fromEntityId,
    r.toEntityId
  );
  return res.edge.relationship._id;
}

async function mutateRelationships(j1Client, relationships, update) {
  const promises = [];
  if (update) {
    console.log('Updating relationships is not currently supported via the CLI.');
  } else {
    for (const r of relationships) {
      promises.push(createRelationship(j1Client, r));
    }
  }
  const relationshipIds = await Promise.all(promises);
  console.log(`Created ${relationshipIds.length} relationships:\n${JSON.stringify(relationshipIds, null, 2)}`);
}

async function mutateAlertRules(j1Client, rules, update) {
  const created = [];
  const updated = [];
  const skipped = [];
  const res = [];
  for (const r of rules) {
    try {
      if (update) {
        // Check if the alert rule instance has an id, which is required for update
        if (r.instance && r.instance.id && r.instance.id !== '') {
          res.push(await j1Client.mutateAlertRule(r, update));
          updated.push(r.name);
        } else {
          console.log(
            `Skipped updating the following alert rule instance because it has no 'id' property:\n ${
              JSON.stringify(r, null, 2)
            }`);
          skipped.push(r.name);
        }
      } else {
        // If it is a 'create' operation, skip existing alert rule instance to avoid duplicate
        if (r.instance && r.instance.id && r.instance.id !== '') {
          console.log(
            `Skipped creating the following alert rule instance because it already exists:\n ${
              JSON.stringify(r, null, 2)
            }`);
          skipped.push(r.name);
        } else {
          res.push(await j1Client.mutateAlertRule(r, update));
          created.push(r.name);
        }
      }
    } catch (err) {
      console.warn(`Error mutating alert rule ${r}.\n${err}\n Skipped.`);
      skipped.push(r.name);
    }
  }
  update
    ? console.log(`Updated ${res.length} alert rules:\n${JSON.stringify(res, null, 2)}.`)
    : console.log(`Created ${res.length} alert rules:\n${JSON.stringify(res, null, 2)}.`);
}

async function provisionRulePackAlerts(j1Client, rules, defaultSettings) {
  const promises = [];
  for (const r of rules) {
    if (r.instance) {
      const update = r.instance.id !== undefined;
      promises.push(j1Client.mutateAlertRule(rule, update));
    }
    else {
      const instance = {
        name: r.name,
        description: r.description,
        question: {
          queries: r.queries
        },
        ...defaultSettings
      }
      promises.push(j1Client.mutateAlertRule({instance}, false));
    }
  }
  const res = await Promise.all(promises);
  process.stdout.write(`Provisioned ${res.length} rules:\n${JSON.stringify(res, null, 2)}\n`);
}

main();
