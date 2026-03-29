<script lang="ts">
    // import CreateSubjectCard from "$lib/components/create-subject-card.svelte";
    import DndTest from "$lib/components/dnd-test.svelte";

    // import LoginCard from "$lib/components/login-card.svelte";
    // import SubjectList from "$lib/components/subject-list.svelte";
    // import { clearAuth, authState } from "$lib/stores/auth-store.svelte";

    // const isAuthenticated = $derived(authState.isAuthenticated);
</script>

<!-- {#if isAuthenticated}
    <span>You are authenticated</span>
    <button onclick={clearAuth}>logout</button>
    <CreateSubjectCard />
    <SubjectList />
{:else}
    <span>You need to login</span>
    <LoginCard />
{/if} -->

<DndTest />
