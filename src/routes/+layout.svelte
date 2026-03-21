<script lang="ts">
	import "./layout.css";
	import { initializePlannerStore } from "$lib/stores/planner-store.svelte.js";
	import { initAuthStore } from "$lib/stores/auth-store.svelte.js";
	import { initSettingsStore } from "$lib/stores/settings-store.svelte.js";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		initAuthStore();
		initSettingsStore();
		void initializePlannerStore();
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
	<link rel="shortcut icon" href="/favicon-32.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<title>Revision Planner</title>
	<meta name="description" content="Local-first revision planner — what should I study?" />
	<meta name="theme-color" content="#fafafa" />
</svelte:head>

<div class="min-h-screen bg-neutral-50 text-neutral-900">
	<main class="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8">
		{@render children()}
	</main>
</div>
