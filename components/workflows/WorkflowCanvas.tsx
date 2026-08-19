'use client';

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StepItem } from './StepBuilder';
import { TriggerItem } from './TriggerBuilder';

export interface WorkflowCanvasProps {
  steps: StepItem[];
  triggers: TriggerItem[];
  onSelectStep?: (index: number) => void;
  canEdit?: boolean;
}

// Neobrutalist styling theme mapping
const STEP_STYLES: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  // Classic Steps
  llm_call: { bg: '#EDE8FF', text: '#5B3FC8', border: '#111', label: 'LLM Call', icon: '🧠' },
  http_request: { bg: '#DDEEFF', text: '#1155AA', border: '#111', label: 'HTTP Request', icon: '🌐' },
  conditional_branch: { bg: '#FFF5CC', text: '#8A6000', border: '#111', label: 'Conditional Branch', icon: '🔀' },
  approval_gate: { bg: '#FFDDEA', text: '#B02050', border: '#111', label: 'Approval Gate', icon: '⏸️' },
  db_write: { bg: '#D0FAF4', text: '#0A7A6E', border: '#111', label: 'DB Write', icon: '💾' },
  notify: { bg: '#FFE8CC', text: '#B05000', border: '#111', label: 'Notify Alert', icon: '🔔' },

  // Stagehand & Browser Automation Steps
  browser_navigate: { bg: '#E0F2FE', text: '#0284C7', border: '#111', label: 'Browser Navigate', icon: '🧭' },
  stagehand_act: { bg: '#FCE7F3', text: '#DB2777', border: '#111', label: 'Stagehand Act', icon: '⚡' },
  stagehand_extract: { bg: '#ECFDF5', text: '#059669', border: '#111', label: 'Stagehand Extract', icon: '📊' },
  stagehand_observe: { bg: '#FEF3C7', text: '#D97706', border: '#111', label: 'Stagehand Observe', icon: '🔍' },

  // Triggers
  manual_trigger: { bg: '#F5C842', text: '#111', border: '#111', label: 'Manual Trigger', icon: '⚡' },
  webhook_trigger: { bg: '#E5D4FF', text: '#5B21B6', border: '#111', label: 'Webhook Ingestion', icon: '⚓' },
  scheduled_trigger: { bg: '#D1FAE5', text: '#065F46', border: '#111', label: 'Scheduled Cron', icon: '⏰' },
  database_event_trigger: { bg: '#E0E7FF', text: '#3730A3', border: '#111', label: 'DB Event Trigger', icon: '⚡' },
};

