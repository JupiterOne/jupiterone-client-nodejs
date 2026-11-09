/**
 * Builds the question rule instance the CLI creates for one rule from a rule pack
 * (`@jupiterone/jupiterone-alert-rules`). Kept apart from `j1cli.ts`, which runs
 * `main()` on import, so the mapping can be tested.
 */
export interface RulePackRuleLabel {
  labelName: string;
  labelValue: string | number | boolean;
}

export interface RulePackRule {
  name: string;
  description?: string;
  alertLevel?: string;
  queries: unknown[];
  labels?: RulePackRuleLabel[];
}

export interface RulePackDefaultSettings {
  operations: Array<{ when: unknown; actions: unknown[] }>;
  [key: string]: unknown;
}

export function buildRulePackInstance(
  rule: RulePackRule,
  defaultSettings: RulePackDefaultSettings,
): Record<string, unknown> {
  return {
    ...defaultSettings,
    name: rule.name,
    description: rule.description,
    question: {
      queries: rule.queries,
    },
    operations: rule.alertLevel
      ? [
          {
            when: defaultSettings.operations[0].when,
            actions: [
              {
                type: 'SET_PROPERTY',
                targetProperty: 'alertLevel',
                targetValue: rule.alertLevel,
              },
              {
                type: 'CREATE_ALERT',
              },
            ],
          },
        ]
      : defaultSettings.operations,
    // The create mutation accepts labels ([RuleInstanceLabelInput!]); rule packs use them to
    // mark which product a rule belongs to (for example `product: ai-asm`). A rule without
    // labels sends none, so existing packs provision exactly as before.
    ...(rule.labels?.length ? { labels: rule.labels } : {}),
  };
}
