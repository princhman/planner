<script lang="ts">
    // Two jobs: (1) set up Convex, (2) tell Convex about the user's auth token.

    import "./layout.css";

    import { PUBLIC_CONVEX_URL } from "$env/static/public";
    import { setupConvex, useConvexClient } from "convex-svelte";
    import { onMount } from "svelte";
    import { Toaster } from "$lib/components/ui/sonner/index.js";

    const { children, data } = $props();

    setupConvex(PUBLIC_CONVEX_URL);

    const client = useConvexClient();

    onMount(() => {
        if (data.token) {
            client.setAuth(() => Promise.resolve(data.token));
        }
    });

    // Derive auth state from server data (no more localStorage!)
    const isAuthenticated = $derived(!!data.user);
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

<main class="mx-auto max-w-3xl px-4" class:py-4={isAuthenticated}>
    {@render children()}
</main>
