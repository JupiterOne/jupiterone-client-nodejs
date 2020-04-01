import { v4 as uuid } from 'uuid';
import pMap from 'p-map';
import {
  IntegrationLogger,
  IntegrationJob,
  IntegrationInstance,
  IntegrationDefinition,
} from './types';

import { createLogger } from 'bunyan';

import { GraphDataClient, createGraphDataClient } from '../clients';

interface CollectionPhase<T> {
  name: string;
  work: CollectionWorkFunction<T> | CollectionWorkFunction<T>[];
}

type CollectionWorkFunction<T> = (
  context: CollectionWorkContext<T>,
) => void | Promise<void>;

type CollectionWorkContext<T> = JupiterOneIntegrationContext<T> & {
  graphDataClient: GraphDataClient;
};

type PrepareFunc<T> = (
  context: Omit<JupiterOneIntegrationContext<T>, 'provider'>,
) => JupiterOneIntegrationContext<T>;

interface JupiterOneIntegrationContext<T> {
  definition: IntegrationDefinition;
  instance: IntegrationInstance;
  job: IntegrationJob;
  logger: IntegrationLogger;
  provider: T;
}

export interface JupiterOneIntegrationInput<T> {
  prepare?: PrepareFunc<T>;
  phases: CollectionPhase<T>[];
  options?: JupiterOneIntegrationOptions;
}

interface JupiterOneIntegrationOptions {
  local?: boolean;
}

/**
 * NOTE: consider making it so that the
 * integration definitions must be passed
 * into the constructor
 */
export class JupiterOneIntegration<Provider = any> {
  readonly prepare: PrepareFunc<Provider>;
  readonly phases: CollectionPhase<Provider>[];
  readonly options: JupiterOneIntegrationOptions;

  constructor({
    prepare,
    phases,
    options = { local: true },
  }: JupiterOneIntegrationInput<Provider>) {
    this.prepare = prepare;
    this.phases = phases;
    this.options = options;
  }

  /**
   * Runs all of the phases
   */
  async run(accountId: string, integrationInstanceId: string) {
    let context = await this.createContext(accountId, integrationInstanceId);
    context.logger.info('Executing all phases');
    return executeAllPhases(context, this.phases, this.options);
  }

  /**
   * build context for an integration run
   */
  async createContext(
    accountId: string,
    integrationInstanceId: string,
  ): Promise<JupiterOneIntegrationContext<Provider>> {
    const instance = fetchIntegrationInstance(accountId, integrationInstanceId);
    const { integrationDefinitionId } = instance;
    const definition = fetchIntegrationDefinition(
      instance.integrationDefinitionId,
    );
    const job = createJob(definition.id);

    let context: Omit<JupiterOneIntegrationContext<Provider>, 'provider'> = {
      job,
      instance,
      definition,
      logger: createLogger({
        name: 'jupiterone',
        jobId: job.id,
        integrationInstanceId,
        integrationDefinitionId,
      }),
    };

    if (this.prepare) {
      context.logger.info('Executing prepare step');
      context = await this.prepare(context);
    }

    return context as JupiterOneIntegrationContext<Provider>;
  }
}

async function executeAllPhases<T>(
  context: JupiterOneIntegrationContext<T>,
  phases: CollectionPhase<T>[],
  options: JupiterOneIntegrationOptions,
) {
  return pMap(phases, (phase) => executePhase<T>(context, phase, options), {
    concurrency: 1,
  });
}

interface PhaseResult {
  success: boolean;
}
async function executePhase<T>(
  context: JupiterOneIntegrationContext<T>,
  phase: CollectionPhase<T>,
  options: JupiterOneIntegrationOptions,
): Promise<PhaseResult> {
  const { work } = phase;
  const workToPerform = Array.isArray(work) ? work : [work];

  const result: PhaseResult = {
    success: true,
  };

  const logger = context.logger.child({
    phase: phase.name,
  });

  const phaseContext = { ...context, logger };

  try {
    await pMap(
      workToPerform,
      (work) => executePhaseWorkFunction(phaseContext, work, options),
      { concurrency: 2 },
    );
  } catch (err) {
    context.logger.error({ err }, 'Unexpected error occurred');
    throw err;
  }

  return result;
}

async function executePhaseWorkFunction<T>(
  context: JupiterOneIntegrationContext<T>,
  workFn: CollectionWorkFunction<T>,
  options: JupiterOneIntegrationOptions,
) {
  const graphDataClient = createGraphDataClient(uuid(), options.local);
  const workContext: CollectionWorkContext<T> = { ...context, graphDataClient };
  await workFn(workContext);

  if (graphDataClient.hasDataToFlush()) {
    await graphDataClient.flush();
  }
}

/**
 * mocking all of this out
 */
function fetchIntegrationInstance(
  accountId: string,
  id: string,
): IntegrationInstance {
  return {
    id,
    name: uuid(),
    accountId,
    integrationDefinitionId: uuid(),
    config: {},
  };
}

function fetchIntegrationDefinition(id: string): IntegrationDefinition {
  return {
    id,
    name: uuid(),
    type: uuid(),
    title: uuid(),
    integrationType: uuid(),
    integrationClass: [],
  };
}

function createJob(integrationInstanceId: string): IntegrationJob {
  return {
    id: uuid(),
    integrationInstanceId,
    createDate: Date.now(),
    errorsOccurred: false,
  };
}
