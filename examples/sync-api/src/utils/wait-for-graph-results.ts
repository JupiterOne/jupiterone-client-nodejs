import { sleep, logger } from '.';

export const waitForGraphResults = (j1, j1Query) => {
  const repeat = async (counter: number = 1) => {
    counter = +counter;
    if (isNaN(counter)) {
      logger('Counter is not a number... exiting.');
      return null;
    }
    if (counter > 5) return null;

    const results = await j1.queryV1(j1Query, { fetchPolicy: 'no-cache' });

    if (!results || !results?.length) {
      console.log('Sleeping for 5 seconds...');
      await sleep(5000);
      return repeat(++counter);
    }

    return results;
  };

  return repeat;
};
