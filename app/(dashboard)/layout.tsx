'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/ToastContext';
import { AiAssistantModal } from '@/components/workflows/AiAssistantModal';
import { TemplateGalleryModal } from '@/components/workflows/TemplateGalleryModal';
import { TemplateConfigModal } from '@/components/workflows/TemplateConfigModal';
import { CreateWorkflowModal } from '@/components/workflows/CreateWorkflowModal';
import { WorkflowTemplate } from '@/lib/templates/definitions';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global Creation & Command Palette Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5EFE6]">
        <div className="flex items-center space-x-3 px-6 py-4 rounded-xl border-[2.5px] border-[#111] bg-white shadow-[4px_4px_0_#111]">
          <svg className="animate-spin h-5 w-5 text-[#111]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="font-black uppercase text-xs tracking-wider text-[#111]">
            Resolving Nhost session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F5EFE6] text-[#111111] p-3 sm:p-4 lg:p-6">
        <div className="max-w-7xl mx-auto flex gap-6 items-start">
          {/* Responsive Sidebar */}
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

          {/* Main Application Area */}
          <div className="flex-1 flex flex-col min-w-0 w-full">
            <Header
              onToggleSidebar={() => setIsSidebarOpen(true)}
              onOpenAiAssistant={() => setIsAiModalOpen(true)}
              onOpenTemplates={() => setIsTemplateGalleryOpen(true)}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
            />
            <main className="flex-1 max-w-7xl w-full mx-auto px-1 sm:px-2">
              {children}
            </main>
          </div>
        </div>

        {/* Global Action & Command Modals */}
        <AiAssistantModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
        />

        <TemplateGalleryModal
          isOpen={isTemplateGalleryOpen}
          onClose={() => setIsTemplateGalleryOpen(false)}
          onSelectTemplate={(t) => setSelectedTemplate(t)}
        />

        <TemplateConfigModal
          isOpen={!!selectedTemplate}
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />

        <CreateWorkflowModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </div>
    </ToastProvider>
  );
}
