<script lang="ts">
    import type { ConfidenceCounts, Topic } from "./types";
    import type { Id } from "$convex/_generated/dataModel";
    import { createSortable } from "@dnd-kit/svelte/sortable";
    import Button from "../ui/button/button.svelte";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { Brain, Check, GripVertical, Pencil } from "lucide-svelte";
    import Input from "../ui/input/input.svelte";
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import ConfidenceSelector from "../course/confidence-selector.svelte";
    import * as Popover from "../ui/popover";

    function formatDuration(ms: number): string {
        const abs = Math.abs(ms);
        const days = Math.floor(abs / 86_400_000);
        const hours = Math.floor((abs % 86_400_000) / 3_600_000);
        if (days > 0) return `${days}d ${hours}h`;
        const minutes = Math.floor((abs % 3_600_000) / 60_000);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    const config = {
        alignment: {
            x: "start",
            y: "center",
        },
        transition: {
            idle: true,
        },
    } as const;

    interface Props {
        topic: Topic;
        index: number;
        isCollapsed: boolean;
        toggleCollapse: (id: Id<"topics">) => void;
        canCollapse: boolean;
        editingTitleId: Id<"topics"> | null;
        isBacklogMode: boolean;
        isEditMode: boolean;
    }
    let {
        topic,
        index,
        isCollapsed,
        toggleCollapse,
        canCollapse,
        editingTitleId = $bindable(),
        isBacklogMode,
        isEditMode,
    }: Props = $props();

    const client = useConvexClient();

    const isEdit = $derived(editingTitleId === topic.id);
    const anotherIsEdting = $derived(
        editingTitleId !== null && editingTitleId !== topic.id,
    );
    let title = $state(topic.title);

    const sortable = createSortable({
        ...config,
        get id() {
            return topic.id;
        },
        get index() {
            return index;
        },
        get disabled() {
            return !isEditMode;
        },
        get data() {
            return {
                title: topic.title,
                order: topic.order,
                depth: topic.depth,
            };
        },
    });

    const updateTitle = () => {
        client.mutation(api.topics.updateTitle, { id: topic.id, title }); // maybe add optimistic updates later?
        editingTitleId = null;
    };

    const updateConfidence = (value: number) => {
        client.mutation(api.topics.updateConfidence, {
            id: topic.id,
            confidence: value,
            backlogMode: isBacklogMode,
        });
    };
</script>

<div {@attach sortable.attach} class="group relative w-full flex box-border">
    <div class="flex w-full items-center">
        <div
            class="flex flex-1 w-full items-center {sortable.isDragSource
                ? 'bg-gray-700'
                : 'max-w-md'}"
            style:margin-left="{topic.depth * 24}px"
        >
            <div class="w-5 h-5 items-center shrink-0">
                {#if canCollapse}
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        class="w-5 h-5 p-0"
                        onclick={() => toggleCollapse(topic.id)}
                    >
                        {#if isCollapsed}
                            <ChevronRight />
                        {:else}
                            <ChevronDown />
                        {/if}
                    </Button>
                {/if}
            </div>
            <div class="gap-1 flex items-center">
                <span class="shrink-0">{topic.order}.</span>
                {#if isEdit}
                    <Input
                        bind:value={title}
                        class="text-inherit! h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                        style="font: inherit"
                        onkeydown={(e) => e.key === "Enter" && updateTitle()}
                    />
                {:else}
                    <span class="flex-1 min-w-0 truncate max-w-xs md:max-w-sm">
                        {topic.title}</span
                    >
                {/if}
                {#if isEditMode}
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={anotherIsEdting}
                        class="w-5 h-5 p-0 {isEdit
                            ? 'visible'
                            : 'lg:invisible'} {!isEdit
                            ? 'lg:group-hover:visible'
                            : ''}"
                        onclick={() =>
                            isEdit
                                ? updateTitle()
                                : (editingTitleId = topic.id)}
                    >
                        {#if !isEdit}
                            <Pencil />
                        {:else}
                            <Check />
                        {/if}
                    </Button>
                {:else if topic.isLeaf}
                    <Popover.Root>
                        <Popover.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    {...props}
                                    size="icon-xs"
                                    variant="ghost"
                                    class="w-5 h-5 p-0 lg:invisible lg:group-hover:visible"
                                >
                                    <Brain />
                                </Button>
                            {/snippet}
                        </Popover.Trigger>
                        <Popover.Content class="w-auto" side="top">
                            <div class="grid gap-1 text-xs">
                                <div class="flex justify-between gap-4">
                                    <span class="text-muted-foreground"
                                        >Stability</span
                                    >
                                    <span
                                        >{topic.stability?.toFixed(1) ??
                                            "—"}d</span
                                    >
                                </div>
                                <div class="flex justify-between gap-4">
                                    <span class="text-muted-foreground"
                                        >Retrievability</span
                                    >
                                    <span
                                        >{topic.r != null
                                            ? `${(topic.r * 100).toFixed(0)}%`
                                            : "—"}</span
                                    >
                                </div>
                                <div class="flex justify-between gap-4">
                                    <span class="text-muted-foreground"
                                        >Last recall</span
                                    >
                                    <span
                                        >{topic.lastRecallAt
                                            ? new Date(
                                                  topic.lastRecallAt,
                                              ).toLocaleDateString()
                                            : "Never"}</span
                                    >
                                </div>
                                <div class="flex justify-between gap-4">
                                    <span class="text-muted-foreground"
                                        >Next review</span
                                    >
                                    <span>
                                        {#if topic.nextReview == null}
                                            —
                                        {:else if topic.nextReview <= 0}
                                            Now
                                        {:else}
                                            in {formatDuration(
                                                topic.nextReview,
                                            )}
                                        {/if}
                                    </span>
                                </div>
                            </div>
                        </Popover.Content>
                    </Popover.Root>
                {/if}
            </div>
        </div>

        <div class="absolute right-0 top-1/2 -translate-y-1/2">
            {#if isEditMode}
                <GripVertical class="text-muted-foreground cursor-grab" />
            {:else}
                <ConfidenceSelector
                    value={topic.confidence}
                    onChange={(value: number) => updateConfidence(value)}
                    readOnly={canCollapse}
                    confidenceCounts={topic.confidenceCounts! as ConfidenceCounts}
                    topicName={topic.title}
                />
            {/if}
        </div>
    </div>
</div>
