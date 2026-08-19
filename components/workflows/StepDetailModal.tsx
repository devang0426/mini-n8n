'use client';

import { StepRunItem } from '@/lib/graphql/subscriptions';

interface StepDetailModalProps {
  stepRun: StepRunItem | null;
  onClose: () => void;
}

function sanitizeObject(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return obj
      .replace(/(Authorization|Bearer)\s+[:=]?\s*["']?[A-Za-z0-9._-]+["']?/gi, '$1: [REDACTED]')
      .replace(/(api[_-]?key|secret|password|admin_secret)\s*[:=]\s*["']?[^"'\s]+["']?/gi, '$1: [REDACTED]');
  }
  if (typeof obj === 'object') {
    const sanitized: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('authorization') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

export function StepDetailModal({ stepRun, onClose }: StepDetailModalProps) {
  if (!stepRun) return null;

  const stepPos = stepRun.workflow_step?.position || 1;
  const stepType = stepRun.workflow_step?.step_type || 'unknown';

  const sanitizedInput = sanitizeObject(stepRun.input);
  const sanitizedOutput = sanitizeObject(stepRun.output);
  const sanitizedError = sanitizeObject(stepRun.error);

  return (
    <div className="fixed inset-0 z-50 bg-[#F5EFE6]/85 flex items-center justify-center p-4">
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b-[2.5px] border-[#111] flex items-center justify-between bg-[#F5C842]">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-black text-[#111] px-2.5 py-0.5 bg-white border-[1.5px] border-[#111] rounded-md">
              STEP #{stepPos}
            </span>
            <h2 className="font-black text-[#111] text-base uppercase tracking-wider">
              {stepType.replace('_', ' ')} Execution Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#FF6B6B] hover:text-white flex items-center justify-center font-black text-sm transition-all"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Status & Attempt Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5EFE6] p-3.5 rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111]">
            <div>
              <span className="text-[10px] font-black uppercase text-[#555] block">Status</span>
              <span className="font-black uppercase text-[#111]">{stepRun.status}</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#555] block">Attempts</span>
              <span className="font-black text-[#111]">{stepRun.attempt_count}</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#555] block">Started</span>
              <span className="font-mono font-bold text-[#111]">
                {stepRun.started_at ? new Date(stepRun.started_at).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#555] block">Completed</span>
              <span className="font-mono font-bold text-[#111]">
                {stepRun.completed_at ? new Date(stepRun.completed_at).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Configuration */}
          <div>
            <h4 className="font-black text-[#111] text-xs uppercase tracking-wider mb-1.5">Step Configuration</h4>
            <pre className="bg-[#F5EFE6] p-3 rounded-xl border-[2px] border-[#111] text-xs font-mono text-[#111] overflow-x-auto shadow-[2px_2px_0_#111]">
              {JSON.stringify(sanitizeObject(stepRun.workflow_step?.config || {}), null, 2)}
            </pre>
          </div>

          {/* Input Data */}
          <div>
            <h4 className="font-black text-[#111] text-xs uppercase tracking-wider mb-1.5">Input Payload</h4>
            <pre className="bg-[#F5EFE6] p-3 rounded-xl border-[2px] border-[#111] text-xs font-mono text-[#111] overflow-x-auto shadow-[2px_2px_0_#111]">
              {sanitizedInput ? JSON.stringify(sanitizedInput, null, 2) : 'No input payload'}
            </pre>
          </div>

          {/* Output Data */}
          <div>
            <h4 className="font-black text-[#111] text-xs uppercase tracking-wider mb-1.5">Output Payload</h4>
            <pre className="bg-[#B6F5C8] p-3 rounded-xl border-[2px] border-[#111] text-xs font-mono text-[#0A6630] font-bold overflow-x-auto shadow-[2px_2px_0_#111]">
              {sanitizedOutput ? JSON.stringify(sanitizedOutput, null, 2) : 'No output payload'}
            </pre>
          </div>

          {/* Error Message */}
          {sanitizedError && (
            <div>
              <h4 className="font-black text-[#FF6B6B] text-xs uppercase tracking-wider mb-1.5">Execution Error</h4>
              <pre className="bg-[#FF6B6B] p-3 rounded-xl border-[2px] border-[#111] text-xs font-mono text-white font-bold overflow-x-auto shadow-[2px_2px_0_#111]">
                {typeof sanitizedError === 'string' ? sanitizedError : JSON.stringify(sanitizedError, null, 2)}
              </pre>
            </div>
          )}

          {/* Approval Details */}
          {stepRun.approved_by && (
            <div className="bg-[#B6F5C8] border-[2px] border-[#111] p-3 rounded-xl text-[#0A6630] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#111]">
              Approved by {stepRun.approved_by} on {new Date(stepRun.approved_at!).toLocaleString()}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t-[2.5px] border-[#111] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-[#F0EBE2] text-[#111] border-[2.5px] border-[#111] rounded-xl text-xs font-black uppercase tracking-wider shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
