import { browser } from "$app/environment";
import { ConvexClient } from "convex/browser";

/**
 * Helper to get the Convex client and API.
 *
 * The Convex API module (`_generated/api.js`) is only available after
 * running `npx convex dev`. This helper handles the case where it
 * doesn't exist yet.
 */

let cachedClient: ConvexClient | null = null;
let cachedApi: any = null;

export function getConvexUrl(): string {
	if (!browser) return "";
	return (import.meta.env?.PUBLIC_CONVEX_URL as string) ?? "";
}

export function getConvexClient(): ConvexClient | null {
	const url = getConvexUrl();
	if (!url) return null;

	if (!cachedClient) {
		cachedClient = new ConvexClient(url);
	}
	return cachedClient;
}

export async function getConvexApi(): Promise<any | null> {
	if (cachedApi) return cachedApi;

	try {
		// Use a variable to prevent static analysis from failing on missing module
		const modulePath = "./convex-api-loader.js";
		const mod = await import(/* @vite-ignore */ modulePath);
		cachedApi = mod.api;
		return cachedApi;
	} catch {
		return null;
	}
}

export function isConvexConfigured(): boolean {
	return !!getConvexUrl();
}
