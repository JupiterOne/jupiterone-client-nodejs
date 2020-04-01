/**
 * Standards
 */

exports.convertComplianceStandardToEntity = (standard) => ({
  _key: `jupiterone:compliance:${standard.id}`,
  _type: `jupiterone_compliance_${standard.specDetails.type}`,
  _class: `Framework`,
  id: standard.id,
  displayName: standard.name,
  createdOn: standard.createTimestamp,
  updatedOn: standard.lastUpdatedTimestamp,
  standard: standard.standard,
  webLink: standard.specDetails.webLink,
  version: standard.specDetails.version,
});

/**
 * Requirements
 */

exports.convertComplianceRequirementToEntity = (
  standardEntity,
  requirement,
) => ({
  _key: `jupiterone:compliance:${standardEntity.id}:${requirement.ref}`,
  _type: 'jupiterone_compliance_requirement',
  _class: `Requirement`,
  ref: requirement.ref,
  summary: requirement.summary,
  applicable: requirement.applicable,
  status: requirement.status,
  control: requirement.control,
  standardId: standardEntity.id,
  standard: standardEntity.standard,
});

exports.buildComplianceRequirementRelationship = (
  standardEntity,
  requirementEntity,
) => ({
  _key: `${standardEntity._key}:${requirementEntity._key}`,
  _type: `${standardEntity._type}_has_${requirementEntity._type}`,
  _class: 'HAS',
});

/**
 * Controls
 */

exports.convertComplianceControlToEntity = (standardEntity, control) => ({
  _key: `jupiterone:compliance:${standardEntity.id}:${control.ref}`,
  _type: 'jupiterone_compliance_control',
  _class: `Control`,
  ref: control.ref,
  summary: control.summary,
  applicable: control.applicable,
  status: control.status,
  requirement: control.requirement,
  standardId: standardEntity.id,
  standard: standardEntity.standard,
});

exports.buildComplianceControlRelationship = (
  standardEntity,
  controlEntity,
) => ({
  _key: `${standardEntity._key}:${controlEntity._key}`,
  _type: `${standardEntity._type}_has_${controlEntity._type}`,
  _class: 'HAS',
});

/**
 * Evidence
 */

exports.convertEvidenceToEntity = (evidence) => ({
  _key: `jupiterone:compliance:evidence:${evidence.id}`,
  _type: `jupiterone_compliance_evidence_${evidence.type.toLowerCase()}`,
  _class: 'Document', // can't think of anything better
  filename: evidence.uploadDetails ? evidence.uploadDetails.filename : null,
  webLink: evidence.linkUrl,
  createdOn: evidence.createTimestamp,
  updatedOn: evidence.lastUpdatedTimestamp,
});

exports.buildComplianceEvidenceRelationship = (
  requirementEntity,
  evidenceEntity,
) => ({
  _key: `${requirementEntity._key}:${evidenceEntity._key}`,
  _type: `${requirementEntity._type}_has_${evidenceEntity._type}`,
  _class: 'Evaluates',
  _fromEntityKey: requirementEntity._key,
  _toEntityKey: evidenceEntity._key,
});

/**
 * Notes
 */

exports.convertNoteToEntity = (note) => ({
  _key: `jupiterone:compliance:evidence:${note.id}`,
  _type: `jupiterone_compliance_note`,
  _class: 'Document', // can't think of anything better
  body: note.body,
  createdOn: note.createTimestamp,
  updatedOn: note.lastUpdatedTimestamp,
});

exports.buildComplianceNoteRelationship = (requirementEntity, noteEntity) => ({
  _key: `${requirementEntity._key}:${noteEntity._key}`,
  _type: `${requirementEntity._type}_has_${noteEntity._type}`,
  _class: 'Has',
  _fromEntityKey: requirementEntity._key,
  _toEntityKey: noteEntity._key,
});
