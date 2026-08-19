'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { OrgSelector } from '@/components/organizations/OrgSelector';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { organization, role } = useOrganization();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Workflows', href: '/dashboard/workflows', icon: '⚡' },
    { label: 'Runs', href: '/dashboard/runs', icon: '🔄' },
    { label: 'Approvals', href: '/dashboard/approvals', icon: '⏳' },
  ];

  const orgItems = [
    { label: 'Members', href: '/dashboard/organization/members', icon: '👥' },
    { label: 'Connections', href: '/dashboard/organization/connections', icon: '🔑' },
    { label: 'Usage', href: '/dashboard/organization/usage', icon: '📈' },
    { label: 'Settings', href: '/dashboard/organization/settings', icon: '⚙️' },
  ];

  const userItems = [
    { label: 'Profile', href: '/dashboard/user/profile', icon: '👤' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-[2.5px] border-[#111] rounded-[18px] shadow-[6px_6px_0_#111] p-4 text-[#111]">
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-4 border-b-[2px] border-[#111] mb-4">
        <Link href="/dashboard" className="flex items-center space-x-2.5 font-black text-xl text-[#111]">
          <span className="h-9 w-9 rounded-xl bg-[#F5C842] border-[2px] border-[#111] flex items-center justify-center text-[#111] text-base font-black shadow-[2px_2px_0_#111]">
            W
          </span>
          <div className="flex flex-col">
            <span className="uppercase tracking-wider text-base leading-tight font-black">Workflo</span>
            <span className="text-[10px] font-bold tracking-widest text-[#666] uppercase">SaaS Platform</span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg border-[2px] border-[#111] bg-[#F5EFE6] text-xs font-black"
          >
            ✕
          </button>
        )}
      </div>

      {/* Org Context Pill */}
      <div className="mb-5 bg-[#F5EFE6] p-2.5 rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111]">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#666] mb-1">
          Active Workspace
        </div>
        <OrgSelector />
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
        {/* Core Nav */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#888] mb-2 px-2">
            Platform
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-xl border-[2px] text-xs font-black uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-[#F5C842] text-[#111] border-[#111] shadow-[3px_3px_0_#111]'
                      : 'bg-white text-[#333] border-transparent hover:border-[#111] hover:bg-[#F5EFE6]'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Organization Nav */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#888] mb-2 px-2">
            Organization
          </div>
          <nav className="space-y-1">
            {orgItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-xl border-[2px] text-xs font-black uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-[#F5C842] text-[#111] border-[#111] shadow-[3px_3px_0_#111]'
                      : 'bg-white text-[#333] border-transparent hover:border-[#111] hover:bg-[#F5EFE6]'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Account Nav */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#888] mb-2 px-2">
            Account
          </div>
          <nav className="space-y-1">
            {userItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-xl border-[2px] text-xs font-black uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-[#F5C842] text-[#111] border-[#111] shadow-[3px_3px_0_#111]'
                      : 'bg-white text-[#333] border-transparent hover:border-[#111] hover:bg-[#F5EFE6]'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer User Info & Sign Out */}
      <div className="pt-4 border-t-[2px] border-[#111] mt-4 flex items-center justify-between">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="text-xs font-black uppercase truncate text-[#111]">
            {user?.displayName || 'Nhost User'}
          </span>
          <span className="text-[10px] font-bold text-[#666] truncate">
            {user?.email || ''}
          </span>
        </div>
        <button
          id="sidebar-sign-out-btn"
          onClick={handleSignOut}
          title="Sign Out"
          className="p-2 rounded-xl bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#FF6B6B] hover:text-white transition-all text-xs font-black cursor-pointer flex-shrink-0"
        >
          🚪
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-3 h-[calc(100vh-1.5rem)]">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-[#F5EFE6] p-3 z-50 transform transition-transform duration-200 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>
    </>
  );
}
