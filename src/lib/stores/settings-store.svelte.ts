import { browser } from "$app/environment";
import { getAuthUserId } from "$lib/stores/auth-store.svelte.js";

export type PlannerSettings = {
	importanceEnabled: boolean;
};

const DEFAULT_SETTINGS: PlannerSettings = {
	importanceEnabled: true,
};

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

export function initSettingsStore(): void {
	plannerSettings = readSettings();
}

export function getPlannerSettings(): PlannerSettings {
	return plannerSettings;
}

export function setImportanceEnabled(enabled: boolean): void {
	plannerSettings = { ...plannerSettings, importanceEnabled: enabled };
	writeSettings(plannerSettings);
}
