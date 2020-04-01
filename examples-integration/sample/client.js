const flatten = require('lodash/flatten');
const gql = require('graphql-tag');

exports.collectComplianceStandards = async (provider) => {
  const query = gql`
    query standards($cursor: String) {
      complianceStandards(size: 1, cursor: $cursor) {
        complianceStandards {
          id
          name
          standard
          specDetails {
            version
            type
            webLink
          }
          createTimestamp
          lastUpdatedTimestamp
        }
        pageInfo {
          endCursor
        }
      }
    }
  `;

  let endCursor;
  let standards = [];

  do {
    const result = await provider.graphClient.query({
      query,
      variables: {
        cursor: endCursor,
      },
    });
    if (result.errors) {
      throw new Error('Errors returned while collecting complianceStandards');
    }
    standards = standards.concat(
      result.data.complianceStandards.complianceStandards,
    );
    endCursor = result.data.complianceStandards.pageInfo.endCursor;
  } while (endCursor);

  return standards;
};

exports.collectRequirementsAndControlsForStandard = async (provider, id) => {
  const query = gql`
    query standards($id: ID!) {
      complianceStandard(id: $id) {
        id
        sections {
          title
          description
          requirements {
            ref
            title
            summary
            applicable
            appliesIf
            status
            hasEvidence
            procedures {
              id
            }
            control
          }
        }
        domains {
          title
          description
          controls {
            ref
            title
            summary
            applicable
            appliesIf
            status
            hasEvidence
            procedures {
              id
            }
            requirement
          }
        }
      }
    }
  `;

  const result = await provider.graphClient.query({
    query,
    variables: {
      id,
    },
  });
  if (result.errors) {
    throw new Error('Errors returned while collecting complianceStandards');
  }

  const { sections, domains } = result.data.complianceStandard;

  return {
    requirements: flatten(
      sections.map((section) => section.requirements).filter((r) => r !== null),
    ),

    controls: flatten(
      domains.map((domain) => domain.controls).filter((d) => d !== null),
    ),
  };
};

exports.collectEvidenceForRequirement = async (provider, requirementEntity) => {
  // needs fragment matcher
  /*

  ... on ComplianceUserEvidenceWithExternalLink {
    linkUrl
  }
  ... on ComplianceUserEvidenceWithExternalUpload {
    uploadId
    uploadDetails {
      filename
    }
  }
  */
  const query = gql`
    query evidences($requirementId: String!, $cursor: String) {
      complianceUserEvidences(requirementId: $requirementId, cursor: $cursor) {
        evidences {
          id
          name
          type
          description
          accountId
          createTimestamp
          lastUpdatedTimestamp
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  let endCursor;
  let evidences = [];

  do {
    const result = await provider.graphClient.query({
      query,
      variables: {
        requirementId: buildRequirementId(requirementEntity),
        cursor: endCursor,
      },
    });

    if (result.errors) {
      console.error(result.errors);
      throw new Error('Errors returned while collecting evidences');
    }

    evidences = evidences.concat(result.data.complianceUserEvidences.evidences);
    endCursor = result.data.complianceUserEvidences.pageInfo.endCursor;
  } while (endCursor);

  return evidences;
};

exports.collectNotesForRequirement = async (provider, requirementEntity) => {
  const query = gql`
    query notes($requirementId: String!, $size: Int, $cursor: String) {
      listComplianceNotesForRequirement(
        requirementId: $requirementId
        size: $size
        cursor: $cursor
      ) {
        notes {
          id
          accountId
          userId
          email
          requirementId
          body
          createTimestamp
          lastUpdatedTimestamp
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  let endCursor;
  let notes = [];

  do {
    const result = await provider.graphClient.query({
      query,
      variables: {
        requirementId: buildRequirementId(requirementEntity),
        cursor: endCursor,
      },
    });

    if (result.errors) {
      throw new Error('Errors returned while collecting evidences');
    }

    notes = notes.concat(result.data.listComplianceNotesForRequirement.notes);
    endCursor =
      result.data.listComplianceNotesForRequirement.pageInfo.endCursor;
  } while (endCursor);

  return notes;
};

function buildRequirementId(requirementEntity) {
  return `${requirementEntity.standard}-${requirementEntity.standardId}-${requirementEntity.ref}`;
}
