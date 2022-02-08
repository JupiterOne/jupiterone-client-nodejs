export const getAllIntegrationInstances = async (j1, integrationDefinition) => {
  let instances = [];

  const getInstances = async (cursor) => {
    const integrationInstances = await j1.integrationInstances.list({
      definitionId: integrationDefinition?.id,
      cursor,
    });

    if (
      integrationInstances?.instances &&
      Array.isArray(integrationInstances.instances)
    ) {
      instances = [...instances, ...integrationInstances.instances];
    }

    if (integrationInstances?.pageInfo?.hasNextPage) {
      return getInstances(integrationInstances.pageInfo.endCursor);
    }
  };

  await getInstances(null);

  return instances;
};
