'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { executeGraphQL } from '../lib/graphql/client';
import { GET_STEP_RUNS_QUERY, StepRunItem, GetStepRunsResponse } from '../lib/graphql/subscriptions';

export type SubscriptionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

interface UseStepRunsSubscriptionResult {
  stepRuns: StepRunItem[];
  workflowRunStatus: string | null;
  subscriptionStatus: SubscriptionStatus;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStepRunsSubscription(
  accessToken: string | null,
  workflowRunId: string | null
): UseStepRunsSubscriptionResult {
  const [stepRuns, setStepRuns] = useState<StepRunItem[]>([]);
  const [workflowRunStatus, setWorkflowRunStatus] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('connecting');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStepRuns = useCallback(async () => {
    if (!accessToken || !workflowRunId) return;

    try {
      const data = await executeGraphQL<GetStepRunsResponse>(accessToken, GET_STEP_RUNS_QUERY, {
        workflow_run_id: workflowRunId,
      });

      if (!isMountedRef.current) return;

      const runs = data.step_runs || [];
      setStepRuns(runs);

      if (runs.length > 0 && runs[0].workflow_run?.status) {
        setWorkflowRunStatus(runs[0].workflow_run.status);
      }

      setSubscriptionStatus('connected');
      setError(null);
      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching step runs:', err);
      setError((err as Error).message);
      setSubscriptionStatus('error');
      setIsLoading(false);
    }
  }, [accessToken, workflowRunId]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!accessToken || !workflowRunId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSubscriptionStatus('connecting');

    // Initial fetch
    fetchStepRuns();

    // Setup resilient live polling interval (every 1500ms) while run is active
    pollIntervalRef.current = setInterval(() => {
      fetchStepRuns();
    }, 1500);

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [accessToken, workflowRunId, fetchStepRuns]);

  // Stop active polling if workflow run enters a terminal state (completed or failed)
  useEffect(() => {
    if (workflowRunStatus === 'completed' || workflowRunStatus === 'failed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [workflowRunStatus]);

  return {
    stepRuns,
    workflowRunStatus,
    subscriptionStatus,
    isLoading,
    error,
    refetch: fetchStepRuns,
  };
}
