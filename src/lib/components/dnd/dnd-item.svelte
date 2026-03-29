<script lang="ts">
    import type { Topic } from "./types";
    import type { Id } from "$convex/_generated/dataModel";
    import { createSortable } from "@dnd-kit/svelte/sortable";
    import Button from "../ui/button/button.svelte";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { slide } from "svelte/transition";

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
    }
    const { topic, index, isCollapsed, toggleCollapse, canCollapse }: Props =
        $props();

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
        },
    });
</script>

<!-- dragging it would drag a different element, so it would flinch when i start drag-->
<div
    {@attach sortable.attach}
    style:margin-left="{topic.depth * 24}px"
    class="w-full max-w-xs flex box-border {sortable.isDragSource
        ? 'bg-gray-700'
        : ''}"
>
    <div class="w-5 h-5 items-center justify-center shrink-0">
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
    {topic.order}. {topic.title}
</div>
