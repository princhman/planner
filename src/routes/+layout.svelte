<script lang="ts">
    // Generated with AI
    // Two jobs: (1) set up Convex, (2) tell Convex about the user's auth token.

    import "./layout.css";

    import { PUBLIC_CONVEX_URL } from "$env/static/public";
    import { setupConvex, useConvexClient } from "convex-svelte";
    import { Toaster } from "$lib/components/ui/sonner/index.js";

    const { children, data } = $props();

    setupConvex(PUBLIC_CONVEX_URL);

    const client = useConvexClient();

    // fetchToken is called by the Convex client whenever it needs a token —
    // both on initial connect and periodically to refresh before expiry.
    // It hits our server endpoint which can use the httpOnly refresh token
    // cookie to get a fresh access token from WorkOS.
    async function fetchToken(): Promise<string | null> {
        try {
            const res = await fetch("/auth/token");
            const { token } = await res.json();
            return token ?? null;
        } catch {
            return null;
        }
    }

    // Set auth once. The Convex client manages the lifecycle — it calls
    // fetchToken when needed (initial auth + scheduled refreshes).
    // On logout (data.user goes away), we pass a null-returning function
    // to tell Convex there's no authenticated user.
    let authSet = false;
    $effect(() => {
        if (data.user) {
            if (!authSet) {
                client.setAuth(fetchToken);
                authSet = true;
            }
        } else {
            if (authSet) {
                client.setAuth(() => Promise.resolve(null));
                authSet = false;
            }
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
    <title>Quextro Planner</title>
    <meta name="description" content="what should I revise?" />
    <meta name="theme-color" content="#fafafa" />
</svelte:head>

<Toaster position="top-center" />

<main class="mx-auto max-w-5xl px-4" class:py-4={isAuthenticated}>
    {@render children()}
</main>
