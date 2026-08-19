'use client';

import { useAuthenticationStatus, useUserData, useAccessToken, useSignOut } from '@nhost/react';

export function useAuth() {
  const { isAuthenticated, isLoading, error } = useAuthenticationStatus();
  const user = useUserData();
  const accessToken = useAccessToken();
  const { signOut } = useSignOut();

  return {
    isAuthenticated: !!isAuthenticated,
    isLoading,
    error,
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.displayName || user.email,
          avatarUrl: user.avatarUrl,
        }
      : null,
    userId: user?.id || null,
    userEmail: user?.email || null,
    accessToken,
    signOut,
  };
}
