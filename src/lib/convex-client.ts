import { browser } from "$app/environment";
import { PUBLIC_CONVEX_URL } from "$env/static/public";
import { ConvexClient } from "convex/browser";
import { api } from "./convex-api-loader.js";

/**
 * Helper to get the Convex client and generated API.
 */

let cachedClient: ConvexClient | null = null;

export type ConvexApi = typeof api;

export function getConvexUrl(): string {
	if (!browser) return "";
	return PUBLIC_CONVEX_URL;
}

export function getConvexClient(): ConvexClient | null {
	const url = getConvexUrl();
	if (!url) return null;

	if (!cachedClient) {
		cachedClient = new ConvexClient(url);
	}
	return cachedClient;
}

export function getConvexApi(): ConvexApi {
	return api;
}

export function isConvexConfigured(): boolean {
	return !!getConvexUrl();
}
