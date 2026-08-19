/**
 * AI Agent Workflow Builder — Executor Errors (Phase 4A)
 */

export class ExecutorError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'EXECUTOR_ERROR') {
    super(message);
    this.name = 'ExecutorError';
    this.code = code;
  }
}

export class WorkflowNotFoundError extends ExecutorError {
  constructor(workflowId: string) {
    super(`Workflow with ID '${workflowId}' not found.`, 'WORKFLOW_NOT_FOUND');
    this.name = 'WorkflowNotFoundError';
  }
}

export class MismatchedOrgError extends ExecutorError {
  constructor(expectedOrgId: string, actualOrgId: string) {
    super(
      `Workflow organization mismatch. Workflow belongs to '${actualOrgId}', but request supplied '${expectedOrgId}'.`,
      'MISMATCHED_ORG'
    );
    this.name = 'MismatchedOrgError';
  }
}

export class InactiveWorkflowError extends ExecutorError {
  constructor(workflowId: string) {
    super(`Workflow '${workflowId}' is inactive and cannot be executed.`, 'INACTIVE_WORKFLOW');
    this.name = 'InactiveWorkflowError';
  }
}

export class QuotaExhaustedError extends ExecutorError {
  constructor(orgId: string) {
    super(`Organization '${orgId}' has exhausted its quota limit.`, 'QUOTA_EXHAUSTED');
    this.name = 'QuotaExhaustedError';
  }
}

export class StateTransitionError extends ExecutorError {
  constructor(message: string) {
    super(message, 'INVALID_STATE_TRANSITION');
    this.name = 'StateTransitionError';
  }
}

export class StepExecutionError extends ExecutorError {
  public readonly isRetryable: boolean;

  constructor(message: string, isRetryable = false) {
    super(message, 'STEP_EXECUTION_ERROR');
    this.name = 'StepExecutionError';
    this.isRetryable = isRetryable;
  }
}

export class NotImplementedError extends ExecutorError {
  constructor(featureName: string) {
    super(`Feature '${featureName}' is NOT_IMPLEMENTED in Phase 4A.`, 'NOT_IMPLEMENTED');
    this.name = 'NotImplementedError';
  }
}

export class ValidationError extends ExecutorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
