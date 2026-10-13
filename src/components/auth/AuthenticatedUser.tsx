"use client";

import { createContext, useContext } from "react";

export type AuthenticatedUser = { id: string; name: string; email: string };

// Identity comes from the protected server layout, never from workspace storage.
export const AuthenticatedUserContext = createContext<AuthenticatedUser | null>(null);

export function useAuthenticatedUser() {
  return useContext(AuthenticatedUserContext);
}
