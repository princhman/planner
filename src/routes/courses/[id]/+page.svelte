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
    import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";

    let { params }: PageProps = $props();
    let userId = $derived(authState.userId);

    const client = useConvexClient();
    let topicTitle = $state("");
    let isBacklogMode = $state(false);
    let isEditMode = $state(false);
    let showAddTopic = $state(false);

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
            <Breadcrumb.Root>
                <Breadcrumb.List>
                    <Breadcrumb.Item>
                        <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
                    </Breadcrumb.Item>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                        <Breadcrumb.Page
                            >{course.data?.name}{isBacklogMode
                                ? " (backloging)"
                                : isEditMode
                                  ? " (editing)"
                                  : ""}</Breadcrumb.Page
                        >
                    </Breadcrumb.Item>
                </Breadcrumb.List>
            </Breadcrumb.Root>
        </div>
        <div class="flex gap-1">
            {#if !isEditMode}
                <Button
                    onclick={() => {
                        isBacklogMode = !isBacklogMode;
                    }}
                    variant={isBacklogMode ? "default" : "outline"}
                    size="sm"><FileClock /><span>Backlog mode</span></Button
                >
            {/if}
            {#if isEditMode}
                <Button
                    variant={showAddTopic ? "default" : "outline"}
                    size="icon-sm"
                    onclick={() => {
                        showAddTopic = !showAddTopic;
                    }}
                >
                    <Plus />
                </Button>
            {/if}
            <Button
                variant={isEditMode ? "default" : "outline"}
                size="icon-sm"
                onclick={() => {
                    isEditMode = !isEditMode;
                    if (!isEditMode) showAddTopic = false;
                }}
            >
                <Pencil />
            </Button>
        </div>
    </div>
{/if}
{#if showAddTopic}
    <div class="flex">
        <Input
            bind:value={topicTitle}
            onkeydown={(e) =>
                e.key === "Enter" && topicTitle.trim() !== "" && addTopic()}
        />
        <Button disabled={!topicTitle.trim()} onclick={addTopic}>Add</Button>
    </div>
{/if}
{#if topics.data}
    <details
        class="text-sm text-muted-foreground [&>summary]:cursor-pointer [&>summary]:select-none"
    >
        <summary
            class="text-sm font-medium hover:text-foreground transition-colors w-fit"
            >How does this work?</summary
        >
        <div class="mt-1.5 space-y-1 text-sm">
            {#if isBacklogMode}
                <p>
                    Backlog mode: In this mode, you do not update last recall
                    date, only the confidence and your understanding stability
                    (how long it takes for your understanding to go from 100% to
                    90%).
                </p>
            {:else}
                <p>
                    Any confidence update would be considered to be a review,
                    last recall date would be set to today. To just update
                    confidence, use backlog mode.
                </p>
            {/if}
            <p>
                In summaries, a topic that has subtopics is counted using the
                lowest confidence level of its subtopics.
            </p>
        </div>
    </details>
    {#if topics.data.length > 0}
        <DndList
            dbTopics={topics.data}
            update={updateTopics}
            courseId={params.id}
            {isBacklogMode}
            {isEditMode}
        />
    {:else}
        <p>No topics found.</p>
    {/if}
{/if}
