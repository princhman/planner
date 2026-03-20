<script lang="ts">
	import { goto } from "$app/navigation";
	import { browser } from "$app/environment";
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
	} from "$lib/stores/settings-store.svelte.js";
	import { getConvexUrl } from "$lib/convex-client.js";
	import { ConvexClient } from "convex/browser";
	import { onMount } from "svelte";
	import PageHeader from "$lib/components/PageHeader.svelte";

	let isSignUp = $state(false);
	let email = $state("");
	let password = $state("");
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
			const client = new ConvexClient(convexUrl);

			let api: any;
			try {
				const mod = await import("$lib/convex-api-loader.js");
				api = mod.api;
			} catch {
				error = "Convex API not generated. Run 'npx convex dev' first.";
				isSubmitting = false;
				return;
			}

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

	async function handlePostLogin(client: ConvexClient, api: any) {
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

{#if isLoggedIn}
	<div class="space-y-4">
		<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
			<p class="text-xs text-neutral-400">Signed in as</p>
			<p class="mt-0.5 text-sm font-medium text-neutral-900">{userEmail}</p>
			<p class="mt-3 text-xs text-neutral-400">
				Your data is synced to the cloud.
			</p>
		</div>
		<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
			<p class="text-xs text-neutral-400">Preferences</p>
			<div class="mt-3 flex items-start justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-neutral-900">Use importance ratings</p>
					<p class="mt-1 text-xs leading-5 text-neutral-500">
						When disabled, importance dots are hidden and recommendations ignore importance.
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={plannerSettings.importanceEnabled}
					aria-label="Toggle importance ratings"
					onclick={() => setImportanceEnabled(!plannerSettings.importanceEnabled)}
					class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {plannerSettings.importanceEnabled ? 'bg-neutral-900' : 'bg-neutral-300'}"
				>
					<span
						class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform {plannerSettings.importanceEnabled ? 'translate-x-5' : 'translate-x-0.5'}"
					></span>
				</button>
			</div>
		</div>
		<button
			onclick={handleSignOut}
			class="text-sm text-neutral-400 transition-colors hover:text-neutral-700"
		>
			Sign out
		</button>
	</div>
{:else}
	<!-- Info -->
	<p class="text-sm text-neutral-400">
		Your planner works locally without an account. Create one to sync across devices.
	</p>

	<div class="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-100">
		<p class="text-xs text-neutral-400">Preferences</p>
		<div class="mt-3 flex items-start justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-neutral-900">Use importance ratings</p>
				<p class="mt-1 text-xs leading-5 text-neutral-500">
					This is saved in this browser until you sign in to an account.
				</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={plannerSettings.importanceEnabled}
				aria-label="Toggle importance ratings"
				onclick={() => setImportanceEnabled(!plannerSettings.importanceEnabled)}
				class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {plannerSettings.importanceEnabled ? 'bg-neutral-900' : 'bg-neutral-300'}"
			>
				<span
					class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform {plannerSettings.importanceEnabled ? 'translate-x-5' : 'translate-x-0.5'}"
				></span>
			</button>
		</div>
	</div>

	{#if !convexUrl}
		<div class="mt-5 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
			<p class="text-xs font-medium text-amber-700">Convex not configured</p>
			<ol class="mt-2 list-inside list-decimal space-y-1 text-xs text-amber-600">
				<li>Run <code class="rounded bg-amber-100 px-1">npx convex dev</code></li>
				<li>Add <code class="rounded bg-amber-100 px-1">PUBLIC_CONVEX_URL</code> to <code class="rounded bg-amber-100 px-1">.env.local</code></li>
				<li>Restart the dev server</li>
			</ol>
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="mt-5 space-y-4">
			<h2 class="text-sm font-medium text-neutral-700">
				{isSignUp ? "Create account" : "Sign in"}
			</h2>

			<div>
				<label for="email" class="block text-xs font-medium text-neutral-500">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					class="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
				/>
			</div>

			<div>
				<label for="password" class="block text-xs font-medium text-neutral-500">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="At least 8 characters"
					class="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
				/>
			</div>

			{#if error}
				<p class="text-xs text-red-500">{error}</p>
			{/if}

			{#if importStatus}
				<p class="text-xs text-green-600">{importStatus}</p>
			{/if}

			<div class="flex items-center gap-3 pt-1">
				<button
					type="submit"
					disabled={isSubmitting}
					class="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
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
					class="text-xs text-neutral-400 hover:text-neutral-600"
				>
					{isSignUp ? "Have an account? Sign in" : "Need an account? Sign up"}
				</button>
			</div>
		</form>
	{/if}
{/if}
