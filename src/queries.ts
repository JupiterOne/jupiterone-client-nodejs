import gql from 'graphql-tag';

export const CREATE_ENTITY = gql`
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

export const UPDATE_ENTITY = gql`
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

export const DELETE_ENTITY = gql`
  mutation DeleteEntity(
    $entityId: String!
    $timestamp: Long
    $hardDelete: Boolean
  ) {
    deleteEntityV2(
      entityId: $entityId
      timestamp: $timestamp
      hardDelete: $hardDelete
    ) {
      entity 
    }
  }
`;

export const CREATE_RELATIONSHIP = gql`
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

export const UPSERT_ENTITY_RAW_DATA = gql`
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

export const QUERY_V1 = gql`
  query QueryLanguageV1(
    $query: String!
    $variables: JSON
    $includeDeleted: Boolean
    $deferredResponse: DeferredResponseOption
    $deferredFormat: DeferredResponseFormat
  ) {
    queryV1(
      query: $query
      variables: $variables
      includeDeleted: $includeDeleted
      deferredResponse: $deferredResponse
      deferredFormat: $deferredFormat
    ) {
      type
      data
      url
    }
  }
`;

export const CREATE_ALERT_RULE = gql`
  mutation CreateQuestionRuleInstance(
    $instance: CreateQuestionRuleInstanceInput!
  ) {
    createQuestionRuleInstance(instance: $instance) {
      id
      name
    }
  }
`;

export const UPDATE_ALERT_RULE = gql`
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

export const CREATE_QUESTION = gql`
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

export const UPDATE_QUESTION = gql`
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

export const DELETE_QUESTION = gql`
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
