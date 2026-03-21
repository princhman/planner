import { browser } from "$app/environment";
import type { Id } from "$convex/_generated/dataModel.js";

/**
 * Authentication store.
 *
 * Manages user login state and Convex client connection.
 * Stores the user ID and email in localStorage.
 *
 * The actual Convex client setup and repository swap
 * happen in the layout component.
 */

const AUTH_KEYS = {
	userId: "planner:auth:userId",
	userEmail: "planner:auth:email",
} as const;

// Reactive auth state
let userId = $state<Id<"users"> | null>(null);
let userEmail = $state<string | null>(null);
let isAuthenticated = $state(false);

export function initAuthStore(): void {
	if (!browser) return;
	userId = localStorage.getItem(AUTH_KEYS.userId) as Id<"users"> | null;
	userEmail = localStorage.getItem(AUTH_KEYS.userEmail);
	isAuthenticated = !!userId;
}

export function getAuthUserId(): Id<"users"> | null {
	return userId;
}

export function getAuthUserEmail(): string | null {
	return userEmail;
}

export function getIsAuthenticated(): boolean {
	return isAuthenticated;
}

export function setAuthUser(id: Id<"users">, email: string): void {
	if (!browser) return;
	userId = id;
	userEmail = email;
	isAuthenticated = true;
	localStorage.setItem(AUTH_KEYS.userId, id);
	localStorage.setItem(AUTH_KEYS.userEmail, email);
}

export function clearAuth(): void {
	if (!browser) return;
	userId = null;
	userEmail = null;
	isAuthenticated = false;
	localStorage.removeItem(AUTH_KEYS.userId);
	localStorage.removeItem(AUTH_KEYS.userEmail);
}
