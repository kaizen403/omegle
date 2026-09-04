/**
 * useUser Hook
 *
 * Display name and gender from UserProvider. Session identity is assigned by
 * the server on socket connect (see SocketIOService.getSessionUid) — it is
 * not stored in this context.
 *
 * @returns {UserContextType} name, gender, and their setters
 * @throws {Error} If used outside of UserProvider
 */

import { useContext } from 'react';
import { UserContext, type UserContextType } from '@/providers/UserProvider';

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
