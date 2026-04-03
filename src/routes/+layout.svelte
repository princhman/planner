<script lang="ts">
    import "./layout.css";

    import { PUBLIC_CONVEX_URL } from "$env/static/public";
    import { setupConvex } from "convex-svelte";
    import { initAuthStore } from "$lib/stores/auth-store.svelte";
    import { onMount } from "svelte";
    import { Toaster } from "$lib/components/ui/sonner/index.js";
    import { authState } from "$lib/stores/auth-store.svelte";

    const { children } = $props();
    setupConvex(PUBLIC_CONVEX_URL);

    onMount(() => {
        initAuthStore();
    });
</script>

<svelte:head>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="shortcut icon" href="/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <title>Revision Planner</title>
    <meta name="description" content="what should I revise?" />
    <meta name="theme-color" content="#fafafa" />
</svelte:head>

<Toaster position="top-center" />

<main class="mx-auto max-w-3xl px-4" class:py-4={authState.isAuthenticated}>
    {@render children()}
</main>
