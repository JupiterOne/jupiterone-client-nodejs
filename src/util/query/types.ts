import { ApolloQueryResult } from '@apollo/client/core';
import { GraphQLFormattedError } from 'graphql';

export interface QueryResults<T> {
  data: Array<T>;
  errors: ReadonlyArray<GraphQLFormattedError>;
}

export interface QueryOptions {
  dataPath: string;
  cursorPath: string;
}

export interface QueryFunctionProps {
  cursor: string | undefined;
}

export interface QueryFunction<T> {
  (options: QueryFunctionProps): Promise<ApolloQueryResult<T>>;
}
