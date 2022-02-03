const integrationConfig = require('@jupiterone/integration-sdk-dev-tools/config/jest');

module.exports = {
  ...integrationConfig,
  preset: 'ts-jest',
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
