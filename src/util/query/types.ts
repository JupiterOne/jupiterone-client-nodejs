import { ApolloQueryResult } from 'apollo-client';
import { GraphQLError } from 'graphql';

export interface QueryResults<T> {
  data: Array<T>;
  errors: ReadonlyArray<GraphQLError>;
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
