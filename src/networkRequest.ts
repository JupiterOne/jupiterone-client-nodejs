// Temporary helper file because it's difficult to mock in the current architecture

import fetch from 'node-fetch';

export const networkRequest = async (
  url: string,
): Promise<Record<string, unknown>> => {
  const result = await fetch(url);
  return result.json();
};
