/**
 * Workflo Workflow Template Definitions (Phase P8)
 * Built strictly using supported step types (llm_call, http_request, db_write, notify, conditional_branch, approval_gate)
 * and executable trigger types (manual, webhook).
 */

export interface TemplateStepDefinition {
  position: number;
  step_type: 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';
  name: string;
  config: Record<string, unknown>;
}

export interface TemplateTriggerDefinition {
  trigger_type: 'manual' | 'webhook';
  config: Record<string, unknown>;
  is_enabled: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'AI & Data' | 'Approvals' | 'Integrations' | 'Automation';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  triggers: TemplateTriggerDefinition[];
  steps: TemplateStepDefinition[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'ai-content-processor',
    name: 'AI Content Processor',
    description: 'Receives content payload via webhook, analyzes sentiment/urgency using LLM, and routes urgent alerts to an external HTTP endpoint.',
    category: 'AI & Data',
    difficulty: 'Intermediate',
    triggers: [
      {
        trigger_type: 'webhook',
        config: { endpoint: '/api/webhooks/trigger' },
        is_enabled: true,
      },
    ],
    steps: [
      {
        position: 1,
        step_type: 'llm_call',
        name: 'Urgency & Sentiment Analysis',
        config: {
          model: 'gpt-4o',
          prompt: 'Analyze incoming payload for urgency and sentiment. Return JSON object with field "urgent" (boolean).',
          temperature: 0.3,
        },
      },
      {
        position: 2,
        step_type: 'conditional_branch',
        name: 'Check Urgency Flag',
        config: {
          field: 'urgent',
          operator: 'equals',
          value: true,
        },
      },
      {
        position: 3,
        step_type: 'http_request',
        name: 'Dispatch External Alert',
        config: {
          url: 'https://httpbin.org/post',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { event: 'urgent_content_detected', timestamp: new Date().toISOString() },
        },
      },
    ],
  },
  {
    id: 'human-approval-pipeline',
    name: 'Human Approval Pipeline',
    description: 'Ingests operational requests via webhook, performs AI risk classification, pauses at a human approval gate, and deploys upon approval.',
    category: 'Approvals',
    difficulty: 'Intermediate',
    triggers: [
      {
        trigger_type: 'webhook',
        config: { endpoint: '/api/webhooks/trigger' },
        is_enabled: true,
      },
    ],
    steps: [
      {
        position: 1,
        step_type: 'llm_call',
        name: 'AI Risk Classification',
        config: {
          model: 'gpt-4o',
          prompt: 'Evaluate deployment payload and provide a risk assessment summary.',
          temperature: 0.2,
        },
      },
      {
        position: 2,
        step_type: 'approval_gate',
        name: 'Manager Review & Approval Gate',
        config: {
          message: 'Review AI risk classification and approve production deployment.',
        },
      },
      {
        position: 3,
        step_type: 'http_request',
        name: 'Execute Production Deployment',
        config: {
          url: 'https://httpbin.org/post',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { action: 'deploy_production', status: 'approved' },
        },
      },
    ],
  },
  {
    id: 'api-data-processor',
    name: 'API Data Processor',
    description: 'Manually triggered workflow fetching live external API data, summarizing key metrics with an LLM, and inserting an audit record into PostgreSQL.',
    category: 'Integrations',
    difficulty: 'Beginner',
    triggers: [
      {
        trigger_type: 'manual',
        config: {},
        is_enabled: true,
      },
    ],
    steps: [
      {
        position: 1,
        step_type: 'http_request',
        name: 'Fetch External API Payload',
        config: {
          url: 'https://httpbin.org/get',
          method: 'GET',
        },
      },
      {
        position: 2,
        step_type: 'llm_call',
        name: 'LLM Key Insights Extraction',
        config: {
          model: 'gpt-4o',
          prompt: 'Extract 3 main technical takeaways from the fetched HTTP response body.',
        },
      },
      {
        position: 3,
        step_type: 'db_write',
        name: 'Log System Audit Record',
        config: {
          table: 'audit_logs',
          action: 'insert',
          data: { action: 'api_data_processed' },
        },
      },
    ],
  },
  {
    id: 'ai-classification-workflow',
    name: 'AI Classification Workflow',
    description: 'Manual pipeline for running LLM classification on input data, branching on conditions, and storing events in organization notifications.',
    category: 'Automation',
    difficulty: 'Advanced',
    triggers: [
      {
        trigger_type: 'manual',
        config: {},
        is_enabled: true,
      },
    ],
    steps: [
      {
        position: 1,
        step_type: 'llm_call',
        name: 'Customer Request Classifier',
        config: {
          model: 'gpt-4o',
          prompt: 'Classify customer input. Set field "category" to "support", "billing", or "feature_request".',
        },
      },
      {
        position: 2,
        step_type: 'conditional_branch',
        name: 'Check Category Equals Support',
        config: {
          field: 'category',
          operator: 'equals',
          value: 'support',
        },
      },
      {
        position: 3,
        step_type: 'db_write',
        name: 'Save Support Log',
        config: {
          table: 'audit_logs',
          action: 'insert',
          data: { action: 'customer_support_classified' },
        },
      },
    ],
  },
];
