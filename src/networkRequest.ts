// Temporary helper file because it's difficult to mock in the current architecture

import fetch from 'node-fetch';

export const networkRequest = async (
  url: string,
): Promise<Record<string, unknown>> => {
  const result = await fetch(url);

  const { status, headers } = result;

  if (status < 200 || status >= 300) {
    const body = await result.text();
    throw new Error(`HTTP request failed (${status}): ${body}`);
  }

  const contentType = headers.get('content-type');
  if (contentType?.includes('application/json') === false) {
    const body = await result.text();
    throw new Error(`HTTP response is not JSON but ${contentType}: ${body}`);
  }

  return result.json();
};
