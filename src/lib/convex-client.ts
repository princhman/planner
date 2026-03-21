import { browser } from "$app/environment";
import { PUBLIC_CONVEX_URL } from "$env/static/public";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex-api-loader.js";

/**
 * Helper to get the Convex client and generated API.
 */

let cachedClient: ConvexHttpClient | null = null;

export type ConvexApi = typeof api;

export function getConvexUrl(): string {
	if (!browser) return "";
	return PUBLIC_CONVEX_URL;
}

export function getConvexClient(): ConvexHttpClient | null {
	const url = getConvexUrl();
	if (!url) return null;

	if (!cachedClient) {
		// This app performs direct query/mutation calls and doesn't rely on
		// live subscriptions, so use HTTP to avoid browser-specific websocket issues.
		cachedClient = new ConvexHttpClient(url);
	}
	return cachedClient;
}

export function getConvexApi(): ConvexApi {
	return api;
}

export function isConvexConfigured(): boolean {
	return !!getConvexUrl();
}
