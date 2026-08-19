/**
 * AI Agent Workflow Builder — Run State Machine & Transition Guard (Phase 4A)
 * Atomic database state machine enforcing valid transitions and preventing duplicate/concurrent runs.
 */

import { RunStatus } from './types';
import { StateTransitionError } from './errors';

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  pending: ['running'],
  running: ['paused', 'completed', 'failed'],
  paused: ['running'],
  completed: [], // Terminal
  failed: [],    // Terminal
};

export class RunStateMachine {
  /**
   * Validates whether a transition from currentStatus to nextStatus is allowed.
   */
  public static isValidTransition(currentStatus: RunStatus, nextStatus: RunStatus): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
  }

  /**
   * Asserts that a transition from currentStatus to nextStatus is valid.
   * Throws StateTransitionError if invalid.
   */
  public static assertValidTransition(currentStatus: RunStatus, nextStatus: RunStatus, runId: string): void {
    if (!this.isValidTransition(currentStatus, nextStatus)) {
      throw new StateTransitionError(
        `Invalid workflow_run state transition from '${currentStatus}' to '${nextStatus}' for run '${runId}'.`
      );
    }
  }

  /**
   * Formats the SQL WHERE clause for an atomic state transition in PostgreSQL.
   */
  public static getAtomicTransitionSql(runId: string, expectedPrevStatus: RunStatus, nextStatus: RunStatus): string {
    this.assertValidTransition(expectedPrevStatus, nextStatus, runId);
    let extraSet = '';
    if (nextStatus === 'running') {
      extraSet = ', started_at = COALESCE(started_at, now())';
    } else if (nextStatus === 'completed' || nextStatus === 'failed') {
      extraSet = ', completed_at = now()';
    }

    return `
      UPDATE public.workflow_runs
      SET status = '${nextStatus}', updated_at = now()${extraSet}
      WHERE id = '${runId}' AND status = '${expectedPrevStatus}'
      RETURNING id, status;
    `;
  }
}
