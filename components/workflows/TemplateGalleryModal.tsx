'use client';

import React, { useState } from 'react';
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from '@/lib/templates/definitions';

export interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

export function TemplateGalleryModal({ isOpen, onClose, onSelectTemplate }: TemplateGalleryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = ['all', 'AI & Data', 'Approvals', 'Integrations', 'Automation'];

  const filteredTemplates = selectedCategory === 'all'
    ? WORKFLOW_TEMPLATES
    : WORKFLOW_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">📋</span>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">Workflow Template Gallery</h2>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#555] mt-0.5">
              Launch pre-built production workflows built on native step types
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] flex items-center justify-center font-black text-sm transition-all"
          >
            ✕
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b-[2px] border-[#111] pb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border-[2px] border-[#111] transition-all ${
                selectedCategory === cat
                  ? 'bg-[#F5C842] text-[#111] shadow-[2px_2px_0_#111]'
                  : 'bg-white text-[#555] hover:bg-[#F5EFE6]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTemplates.map((template) => {
            const triggerLabel = template.triggers[0]?.trigger_type.toUpperCase() || 'MANUAL';
            const stepTypesList = template.steps.map((s) => s.step_type.replace('_', ' ')).join(' → ');

            return (
              <div
                key={template.id}
                className="bg-white rounded-2xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] p-5 flex flex-col justify-between space-y-4 hover:shadow-[6px_6px_0_#111] transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-[1.5px] border-[#111] bg-[#EDE8FF] text-[#5B21B6]">
                      {template.category}
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-[1.5px] border-[#111] bg-[#FFF5CC] text-[#C49B10]">
                      {template.difficulty}
                    </span>
                  </div>

                  <h3 className="text-lg font-black uppercase text-[#111]">{template.name}</h3>
                  <p className="text-xs font-medium text-[#555] leading-relaxed">{template.description}</p>
                </div>

                {/* Workflow Diagram & Metadata */}
                <div className="space-y-3 pt-3 border-t-[2px] border-[#111]">
                  <div className="p-2.5 rounded-xl bg-[#F0EBE2] border-[1.5px] border-[#111] text-[11px] font-mono text-[#111] space-y-1">
                    <div>
                      <strong>Trigger:</strong> <span className="uppercase text-[#5B21B6]">{triggerLabel}</span>
                    </div>
                    <div className="truncate">
                      <strong>Steps ({template.steps.length}):</strong> <span className="capitalize">{stepTypesList}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectTemplate(template);
                      onClose();
                    }}
                    className="w-full py-2.5 bg-[#F5C842] hover:bg-[#E5B832] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <span>Use Template →</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
