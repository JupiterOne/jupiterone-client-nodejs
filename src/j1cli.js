"use strict";

const JupiterOneClient = require("./j1client");
const { prompt } = require("inquirer");
const program = require("commander");
const error = require("./util/error");
const fs = require("fs");
const util = require("util");
const yaml = require("js-yaml");
const { defaultAlertSettings } = require("@jupiterone/jupiterone-alert-rules");
const pAll = require("p-all");

const J1_USER_POOL_ID = process.env.J1_USER_POOL_ID;
const J1_CLIENT_ID = process.env.J1_CLIENT_ID;
const J1_API_TOKEN = process.env.J1_API_TOKEN;
const EUSAGEERROR = 126;

const SUPPORTED_OPERATIONS = [
  "create",
  "update",
  "delete",
  "provision-alert-rule-pack"
];

async function main() {
  program
    .version(require("../package").version, "-v, --version")
    .usage("[options]")
    .option("-a, --account <name>", "JupiterOne account name.")
    .option("-u, --user <email>", "JupiterOne user email.")
    .option("-k, --key <apiToken>", "JupiterOne API access token.")
    .option("-q, --query <j1ql>", "Execute a query.")
    .option(
      "-o, --operation <action>",
      `Supported operations: ${SUPPORTED_OPERATIONS}`
    )
    .option("-e, --entity", "Specifies entity operations.")
    .option("-r, --relationship", "Specifies relationship operations.")
    .option("-l, --alert", "Specifies alert rule operations.")
    .option(
      "-w, --question",
      "Specifies question operations. A question is answered by one or more queries."
    )
    .option(
      "-f, --file <dir>",
      "Input JSON file. Or the filename of the alert rule pack."
    )
    .parse(process.argv);

  try {
    const data = await validateInputs();
    const j1Client = await initializeJ1Client();
    if (program.query) {
      const res = await j1Client.queryV1(program.query);
      console.log(JSON.stringify(res, null, 2));
    } else {
      const update = program.operation === "update";
      if (program.entity) {
        await mutateEntities(
          j1Client,
          Array.isArray(data) ? data : [data],
          program.operation
        );
      } else if (program.relationship) {
        await mutateRelationships(
          j1Client,
          Array.isArray(data) ? data : [data],
          update
        );
      } else if (program.alert) {
        if (program.operation === "provision-alert-rule-pack") {
          await provisionRulePackAlerts(j1Client, data, defaultAlertSettings);
        } else {
          await mutateAlertRules(
            j1Client,
            Array.isArray(data) ? data : [data],
            update
          );
        }
      } else if (program.question) {
        await mutateQuestions(
          j1Client,
          Array.isArray(data) ? data : [data],
          program.operation
        );
      }
    }
  } catch (err) {
    error.fatal(`Unexpected error: ${err.stack || err.toString()}`);
  }
  console.log("Done!");
}

// ensure user supplied necessary params
async function validateInputs() {
  process.stdout.write("Validating inputs... ");
  let data;
  if (!program.account || program.account === "") {
    error.fatal("Missing -a|--account flag!", EUSAGEERROR);
  }
  if (!program.query || program.query === "") {
    if (!program.operation || program.operation === "") {
      error.fatal(
        "Must specify a query (using -q|--query) or operation action (-o|--operation)",
        EUSAGEERROR
      );
    } else if (SUPPORTED_OPERATIONS.indexOf(program.operation) < 0) {
      error.fatal(`Unsupported operation: ${program.operation}`);
    } else if (
      !program.entity &&
      !program.relationship &&
      !program.alert &&
      !program.question
    ) {
      error.fatal(
        "Must specify an operation target type (--entity, --relationship, --alert, or --question)",
        EUSAGEERROR
      );
    } else if (!program.file || program.file === "") {
      error.fatal("Must specify input JSON file with -f|--file)", EUSAGEERROR);
    } else {
      let filePath = program.file;
      if (!fs.existsSync(filePath)) {
        if (program.operation === "provision-alert-rule-pack") {
          filePath = `node_modules/@jupiterone/jupiterone-alert-rules/rule-packs/${program.file}.json`;
          if (!fs.existsSync(filePath)) {
            error.fatal(
              `Could not find input JSON file (${filePath}). Specify the correct file path or alert-rule-pack name with '-f|--file'.`
            );
          }
        } else {
          error.fatal(
            `Could not find input JSON file (${filePath}). Specify the correct file path or alert-rule-pack name with '-f|--file'.`
          );
        }
      }

      data = jParse(filePath);
      if (!data) {
        error.fatal(`Could not parse input JSON file (${filePath}).`);
      }
    }
  }

  if ((!program.key || program.key === "") && !J1_API_TOKEN) {
    if (!program.user || program.user === "") {
      error.fatal(
        "Must authenticate with either the API key (using -k|--key) or username/password (using -u|--user)",
        EUSAGEERROR
      );
    } else {
      await gatherPassword();
    }
  }

  console.log("OK");
  return data;
}

