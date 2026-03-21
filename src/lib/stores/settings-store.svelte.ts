import { browser } from "$app/environment";
import { getAuthUserId } from "$lib/stores/auth-store.svelte.js";
import { getConvexClient, getConvexApi } from "$lib/convex-client.js";

export type PlannerSettings = {
	importanceEnabled: boolean;
};

const DEFAULT_SETTINGS: PlannerSettings = {
	importanceEnabled: true,
};

const PREF_KEY = "importanceEnabled";

let plannerSettings = $state<PlannerSettings>({ ...DEFAULT_SETTINGS });

function settingsKey(): string {
	const userId = getAuthUserId();
	return userId ? `planner:settings:${userId}` : "planner:settings:local";
}

function readSettings(): PlannerSettings {
	if (!browser) return { ...DEFAULT_SETTINGS };

	try {
		const raw = localStorage.getItem(settingsKey());
		if (!raw) return { ...DEFAULT_SETTINGS };

		const parsed = JSON.parse(raw);
		return {
			importanceEnabled:
				typeof parsed?.importanceEnabled === "boolean"
					? parsed.importanceEnabled
					: DEFAULT_SETTINGS.importanceEnabled,
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function writeSettings(value: PlannerSettings): void {
	if (!browser) return;
	localStorage.setItem(settingsKey(), JSON.stringify(value));
}

async function syncToConvex(enabled: boolean): Promise<void> {
	const userId = getAuthUserId();
	if (!userId) return;

	try {
		const client = getConvexClient();
		const api = await getConvexApi();
		if (!client || !api) return;

		await client.mutation(api.preferences.set, {
			userId,
			key: PREF_KEY,
			value: JSON.stringify(enabled),
		});
	} catch {
		// Silently fail — localStorage is the fallback
	}
}

export async function loadSettingsFromConvex(): Promise<void> {
	const userId = getAuthUserId();
	if (!userId) return;

	try {
		const client = getConvexClient();
		const api = await getConvexApi();
		if (!client || !api) return;

		const value = await client.query(api.preferences.get, {
			userId,
			key: PREF_KEY,
		});

		if (value !== null) {
			// Cloud value exists — use it as source of truth
			const enabled = JSON.parse(value);
			plannerSettings = { ...plannerSettings, importanceEnabled: enabled };
			writeSettings(plannerSettings);
		} else {
			// First login — push current local setting to Convex
			await syncToConvex(plannerSettings.importanceEnabled);
		}
	} catch {
		// Silently fail — keep localStorage value
	}
}

export function initSettingsStore(): void {
	plannerSettings = readSettings();
}

export function getPlannerSettings(): PlannerSettings {
	return plannerSettings;
}

export function setImportanceEnabled(enabled: boolean): void {
	plannerSettings = { ...plannerSettings, importanceEnabled: enabled };
	writeSettings(plannerSettings);
	syncToConvex(enabled);
}
