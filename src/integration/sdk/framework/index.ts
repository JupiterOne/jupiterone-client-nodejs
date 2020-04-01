import {
  JupiterOneIntegration,
  JupiterOneIntegrationInput,
} from './JupiterOneIntegration';

export function createIntegration<T = undefined>(
  input: JupiterOneIntegrationInput<T>,
) {
  return new JupiterOneIntegration<T>(input);
}
