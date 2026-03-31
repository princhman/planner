<script lang="ts">
    import { api } from "$convex/_generated/api";
    import { authState } from "$lib/stores/auth-store.svelte";
    import { useQuery } from "convex-svelte";

    const userId = $derived(authState.userId);

    const includeNotStarted = $state(true);

    const recomendations = useQuery(api.topics.recomendations, () =>
        userId ? { userId, includeNotStarted } : "skip",
    );
</script>

<!-- for now just all, need to add picker for started and course -->

<div>
    {#if recomendations.data?.length == 0}
        <p>
            No recommendations found based on the selected criteria. Consider
            changing them.
        </p>
    {:else}
        {#each recomendations.data as recomendation}
            <div>
                <span>{recomendation.topic.title}</span>
                <span>{recomendation.priority}</span>
            </div>
        {/each}
    {/if}
</div>
