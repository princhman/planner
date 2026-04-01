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
    import { FileClock, GraduationCap, Pencil, Plus } from "lucide-svelte";
    import {
        confidenceLabels,
        confidenceBgColors,
    } from "$lib/confidence";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import Calendar from "$lib/components/ui/calendar/calendar.svelte";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import {
        getLocalTimeZone,
        today,
        parseDate,
        type CalendarDate,
    } from "@internationalized/date";

    let { params }: PageProps = $props();
    let userId = $derived(authState.userId);

    const client = useConvexClient();
    let topicTitle = $state("");
    let isBacklogMode = $state(false);
    let isEditMode = $state(false);
    let showAddTopic = $state(false);

    // Course edit state
    let editName = $state("");
    let editExamDate = $state<CalendarDate | undefined>(undefined);
    let datePickerOpen = $state(false);
    let isSaving = $state(false);

    function initEditFields() {
        editName = course.data?.name ?? "";
        const raw = course.data?.examDate;
        editExamDate = raw ? parseDate(raw) : undefined;
    }

    async function saveCourse() {
        if (!userId || !course.data) return;
        isSaving = true;
        await client.mutation(api.courses.update, {
            id: params.id as Id<"courses">,
            userId,
            name: editName,
            examDate: editExamDate?.toString() ?? "",
        });
        isSaving = false;
        isEditMode = false;
        showAddTopic = false;
    }

    const course = useQuery(api.courses.get, () =>
        userId ? { id: params.id as Id<"courses">, userId } : "skip",
    );

    const examLabel = $derived.by(() => {
        const raw = course.data?.examDate;
        if (!raw) return null;
        const ms = Date.parse(raw);
        if (Number.isNaN(ms)) return null;
        const days = Math.ceil((ms - Date.now()) / 86_400_000);
        if (days < 0) return "passed";
        if (days === 0) return "today";
        if (days === 1) return "tomorrow";
        return `in ${days}d`;
    });
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
    <div class="flex justify-between items-center pb-2">
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
            {#if examLabel}
                <span
                    class="flex items-center gap-1 text-xs text-muted-foreground ml-2"
                    title="Exam {examLabel}"
                >
                    <GraduationCap class="size-3.5" />
                    Exam {examLabel}
                </span>
            {/if}
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
                    if (!isEditMode) initEditFields();
                    isEditMode = !isEditMode;
                    if (!isEditMode) showAddTopic = false;
                }}
            >
                <Pencil />
            </Button>
        </div>
    </div>
{/if}
{#if isEditMode && course.data}
    <div class="flex items-end justify-between px-4 py-2 border rounded-sm">
        <div class="flex flex-col max-w-96 gap-2">
            <span class="text-md font-bold">Edit course</span>
            <div class="flex gap-2">
                <Label for="edit-name" class="px-1">Name</Label>
                <Input
                    id="edit-name"
                    bind:value={editName}
                    type="text"
                    class="font-normal"
                />
            </div>
            <div class="flex gap-3">
                <Label for="edit-date" class="px-1">Exam date</Label>
                <Popover.Root bind:open={datePickerOpen}>
                    <Popover.Trigger id="edit-date">
                        <Button
                            variant="outline"
                            class="w-full justify-between font-normal"
                        >
                            {editExamDate
                                ? editExamDate
                                      .toDate(getLocalTimeZone())
                                      .toLocaleDateString()
                                : "Select date"}
                            <ChevronDownIcon />
                        </Button>
                    </Popover.Trigger>
                    <Popover.Content
                        class="w-auto overflow-hidden p-0"
                        align="start"
                    >
                        <Calendar
                            type="single"
                            bind:value={editExamDate}
                            captionLayout="dropdown"
                            onValueChange={() => {
                                datePickerOpen = false;
                            }}
                            minValue={today(getLocalTimeZone())}
                        />
                    </Popover.Content>
                </Popover.Root>
            </div>
        </div>
        <div class="flex justify-end gap-2">
            <Button class="px-4 py-2 font-bold" onclick={saveCourse}
                >{isSaving ? "Saving..." : "Save"}
            </Button>
        </div>
    </div>
{/if}
{#if showAddTopic}
    <div class="flex items-end justify-between px-4 py-2 border rounded-sm">
        <div class="flex flex-col max-w-96 gap-2">
            <span class="text-md font-bold">Add topic</span>
            <div class="flex gap-2">
                <Label for="new-topic-title" class="px-1">Title</Label>
                <Input
                    id="new-topic-title"
                    bind:value={topicTitle}
                    type="text"
                    class="font-normal"
                    onkeydown={(e) =>
                        e.key === "Enter" &&
                        topicTitle.trim() !== "" &&
                        addTopic()}
                />
            </div>
        </div>
        <div class="flex justify-end gap-2">
            <Button disabled={!topicTitle.trim()} onclick={addTopic} class="px-4 py-2 font-bold">
                Add
            </Button>
        </div>
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
            <div class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {#each confidenceLabels as label, i}
                    <span class="flex items-center gap-1.5">
                        <div
                            class="{confidenceBgColors[i]} size-2.5 rounded-sm"
                        ></div>
                        {label}
                    </span>
                {/each}
            </div>
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
