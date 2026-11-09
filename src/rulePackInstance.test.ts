import { defaultAlertSettings } from '@jupiterone/jupiterone-alert-rules';
import { buildRulePackInstance, RulePackRule } from './rulePackInstance';

const queries = [
  { name: 'query0', version: 'v1', query: 'FIND NHI WITH isAi = true' },
];

describe('buildRulePackInstance', () => {
  test('forwards a rule pack rule labels to the created instance', () => {
    const rule: RulePackRule = {
      name: 'Unsanctioned AI apps',
      alertLevel: 'HIGH',
      queries,
      labels: [
        { labelName: 'product', labelValue: 'ai-asm' },
        { labelName: 'category', labelValue: 'shadow-ai' },
      ],
    };

    expect(buildRulePackInstance(rule, defaultAlertSettings).labels).toEqual([
      { labelName: 'product', labelValue: 'ai-asm' },
      { labelName: 'category', labelValue: 'shadow-ai' },
    ]);
  });

  test('sends no labels key for a rule without labels, as before', () => {
    const rule: RulePackRule = { name: 'No labels', queries };
    expect(
      buildRulePackInstance(rule, defaultAlertSettings),
    ).not.toHaveProperty('labels');
  });

  test('sends no labels key for a rule with an empty labels list', () => {
    const rule: RulePackRule = { name: 'Empty labels', queries, labels: [] };
    expect(
      buildRulePackInstance(rule, defaultAlertSettings),
    ).not.toHaveProperty('labels');
  });

  test("uses the rule's own alert level", () => {
    const rule: RulePackRule = {
      name: 'Medium rule',
      alertLevel: 'MEDIUM',
      queries,
    };
    const instance = buildRulePackInstance(rule, defaultAlertSettings) as {
      operations: Array<{ actions: Array<{ targetValue?: string }> }>;
    };
    expect(instance.operations[0].actions[0].targetValue).toBe('MEDIUM');
  });

  test('falls back to the default operations when the rule has no alert level', () => {
    const rule: RulePackRule = { name: 'Default level', queries };
    expect(buildRulePackInstance(rule, defaultAlertSettings).operations).toBe(
      defaultAlertSettings.operations,
    );
  });

  test('keeps the name, description and queries', () => {
    const rule: RulePackRule = {
      name: 'Named',
      description: 'Why it matters',
      queries,
    };
    expect(buildRulePackInstance(rule, defaultAlertSettings)).toMatchObject({
      name: 'Named',
      description: 'Why it matters',
      question: { queries },
    });
  });
});
