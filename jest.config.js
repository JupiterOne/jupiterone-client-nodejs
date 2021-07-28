const integrationConfig = require('@jupiterone/integration-sdk-dev-tools/config/jest');

// CRB: This is done to be consistent with tsconfig.json
// Without this, test/index.test.ts breaks
module.exports = {
  ...integrationConfig,
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@j1_config/(.*)': '<rootDir>/src/config/$1',
    '@j1_create_catalog/(.*)': '<rootDir>/src/j1-cicd-catalog-creator/$1',
    '@j1_utils/(.*)': '<rootDir>/src/utils/$1',
  },
};
