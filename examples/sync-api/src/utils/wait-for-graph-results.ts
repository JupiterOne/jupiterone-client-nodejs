import { sleep } from '.';

export const waitForGraphResults = (j1, j1Query) => {
  const repeat = async (counter: number = 1) => {
    if (counter > 5) return [];

    const results = await j1.queryV1(j1Query);

    if (!results && !results?.length) {
      console.log('Sleeping for 5 seconds...');
      await sleep(5000);
      return repeat(counter++);
    }

    return results;
  };

  return repeat;
};
