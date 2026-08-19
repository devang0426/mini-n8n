/**
 * AI Agent Workflow Builder — GraphQL Error Handling Strategy (Phase 3)
 */

export enum GraphQLErrorCategory {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppGraphQLError extends Error {
  public readonly category: GraphQLErrorCategory;
  public readonly originalErrors?: readonly unknown[];
  public readonly statusCode?: number;

  constructor(
    message: string,
    category: GraphQLErrorCategory = GraphQLErrorCategory.UNKNOWN_ERROR,
    originalErrors?: readonly unknown[],
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppGraphQLError';
    this.category = category;
    this.originalErrors = originalErrors;
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends AppGraphQLError {
  constructor(message = 'Authentication failed. Please log in.') {
    super(message, GraphQLErrorCategory.AUTHENTICATION_ERROR, undefined, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppGraphQLError {
  constructor(message = 'Authorization failed. Access denied by Hasura permissions.') {
    super(message, GraphQLErrorCategory.AUTHORIZATION_ERROR, undefined, 403);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends AppGraphQLError {
  constructor(message = 'Validation error in GraphQL operation.') {
    super(message, GraphQLErrorCategory.VALIDATION_ERROR, undefined, 400);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppGraphQLError {
  constructor(message = 'Network error while contacting GraphQL endpoint.') {
    super(message, GraphQLErrorCategory.NETWORK_ERROR, undefined, 500);
    this.name = 'NetworkError';
  }
}

export interface HasuraGraphQLErrorItem {
  message: string;
  extensions?: {
    code?: string;
    path?: string;
  };
}

/**
 * Parses raw GraphQL response errors into categorized AppGraphQLError
 */
export function parseGraphQLErrors(
  errors: readonly HasuraGraphQLErrorItem[] | undefined,
  statusCode?: number
): AppGraphQLError {
  if (!errors || errors.length === 0) {
    return new AppGraphQLError('Unknown GraphQL error occurred.', GraphQLErrorCategory.UNKNOWN_ERROR, undefined, statusCode);
  }

  const firstMsg = errors[0].message || '';
  const code = errors[0].extensions?.code || '';

  if (statusCode === 401 || firstMsg.includes('JWT') || firstMsg.includes('Unauthenticated') || code === 'access-denied') {
    return new AuthenticationError(firstMsg || 'Unauthenticated request.');
  }

  if (
    statusCode === 403 ||
    firstMsg.includes('check constraint') ||
    firstMsg.includes('permission') ||
    firstMsg.includes('not found') ||
    code === 'permission-error' ||
    code === 'validation-failed'
  ) {
    return new AuthorizationError(`Authorization denied: ${firstMsg}`);
  }

  return new AppGraphQLError(firstMsg, GraphQLErrorCategory.UNKNOWN_ERROR, errors, statusCode);
}
