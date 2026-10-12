"use client";
import { createAuthClient } from "better-auth/react";

// Same-origin requests only. OAuth credentials and DB access stay on the server.
export const authClient = createAuthClient();
