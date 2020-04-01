export interface IntegrationInstance {
  /**
   * Unique identifier for the activated integration instance.
   */
  id: string;

  /**
   * A short friendly name for the integration instance that is provided by
   * end-user.
   */
  name: string;

  /**
   * `accountId` identifies the tenant/account holder that activated the
   * integration.
   */
  accountId: string;

  /**
   * The `integrationDefinitionId` identifies a integration definition.
   */
  integrationDefinitionId: string;

  /**
   * Optional description of the integration instance.
   */
  description?: string;

  /**
   * The unencrypted user configuration of the integration instance.
   *
   * Each integration specifies the properties it requires a user provide when
   * configuring an instance of the integration. It is up to the UI to validate
   * input at configuration time, and the integration should also validate the
   * configuration upon invocation and provide useful configuration error
   * messages.
   *
   * This property is populated at runtime by decrypting `configEncrypted`. The
   * clear text value is never stored unencrypted at rest.
   */
  config?: any;

  /**
   * Ternary marker for offsite flow state.
   *
   * Integrations supporting an offsite installation flow will set this value to
   * `false` when the instance is created, indicating that the configuration is
   * incomplete. The value will become `true` when the offsite flow has
   * completed successfully.
   *
   * Integrations that do/will not support an offsite installation flow will
   * leave this value `undefined`.
   */
  offsiteComplete?: boolean;
}

/**
 * A record representing an integration, used to make the system aware of an
 * integration that users may install into their account.
 */
export interface IntegrationDefinition {
  /**
   * A unique identifier (uuid) associated with the integration. All
   * `IntegrationInstance` records must be associated with an
   * `IntegrationDefinition` by this value.
   */
  id: string;

  /**
   * A unique name associated with the integration, used for ...
   */
  name: string;

  /**
   * Identifies the integration implementation type, such as `"managed_lambda"`.
   * See also `integrationType`.
   */
  type: string;

  /**
   * A unique title associated with the integration, used in presenting the
   * integration to users.
   *
   * This value is also used in UI code to associate input validation meta data
   * with the definition! WARNING: Changing this value currently requires
   * changing that UI code 😳
   */
  title: string;

  /**
   * The type of the integration, transferred to entity data created by the
   * integration.
   */
  integrationType: string;

  /**
   * The class of the integration, transferred to entity data created by the
   * integration.
   */
  integrationClass: string[];

  /**
   * The fields specific to this integration that will be included in the
   * integration instance configuration UI and in the instance's encrypted
   * config in DynamoDB.
   */
  // configFields: ConfigField[];
}

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction {
  (options: object): IntegrationLogger;
}

export interface IntegrationLogger {
  trace: LogFunction;
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  fatal: LogFunction;
  child: ChildLogFunction;
}

export interface IntegrationJob {
  /**
   * The identifier of the job, required when sending events and closing the
   * job.
   */
  id: string;

  /**
   * The `IntegrationInstance.id`, required when sending events and closing the
   * job.
   */
  integrationInstanceId: string;

  /**
   * The timestamp when the integration service creates a job at the request of
   * an integration.
   */
  createDate: number;

  // status?: IntegrationJobStatus;

  endDate?: number;

  /**
   * The integration service will mark `errorsOccurred: true` when a job event
   * `name` value matches a pattern (including the word `'error'`).
   */
  errorsOccurred: boolean;
}
