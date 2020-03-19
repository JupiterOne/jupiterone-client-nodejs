const Cognito = require("amazon-cognito-identity-js-node");

const { ApolloClient } = require("apollo-client");
const { InMemoryCache } = require("apollo-cache-inmemory");
const { ApolloLink } = require("apollo-link");
const { RetryLink } = require("apollo-link-retry");
const { BatchHttpLink } = require("apollo-link-batch-http");
const gql = require("graphql-tag");
const fetch = require("node-fetch").default;

const J1_USER_POOL_ID_PROD = "us-east-2_9fnMVHuxD";
const J1_CLIENT_ID_PROD = "1hcv141pqth5f49df7o28ngq1u";
const REQUEST_TIMEOUT_IN_MS = 1000 * 60 * 5; // 5 minute timeout.

const JobStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
};

function sleep(ms) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, ms);
  });
}

class JupiterOneClient {
  constructor({
    account,
    username,
    password,
    poolId = J1_USER_POOL_ID_PROD,
    clientId = J1_CLIENT_ID_PROD,
    accessToken,
    dev = false,
    useRulesEndpoint = false
  }) {
    this.account = account;
    this.username = username;
    this.password = password;
    this.poolId = poolId;
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.useRulesEndpoint = useRulesEndpoint;

    this.apiUrl = dev
      ? "https://api.dev.jupiterone.io"
      : "https://api.us.jupiterone.io";
    this.queryEndpoint = this.apiUrl + "/graphql";
    this.rulesEndpoint = this.apiUrl + "/rules/graphql";
  }

  async init() {
    const token = this.accessToken
      ? this.accessToken
      : await this.authenticateUser();
    this.headers = {
      Authorization: `Bearer ${token}`,
      "LifeOmic-Account": this.account
    };

    const uri = this.useRulesEndpoint ? this.rulesEndpoint : this.queryEndpoint;
    const link = ApolloLink.from([
      new RetryLink({
        delay: {
          initial: 2000,
          max: 5000,
          jitter: true
        }
      }),
      new BatchHttpLink({ uri, headers: this.headers, fetch })
    ]);
    const cache = new InMemoryCache();
    this.graphClient = new ApolloClient({ link, cache });

    return this;
  }

  async authenticateUser() {
    const authenticationDetails = new Cognito.AuthenticationDetails({
      Username: this.username,
      Password: this.password
    });
    const Pool = new Cognito.CognitoUserPool({
      UserPoolId: this.poolId,
      ClientId: this.clientId
    });
    const User = new Cognito.CognitoUser({ Username: this.username, Pool });

    const result = await new Promise((resolve, reject) => {
      User.authenticateUser(authenticationDetails, {
        onSuccess: result => resolve(result),
        onFailure: err => reject(err)
      });
    });

    return result.getAccessToken().getJwtToken();
  }

  async queryV1(j1ql) {
    let complete = false;
    let page = 0;
    let results = [];

    while (!complete) {
      const query = getQueryV1Gpl(j1ql, page);
      page++;

      const res = await this.graphClient.query({ query });
      if (res.errors) {
        throw new Error(`JupiterOne returned error(s) for query: '${j1ql}'`);
      }

      const deferredUrl = res.data.queryV1.url;
      let status = JobStatus.IN_PROGRESS;
      let statusFile;
      let startTimeInMs = Date.now();
      do {
        await sleep(200);
        statusFile = await fetch(deferredUrl).then(res => res.json());
        status = statusFile.status;
        if (Date.now() - startTimeInMs > REQUEST_TIMEOUT_IN_MS) {
          throw new Error(
            `Exceeded request timeout of ${REQUEST_TIMEOUT_IN_MS /
              1000} seconds.`
          );
        }
      } while (status === JobStatus.IN_PROGRESS);

      let result;
      if (status === JobStatus.COMPLETED) {
        result = await fetch(statusFile.url).then(res => res.json());
      } else {
        // JobStatus.FAILED
        throw new Error(
          statusFile.error || "Job failed without an error message."
        );
      }

      const { data } = result;

      // data will assume tree shape if you specify 'return tree' in J1QL
      const isTree = data.vertices && data.edges;

      if (isTree) {
        complete = true;
        results = data;
      } else {
        // data is array-shaped, possibly paginated
        if (data.length < J1QL_SKIP_COUNT) {
          complete = true;
        }
        results = results.concat(data);
      }
    }
    return results;
  }

