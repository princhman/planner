<script lang="ts">
    import type { Topic } from "./types";
    import type { Id } from "$convex/_generated/dataModel";
    import { createSortable } from "@dnd-kit/svelte/sortable";
    import Button from "../ui/button/button.svelte";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { Check, Pencil } from "lucide-svelte";
    import Input from "../ui/input/input.svelte";
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";

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
    }
    let {
        topic,
        index,
        isCollapsed,
        toggleCollapse,
        canCollapse,
        editingTitleId = $bindable(),
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
        data: {
            title: topic.title,
            order: topic.order,
            depth: topic.depth,
        },
    });

    const updateTitle = () => {
        client.mutation(api.topics.updateTitle, { id: topic.id, title }); // maybe add optimistic updates later?
        editingTitleId = null;
    };
</script>

<div {@attach sortable.attach} class="group relative w-full flex box-border">
    <div class="flex w-full items-center">
        <div
            class="flex flex-1 w-full items-center max-w-md {sortable.isDragSource
                ? 'bg-gray-700'
                : ''}"
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
                        isEdit ? updateTitle() : (editingTitleId = topic.id)}
                >
                    {#if !isEdit}
                        <Pencil />
                    {:else}
                        <Check />
                    {/if}
                </Button>
            </div>
        </div>

        <div class="absolute right-0 top-1/2 -translate-y-1/2"></div>
    </div>
</div>
