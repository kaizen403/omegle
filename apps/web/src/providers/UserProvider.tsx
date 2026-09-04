/**
 * User Context and Provider
 * Manages user identity state for the session
 *
 * @description Provides the user's chosen display name and gender across the application.
 *
 * Session identity is NOT held here. The server assigns a session id on socket connect and
 * the client reads it back from the socket (see SocketIOService.getSessionUid). The previous
 * client-generated UID — derived from Date.now() — was guessable, so another peer could claim
 * an active session; identity must not be something the client chooses.
 */

'use client';

import React, { createContext, useState, useMemo, type ReactNode } from 'react';

export interface UserContextType {
  /** User's display name */
  name: string;
  /** User's selected gender */
  gender: string;
  /** Set the user's display name */
  setName: (name: string) => void;
  /** Set the user's gender */
  setGender: (gender: string) => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Male');

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      name,
      gender,
      setName,
      setGender,
    }),
    [name, gender]
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}
