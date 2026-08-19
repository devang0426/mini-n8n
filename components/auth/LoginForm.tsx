'use client';

import React, { useState } from 'react';
import { useSignInEmailPassword, useSignUpEmailPassword } from '@nhost/react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { signInEmailPassword, isLoading: isSigningIn, error: signInError } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: isSigningUp, error: signUpError } = useSignUpEmailPassword();

  const isLoading = isSigningIn || isSigningUp;
  const error = isSignUp ? signUpError?.message : signInError?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (isSignUp) {
      const res = await signUpEmailPassword(email, password);
      if (res.isSuccess) {
        router.push('/dashboard');
      }
    } else {
      const res = await signInEmailPassword(email, password);
      if (res.isSuccess) {
        router.push('/dashboard');
      }
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111]">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#F5C842] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] mb-3 text-xl font-black text-[#111]">
          W
        </div>
        <h2 className="text-2xl font-black uppercase tracking-wider text-[#111]">
          {isSignUp ? 'Create Account' : 'Sign in to Workflo'}
        </h2>
        <p className="text-xs font-bold uppercase tracking-wider text-[#555] mt-1">
          AI Agent Workflow Automation Platform
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] text-xs font-bold text-white uppercase tracking-wider">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
            Email Address
          </label>
          <input
            id="email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
            Password
          </label>
          <input
            id="password-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
          />
        </div>

        <button
          id="submit-auth-btn"
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3 px-4 bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 text-[#111] font-black uppercase tracking-wider text-sm rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#111]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Processing...</span>
            </>
          ) : isSignUp ? (
            'Sign Up'
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t-[1.5px] border-[#444] text-center text-xs font-bold text-[#555] space-y-3">
        <div className="p-3.5 bg-[#FFF5CC] border-[2px] border-[#111] rounded-xl text-left text-[11px] font-bold text-[#111] space-y-2 shadow-[2px_2px_0_#111]">
          <div className="font-black uppercase text-[#111] flex items-center justify-between">
            <span>🎯 Recruiter Demo Credentials</span>
            <span className="px-1.5 py-0.5 text-[9px] bg-[#F5C842] rounded border border-[#111]">1-Click Login</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-[#111] space-y-1.5 font-mono text-[10px] text-[#111]">
            <div className="font-black text-[#5B21B6] uppercase text-[9px]">🏢 Org A (Acme Corp):</div>
            <div>• Owner: <span className="font-bold text-[#5B21B6]">owner.a@acme.com</span> / <span className="font-bold text-[#C49B10]">DemoPassword123!</span></div>
            <div>• Editor: <span className="font-bold text-[#5B21B6]">editor.a@acme.com</span> / <span className="font-bold text-[#C49B10]">DemoPassword123!</span></div>
            <div>• Viewer: <span className="font-bold text-[#5B21B6]">viewer.a@acme.com</span> / <span className="font-bold text-[#C49B10]">DemoPassword123!</span></div>

            <div className="font-black text-[#5B21B6] uppercase text-[9px] pt-1">🏢 Org B (Beta Corp — Isolated):</div>
            <div>• Owner: <span className="font-bold text-[#5B21B6]">owner.b@beta.com</span> / <span className="font-bold text-[#C49B10]">DemoPassword123!</span></div>
          </div>

          <p className="text-[10px] text-[#444] font-medium leading-tight">
            Click below to autofill and test live multi-tenant workflows:
          </p>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setEmail('owner.a@acme.com');
                setPassword('DemoPassword123!');
                setIsSignUp(false);
              }}
              className="py-1.5 px-2 bg-[#F5C842] hover:bg-[#E5B832] border border-[#111] rounded-lg text-[10px] font-black uppercase text-[#111] shadow-[1px_1px_0_#111] transition-all cursor-pointer truncate"
            >
              Fill Org A Owner
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('editor.a@acme.com');
                setPassword('DemoPassword123!');
                setIsSignUp(false);
              }}
              className="py-1.5 px-2 bg-[#F5EFE6] hover:bg-[#E0D5C1] border border-[#111] rounded-lg text-[10px] font-black uppercase text-[#111] shadow-[1px_1px_0_#111] transition-all cursor-pointer truncate"
            >
              Fill Org A Editor
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('viewer.a@acme.com');
                setPassword('DemoPassword123!');
                setIsSignUp(false);
              }}
              className="py-1.5 px-2 bg-[#F5EFE6] hover:bg-[#E0D5C1] border border-[#111] rounded-lg text-[10px] font-black uppercase text-[#111] shadow-[1px_1px_0_#111] transition-all cursor-pointer truncate"
            >
              Fill Org A Viewer
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('owner.b@beta.com');
                setPassword('DemoPassword123!');
                setIsSignUp(false);
              }}
              className="py-1.5 px-2 bg-[#A855F7] hover:bg-[#9333EA] border border-[#111] text-white rounded-lg text-[10px] font-black uppercase shadow-[1px_1px_0_#111] transition-all cursor-pointer truncate"
            >
              Fill Org B Owner
            </button>
          </div>
        </div>

        {isSignUp ? (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className="text-[#111] font-black uppercase underline hover:text-[#7B5CF5] ml-1"
            >
              Sign In
            </button>
          </p>
        ) : (
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className="text-[#111] font-black uppercase underline hover:text-[#7B5CF5] ml-1"
            >
              Sign Up
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
