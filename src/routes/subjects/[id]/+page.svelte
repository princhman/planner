<script lang="ts">
    import { useConvexClient, useQuery } from "convex-svelte";
    import type { PageProps } from "./$types";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { authState } from "$lib/stores/auth-store.svelte";
    import Input from "$lib/components/ui/input/input.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import type { Topic } from "$lib/components/dnd/types";
    import DndList from "$lib/components/dnd/dnd-list.svelte";

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
    type TopicUpdate = {
        id: Id<"topics">;
        parentId?: Id<"topics">;
        order: number;
    };
    const updateTopics = (changed: Topic[]) => {
        if (!userId) return;

        const updates: TopicUpdate[] = changed.map((t) => ({
            id: t.id,
            parentId: t.parentId,
            order: t.order,
        }));
        const queryArgs = {
            subjectId: params.id as Id<"subjects">,
            userId,
        };
        client.mutation(
            api.topics.update,
            { updates },
            {
                optimisticUpdate: (localStore) => {
                    const existing = localStore.getQuery(
                        api.topics.listBySubject,
                        queryArgs,
                    );
                    if (!existing) return;

                    const byId = new Map(updates.map((u) => [u.id, u]));
                    const next = existing.map((topic) => {
                        const patch = byId.get(topic._id);
                        if (!patch) return topic;
                        return {
                            ...topic,
                            parentId: patch.parentId,
                            order: patch.order,
                        };
                    });

                    localStore.setQuery(
                        api.topics.listBySubject,
                        queryArgs,
                        next,
                    );
                },
            },
        );
    };
</script>

{#if subject}
    <p>{subject.data?.name}</p>
{/if}
<div class="flex">
    <Input
        bind:value={topicTitle}
        onkeydown={(e) => e.key === "Enter" && addTopic()}
    />
    <Button onclick={addTopic}>Add</Button>
</div>
{#if topics.data}
    {#if topics.data.length > 0}
        <DndList
            dbTopics={topics.data}
            update={updateTopics}
            subjectId={params.id}
        />
    {:else}
        <p>No topics found.</p>
    {/if}
{/if}
