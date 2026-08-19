'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { OrgSelector } from '@/components/organizations/OrgSelector';
import { CommandPalette } from './CommandPalette';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenTemplates?: () => void;
  onOpenCreateModal?: () => void;
}

export function Header({ onToggleSidebar, onOpenAiAssistant, onOpenTemplates, onOpenCreateModal }: HeaderProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { organization } = useOrganization();
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <>
      <header className="sticky top-3 z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mb-6">
        <div className="bg-white border-[2.5px] border-[#111] rounded-[16px] shadow-[4px_4px_0_#111] px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Mobile Menu Button & Mobile Brand */}
          <div className="flex items-center space-x-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                aria-label="Open Navigation Menu"
                className="lg:hidden p-2 rounded-xl border-[2px] border-[#111] bg-[#F5C842] shadow-[2px_2px_0_#111] text-[#111] font-black hover:bg-[#E5B832] transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Logo link for mobile / tablet */}
            <Link href="/dashboard" className="flex items-center space-x-2 font-black text-lg text-[#111] lg:hidden">
              <span className="h-8 w-8 rounded-lg bg-[#F5C842] border-[2px] border-[#111] flex items-center justify-center text-[#111] text-sm font-black shadow-[2px_2px_0_#111]">
                W
              </span>
              <span className="uppercase tracking-wider">Workflo</span>
            </Link>

            {/* Org & Role Display on Desktop */}
            <div className="hidden lg:flex items-center space-x-3">
              <span className="text-xs font-black uppercase text-[#888] tracking-widest">
                Workspace:
              </span>
              <span className="text-xs font-black uppercase text-[#111] bg-[#F5EFE6] px-2.5 py-1 rounded-lg border-[1.5px] border-[#111]">
                {organization?.name || 'Default Org'}
              </span>
            </div>
          </div>

          {/* Quick Command Palette Button */}
          <div className="hidden md:flex items-center">
            <button
              onClick={() => setIsCmdPaletteOpen(true)}
              className="px-3.5 py-1.5 rounded-xl border-[2px] border-[#111] bg-[#FFF5CC] hover:bg-[#F5C842] text-xs font-black uppercase tracking-wider text-[#111] shadow-[2px_2px_0_#111] transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>🔍 Search / Commands</span>
              <span className="px-1.5 py-0.5 rounded bg-white border border-[#111] text-[10px] text-[#555]">⌘K</span>
            </button>
          </div>

          {/* Right Section: Org Selector, Profile Link & Sign Out */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="hidden sm:block">
              <OrgSelector />
            </div>

            {/* User Email & Sign Out */}
            <div className="flex items-center space-x-3 pl-3 border-l-[2px] border-[#111]">
              <Link
                href="/dashboard/user/profile"
                className="hidden sm:flex flex-col text-right hover:opacity-80 transition-opacity"
              >
                <span className="text-xs font-black uppercase text-[#111]">
                  {user?.displayName || 'User'}
                </span>
                <span className="text-[10px] font-bold text-[#555] max-w-[130px] truncate">
                  {user?.email || 'Nhost User'}
                </span>
              </Link>

              <button
                id="header-sign-out-btn"
                onClick={handleSignOut}
                className="px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl text-[#111] bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#FF6B6B] hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        onOpenAiAssistant={onOpenAiAssistant}
        onOpenTemplates={onOpenTemplates}
        onOpenCreateModal={onOpenCreateModal}
      />
    </>
  );
}
