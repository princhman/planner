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
    import { FileClock, Pencil, Plus } from "lucide-svelte";

    let { params }: PageProps = $props();
    let userId = $derived(authState.userId);

    const client = useConvexClient();
    let topicTitle = $state("");
    let isBacklogMode = $state(false);

    const course = useQuery(api.courses.get, () =>
        userId ? { id: params.id as Id<"courses">, userId } : "skip",
    );
    const topics = useQuery(api.topics.listByCourse, () =>
        userId ? { courseId: params.id as Id<"courses">, userId } : "skip",
    );
    const addTopic = () => {
        if (userId) {
            client.mutation(api.topics.add, {
                userId,
                courseId: params.id as Id<"courses">,
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
            courseId: params.id as Id<"courses">,
            userId,
        };
        client.mutation(
            api.topics.update,
            { updates },
            {
                optimisticUpdate: (localStore) => {
                    const existing = localStore.getQuery(
                        api.topics.listByCourse,
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
                        api.topics.listByCourse,
                        queryArgs,
                        next,
                    );
                },
            },
        );
    };
</script>

{#if course}
    <div class="flex justify-between items-center">
        <div class="gap-1 flex">
            <a href="/">Home</a>
            <p>{" > "}</p>
            <p>{course.data?.name}</p>
        </div>
        <div class="flex gap-1">
            <Button
                onclick={() => {
                    isBacklogMode = !isBacklogMode;
                }}
                variant="outline"
                size="sm"
                ><FileClock /><span
                    >{isBacklogMode
                        ? "Disable backlog"
                        : "Enable backlog"}</span
                ></Button
            >
            <Button variant="outline" size="icon-sm" onclick={() => {}}>
                <Plus />
            </Button>
            <Button variant="outline" size="icon-sm" onclick={() => {}}>
                <Pencil />
            </Button>
        </div>
    </div>
{/if}
<div class="flex">
    <Input
        bind:value={topicTitle}
        onkeydown={(e) =>
            e.key === "Enter" && topicTitle.trim() !== "" && addTopic()}
    />
    <Button disabled={!topicTitle.trim()} onclick={addTopic}>Add</Button>
</div>
{#if topics.data}
    <p class="text-gray-500">
        In summaries, a topic that has subtopics is counted using the lowest
        confidence level of its subtopics.
    </p>
    {#if topics.data.length > 0}
        <DndList
            dbTopics={topics.data}
            update={updateTopics}
            courseId={params.id}
            {isBacklogMode}
        />
    {:else}
        <p>No topics found.</p>
    {/if}
{/if}
