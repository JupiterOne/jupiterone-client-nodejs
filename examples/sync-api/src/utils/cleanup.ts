import { JupiterOneClient } from '@jupiterone/jupiterone-client-nodejs';
import { queries, mapProp } from './';

export const cleanup = async (j1: JupiterOneClient, integrationId: string) => {
  const codeModules = await j1.queryV1(queries.codeModuleUsesCodeRepo);
  const codeRepos = await j1.queryV1(
    queries.codeRepoByIntegrationId(integrationId),
  );

  await j1.bulkDelete({
    entities: [
      ...mapProp(codeModules, 'entity'),
      ...mapProp(codeRepos, 'entity'),
    ],
  });
};
