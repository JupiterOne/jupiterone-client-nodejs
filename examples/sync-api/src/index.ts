import chalk from 'chalk';
import { authenticate } from './utils/authenticate';
import { targetQuery } from './utils/target-query';
import {
  generateRelationships,
  RelationshipTypes,
} from './utils/generate-relationships';
import codeModules from './data/code-modules.json';

const codeRepoNames = [
  "'graph-veracode'",
  "'graph-knowbe4'",
  "'graph-azure'",
  "'graph-wazuh'",
  "'graph-enrichment-examples'",
  "'graph-whois'",
  "'graph-zeit'",
];

const codeModulesForUpload = codeModules.map((codeModule) => codeModule.entity);

const main = async (): Promise<void> => {
  const action = process.argv[2];

  if (!Object.values(RelationshipTypes).includes(action)) {
    console.log(chalk.red('Invalid action!', action));
    console.log(
      chalk.red(
        'Valid actions are:',
        JSON.stringify(
          Object.values(RelationshipTypes).filter(
            (rt) => typeof rt === 'string',
          ),
          null,
          4,
        ),
      ),
    );
    return;
  }

  const j1 = await authenticate();
  const targetQueryResult = await j1.queryV1(targetQuery);
  const targetQueryBulkDelete = targetQueryResult.map(
    (codeModule) => codeModule.entity,
  );

  await j1.bulkDelete({
    entities: targetQueryBulkDelete,
  });

  const codeRepoQuery = `
    FIND github_repo
        WITH displayName = (${codeRepoNames.join(' OR ')})
`;

  const type = RelationshipTypes[action];
  const codeRepos = await j1.queryV1(codeRepoQuery);
  const relationships = generateRelationships(codeRepos, codeModules, type);

  await j1.bulkUpload({
    syncJobOptions: {
      scope: 'form-relationships-test',
    },
    entities: codeModulesForUpload,
    relationships,
  });
};

main().catch(console.error);
