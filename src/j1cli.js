'use strict';

const J1_USER_POOL_ID = process.env.J1_USER_POOL_ID || 'us-east-2_9fnMVHuxD';
const J1_CLIENT_ID = process.env.J1_CLIENT_ID || '1hcv141pqth5f49df7o28ngq1u';
const J1_API_TOKEN = process.env.J1_API_TOKEN;
const JupiterOneClient = require('./j1client');
const { prompt } = require('inquirer');
const program = require('commander');
const error = require('./util/error');
const fs = require('fs');

const EUSAGEERROR = 126;

async function main () {
  program
    .version(require('../package').version, '-v, --version')
    .usage('[options]')
    .option('-a, --account <name>', 'JupiterOne account name.')
    .option('-u, --user <email>', 'JupiterOne user email.')
    .option('-k, --key <apiToken>', 'JupiterOne API access token.')
    .option('-q, --query <j1ql>', 'Execute a query.')
    .option('-o, --operation <action>', 'Supported operations: create, update')
    .option('--entity', 'Specifies entity operations.')
    .option('--relationship', 'Specifies relationship operations.')
    .option('--alert', 'Specifies alert rule operations.')
    .option('-f, --file <dir>', 'Input JSON file.')
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
        await mutateAlertRules(j1Client, Array.isArray(data) ? data : [data], update);
      }
    }
  } catch (err) {
    error.fatal(`Unexpected error: ${err}`);
  }
  console.log('Done!');
}

// ensure user supplied necessary params
async function validateInputs () {
  console.log('Validating inputs...');
  if (!program.account || program.account === '') {
    error.fatal('Missing -a|--account flag!', EUSAGEERROR);
  }

  let data;

  if (!program.query || program.query === '') {
    if (!program.entity && !program.relationship && !program.alert) {
      error.fatal('Must specify a query (using -q|--query) or an entity/relationship/rule operation (--entity or --relationship or --alert)', EUSAGEERROR);
    } else if (!program.operation || program.operation === '') {
      error.fatal('Must specify command action for entity or rule operation (-c|--command <create|update|delete>)', EUSAGEERROR);
    } else if (program.operation !== 'create' && program.operation !== 'update') {
      error.fatal(`Unsupported operation: ${program.operation}`);
    } else if (!program.file || program.file === '') {
      error.fatal('Must specify input JSON file with -f|--file)', EUSAGEERROR);
    } else if (!fs.existsSync(program.file)) {
      error.fatal(`Could not find input JSON file (${program.file}). Specify the correct path with '-f|--file'.`);
    } else {
      data = jParse(program.file);
      if (!data) {
        error.fatal(`Could not parse input JSON file (${program.file}).`);
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

  return data;
}

function jParse (file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
  return data;
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
  console.log('Authenticated!');
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
    ? console.log(`Updated entities:\n${JSON.stringify(entityIds, null, 2)}`)
    : console.log(`Created entities:\n${JSON.stringify(entityIds, null, 2)}`);
}

async function createRelationship(j1Client, r) {
  const res = await j1Client.createRelationship(
    r.relationshipKey,
    r.relationshipType,
    r.relationshipClass,
    r.fromEntityId,
    r.toEntityId
  );
  return res.edge.id;
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
  console.log(`Created relationships:\n${JSON.stringify(relationshipIds, null, 2)}`);
}

async function mutateAlertRule(j1Client, rule, update) {
  const res = await j1Client.mutateAlertRule(rule, update);
  return res.id;
}

async function mutateAlertRules(j1Client, rules, update) {
  const promises = [];
  for (const r of rules) {
    if (update) {
      // Check if the alert rule instance has an id, which is required for update
      if (r.instance && r.instance.id && r.instance.id !== '') {
        promises.push(mutateAlertRule(j1Client, r, update));
      } else {
        console.log(
          `Skipped updating the following alert rule instance because it has no 'id' property:\n ${
            JSON.stringify(r, null, 2)
          }`);
      }
    } else {
      // If it is a 'create' operation, skip existing alert rule instance to avoid duplicate
      if (r.instance && r.instance.id && r.instance.id !== '') {
        console.log(
          `Skipped creating the following alert rule instance because it already exists:\n ${
            JSON.stringify(r, null, 2)
          }`);
      } else {
        promises.push(mutateAlertRule(j1Client, r, update));
      }
    }
  }
  const ruleIds = await Promise.all(promises);
  update
    ? console.log(`Updated alert rules:\n${JSON.stringify(ruleIds, null, 2)}.`)
    : console.log(`Created alert rules:\n${JSON.stringify(ruleIds, null, 2)}.`);
}

main();
