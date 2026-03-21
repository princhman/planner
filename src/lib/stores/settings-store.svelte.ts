import { browser } from "$app/environment";
import { getAuthUserId } from "$lib/stores/auth-store.svelte.js";
import { getConvexClient, getConvexApi } from "$lib/convex-client.js";

export type ThemeChoice = "system" | "light" | "dark";

export type PlannerSettings = {
	importanceEnabled: boolean;
	theme: ThemeChoice;
};

const DEFAULT_SETTINGS: PlannerSettings = {
	importanceEnabled: true,
	theme: "system",
};

const PREF_KEY = "importanceEnabled";
const THEME_PREF_KEY = "theme";
const THEME_STORAGE_KEY = "planner:theme";

let plannerSettings = $state<PlannerSettings>({ ...DEFAULT_SETTINGS });
let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

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
			theme:
				parsed?.theme === "light" || parsed?.theme === "dark"
					? parsed.theme
					: DEFAULT_SETTINGS.theme,
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function writeSettings(value: PlannerSettings): void {
	if (!browser) return;
	localStorage.setItem(settingsKey(), JSON.stringify(value));
}

function applyThemeToDOM(isDark: boolean): void {
	if (!browser) return;
	const root = document.documentElement;
	if (isDark) {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
	// Update theme-color meta for mobile browsers
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute("content", isDark ? "#18191f" : "#fafafa");
	}
}

function resolveIsDark(theme: ThemeChoice): boolean {
	if (theme === "dark") return true;
	if (theme === "light") return false;
	// system
	if (!browser) return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(): void {
	if (!browser) return;

	// Clean up previous system listener
	if (mediaQuery && mediaListener) {
		mediaQuery.removeEventListener("change", mediaListener);
		mediaListener = null;
		mediaQuery = null;
	}

	const theme = plannerSettings.theme;

	// Write the raw theme choice to a simple key so the flash-prevention
	// script in app.html can read it before the app boots
	localStorage.setItem(THEME_STORAGE_KEY, theme);

	applyThemeToDOM(resolveIsDark(theme));

	// If "system", listen for OS changes
	if (theme === "system") {
		mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		mediaListener = (e: MediaQueryListEvent) => {
			applyThemeToDOM(e.matches);
		};
		mediaQuery.addEventListener("change", mediaListener);
	}
}

async function syncToConvex(key: string, value: string): Promise<void> {
	const userId = getAuthUserId();
	if (!userId) return;

	try {
		const client = getConvexClient();
		const api = await getConvexApi();
		if (!client || !api) return;

		await client.mutation(api.preferences.set, {
			userId,
			key,
			value: JSON.stringify(value),
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

		// Load importanceEnabled
		const impValue = await client.query(api.preferences.get, {
			userId,
			key: PREF_KEY,
		});

		if (impValue !== null) {
			const enabled = JSON.parse(impValue);
			plannerSettings = { ...plannerSettings, importanceEnabled: enabled };
		} else {
			await syncToConvex(PREF_KEY, JSON.stringify(plannerSettings.importanceEnabled));
		}

		// Load theme
		const themeValue = await client.query(api.preferences.get, {
			userId,
			key: THEME_PREF_KEY,
		});

		if (themeValue !== null) {
			const theme = JSON.parse(themeValue);
			if (theme === "light" || theme === "dark" || theme === "system") {
				plannerSettings = { ...plannerSettings, theme };
				applyTheme();
			}
		} else {
			await syncToConvex(THEME_PREF_KEY, plannerSettings.theme);
		}

		writeSettings(plannerSettings);
	} catch {
		// Silently fail — keep localStorage value
	}
}

export function initSettingsStore(): void {
	plannerSettings = readSettings();
	applyTheme();
}

export function getPlannerSettings(): PlannerSettings {
	return plannerSettings;
}

export function setImportanceEnabled(enabled: boolean): void {
	plannerSettings = { ...plannerSettings, importanceEnabled: enabled };
	writeSettings(plannerSettings);
	syncToConvex(PREF_KEY, JSON.stringify(enabled));
}

export function setTheme(theme: ThemeChoice): void {
	plannerSettings = { ...plannerSettings, theme };
	writeSettings(plannerSettings);
	applyTheme();
	syncToConvex(THEME_PREF_KEY, theme);
}
