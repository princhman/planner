<script lang="ts">
    import { useConvexClient, useQuery } from "convex-svelte";
    import type { PageProps } from "./$types";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { authState } from "$lib/stores/auth-store.svelte";
    import Input from "$lib/components/ui/input/input.svelte";
    import Button from "$lib/components/ui/button/button.svelte";

    let { params }: PageProps = $props();
    let userId = $derived(authState.userId);
    const client = useConvexClient();
    let topicTitle = $state("");
    const subject = useQuery(api.subjects.get, () =>
        userId ? { id: params.id as Id<"subjects">, userId } : "skip",
    );
    const topics = useQuery(api.topics.listBySubject, () =>
        userId ? { subjectId: params.id as Id<"subjects">, userId } : "skip",
    );
    const addTopic = () => {
        if (userId) {
            client.mutation(api.topics.add, {
                userId,
                subjectId: params.id as Id<"subjects">,
                title: topicTitle,
            });
            topicTitle = "";
        }
    };
</script>

{#if subject}
    <p>{subject.data?.name}</p>
{/if}
{#if topics.data}
    {#if topics.data?.length > 0}
        <ul>
            {#each topics.data as topic}
                <li>{topic.order}. {topic.title}</li>
            {/each}
        </ul>
    {:else}
        <p>No topics found.</p>
    {/if}
{/if}
<Input bind:value={topicTitle}></Input>
<Button onclick={addTopic}>Add</Button>
