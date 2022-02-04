import {
  successLog,
  logger,
  handleInvalidEnum,
  authenticate,
  cleanup,
  generateRelationships,
  waitForGraphResults,
  getIntegrationDefinition,
  getAllIntegrationInstances,
  queries,
  mapProp,
  createScope,
} from './utils';
import { RelationshipTypes } from './utils/generate-relationships';
import codeModules from './data/code-modules.json';
import codeRepos from './data/code-repos.json';

const codeModulesForUpload = mapProp(codeModules, 'entity');
const codeReposForUpload = mapProp(codeRepos, 'entity');

const INTEGRATION_INSTANCE_TARGET =
  'Relationships Between Differences in Owned Entities';
const INTEGRATION_DEFINITION_TARGET = 'Custom';

const main = async (): Promise<void> => {
  const action = process.argv[2];
  if (handleInvalidEnum(RelationshipTypes, action) === false) return;

  const j1 = await authenticate();

  // Integrations begin with a definition. We'll start there
  // and progress down in the hierarchy to find an integration
  // instance
  const integrationDefinition = await getIntegrationDefinition(
    j1,
    INTEGRATION_DEFINITION_TARGET,
  );
  if (integrationDefinition === null) return;

  // Get all the integration instances underneath a definition
  // so we can start looking for the instance we're interested in
  const allIntegrationInstances = await getAllIntegrationInstances(
    j1,
    integrationDefinition,
  );

  // GET or CREATE the Integration Instance
  let targetIntegrationInstance =
    (allIntegrationInstances.find(
      (integrationInstance) =>
        integrationInstance.name.toLowerCase() ===
        INTEGRATION_INSTANCE_TARGET.toLowerCase(),
    ) ??
      []) ||
    (await j1.integrationInstances.create({
      name: INTEGRATION_INSTANCE_TARGET,
      integrationDefinitionId: integrationDefinition?.id,
    }));

  // Cleanup data from our last execution
  await cleanup(j1, targetIntegrationInstance.id);

  await j1.bulkUpload({
    syncJobOptions: {
      source: 'integration-managed',
      integrationInstanceId: targetIntegrationInstance.id,
    },
    entities: codeReposForUpload,
  });

  const codeReposFromGraph = await waitForGraphResults(
    j1,
    queries.codeRepoByIntegrationId(targetIntegrationInstance.id),
  )(1);

  if (!codeReposFromGraph) {
    logger('Cannot find results in J1... exiting.');
    return;
  }

  const relationshipConnection = RelationshipTypes[action];
  const scope = createScope();

  const bulkUPayload = {
    syncJobOptions: {
      scope,
    },
    entities: codeModulesForUpload,
    relationships: generateRelationships(
      codeReposFromGraph,
      codeModules,
      relationshipConnection,
    ),
  };

  await j1.bulkUpload(bulkUPayload);

  successLog(`
    If you did not use KEY_TO_KEY, you should be able to use this query to find your results in the graph:

    ${queries.codeModuleUsesCodeRepo}
    RETURN TREE
  `);
};

main().catch(console.error);
