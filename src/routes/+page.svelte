<script lang="ts">
    import LoginCard from "$lib/components/login-card.svelte";
    import { clearAuth, authState } from "$lib/stores/auth-store.svelte";

    const isAuthenticated = $derived(authState.isAuthenticated);
</script>

{#if isAuthenticated}
    <span>You are authenticated</span>
    <button onclick={clearAuth}>logout</button>
{:else}
    <span>You need to login</span>
    <LoginCard />
{/if}
