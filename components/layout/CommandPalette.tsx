'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAiAssistant?: () => void;
  onOpenTemplates?: () => void;
  onOpenCreateModal?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenAiAssistant,
  onOpenTemplates,
  onOpenCreateModal,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or custom state
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const COMMAND_ITEMS = [
    {
      id: 'ai',
      label: '✨ Build Workflow with AI',
      category: 'Creation',
      action: () => {
        onClose();
        if (onOpenAiAssistant) onOpenAiAssistant();
      },
    },
    {
      id: 'template',
      label: '📋 Browse Workflow Templates',
      category: 'Creation',
      action: () => {
        onClose();
        if (onOpenTemplates) onOpenTemplates();
      },
    },
    {
      id: 'blank',
      label: '➕ Create Blank Workflow',
      category: 'Creation',
      action: () => {
        onClose();
        if (onOpenCreateModal) onOpenCreateModal();
      },
    },
    {
      id: 'workflows',
      label: '⚡ View Workflows',
      category: 'Navigation',
      action: () => {
        onClose();
        router.push('/dashboard/workflows');
      },
    },
    {
      id: 'runs',
      label: '🔄 Execution History & Runs',
      category: 'Navigation',
      action: () => {
        onClose();
        router.push('/dashboard/runs');
      },
    },
    {
      id: 'approvals',
      label: '⏳ Approval Gates Inbox',
      category: 'Navigation',
      action: () => {
        onClose();
        router.push('/dashboard/approvals');
      },
    },
    {
      id: 'connections',
      label: '🔑 Manage API Connections',
      category: 'Organization',
      action: () => {
        onClose();
        router.push('/dashboard/organization/connections');
      },
    },
    {
      id: 'members',
      label: '👥 Organization Members',
      category: 'Organization',
      action: () => {
        onClose();
        router.push('/dashboard/organization/members');
      },
    },
    {
      id: 'usage',
      label: '📊 Organization Quota & Usage',
      category: 'Organization',
      action: () => {
        onClose();
        router.push('/dashboard/organization/usage');
      },
    },
    {
      id: 'profile',
      label: '👤 User Account Profile',
      category: 'User',
      action: () => {
        onClose();
        router.push('/dashboard/user/profile');
      },
    },
  ];

  const filteredItems = query.trim()
    ? COMMAND_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim()))
    : COMMAND_ITEMS;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] overflow-hidden space-y-0">
        {/* Search Bar */}
        <div className="p-4 border-b-[2.5px] border-[#111] flex items-center gap-3">
          <span className="text-lg">🔍</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search (Cmd + K)..."
            className="w-full bg-transparent text-sm font-black uppercase tracking-wider text-[#111] focus:outline-none placeholder:text-[#888]"
          />
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs font-black uppercase rounded bg-[#F0EBE2] border border-[#111]"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs font-black uppercase text-[#666]">
              No matching command found.
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full p-3 rounded-xl hover:bg-[#FFF5CC] border-[2px] border-transparent hover:border-[#111] flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#111] text-left transition-all cursor-pointer"
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-[#555] bg-[#F0EBE2] px-2 py-0.5 rounded border border-[#111]">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
