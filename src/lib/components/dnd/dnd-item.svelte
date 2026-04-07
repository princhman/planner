<script lang="ts">
    import type { ConfidenceCounts, Topic } from "./types";
    import type { Id } from "$convex/_generated/dataModel";
    import { createSortable } from "@dnd-kit/svelte/sortable";
    import Button from "../ui/button/button.svelte";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { Check, GripVertical, Pencil, Plus, Trash2 } from "lucide-svelte";
    import Input from "../ui/input/input.svelte";
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import ConfidenceSelector from "../course/confidence-selector.svelte";
    import ItemInfoPopover from "../course/item-info-popover.svelte";
    import * as ContextMenu from "$lib/components/ui/context-menu";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Ellipsis } from "lucide-svelte";
    import { cn } from "$lib/utils";

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
    let contextMenuOpen = $state(false);

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

    const deleteTopic = () => {
        client.mutation(api.topics.deleteTopic, { id: topic.id });
    };

    const addBelow = async () => {
        const newId = await client.mutation(api.topics.addBelow, {
            id: topic.id,
        });

        if (newId) {
            editingTitleId = newId;
        }
    };
</script>

{#snippet itemContent()}
    <div
        {@attach sortable.attach}
        class="group relative w-full flex box-border"
    >
        <div class="flex w-full items-center">
            <div
                class={cn(
                    "flex flex-1 w-full items-center",
                    sortable.isDragSource ? "bg-gray-700" : "max-w-md",
                    contextMenuOpen && "rounded-sm ring-1 ring-primary",
                )}
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
                            onkeydown={(e) =>
                                e.key === "Enter" && updateTitle()}
                        />
                    {:else}
                        <span
                            class="flex-1 min-w-0 truncate max-w-xs md:max-w-sm"
                        >
                            {topic.title}</span
                        >
                    {/if}
                    {#if isEditMode && isEdit}
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={anotherIsEdting}
                            class="w-5 h-5 p-0 {isEdit
                                ? 'visible'
                                : 'lg:invisible'} {!isEdit
                                ? 'lg:group-hover:visible'
                                : ''}"
                            onclick={updateTitle}
                        >
                            <Check />
                        </Button>
                    {:else if topic.isLeaf && !isEditMode}
                        <ItemInfoPopover
                            stability={topic.stability}
                            lastRecallAt={topic.lastRecallAt}
                            r={topic.r}
                            nextReview={topic.nextReview}
                        />
                    {/if}
                </div>
            </div>

            <div class="absolute right-0 top-1/2 -translate-y-1/2">
                {#if isEditMode}
                    <div class="flex items-center gap-0.5">
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger>
                                <Ellipsis
                                    class="text-muted-foreground cursor-pointer lg:invisible lg:group-hover:visible"
                                />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content>
                                {#if editingTitleId === topic.id}
                                    <DropdownMenu.Item onclick={updateTitle}
                                        ><Check /> Save</DropdownMenu.Item
                                    >
                                {:else}
                                    <DropdownMenu.Item
                                        onclick={() =>
                                            (editingTitleId = topic.id)}
                                        ><Pencil /> Edit</DropdownMenu.Item
                                    >
                                {/if}
                                <DropdownMenu.Item onclick={addBelow}
                                    ><Plus /> Add below</DropdownMenu.Item
                                >
                                <DropdownMenu.Item
                                    variant="destructive"
                                    onclick={deleteTopic}
                                    ><Trash2 /> Delete</DropdownMenu.Item
                                >
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>
                        <GripVertical
                            class="text-muted-foreground cursor-grab"
                        />
                    </div>
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
{/snippet}

{#if isEditMode}
    <ContextMenu.Root bind:open={contextMenuOpen}>
        <ContextMenu.Trigger>{@render itemContent()}</ContextMenu.Trigger>
        <ContextMenu.Content>
            {#if editingTitleId === topic.id}
                <ContextMenu.Item onclick={updateTitle}
                    ><Check /> Save</ContextMenu.Item
                >
            {:else}
                <ContextMenu.Item onclick={() => (editingTitleId = topic.id)}
                    ><Pencil /> Edit</ContextMenu.Item
                >
            {/if}
            <ContextMenu.Item onclick={addBelow}
                ><Plus /> Add bellow</ContextMenu.Item
            >
            <ContextMenu.Item variant="destructive" onclick={deleteTopic}
                ><Trash2 /> Delete</ContextMenu.Item
            >
        </ContextMenu.Content>
    </ContextMenu.Root>
{:else}
    {@render itemContent()}
{/if}
