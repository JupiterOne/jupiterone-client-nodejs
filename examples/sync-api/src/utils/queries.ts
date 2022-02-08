import codeModules from '../data/code-modules.json';

export const codeModuleUsesCodeRepo = `
    FIND CodeModule
    WITH displayName = (${codeModules
      .map((codeModule) => `'${codeModule.entity.displayName}'`)
      .join(' OR ')})
    AND from = 'testing'
    THAT USES << CodeRepo
`;

export const codeRepoByIntegrationId = (integrationId) => `
    FIND CodeRepo 
    WITH _integrationInstanceId="${integrationId}"
`;
