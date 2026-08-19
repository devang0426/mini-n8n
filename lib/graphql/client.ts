/**
 * AI Agent Workflow Builder — Authenticated GraphQL Client (Phase 3)
 * Uses Nhost User JWT for all operations. Never uses admin secret.
 */

import { parseGraphQLErrors, AppGraphQLError, AuthenticationError, NetworkError } from './errors';

const HASURA_GRAPHQL_URL =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ||
  'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/graphql';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
      path?: string;
    };
  }>;
}

export async function executeGraphQL<TData = unknown, TVariables = Record<string, unknown>>(
  jwtToken: string,
  query: string,
  variables?: TVariables
): Promise<TData> {
  if (!jwtToken) {
    throw new AuthenticationError('User JWT token is required for GraphQL operations.');
  }

  let response: Response;
  try {
    response = await fetch(HASURA_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
    });
  } catch (err) {
    throw new NetworkError(`Network error while fetching GraphQL endpoint: ${(err as Error).message}`);
  }

  let result: GraphQLResponse<TData>;
  try {
    result = (await response.json()) as GraphQLResponse<TData>;
  } catch {
    throw new AppGraphQLError('Failed to parse GraphQL response as JSON.', undefined, undefined, response.status);
  }

  if (result.errors && result.errors.length > 0) {
    throw parseGraphQLErrors(result.errors, response.status);
  }

  if (!result.data) {
    throw new AppGraphQLError('No data returned from GraphQL server.', undefined, undefined, response.status);
  }

  return result.data;
}
