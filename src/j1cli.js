"use strict";

const path = require("path");
const JupiterOneClient = require("./j1client");
const { prompt } = require("inquirer");
const program = require("commander");
const error = require("./util/error");
const fs = require("fs");
const util = require("util");
const yaml = require("js-yaml");
const { defaultAlertSettings } = require("@jupiterone/jupiterone-alert-rules");
const pAll = require("p-all");

const writeFile = util.promisify(fs.writeFile);

const J1_USER_POOL_ID = process.env.J1_USER_POOL_ID;
const J1_CLIENT_ID = process.env.J1_CLIENT_ID;
const J1_API_TOKEN = process.env.J1_API_TOKEN;
const J1_DEV_ENABLED = process.env.J1_DEV_ENABLED;
const EUSAGEERROR = 126;
const CONCURRENCY = 2;

const SUPPORTED_OPERATIONS = [
  "create",
  "update",
  "upsert", // only works on entities
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
      "-f, --input-file <dir>",
      "Input JSON file. Or the filename of the alert rule pack."
    )
    .option(
      "--hard-delete",
      "Optionally force hard deletion of entities (default is soft delete)."
    )
    .option(
      "--delete-duplicates",
      "Optionally force deletion of duplicate entities with identical keys."
    )
    .option(
      "--output-file <file>",
      "Writes query result to specified output file, or results.json by default",
      "results.json"
    )
    .parse(process.argv);

  try {
    const data = await validateInputs();
    const j1Client = await initializeJ1Client();
    if (program.query) {
      const res = await j1Client.queryV1(program.query);
      const result = JSON.stringify(res, null, 2);
      console.log(result);
      if (program.outputFile) {
        await writeFile(program.outputFile, result);
      }
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
    } else if (!program.inputFile || program.inputFile === "") {
      error.fatal("Must specify input JSON file with -f|--file)", EUSAGEERROR);
    } else {
      let filePath = program.inputFile;
      if (!fs.existsSync(filePath)) {
        if (program.operation === "provision-alert-rule-pack") {
          filePath = `node_modules/@jupiterone/jupiterone-alert-rules/rule-packs/${program.inputFile}.json`;
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

function jParse(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const fileExtension = path.extname(filePath);
    if (fileExtension === ".yml" || fileExtension === ".yaml") {
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
    accessToken: program.key || J1_API_TOKEN,
    dev: !!J1_DEV_ENABLED
  }).init(program.alert);
  console.log("OK");
  return j1Client;
}

async function createEntity(j1Client, e) {
  const classLabels = Array.isArray(e.entityClass)
    ? e.entityClass
    : [e.entityClass];

  if (e.properties) {
    e.properties.createdOn =
      e.properties.createdOn && new Date(e.properties.createdOn).getTime();
  }

  const res = await j1Client.createEntity(
    e.entityKey,
    e.entityType,
    classLabels,
    e.properties
  );
  return res.vertex.entity._id;
}

async function updateEntity(j1Client, entityId, properties) {
  if (properties) {
    properties.updatedOn =
      properties.updatedOn && new Date(properties.updatedOn).getTime();

    await j1Client.updateEntity(entityId, properties);
  } else {
    console.log(
      `Skipping entity update with _id='${entityId}' - No properties provided.`
    );
  }
  return entityId;
}

async function deleteEntity(j1Client, entityId, hardDelete) {
  await j1Client.deleteEntity(entityId, hardDelete);
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
  } else {
    for (const e of entities) {
      let entityId;
      let entityIds;

      if (e.entityId) {
        entityId = e.entityId;
      } else if (e.entityKey) {
        const query = `Find * with _key='${e.entityKey}'`;
        const res = await j1Client.queryV1(query);
        if (res.length === 1) {
          entityId = res[0].entity._id;
        } else if (res.length === 0 && operation != "upsert") {
          console.log(`Skipping entity with _key='${e.entityKey}' - NOT FOUND`);
          continue;
        } else if (res.length > 0) {
          if (operation !== "delete" && !program.deleteDuplicates) {
            console.log(
              `Skipping entity with _key='${e.entityKey}' - KEY NOT UNIQUE`
            );
            continue;
          }
          entityIds = res.map(r => r.entity._id);
        }
      }

      if (entityId) {
        if (operation === "update" || operation === "upsert") {
          work.push(() => {
            return updateEntity(j1Client, entityId, e.properties);
          });
        } else if (operation === "delete") {
          work.push(() => {
            return deleteEntity(j1Client, entityId, program.hardDelete);
          });
        }
      } else if (entityIds) {
        // deletes duplicate entities with identical key
        if (operation === "delete" && program.deleteDuplicates) {
          for (const id of entityIds) {
            work.push(() => {
              return deleteEntity(j1Client, id, program.hardDelete);
            });
          }
        }
      } else if (operation === "upsert") {
        work.push(() => {
          return createEntity(j1Client, e);
        });
      } else {
        console.log(
          `Skipping entity: '${JSON.stringify(
            e
          )}' - undefined entityId or entityKey`
        );
      }
    }
  }
  const entityIds = await pAll(work, {
    concurrency: CONCURRENCY
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
    r.toEntityId,
    r.properties
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
    concurrency: CONCURRENCY
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
    const jsonString = JSON.stringify(questions, null, 2);

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
    concurrency: CONCURRENCY
  });
  process.stdout.write(
    `Provisioned ${res.length} rules:\n${JSON.stringify(res, null, 2)}\n`
  );
}

main();
