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
      switch (program.operation) {
        case 'create':
          if (program.entity) {
            await createEntities(j1Client, Array.isArray(data) ? data : [data]);
          } else if (program.alert) {
            await createAlerts(j1Client, Array.isArray(data) ? data : [data]);
          }
          break;
        case 'update':
          if (program.entity) {
            await updateEntities(j1Client, Array.isArray(data) ? data : [data]);
          } else if (program.alert) {
            await updateAlerts(j1Client, Array.isArray(data) ? data : [data]);
          }
          break;
        default:
          console.log(`Unsupported operation: ${program.operation}`);
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
  const entityId = res.vertex.entity._id;
  console.log(`Created entity ${entityId}.`);
  return entityId;
}

async function createEntities(j1Client, entities) {
  const entityIds = [];
  for (const e of entities) {
    entityIds.push(await createEntity(j1Client, e));
  }
}

async function updateEntity(j1Client, entityId, properties) {
  await j1Client.updateEntity(entityId, properties);
  console.log(`Updated entity ${entityId}.`);
}

async function updateEntities(j1Client, entities) {
  const entityIds = [];
  for (const e of entities) {
    entityIds.push(await updateEntity(j1Client, e.entityId, e.properties));
  }
}

async function mutateAlertRule(j1Client, rule, update) {
  const res = await j1Client.mutateAlertRule(rule, update);
  const ruleId = res.id;
  return ruleId;
}

async function createAlerts(j1Client, rules) {
  const ruleIds = [];
  for (const r of rules) {
    const ruleId = await mutateAlertRule(j1Client, r, false);
    ruleIds.push(ruleId);
    console.log(`Created alert rule ${ruleId}.`);
  }
}

async function updateAlerts(j1Client, rules) {
  const ruleIds = [];
  for (const r of rules) {
    const ruleId = await mutateAlertRule(j1Client, r, true);
    ruleIds.push(ruleId);
    console.log(`Updated alert rule ${ruleId}.`);
  }
}

main();
