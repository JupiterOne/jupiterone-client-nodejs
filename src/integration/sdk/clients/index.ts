export * from './types';
import { LocalGraphDataClient } from './local';

export const createGraphDataClient = (identifier: string, local?: boolean) => {
  return local
    ? new LocalGraphDataClient(identifier)
    : new LocalGraphDataClient(identifier); // replace with remote
};
