import { browser } from "$app/environment";

/**
 * Authentication store.
 *
 * Manages user login state and Convex client connection.
 * Stores the user ID and Convex URL in localStorage.
 *
 * The actual Convex client setup and repository swap
 * happen in the layout component.
 */

const AUTH_KEYS = {
	userId: "planner:auth:userId",
	userEmail: "planner:auth:email",
	convexUrl: "planner:auth:convexUrl",
} as const;

// Reactive auth state
let userId = $state<string | null>(null);
let userEmail = $state<string | null>(null);
let isAuthenticated = $state(false);

export function initAuthStore(): void {
	if (!browser) return;
	userId = localStorage.getItem(AUTH_KEYS.userId);
	userEmail = localStorage.getItem(AUTH_KEYS.userEmail);
	isAuthenticated = !!userId;
}

export function getAuthUserId(): string | null {
	return userId;
}

export function getAuthUserEmail(): string | null {
	return userEmail;
}

export function getIsAuthenticated(): boolean {
	return isAuthenticated;
}

export function setAuthUser(id: string, email: string): void {
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
