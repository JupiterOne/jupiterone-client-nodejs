import { createCommand } from 'commander';

export const buildIntegrationCommand = () =>
  createCommand('integration')
    .addCommand(buildInitCommand())
    .addCommand(buildPlanCommand())
    .addCommand(buildConfigCommand())
    .addCommand(buildCollectCommand())
    .addCommand(buildValidateCommand())
    .addCommand(buildSyncCommand())
    .addCommand(buildRunCommand());

function buildInitCommand() {
  return createCommand('init');
}

function buildPlanCommand() {
  return createCommand('plan');
}

function buildConfigCommand() {
  return createCommand('config');
}

function buildCollectCommand() {
  return createCommand('collect').action(async () => {
    const { integration } = require(`${process.cwd()}/index`);
    await integration.run('j1dev', 'test-integration');
  });
}

function buildValidateCommand() {
  return createCommand('validate');
}

function buildSyncCommand() {
  return createCommand('sync');
}

function buildRunCommand() {
  return createCommand('run');
}
