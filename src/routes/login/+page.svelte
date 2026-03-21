<script lang="ts">
	import { goto } from "$app/navigation";
	import { browser } from "$app/environment";
	import { Eye, EyeOff } from "lucide-svelte";
	import {
		getIsAuthenticated,
		getAuthUserEmail,
		setAuthUser,
		clearAuth,
		initAuthStore,
	} from "$lib/stores/auth-store.svelte.js";
	import {
		refreshSubjects,
		setRepository,
		initializePlannerStore,
		getRepository,
	} from "$lib/stores/planner-store.svelte.js";
	import {
		hasLocalPlannerData,
		readSubjects,
		readTopics,
		readStudySessions,
		clearLocalPlannerData,
	} from "$lib/stores/local-storage.js";
	import { ConvexRepository } from "$lib/stores/convex-repository.js";
	import { LocalRepository } from "$lib/stores/local-repository.js";
	import {
		getPlannerSettings,
		initSettingsStore,
		setImportanceEnabled,
		setTheme,
		loadSettingsFromConvex,
	} from "$lib/stores/settings-store.svelte.js";
	import type { ThemeChoice } from "$lib/stores/settings-store.svelte.js";
	import { Monitor, Sun, Moon } from "lucide-svelte";
	import { getConvexApi, getConvexClient, getConvexUrl } from "$lib/convex-client.js";
	import { onMount } from "svelte";
	import PageHeader from "$lib/components/PageHeader.svelte";

	let isSignUp = $state(false);
	let email = $state("");
	let password = $state("");
	let showPassword = $state(false);
	let error = $state("");
	let isSubmitting = $state(false);
	let importStatus = $state("");

	let isLoggedIn = $derived(getIsAuthenticated());
	let userEmail = $derived(getAuthUserEmail());
	let plannerSettings = $derived(getPlannerSettings());

	let convexUrl = $state("");

	onMount(() => {
		initAuthStore();
		initSettingsStore();
		convexUrl = getConvexUrl();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = "";

		if (!convexUrl) {
			error = "Convex is not configured. Set PUBLIC_CONVEX_URL in your environment.";
			return;
		}

		if (!email.trim()) {
			error = "Email is required.";
			return;
		}

		if (password.length < 8) {
			error = "Password must be at least 8 characters.";
			return;
		}

		isSubmitting = true;
		try {
			const client = getConvexClient();
			if (!client) {
				error = "Convex client could not be created. Check PUBLIC_CONVEX_URL.";
				return;
			}

			const api = getConvexApi();

			if (isSignUp) {
				const userId = await client.mutation(api.auth.signUp, {
					email: email.trim(),
					password,
				});
				setAuthUser(userId, email.trim());
			} else {
				const userId = await client.mutation(api.auth.signIn, {
					email: email.trim(),
					password,
				});
				setAuthUser(userId, email.trim());
			}
			initSettingsStore();

			await handlePostLogin(client, api);
		} catch (err) {
			error = err instanceof Error ? err.message : "Authentication failed.";
		} finally {
			isSubmitting = false;
		}
	}

	async function handlePostLogin(
		client: NonNullable<ReturnType<typeof getConvexClient>>,
		api: NonNullable<Awaited<ReturnType<typeof getConvexApi>>>,
	) {
		const userId = (await import("$lib/stores/auth-store.svelte.js")).getAuthUserId();
		if (!userId) return;

		const remoteHasData = await client.query(api.auth.hasData, { userId });

		if (!remoteHasData && hasLocalPlannerData()) {
			importStatus = "Importing your local data...";

			const localSubjects = readSubjects();
			const localTopics = readTopics();
			const localSessions = readStudySessions();

			await client.mutation(api.import.importLocalData, {
				userId,
				subjects: localSubjects.map((s) => ({
					localId: s.id,
					name: s.name,
					examDate: s.examDate ?? undefined,
					defaultSessionMinutes: s.defaultSessionMinutes,
					createdAt: s.createdAt,
					updatedAt: s.updatedAt,
				})),
				topics: localTopics.map((t) => ({
					localId: t.id,
					localSubjectId: t.subjectId,
					localParentTopicId: t.parentTopicId ?? undefined,
					code: t.code,
					title: t.title,
					depth: t.depth,
					importance: t.importance,
					confidence: t.confidence,
					lastStudiedAt: t.lastStudiedAt ?? undefined,
					lastRecallAt: t.lastRecallAt ?? undefined,
					createdAt: t.createdAt,
					updatedAt: t.updatedAt,
				})),
				sessions: localSessions.map((s) => ({
					localSubjectId: s.subjectId,
					localTopicId: s.topicId,
					actionType: s.actionType,
					plannedMinutes: s.plannedMinutes,
					completedAt: s.completedAt,
					confidenceBefore: s.confidenceBefore,
					confidenceAfter: s.confidenceAfter ?? undefined,
				})),
			});

			clearLocalPlannerData();
			importStatus = "Import complete!";
		}

		const repo = new ConvexRepository(client, userId, api);
		setRepository(repo);
		await refreshSubjects();
		await loadSettingsFromConvex();

		goto("/");
	}

	async function handleSignOut() {
		clearAuth();
		initSettingsStore();
		setRepository(new LocalRepository());
		await initializePlannerStore();
		goto("/");
	}
</script>

<PageHeader title="Account" />

{#snippet themeToggle()}
	{@const themes: { value: ThemeChoice; label: string; icon: typeof Monitor }[] = [
		{ value: "system", label: "System", icon: Monitor },
		{ value: "light", label: "Light", icon: Sun },
		{ value: "dark", label: "Dark", icon: Moon },
	]}
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-sm font-medium text-neutral-900 dark:text-white">Appearance</p>
			<p class="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
				Choose between light and dark mode, or follow your system setting.
			</p>
		</div>
	</div>
	<div class="mt-3 flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-700">
		{#each themes as t}
			{@const isActive = plannerSettings.theme === t.value}
			<button
				type="button"
				onclick={() => setTheme(t.value)}
				class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isActive
					? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-white'
					: 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'}"
			>
				<t.icon size={14} />
				{t.label}
			</button>
		{/each}
	</div>
{/snippet}

{#if isLoggedIn}
	<div class="space-y-4">
		<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-600">
			<p class="text-xs text-neutral-400 dark:text-neutral-400">Signed in as</p>
			<p class="mt-0.5 text-sm font-medium text-neutral-900 dark:text-white">{userEmail}</p>
			<p class="mt-3 text-xs text-neutral-400 dark:text-neutral-400">
				Your data is synced to the cloud.
			</p>
		</div>
		<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-600">
			<p class="text-xs text-neutral-400 dark:text-neutral-400">Preferences</p>
			<div class="mt-3 flex items-start justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-neutral-900 dark:text-white">Use importance ratings</p>
					<p class="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
						When disabled, importance dots are hidden and recommendations ignore importance.
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={plannerSettings.importanceEnabled}
					aria-label="Toggle importance ratings"
					onclick={() => setImportanceEnabled(!plannerSettings.importanceEnabled)}
					class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {plannerSettings.importanceEnabled ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-600'}"
				>
					<span
						class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-800 {plannerSettings.importanceEnabled ? 'translate-x-5' : 'translate-x-0.5'}"
					></span>
				</button>
			</div>
			<div class="mt-5 border-t border-neutral-100 pt-5 dark:border-neutral-700">
				{@render themeToggle()}
			</div>
		</div>
		<button
			onclick={handleSignOut}
			class="text-sm text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
		>
			Sign out
		</button>
	</div>
{:else}
	<!-- Info -->
	<p class="text-sm text-neutral-400 dark:text-neutral-400">
		Your planner works locally without an account. Create one to sync across devices.
	</p>

	<div class="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-600">
		<p class="text-xs text-neutral-400 dark:text-neutral-400">Preferences</p>
		<div class="mt-3 flex items-start justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-neutral-900 dark:text-white">Use importance ratings</p>
				<p class="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
					This is saved in this browser until you sign in to an account.
				</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={plannerSettings.importanceEnabled}
				aria-label="Toggle importance ratings"
				onclick={() => setImportanceEnabled(!plannerSettings.importanceEnabled)}
				class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {plannerSettings.importanceEnabled ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-600'}"
			>
				<span
					class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-800 {plannerSettings.importanceEnabled ? 'translate-x-5' : 'translate-x-0.5'}"
				></span>
			</button>
		</div>
		<div class="mt-5 border-t border-neutral-100 pt-5 dark:border-neutral-700">
			{@render themeToggle()}
		</div>
	</div>

	{#if !convexUrl}
		<div class="mt-5 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950 dark:ring-amber-800">
			<p class="text-xs font-medium text-amber-700 dark:text-amber-300">Convex not configured</p>
			<ol class="mt-2 list-inside list-decimal space-y-1 text-xs text-amber-600 dark:text-amber-400">
				<li>Run <code class="rounded bg-amber-100 px-1 dark:bg-amber-900">npx convex dev</code></li>
				<li>Add <code class="rounded bg-amber-100 px-1 dark:bg-amber-900">PUBLIC_CONVEX_URL</code> to <code class="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.local</code></li>
				<li>Restart the dev server</li>
			</ol>
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="mt-5 space-y-4">
			<h2 class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
				{isSignUp ? "Create account" : "Sign in"}
			</h2>

			<div>
				<label for="email" class="block text-xs font-medium text-neutral-500 dark:text-neutral-400">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					class="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:bg-neutral-700 dark:text-white dark:ring-neutral-600 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-500"
				/>
			</div>

			<div>
				<label for="password" class="block text-xs font-medium text-neutral-500 dark:text-neutral-400">Password</label>
				<div class="relative mt-1">
					<input
						id="password"
						type={showPassword ? "text" : "password"}
						bind:value={password}
						placeholder="At least 8 characters"
						class="block w-full rounded-lg border-0 bg-white px-3 py-2.5 pr-11 text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:bg-neutral-700 dark:text-white dark:ring-neutral-600 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-500"
					/>
					<button
						type="button"
						aria-label={showPassword ? "Hide password" : "Show password"}
						aria-pressed={showPassword}
						onclick={() => (showPassword = !showPassword)}
						class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
					>
						{#if showPassword}
							<EyeOff class="h-4 w-4" />
						{:else}
							<Eye class="h-4 w-4" />
						{/if}
					</button>
				</div>
			</div>

			{#if error}
				<p class="text-xs text-red-500 dark:text-red-400">{error}</p>
			{/if}

			{#if importStatus}
				<p class="text-xs text-green-600 dark:text-green-400">{importStatus}</p>
			{/if}

			<div class="flex items-center gap-3 pt-1">
				<button
					type="submit"
					disabled={isSubmitting}
					class="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					{isSubmitting
						? "Please wait..."
						: isSignUp
							? "Create account"
							: "Sign in"}
				</button>
				<button
					type="button"
					onclick={() => { isSignUp = !isSignUp; error = ""; }}
					class="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200"
				>
					{isSignUp ? "Have an account? Sign in" : "Need an account? Sign up"}
				</button>
			</div>
		</form>
	{/if}
{/if}
