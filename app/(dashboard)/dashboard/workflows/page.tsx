'use client';

import React from 'react';
import { WorkflowList } from '@/components/workflows/WorkflowList';

export default function WorkflowsPage() {
  return (
    <div className="space-y-6 pb-8">
      <WorkflowList />
    </div>
  );
}
