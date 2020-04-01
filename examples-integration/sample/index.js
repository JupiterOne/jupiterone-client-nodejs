/**
 * JupiterOne compliance integration
 */

require('dotenv').config();

const pMap = require('p-map');

const JupiterOneClient = require('../../dist');

const { createIntegration } = require('../../dist/integration/sdk');

const {
  collectComplianceStandards,
  collectRequirementsAndControlsForStandard,
  collectEvidenceForRequirement,
  collectNotesForRequirement,
} = require('./client');

const {
  convertComplianceStandardToEntity,

  convertComplianceRequirementToEntity,
  buildComplianceRequirementRelationship,

  convertComplianceControlToEntity,
  buildComplianceControlRelationship,

  convertNoteToEntity,
  buildComplianceNoteRelationship,

  convertEvidenceToEntity,
  buildComplianceEvidenceRelationship,
} = require('./converters');

exports.integration = createIntegration({
  async prepare(context) {
    const provider = new JupiterOneClient({
      dev: true,
      account: 'j1dev',
      accessToken: process.env.API_KEY,
    });

    await provider.init();

    return { ...context, provider };
  },
  phases: [
    {
      name: 'Collect standards, sections, and requirements',
      async work({ graphDataClient, provider, logger }) {
        logger.info('collecting standards');
        const standards = await collectComplianceStandards(provider);

        const standardEntities = standards.map((standard) =>
          convertComplianceStandardToEntity(standard),
        );

        graphDataClient.addEntities(standardEntities);

        await pMap(
          standardEntities,
          async (standardEntity) => {
            logger.info(
              { key: standardEntity._key },
              'collecting requirements and controls',
            );
            const {
              requirements,
              controls,
            } = await collectRequirementsAndControlsForStandard(
              provider,
              standardEntity.id,
            );

            const requirementEntities = requirements.map((r) =>
              convertComplianceRequirementToEntity(standardEntity, r),
            );

            graphDataClient.addEntities(requirementEntities);
            graphDataClient.addRelationships(
              requirementEntities.map((re) =>
                buildComplianceRequirementRelationship(standardEntity, re),
              ),
            );

            const controlEntities = controls.map((c) =>
              convertComplianceControlToEntity(standardEntity, c),
            );

            graphDataClient.addEntities(controlEntities);

            graphDataClient.addRelationships(
              controlEntities.map((ce) =>
                buildComplianceControlRelationship(standardEntity, ce),
              ),
            );
          },
          { concurrency: 2 },
        );
      },
    },
    {
      name: 'Collect notes and evidence for requirements',
      work: [
        'jupiterone_compliance_control',
        'jupiterone_compliance_requirement',
      ].map((type) => async ({ logger, provider, graphDataClient }) => {
        const requirementEntities = await graphDataClient.listEntitiesByType(
          type,
        );

        await pMap(
          requirementEntities,
          async (requirementEntity) => {
            logger.info(
              { key: requirementEntity._key, type },
              'collecting evidences and notes',
            );
            const [notes, evidences] = await Promise.all([
              collectNotesForRequirement(provider, requirementEntity),
              collectEvidenceForRequirement(provider, requirementEntity),
            ]);

            const noteEntities = notes.map(convertNoteToEntity);
            graphDataClient.addEntities(noteEntities);
            graphDataClient.addRelationships(
              noteEntities.map((noteEntity) =>
                buildComplianceNoteRelationship(requirementEntity, noteEntity),
              ),
            );
            const evidenceEntities = evidences.map(convertEvidenceToEntity);
            graphDataClient.addEntities(evidenceEntities);
            graphDataClient.addRelationships(
              evidenceEntities.map((evidenceEntity) =>
                buildComplianceEvidenceRelationship(
                  requirementEntity,
                  evidenceEntity,
                ),
              ),
            );

            if (graphDataClient.hasDataToFlush()) {
              await graphDataClient.flush();
            }
          },
          { concurrency: 2 },
        );
      }),
    },
  ],
});