// Custom React Flow Node Component
function CustomStepNode({ data }: NodeProps) {
  const stepType = (data.stepType as string) || 'llm_call';
  const style = STEP_STYLES[stepType] || {
    bg: '#FFFFFF',
    text: '#111111',
    border: '#111111',
    label: stepType,
    icon: '⚡',
  };

  const isTrigger = (data.isTrigger as boolean) || false;

  return (
    <div
      style={{ backgroundColor: style.bg }}
      className="p-4 rounded-2xl border-[3px] border-[#111] shadow-[5px_5px_0_#111] min-w-[240px] max-w-[300px] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[7px_7px_0_#111]"
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-4 !h-4 !bg-white !border-[2.5px] !border-[#111] !shadow-[1px_1px_0_#111]"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{style.icon}</span>
          <span style={{ color: style.text }} className="font-black text-xs uppercase tracking-wider">
            {style.label}
          </span>
        </div>
        {data.positionIndex !== undefined && (
          <span className="h-6 w-6 rounded-full bg-white border-[2px] border-[#111] flex items-center justify-center font-black text-[11px] text-[#111]">
            #{String(data.positionIndex)}
          </span>
        )}
      </div>

      {/* Configuration Summary */}
      <p className="text-xs font-mono font-bold text-[#111]/85 line-clamp-2 bg-white/70 p-2 rounded-xl border-[1.5px] border-[#111]">
        {String(data.summary || '')}
      </p>

      {!isTrigger && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-4 !h-4 !bg-[#F5C842] !border-[2.5px] !border-[#111] !shadow-[1px_1px_0_#111]"
        />
      )}
      {isTrigger && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-4 !h-4 !bg-[#00C8B4] !border-[2.5px] !border-[#111] !shadow-[1px_1px_0_#111]"
        />
      )}
    </div>
  );
}

export function WorkflowCanvas({ steps, triggers, onSelectStep }: WorkflowCanvasProps) {
  const nodeTypes = useMemo(() => ({ stepNode: CustomStepNode }), []);

  // Map triggers and steps into React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    let currentY = 40;

    // 1. Add Trigger Nodes
    triggers.forEach((trig, idx) => {
      const triggerId = `trigger-${trig.id || idx}`;
      const trigTypeKey = `${trig.trigger_type}_trigger`;
      const styleInfo = STEP_STYLES[trigTypeKey] || { label: trig.trigger_type };

      nodes.push({
        id: triggerId,
        type: 'stepNode',
        position: { x: 160, y: currentY },
        data: {
          stepType: trigTypeKey,
          isTrigger: true,
          positionIndex: idx + 1,
          summary: `Trigger: ${styleInfo.label} (${trig.is_enabled ? 'Enabled' : 'Disabled'})`,
        },
      });

      currentY += 160;
    });

    if (triggers.length === 0) {
      nodes.push({
        id: 'start-node',
        type: 'stepNode',
        position: { x: 160, y: 40 },
        data: {
          stepType: 'manual_trigger',
          isTrigger: true,
          positionIndex: 1,
          summary: 'Manual Entry Trigger (Default)',
        },
      });
      currentY = 200;
    }

    // 2. Add Sequential Workflow Step Nodes
    let prevNodeId = triggers.length > 0 ? `trigger-${triggers[0].id || 0}` : 'start-node';

    steps.forEach((step, idx) => {
      const nodeId = `step-${step.id || idx}`;
      let summary = '';
      const c = step.config || {};

      switch (step.step_type) {
        case 'llm_call':
          summary = `Model: ${c.model || 'gpt-4o'} • "${c.prompt || 'Analyze payload'}"`;
          break;
        case 'http_request':
          summary = `${c.method || 'GET'} ${c.url || 'https://...'}`;
          break;
        case 'db_write':
          summary = `Table: ${c.table || 'audit_logs'}`;
          break;
        case 'notify':
          summary = `Recipient: ${c.recipient || 'N/A'}`;
          break;
        case 'conditional_branch':
          summary = `If '${c.field || 'status'}' ${c.operator || 'equals'} '${c.value ?? ''}'`;
          break;
        case 'approval_gate':
          summary = `Gate: "${c.message || 'Approval needed'}"`;
          break;
        case 'browser_navigate':
          summary = `URL: ${c.url || 'https://example.com'}`;
          break;
        case 'stagehand_act':
          summary = `Action: "${c.action || 'Perform action'}"`;
          break;
        case 'stagehand_extract':
          summary = `Extract: "${c.instruction || 'Extract page content'}"`;
          break;
        case 'stagehand_observe':
          summary = `Observe elements on ${c.url || 'target page'}`;
          break;
        default:
          summary = JSON.stringify(c);
      }

      nodes.push({
        id: nodeId,
        type: 'stepNode',
        position: { x: 160, y: currentY },
        data: {
          stepType: step.step_type,
          isTrigger: false,
          positionIndex: idx + 1,
          summary,
          originalIndex: idx,
        },
      });

      // Connect previous node to current node
      edges.push({
        id: `edge-${prevNodeId}-${nodeId}`,
        source: prevNodeId,
        target: nodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#111111', strokeWidth: 3 },
      });

      prevNodeId = nodeId;
      currentY += 170;
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [steps, triggers]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.data?.originalIndex !== undefined && onSelectStep) {
        onSelectStep(node.data.originalIndex as number);
      }
    },
    [onSelectStep]
  );

  return (
    <div className="w-full h-[600px] bg-[#FAF8F5] rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] flex items-center space-x-2">
        <span className="h-3 w-3 rounded-full bg-[#00C8B4] border-[1px] border-[#111] animate-ping" />
        <span className="text-xs font-black uppercase tracking-wider text-[#111]">
          Interactive Canvas View ({nodesCount(steps.length, triggers.length)} Nodes)
        </span>
      </div>

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={2} color="#111111" />
        <Controls className="!bg-white !border-[2px] !border-[#111] !shadow-[3px_3px_0_#111] !rounded-xl" />
        <MiniMap
          nodeColor={(n) => {
            const stepType = (n.data?.stepType as string) || 'default';
            return STEP_STYLES[stepType]?.bg || '#F5C842';
          }}
          className="!bg-white !border-[2px] !border-[#111] !shadow-[3px_3px_0_#111] !rounded-xl"
        />
      </ReactFlow>
    </div>
  );
}

function nodesCount(stepCount: number, triggerCount: number): number {
  return (triggerCount || 1) + stepCount;
}
