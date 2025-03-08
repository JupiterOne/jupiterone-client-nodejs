// Temporary helper file because it's difficult to mock in the current architecture

import fetch from 'node-fetch';
import { retry } from "@lifeomic/attempt";

export const networkRequest = async (
  url: string,
): Promise<Record<string, unknown>> => {
  const result = await retry(async () => {
    const result = await fetch(url);
    const { status } = result;

    if (status < 200 || status >= 300) {
      const body = await result.text();
      throw new Error(`HTTP request failed (${status}): ${body}`);
    }

    return result;
  });

  const contentType = result.headers.get('content-type');
  if (contentType?.includes('application/json') === false) {
    const body = await result.text();
    throw new Error(`HTTP response is not JSON but ${contentType}: ${body}`);
  }

  return result.json();
};
