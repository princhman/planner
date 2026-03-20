<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/favicon.svg";
	import { initializePlannerStore } from "$lib/stores/planner-store.svelte.js";
	import { initAuthStore } from "$lib/stores/auth-store.svelte.js";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		initAuthStore();
		initializePlannerStore();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Revision Planner</title>
	<meta name="description" content="Local-first revision planner — what should I study?" />
	<meta name="theme-color" content="#fafafa" />
</svelte:head>

<div class="min-h-screen bg-neutral-50 text-neutral-900">
	<main class="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8">
		{@render children()}
	</main>
</div>
