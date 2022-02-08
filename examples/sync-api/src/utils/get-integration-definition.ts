import { logger } from '.';

export const getIntegrationDefinition = async (j1, target: string) => {
  const integrationDefinitions = await j1.integrationDefinitions.list();
  const targetIntegrationDefinition = integrationDefinitions.find(
    (definition) => definition.name.toLowerCase() === target.toLowerCase(),
  );

  if (!targetIntegrationDefinition) {
    logger('Unable to find target integration definition.');
    return null;
  }

  return targetIntegrationDefinition;
};
