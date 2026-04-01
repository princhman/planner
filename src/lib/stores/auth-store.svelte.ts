import { browser } from "$app/environment";
import type { Id } from "$convex/_generated/dataModel.js";

const AUTH_KEYS = {
  userId: "planner:auth:userId",
  userEmail: "planner:auth:email",
} as const;

export const authState = $state({
  userId: null as Id<"users"> | null,
  userEmail: null as string | null,
  isAuthenticated: false,
});

export function initAuthStore(): void {
  if (!browser) return;
  authState.userId = localStorage.getItem(
    AUTH_KEYS.userId,
  ) as Id<"users"> | null;
  authState.userEmail = localStorage.getItem(AUTH_KEYS.userEmail);
  authState.isAuthenticated = !!authState.userId;
}

export function setAuthUser(id: Id<"users">, email: string): void {
  if (!browser) return;
  console.log("Setting");
  authState.userId = id;
  authState.userEmail = email;
  authState.isAuthenticated = true;
  localStorage.setItem(AUTH_KEYS.userId, id);
  localStorage.setItem(AUTH_KEYS.userEmail, email);
}

export function clearAuth(): void {
  if (!browser) return;
  authState.userId = null;
  authState.userEmail = null;
  authState.isAuthenticated = false;
  localStorage.removeItem(AUTH_KEYS.userId);
  localStorage.removeItem(AUTH_KEYS.userEmail);
}
