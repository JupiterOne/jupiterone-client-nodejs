import { ApolloQueryResult } from 'apollo-client';
import { QueryTypes } from './';
import { PageInfo } from '../../types';
import { getProp } from '../getProp';

export const query = async <T, V>(
  fn: QueryTypes.QueryFunction<T>,
  options: QueryTypes.QueryOptions,
): Promise<QueryTypes.QueryResults<V>> => {
  const result: QueryTypes.QueryResults<V> = {
    data: [],
    errors: [],
  };

  let cursor: string | undefined;

  do {
    const res = await fn({ cursor });

    if (res.errors) {
      result.errors = [...result.errors, ...res.errors];
    }

    const data = getProp<ApolloQueryResult<T>, Array<V>>(
      res,
      options.dataPath,
      [],
    );

    if (data) {
      result.data = [...result.data, ...data];
    }

    const cursorInfo = getProp<ApolloQueryResult<T>, PageInfo>(
      res,
      options.cursorPath,
    );
    cursor = cursorInfo?.endCursor;
  } while (cursor);

  return result;
};