  async queryGraphQL(query) {
    const res = await this.graphClient.query({ query });
    if (res.errors) {
      console.log(res.errors);
      throw new Error(`JupiterOne returned error(s) for query: '${query}'`);
    }
    return res;
  }

  async ingestEntities(integrationInstanceId, entities) {
    return fetch(this.apiUrl + "/integrations/ingest", {
      method: "POST",
      body: JSON.stringify({ integrationInstanceId, entities }),
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      }
    }).then(res => res.json());
  }

  async ingestCommitRange(integrationInstanceId, commitRange) {
    return fetch(this.apiUrl + "/integrations/action", {
      method: "POST",
      body: JSON.stringify({
        integrationInstanceId,
        action: { name: "INGEST", commitRange }
      }),
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      timeout: 10000
    }).then(res => res.json());
  }

  async mutateAlertRule(rule, update) {
    const res = await this.graphClient.mutate({
      mutation: update ? UPDATE_ALERT_RULE : CREATE_ALERT_RULE,
      variables: {
        instance: rule.instance
      }
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) mutating alert rule: '${rule}'`
      );
    }
    return update
      ? res.data.updateQuestionRuleInstance
      : res.data.createQuestionRuleInstance;
  }

  async createEntity(key, type, classLabels, properties) {
    const res = await this.graphClient.mutate({
      mutation: CREATE_ENTITY,
      variables: {
        entityKey: key,
        entityType: type,
        entityClass: classLabels,
        properties
      }
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) creating entity with key: '${key}'`
      );
    }
    return res.data.createEntity;
  }

  async updateEntity(entityId, properties) {
    let res;
    try {
      res = await this.graphClient.mutate({
        mutation: UPDATE_ENTITY,
        variables: {
          entityId,
          properties
        }
      });
      if (res.errors) {
        throw new Error(
          `JupiterOne returned error(s) updating entity with id: '${entityId}'`
        );
      }
    } catch (err) {
      console.log(
        { err: err.stack || err.toString(), entityId, properties },
        "error updating entity"
      );
      throw err;
    }
    return res.data.updateEntity;
  }

  async deleteEntity(entityId, hardDelete) {
    let res;
    try {
      res = await this.graphClient.mutate({
        mutation: DELETE_ENTITY,
        variables: { entityId, hardDelete }
      });
      if (res.errors) {
        throw new Error(
          `JupiterOne returned error(s) deleting entity with id: '${entityId}'`
        );
      }
    } catch (err) {
      console.log({ err, entityId, res }, "error deleting entity");
      throw err;
    }
    return res.data.deleteEntity;
  }

  async createRelationship(key, type, klass, fromId, toId, properties) {
    const res = await this.graphClient.mutate({
      mutation: CREATE_RELATIONSHIP,
      variables: {
        relationshipKey: key,
        relationshipType: type,
        relationshipClass: klass,
        fromEntityId: fromId,
        toEntityId: toId,
        properties
      }
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) creating relationship with key: '${key}'`
      );
    }
    return res.data.createRelationship;
  }

  async upsertEntityRawData(entityId, name, contentType, data) {
    const operation = {
      mutation: UPSERT_ENTITY_RAW_DATA,
      variables: {
        source: "api",
        entityId,
        rawData: [
          {
            name,
            contentType,
            data
          }
        ]
      }
    };
    let res;
    try {
      res = await this.graphClient.mutate(operation);
      if (res.errors) {
        throw new Error(
          `JupiterOne returned error(s) upserting rawData for entity with id: '${entityId}'`
        );
      }
    } catch (exception) {
      throw new Error(
        `Unable to store raw template data for ${name}: ` + exception.message
      );
    }
    return res.data.upsertEntityRawData.status;
  }

  async createQuestion(question) {
    const res = await this.graphClient.mutate({
      mutation: CREATE_QUESTION,
      variables: { question }
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) creating question: '${question}'`
      );
    }
    return res.data.createQuestion;
  }

  async updateQuestion(question) {
    const { id, ...update } = question;
    const res = await this.graphClient.mutate({
      mutation: UPDATE_QUESTION,
      variables: {
        id,
        update
      }
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) updating question: '${question}'`
      );
    }
    return res.data.updateQuestion;
  }

  async deleteQuestion(questionId) {
    const res = await this.graphClient.mutate({
      mutation: DELETE_QUESTION,
      variables: { id: questionId }
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) updating question with ID: '${questionId}'`
      );
    }
    return res.data.deleteQuestion;
  }
}

