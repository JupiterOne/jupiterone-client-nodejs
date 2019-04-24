const Cognito = require('amazon-cognito-identity-js-node');

const { ApolloClient } = require('apollo-client');
const { InMemoryCache } = require('apollo-cache-inmemory');
const { ApolloLink } = require('apollo-link');
const { RetryLink } = require('apollo-link-retry');
const { BatchHttpLink } = require('apollo-link-batch-http');
const gql = require('graphql-tag');
const fetch = require('node-fetch');

class JupiterOneClient {
  constructor (account, username, password, poolId, clientId, accessToken, dev = false) {
    this.account = account;
    this.username = username;
    this.password = password;
    this.poolId = poolId;
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.apiUrl = dev ? 'https://api.dev.jupiterone.io' : 'https://api.us.jupiterone.io';
    this.queryEndpoint = this.apiUrl + '/graphql';
    this.rulesEndpoint = this.apiUrl + '/rules/graphql';
  }

  async init (rules) {
    const token = this.accessToken ? this.accessToken : await this.authenticateUser();
    const uri = rules ? this.rulesEndpoint : this.queryEndpoint;
    const headers = {};
    headers['Authorization'] = `Bearer ${token}`;
    headers['LifeOmic-Account'] = this.account;
    const link = ApolloLink.from([
      new RetryLink(),
      new BatchHttpLink({ uri, headers, fetch })
    ]);
    const cache = new InMemoryCache();
    this.graphClient = new ApolloClient({ link, cache });
    return this;
  }

  async authenticateUser () {
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
        onSuccess: (result) => resolve(result),
        onFailure: (err) => reject(err)
      });
    });
  
    return result.getAccessToken().getJwtToken();
  }

  async queryV1 (j1ql) {
    let complete = false;
    let page = 0;
    let results = [];

    while (!complete) {
      const query = gql`
      {
        queryV1(query: "${j1ql} SKIP ${page * J1QL_SKIP_COUNT} LIMIT ${J1QL_LIMIT_COUNT}") {
          data
        }
      }`;
      page++;

      const res = await this.graphClient.query({query});
      if (res.errors) {
        throw new Error(`JupiterOne returned error(s) for query: '${j1ql}'`);
      }
      const { data } = res.data.queryV1;

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

  async queryGraphQL (query) {
    const res = await this.graphClient.query({ query });
    if (res.errors) {
      console.log(res.errors);
      throw new Error(`JupiterOne returned error(s) for query: '${query}'`);
    }
    return res;
  }

  async mutateAlertRule(rule, update) {
    const res = await this.graphClient.mutate({
      mutation: update ? UPDATE_ALERT_RULE : CREATE_ALERT_RULE,
      variables: {
        instance: rule.instance
      }
    });
    if (res.errors) {
      throw new Error(`JupiterOne returned error(s) mutating alert rule: '${rule}'`);
    }
    return update
      ? res.data.updateQuestionRuleInstance
      : res.data.createQuestionRuleInstance;
  }

  async createEntity (key, type, classLabels, properties) {
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
      throw new Error(`JupiterOne returned error(s) creating entity with key: '${key}'`);
    }
    return res.data.createEntity;
  }

  async updateEntity (id, properties) {
    let res;
    try {
      res = await this.graphClient.mutate({
        mutation: UPDATE_ENTITY,
        variables: {
          entityId: id,
          properties
        }
      });
      if (res.errors) {
        throw new Error(`JupiterOne returned error(s) updating entity with id: '${id}'`);
      }
    } catch (err) {
      console.log({err, id, properties, res}, 'trap');
      throw err;
    }
    return res.data.updateEntity;
  }

  async createRelationship (key, type, klass, fromId, toId) {
    const res = await this.graphClient.mutate({
      mutation: CREATE_RELATIONSHIP,
      variables: {
        relationshipKey: key,
        relationshipType: type,
        relationshipClass: klass,
        fromEntityId: fromId,
        toEntityId: toId
      }
    });
    if (res.errors) {
      throw new Error(`JupiterOne returned error(s) creating relationship with key: '${key}'`);
    }
    return res.data.createRelationship;
  }

  async upsertEntityRawData (entityId, name, contentType, data) {
    const operation = {
      mutation: UPSERT_ENTITY_RAW_DATA,
      variables: {
        source: 'api',
        entityId,
        rawData: [{
          name,
          contentType,
          data
        }]
      }
    };
    let res;
    try {
      res = await this.graphClient.mutate(operation);
      if (res.errors) {
        throw new Error(`JupiterOne returned error(s) upserting rawData for entity with id: '${entityId}'`);
      }
    } catch (exception) {
      throw new Error(`Unable to store raw template data for ${name}: ` + exception.message);
    }
    return res.data.upsertEntityRawData.status;
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
}`;

const UPDATE_ENTITY = gql`
  mutation UpdateEntity(
    $entityId: String!
    $properties: JSON
  ) {
    updateEntity(
      entityId: $entityId
      properties: $properties
    ) {
      entity {
        _id
      }
      vertex {
        id
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
  ) {
    createRelationship(
      relationshipKey: $relationshipKey
      relationshipType: $relationshipType
      relationshipClass: $relationshipClass
      fromEntityId: $fromEntityId
      toEntityId: $toEntityId
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

const CREATE_ALERT_RULE = gql`
  mutation CreateQuestionRuleInstance (
    $instance: CreateQuestionRuleInstanceInput!
  ) {
    createQuestionRuleInstance (
      instance: $instance
    ) {
      id
      name
    }
  }
`;

const UPDATE_ALERT_RULE = gql`
  mutation UpdateQuestionRuleInstance (
    $instance: UpdateQuestionRuleInstanceInput!
  ) {
    updateQuestionRuleInstance (
      instance: $instance
    ) {
      id
      name
      description
      version
      specVersion
      latest
      deleted
      pollingInterval
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

module.exports = JupiterOneClient;