function jParse(file) {
  try {
    const data = fs.readFileSync(file, "utf8");
    if (
      file
        .split(".")
        .pop()
        .toLowerCase() === "yml"
    ) {
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
async function gatherPassword() {
  const answer = await prompt([
    {
      type: "password",
      name: "password",
      message: "JupiterOne password:"
    }
  ]);
  program.password = answer.password;
}

async function initializeJ1Client() {
  process.stdout.write("Authenticating with JupiterOne... ");
  const j1Client = await new JupiterOneClient({
    account: program.account,
    username: program.user,
    password: program.password,
    poolId: J1_USER_POOL_ID,
    clientId: J1_CLIENT_ID,
    accessToken: program.key || J1_API_TOKEN
  }).init(program.alert);
  console.log("OK");
  return j1Client;
}

async function createEntity(j1Client, e) {
  const classLabels = Array.isArray(e.entityClass)
    ? e.entityClass
    : [e.entityClass];

  e.properties.createdOn = e.properties.createdOn
    ? new Date(e.properties.createdOn).getTime()
    : new Date().getTime();

  const res = await j1Client.createEntity(
    e.entityKey,
    e.entityType,
    classLabels,
    e.properties
  );
  return res.vertex.entity._id;
}

async function updateEntity(j1Client, entityId, properties) {
  properties.updatedOn = properties.updatedOn
    ? new Date(properties.updatedOn).getTime()
    : new Date().getTime();

  await j1Client.updateEntity(entityId, properties);
  return entityId;
}

async function deleteEntity(j1Client, entityId) {
  await j1Client.deleteEntity(entityId);
  return entityId;
}

async function mutateEntities(j1Client, entities, operation) {
  const work = [];
  if (operation === "create") {
    for (const e of entities) {
      work.push(() => {
        return createEntity(j1Client, e);
      });
    }
  } else if (operation === "update") {
    for (const e of entities) {
      work.push(() => {
        return updateEntity(j1Client, e.entityId, e.properties);
      });
    }
  } else if (operation === "delete") {
    for (const e of entities) {
      work.push(() => {
        return deleteEntity(j1Client, e.entityId);
      });
    }
  }
  const entityIds = await pAll(work, {
    concurrency: 5
  });
  console.log(
    `${operation}d ${entityIds.length} entities:\n${JSON.stringify(
      entityIds,
      null,
      2
    )}`
  );
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
  const work = [];
  if (update) {
    console.log(
      "Updating relationships is not currently supported via the CLI."
    );
  } else {
    for (const r of relationships) {
      work.push(() => {
        return createRelationship(j1Client, r);
      });
    }
  }
  const relationshipIds = await pAll(work, {
    concurrency: 5
  });
  console.log(
    `Created ${relationshipIds.length} relationships:\n${JSON.stringify(
      relationshipIds,
      null,
      2
    )}`
  );
}

async function mutateAlertRules(j1Client, rules, update) {
  const created = [];
  const updated = [];
  const skipped = [];
  const results = [];
  for (const r of rules) {
    try {
      if (update) {
        // Check if the alert rule instance has an id, which is required for update
        if (r.instance && r.instance.id && r.instance.id !== "") {
          const res = await j1Client.mutateAlertRule(r, update);
          results.push(res);
          updated.push({ id: res.id, name: r.instance.name });
        } else {
          console.log(
            `Skipped updating the following alert rule instance because it has no 'id' property:\n ${JSON.stringify(
              r,
              null,
              2
            )}`
          );
          skipped.push({ id: r.instance.id, name: r.instance.name });
        }
      } else {
        // If it is a 'create' operation, skip existing alert rule instance to avoid duplicate
        if (r.instance && r.instance.id && r.instance.id !== "") {
          console.log(
            `Skipped creating the following alert rule instance because it already exists:\n ${JSON.stringify(
              r,
              null,
              2
            )}`
          );
          skipped.push({ id: r.instance.id, name: r.instance.name });
        } else {
          const res = await j1Client.mutateAlertRule(r, update);
          results.push(res);
          created.push({ id: res.id, name: r.instance.name });
        }
      }
    } catch (err) {
      console.warn(`Error mutating alert rule ${r}.\n${err}\n Skipped.`);
      skipped.push({ id: r.instance.id, name: r.instance.name });
    }
  }

  if (created.length > 0) {
    console.log(
      `Created ${created.length} alert rules:\n${JSON.stringify(
        created,
        null,
        2
      )}.`
    );
  }
  if (updated.length > 0) {
    console.log(
      `Updated ${updated.length} alert rules:\n${JSON.stringify(
        updated,
        null,
        2
      )}.`
    );
  }
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} alert rules:\n${JSON.stringify(
        skipped,
        null,
        2
      )}.`
    );
  }
}

async function mutateQuestions(j1Client, questions, operation) {
  const created = [];
  const updated = [];
  const deleted = [];
  const skipped = [];
  const results = [];
  let newFile = false;
  for (const q of questions) {
    try {
      if (operation === "create") {
        // Update if there is an ID
        if (q.id) {
          const res = await j1Client.updateQuestion(q);
          results.push(res);
          updated.push({ id: q.id, title: q.title });
        } else {
          const res = await j1Client.createQuestion(q);
          results.push(res);
          created.push({ id: res.id, title: q.title });
          q.id = res.id;
        }
      } else if (operation === "update") {
        if (q.id && q.id.length > 0) {
          const res = await j1Client.updateQuestion(q);
          results.push(res);
          updated.push({ id: q.id, title: q.title });
        } else {
          // Skip if there is no ID
          skipped.push({ id: q.id, title: q.title });
        }
      } else if (operation === "delete") {
        if (q.id && q.id.length > 0) {
          const res = await j1Client.deleteQuestion(q.id);
          results.push(res);
          deleted.push({ id: q.id, title: q.title });
        } else {
          // Skip if there is no ID
          skipped.push({ id: q.id, title: q.title });
        }
      }
    } catch (err) {
      console.warn(`Error mutating question ${q}.\n${err}\n Skipped.`);
      skipped.push({ id: q.id, title: q.title });
    }
  }

  if (created.length > 0) {
    console.log(
      `Created ${created.length} questions:\n${JSON.stringify(
        created,
        null,
        2
      )}.`
    );
    newFile = true;
  }
  if (updated.length > 0) {
    console.log(
      `Updated ${updated.length} questions:\n${JSON.stringify(
        updated,
        null,
        2
      )}.`
    );
  }
  if (deleted.length > 0) {
    console.log(
      `Deleted ${deleted.length} questions:\n${JSON.stringify(
        deleted,
        null,
        2
      )}.`
    );
  }
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} questions:\n${JSON.stringify(
        skipped,
        null,
        2
      )}.`
    );
  }
  if (newFile) {
    var jsonString = JSON.stringify(questions, null, 2);

    const writeFile = util.promisify(fs.writeFile);
    await writeFile("modified_questions.json", jsonString);
    console.log(
      'A modified version of your JSON ("modified_questions.json") with your new IDs has been added to your current directory.'
    );
  }
}

async function provisionRulePackAlerts(j1Client, rules, defaultSettings) {
  const work = [];
  for (const r of rules) {
    if (r.instance) {
      const update = r.instance.id !== undefined;
      work.push(() => {
        return j1Client.mutateAlertRule(r, update);
      });
    } else {
      const instance = {
        ...defaultSettings,
        name: r.name,
        description: r.description,
        question: {
          queries: r.queries
        },
        operations: r.alertLevel
          ? [
              {
                when: defaultSettings.operations[0].when,
                actions: [
                  {
                    type: "SET_PROPERTY",
                    targetProperty: "alertLevel",
                    targetValue: r.alertLevel
                  },
                  {
                    type: "CREATE_ALERT"
                  }
                ]
              }
            ]
          : defaultSettings.operations
      };
      work.push(() => {
        return j1Client.mutateAlertRule({ instance }, false);
      });
    }
  }
  const res = await pAll(work, {
    concurrency: 5
  });
  process.stdout.write(
    `Provisioned ${res.length} rules:\n${JSON.stringify(res, null, 2)}\n`
  );
}

main();