const J1QL_SKIP_COUNT = 250;
const J1QL_LIMIT_COUNT = 250;

const CREATE_ENTITY = gql`
  mutation CreateEntity(
    $entityKey: String!
    $entityType: String!
    $entityClass: [String!]!
    $properties: JSON
  ) {
    createEntity(
      entityKey: $entityKey
      entityType: $entityType
      entityClass: $entityClass
      properties: $properties
    ) {
      entity {
        _id
      }
      vertex {
        id
        entity {
          _id
        }
      }
    }
  }
`;

const UPDATE_ENTITY = gql`
  mutation UpdateEntity($entityId: String!, $properties: JSON) {
    updateEntity(entityId: $entityId, properties: $properties) {
      entity {
        _id
      }
      vertex {
        id
      }
    }
  }
`;

const DELETE_ENTITY = gql`
  mutation DeleteEntity(
    $entityId: String!
    $timestamp: Long
    $hardDelete: Boolean
  ) {
    deleteEntity(
      entityId: $entityId
      timestamp: $timestamp
      hardDelete: $hardDelete
    ) {
      entity {
        _id
        _deleted
        _endOn
      }
      vertex {
        id
        properties
      }
    }
  }
`;

const CREATE_RELATIONSHIP = gql`
  mutation CreateRelationship(
    $relationshipKey: String!
    $relationshipType: String!
    $relationshipClass: String!
    $fromEntityId: String!
    $toEntityId: String!
    $properties: JSON
  ) {
    createRelationship(
      relationshipKey: $relationshipKey
      relationshipType: $relationshipType
      relationshipClass: $relationshipClass
      fromEntityId: $fromEntityId
      toEntityId: $toEntityId
      properties: $properties
    ) {
      relationship {
        _id
      }
      edge {
        id
        toVertexId
        fromVertexId
        relationship {
          _id
        }
        properties
      }
    }
  }
`;

const UPSERT_ENTITY_RAW_DATA = gql`
  mutation UpsertEntityRawData(
    $entityId: String!
    $source: String!
    $rawData: [JSON!]!
  ) {
    upsertEntityRawData(
      entityId: $entityId
      source: $source
      rawData: $rawData
    ) {
      status
    }
  }
`;

function getQueryV1Gpl(j1ql, page) {
  return gql`
  {
    queryV1(
      query: "${j1ql} SKIP ${page * J1QL_SKIP_COUNT} LIMIT ${J1QL_LIMIT_COUNT}",
      deferredResponse: FORCE
    ) {
      type
      url
      data
    }
  }`;
}

const CREATE_ALERT_RULE = gql`
  mutation CreateQuestionRuleInstance(
    $instance: CreateQuestionRuleInstanceInput!
  ) {
    createQuestionRuleInstance(instance: $instance) {
      id
      name
    }
  }
`;

const UPDATE_ALERT_RULE = gql`
  mutation UpdateQuestionRuleInstance(
    $instance: UpdateQuestionRuleInstanceInput!
  ) {
    updateQuestionRuleInstance(instance: $instance) {
      id
      name
      description
      version
      specVersion
      latest
      deleted
      pollingInterval
      templates
      question {
        queries {
          name
          query
          version
        }
      }
      operations {
        when
        actions
      }
      outputs
    }
  }
`;

const CREATE_QUESTION = gql`
  mutation CreateQuestion($question: CreateQuestionInput!) {
    createQuestion(question: $question) {
      id
      title
      description
      queries {
        query
        version
      }
      variables {
        name
        required
        default
      }
      compliance {
        standard
        requirements
      }
      tags
      accountId
      integrationDefinitionId
    }
  }
`;

const UPDATE_QUESTION = gql`
  mutation UpdateQuestion($id: ID!, $update: QuestionUpdate!) {
    updateQuestion(id: $id, update: $update) {
      id
      title
      description
      queries {
        query
        version
      }
      variables {
        name
        required
        default
      }
      compliance {
        standard
        requirements
      }
      tags
      accountId
      integrationDefinitionId
    }
  }
`;

const DELETE_QUESTION = gql`
  mutation DeleteQuestion($id: ID!) {
    deleteQuestion(id: $id) {
      id
      title
      description
      queries {
        query
        version
      }
      variables {
        name
        required
        default
      }
      compliance {
        standard
        requirements
      }
      tags
      accountId
      integrationDefinitionId
    }
  }
`;

module.exports = JupiterOneClient;
